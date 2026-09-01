import hashlib
import os
import uuid
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageStat
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Patient, Referral, Screening, User
from .schemas import (
    PatientCreate,
    PatientOut,
    ReferralOut,
    ReferralUpdate,
    ScreeningOut,
    SyncRequest,
    Token,
    UserCreate,
    UserOut,
)
from .security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

Base.metadata.create_all(bind=engine)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# When ML teammate's FastAPI service runs separately:
# AI_SERVICE_URL=http://127.0.0.1:8001/predict
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "")
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"

app = FastAPI(
    title="AshaScan API",
    description="Backend API for AshaScan",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this before deployment
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


def update_overdue_referrals(db: Session):
    referrals = db.query(Referral).filter(
        Referral.status.in_(["PENDING", "REFERRED"]),
        Referral.due_date < datetime.utcnow(),
    ).all()

    for referral in referrals:
        referral.status = "OVERDUE"

    db.commit()


def check_image_quality(image_bytes: bytes):
    try:
        image = Image.open(BytesIO(image_bytes)).convert("L")
        brightness = ImageStat.Stat(image).mean[0]

        if brightness < 45:
            return "REJECTED", "Image is too dark. Capture in better light."

        if brightness > 235:
            return "REJECTED", "Image is overexposed. Avoid direct flash."

        return "ACCEPTED", None
    except Exception:
        return "REJECTED", "Image could not be read. Please capture again."


async def get_ai_prediction(image_path: Path):
    if AI_SERVICE_URL:
        async with httpx.AsyncClient(timeout=30) as client:
            with image_path.open("rb") as image_file:
                response = await client.post(
                    AI_SERVICE_URL,
                    files={"file": (image_path.name, image_file, "image/jpeg")},
                )

        if response.status_code == 400:
            raise HTTPException(
                status_code=422,
                detail=response.json(),
            )

        response.raise_for_status()
        data = response.json()

        # Existing ML API: low / moderate / high
        risk_map = {
            "low": "green",
            "moderate": "yellow",
            "high": "red",
        }

        ml_risk = str(data["risk_level"]).lower()

        if ml_risk not in risk_map:
            raise HTTPException(
                status_code=502,
                detail="ML service returned an invalid risk level",
            )

        return (
            risk_map[ml_risk],
            float(data["confidence"]),
            "ml-anemia-model",
        )

    if not DEMO_MODE:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured",
        )

    # Hackathon UI demo only — not a medical prediction.
    value = int(hashlib.sha256(image_path.read_bytes()).hexdigest()[:2], 16)
    risk_level = ["green", "yellow", "red"][value % 3]
    confidence = round(0.65 + (value % 30) / 100, 2)

    return risk_level, confidence, "demo-not-clinical"


@app.get("/")
def root():
    return {"message": "AshaScan backend is running!"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "ai_service_configured": bool(AI_SERVICE_URL),
        "demo_mode": DEMO_MODE,
    }


@app.post("/auth/register", response_model=UserOut, status_code=201)
def register_user(data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.phone == data.phone).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="A user with this phone number already exists",
        )

    user = User(
        name=data.name,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role=data.role.upper(),
        village=data.village,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@app.post("/auth/login", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.phone == form.username).first()

    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect phone number or password",
        )

    return Token(access_token=create_access_token(user))


@app.get("/auth/me", response_model=UserOut)
def current_profile(user: User = Depends(get_current_user)):
    return user


@app.post("/patients", response_model=PatientOut, status_code=201)
def create_patient(
    data: PatientCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.offline_id:
        existing = db.query(Patient).filter(
            Patient.offline_id == data.offline_id
        ).first()

        if existing:
            return existing

    patient = Patient(
        **data.model_dump(),
        created_by_id=user.id,
    )

    db.add(patient)
    db.commit()
    db.refresh(patient)

    return patient


@app.get("/patients", response_model=list[PatientOut])
def list_patients(
    search: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Patient)

    if search:
        query = query.filter(Patient.name.ilike(f"%{search}%"))

    return query.order_by(Patient.created_at.desc()).limit(100).all()


@app.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = db.get(Patient, patient_id)

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return patient


@app.post(
    "/patients/{patient_id}/screenings",
    response_model=ScreeningOut,
    status_code=201,
)
async def create_screening(
    patient_id: int,
    image: UploadFile = File(...),
    capture_site: str = Form("eyelid"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if capture_site not in {"eyelid", "nail_bed"}:
        raise HTTPException(
            status_code=422,
            detail="capture_site must be eyelid or nail_bed",
        )

    patient = db.get(Patient, patient_id)

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if image.content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
    }:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WebP image",
        )

    image_bytes = await image.read()

    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image must be 8 MB or smaller",
        )

    quality, quality_notes = check_image_quality(image_bytes)

    if quality != "ACCEPTED":
        raise HTTPException(
            status_code=422,
            detail={
                "image_quality": quality,
                "quality_notes": quality_notes,
            },
        )

    suffix = Path(image.filename or "photo.jpg").suffix or ".jpg"
    image_name = f"{uuid.uuid4().hex}{suffix.lower()}"
    image_path = UPLOAD_DIR / image_name
    image_path.write_bytes(image_bytes)

    risk_level, confidence, model_version = await get_ai_prediction(image_path)

    screening = Screening(
        patient_id=patient_id,
        asha_id=user.id,
        image_path=f"/uploads/{image_name}",
        image_quality=quality,
        quality_notes=quality_notes,
        risk_level=risk_level,
        confidence=confidence,
        model_version=model_version,
    )

    db.add(screening)
    db.flush()

    # Yellow/red automatically become referral cases.
    if risk_level in {"yellow", "red"}:
        due_days = 2 if risk_level == "red" else 7

        referral = Referral(
            screening_id=screening.id,
            patient_id=patient_id,
            status="PENDING",
            due_date=datetime.utcnow() + timedelta(days=due_days),
        )

        db.add(referral)

    db.commit()
    db.refresh(screening)

    return screening


@app.get(
    "/patients/{patient_id}/screenings",
    response_model=list[ScreeningOut],
)
def patient_screenings(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Screening)
        .filter(Screening.patient_id == patient_id)
        .order_by(Screening.screened_at.desc())
        .all()
    )


@app.get("/referrals", response_model=list[ReferralOut])
def list_referrals(
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    update_overdue_referrals(db)

    query = db.query(Referral)

    if status:
        query = query.filter(Referral.status == status.upper())

    return query.order_by(Referral.due_date).all()


@app.patch("/referrals/{referral_id}", response_model=ReferralOut)
def update_referral(
    referral_id: int,
    data: ReferralUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in {"ANM", "PHC", "ADMIN"}:
        raise HTTPException(
            status_code=403,
            detail="Only ANM, PHC, or admin users can update referrals",
        )

    allowed_statuses = {"PENDING", "REFERRED", "OVERDUE", "RESOLVED"}
    new_status = data.status.upper()

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=422,
            detail="Invalid referral status",
        )

    referral = db.get(Referral, referral_id)

    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")

    referral.status = new_status
    referral.notes = data.notes

    if data.assigned_to is not None:
        referral.assigned_to = data.assigned_to

    if new_status == "RESOLVED":
        referral.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(referral)

    return referral


@app.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    update_overdue_referrals(db)

    return {
        "total_patients": db.query(Patient).count(),
        "total_screenings": db.query(Screening).count(),
        "referrals": {
            "pending": db.query(Referral).filter(
                Referral.status == "PENDING"
            ).count(),
            "referred": db.query(Referral).filter(
                Referral.status == "REFERRED"
            ).count(),
            "overdue": db.query(Referral).filter(
                Referral.status == "OVERDUE"
            ).count(),
            "resolved": db.query(Referral).filter(
                Referral.status == "RESOLVED"
            ).count(),
        },
    }


@app.post("/sync/patients")
def sync_patients(
    data: SyncRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient_id_map = {}

    for item in data.patients:
        if not item.offline_id:
            raise HTTPException(
                status_code=422,
                detail="Every offline patient needs offline_id",
            )

        patient = db.query(Patient).filter(
            Patient.offline_id == item.offline_id
        ).first()

        if not patient:
            patient = Patient(
                **item.model_dump(),
                created_by_id=user.id,
            )
            db.add(patient)
            db.flush()

        patient_id_map[item.offline_id] = patient.id

    db.commit()

    return {
        "message": "Offline patients synced successfully",
        "patient_id_map": patient_id_map,
    }