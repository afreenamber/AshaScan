import hashlib
import os
import uuid

from datetime import datetime, timedelta

from io import BytesIO

from pathlib import Path

import httpx

from dotenv import load_dotenv

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from fastapi.middleware.cors import CORSMiddleware

from fastapi.security import OAuth2PasswordRequestForm

from fastapi.staticfiles import StaticFiles

from PIL import Image, ImageStat

from sqlalchemy.orm import Session

from .database import (
    Base,
    engine,
    get_db,
)

from .models import (
    Patient,
    Referral,
    Screening,
    User,
)

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


# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

Base.metadata.create_all(
    bind=engine
)


UPLOAD_DIR = Path("uploads")

UPLOAD_DIR.mkdir(
    exist_ok=True
)


AI_SERVICE_URL = os.getenv(
    "AI_SERVICE_URL",
    "",
).strip()


DEMO_MODE = (
    os.getenv(
        "DEMO_MODE",
        "true",
    ).lower()
    == "true"
)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="AshaScan API",
    description=(
        "Backend API for AshaScan — "
        "AI-assisted anemia screening "
        "and referral tracking."
    ),
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=False,

    allow_methods=["*"],

    allow_headers=["*"],
)


app.mount(
    "/uploads",
    StaticFiles(
        directory="uploads"
    ),
    name="uploads",
)


# ============================================================
# HELPER: OVERDUE REFERRALS
# ============================================================

def update_overdue_referrals(
    db: Session,
):

    referrals = (
        db.query(Referral)
        .filter(
            Referral.status.in_(
                [
                    "PENDING",
                    "REFERRED",
                ]
            ),
            Referral.due_date
            < datetime.utcnow(),
        )
        .all()
    )

    changed = False

    for referral in referrals:

        referral.status = "OVERDUE"

        changed = True

    if changed:

        db.commit()


# ============================================================
# HELPER: IMAGE QUALITY
# ============================================================

def check_image_quality(
    image_bytes: bytes,
):

    try:

        image = Image.open(
            BytesIO(image_bytes)
        ).convert("L")

        brightness = ImageStat.Stat(
            image
        ).mean[0]

        if brightness < 45:

            return (
                "REJECTED",
                "Image is too dark. "
                "Capture in better light.",
            )

        if brightness > 235:

            return (
                "REJECTED",
                "Image is overexposed. "
                "Avoid direct flash.",
            )

        return (
            "ACCEPTED",
            None,
        )

    except Exception:

        return (
            "REJECTED",
            "Image could not be read. "
            "Please capture again.",
        )


# ============================================================
# HELPER: FIND ANM
# ============================================================

def find_anm(
    db: Session,
    village: str | None = None,
):

    query = db.query(User).filter(
        User.role == "ANM"
    )

    if village:

        village_anm = (
            query.filter(
                User.village == village
            )
            .first()
        )

        if village_anm:

            return village_anm

    return query.first()


# ============================================================
# HELPER: AI PREDICTION
# ============================================================

async def get_ai_prediction(
    image_path: Path,
):

    # --------------------------------------------------------
    # REAL ML SERVICE
    # --------------------------------------------------------

    if AI_SERVICE_URL:

        try:

            async with httpx.AsyncClient(
                timeout=30
            ) as client:

                with image_path.open(
                    "rb"
                ) as image_file:

                    response = await client.post(
                        AI_SERVICE_URL,

                        files={
                            "file": (
                                image_path.name,
                                image_file,
                                "image/jpeg",
                            )
                        },
                    )

        except httpx.RequestError as exc:

            raise HTTPException(
                status_code=503,
                detail=(
                    "Could not connect to "
                    f"AI service: {exc}"
                ),
            )

        if response.status_code == 400:

            try:

                detail = response.json()

            except Exception:

                detail = {
                    "message":
                    "Image failed AI quality checks"
                }

            raise HTTPException(
                status_code=422,
                detail=detail,
            )

        try:

            response.raise_for_status()

        except httpx.HTTPStatusError:

            raise HTTPException(
                status_code=502,
                detail=(
                    "AI service returned "
                    f"HTTP {response.status_code}"
                ),
            )

        try:

            data = response.json()

        except Exception:

            raise HTTPException(
                status_code=502,
                detail="AI service returned invalid JSON",
            )

        risk_map = {
            "low": "green",
            "moderate": "yellow",
            "high": "red",
        }

        if "risk_level" not in data:

            raise HTTPException(
                status_code=502,
                detail=(
                    "AI service response is "
                    "missing risk_level"
                ),
            )

        ml_risk = str(
            data["risk_level"]
        ).lower()

        if ml_risk not in risk_map:

            raise HTTPException(
                status_code=502,
                detail=(
                    "AI service returned "
                    "an invalid risk level"
                ),
            )

        confidence = float(
            data["confidence"]
        )

        confidence = max(
            0.0,
            min(
                1.0,
                confidence,
            ),
        )

        return (
            risk_map[ml_risk],
            confidence,
            "ml-anemia-model",
        )

    # --------------------------------------------------------
    # NO ML SERVICE + DEMO DISABLED
    # --------------------------------------------------------

    if not DEMO_MODE:

        raise HTTPException(
            status_code=503,
            detail=(
                "AI service is not configured "
                "and demo mode is disabled."
            ),
        )

    # --------------------------------------------------------
    # DEMO MODE
    # --------------------------------------------------------

    # IMPORTANT:
    # This is ONLY for UI/backend testing.
    # It is NOT a medical prediction.

    value = int(
        hashlib.sha256(
            image_path.read_bytes()
        ).hexdigest()[:2],
        16,
    )

    risk_level = [
        "green",
        "yellow",
        "red",
    ][value % 3]

    confidence = round(
        0.65
        + (value % 30) / 100,
        2,
    )

    return (
        risk_level,
        confidence,
        "demo-not-clinical",
    )


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message":
        "AshaScan backend is running!"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",

        "ai_service_configured":
        bool(AI_SERVICE_URL),

        "demo_mode":
        DEMO_MODE,
    }


# ============================================================
# AUTH — REGISTER
# ============================================================

@app.post(
    "/auth/register",
    response_model=UserOut,
    status_code=201,
)
def register_user(
    data: UserCreate,
    db: Session = Depends(get_db),
):

    allowed_roles = {
        "ASHA",
        "ANM",
        "PHC",
    }

    role = data.role.upper()

    if role not in allowed_roles:

        raise HTTPException(
            status_code=422,
            detail=(
                "Role must be ASHA, ANM, or PHC"
            ),
        )

    existing_user = (
        db.query(User)
        .filter(
            User.phone == data.phone
        )
        .first()
    )

    if existing_user:

        raise HTTPException(
            status_code=409,
            detail=(
                "A user with this phone "
                "number already exists"
            ),
        )

    user = User(
        name=data.name,
        phone=data.phone,
        password_hash=hash_password(
            data.password
        ),
        role=role,
        village=data.village,
    )

    db.add(user)

    db.commit()

    db.refresh(user)

    return user


# ============================================================
# AUTH — LOGIN
# ============================================================

@app.post(
    "/auth/login",
    response_model=Token,
)
def login(
    form: OAuth2PasswordRequestForm =
    Depends(),

    db: Session =
    Depends(get_db),
):

    user = (
        db.query(User)
        .filter(
            User.phone == form.username
        )
        .first()
    )

    if (
        not user
        or not verify_password(
            form.password,
            user.password_hash,
        )
    ):

        raise HTTPException(
            status_code=401,
            detail=(
                "Incorrect phone number "
                "or password"
            ),
        )

    return Token(
        access_token=create_access_token(
            user
        )
    )


# ============================================================
# AUTH — CURRENT USER
# ============================================================

@app.get(
    "/auth/me",
    response_model=UserOut,
)
def current_profile(
    user: User =
    Depends(get_current_user),
):

    return user


# ============================================================
# PATIENT — CREATE
# ============================================================

@app.post(
    "/patients",
    response_model=PatientOut,
    status_code=201,
)
def create_patient(
    data: PatientCreate,

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    if data.offline_id:

        existing = (
            db.query(Patient)
            .filter(
                Patient.offline_id
                == data.offline_id
            )
            .first()
        )

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


# ============================================================
# PATIENT — LIST
# ============================================================

@app.get(
    "/patients",
    response_model=list[PatientOut],
)
def list_patients(
    search: str | None = None,

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    query = db.query(Patient)

    if search:

        query = query.filter(
            Patient.name.ilike(
                f"%{search}%"
            )
        )

    return (
        query
        .order_by(
            Patient.created_at.desc()
        )
        .limit(100)
        .all()
    )


# ============================================================
# PATIENT — GET ONE
# ============================================================

@app.get(
    "/patients/{patient_id}",
    response_model=PatientOut,
)
def get_patient(
    patient_id: int,

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    patient = db.get(
        Patient,
        patient_id,
    )

    if not patient:

        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    return patient


# ============================================================
# SCREENING — CREATE
# ============================================================

@app.post(
    "/patients/{patient_id}/screenings",
    response_model=ScreeningOut,
    status_code=201,
)
async def create_screening(

    patient_id: int,

    image: UploadFile =
    File(...),

    capture_site: str =
    Form("eyelid"),

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    # --------------------------------------------------------
    # Validate capture site
    # --------------------------------------------------------

    if capture_site not in {
        "eyelid",
        "nail_bed",
    }:

        raise HTTPException(
            status_code=422,
            detail=(
                "capture_site must be "
                "eyelid or nail_bed"
            ),
        )

    # --------------------------------------------------------
    # Check patient
    # --------------------------------------------------------

    patient = db.get(
        Patient,
        patient_id,
    )

    if not patient:

        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    # --------------------------------------------------------
    # Check file type
    # --------------------------------------------------------

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    if image.content_type not in allowed_types:

        raise HTTPException(
            status_code=415,
            detail=(
                "Upload a JPEG, PNG, "
                "or WebP image"
            ),
        )

    # --------------------------------------------------------
    # Read image
    # --------------------------------------------------------

    image_bytes = await image.read()

    if len(image_bytes) > 8 * 1024 * 1024:

        raise HTTPException(
            status_code=413,
            detail=(
                "Image must be "
                "8 MB or smaller"
            ),
        )

    # --------------------------------------------------------
    # Basic quality check
    # --------------------------------------------------------

    quality, quality_notes = (
        check_image_quality(
            image_bytes
        )
    )

    if quality != "ACCEPTED":

        raise HTTPException(
            status_code=422,
            detail={
                "image_quality":
                quality,

                "quality_notes":
                quality_notes,
            },
        )

    # --------------------------------------------------------
    # Save image
    # --------------------------------------------------------

    suffix = (
        Path(
            image.filename
            or "photo.jpg"
        ).suffix
        or ".jpg"
    )

    image_name = (
        f"{uuid.uuid4().hex}"
        f"{suffix.lower()}"
    )

    image_path = (
        UPLOAD_DIR
        / image_name
    )

    image_path.write_bytes(
        image_bytes
    )

    # --------------------------------------------------------
    # AI
    # --------------------------------------------------------

    try:

        (
            risk_level,
            confidence,
            model_version,
        ) = await get_ai_prediction(
            image_path
        )

    except Exception:

        # If AI fails, don't leave an
        # unusable orphan image.

        if image_path.exists():

            image_path.unlink()

        raise

    # --------------------------------------------------------
    # Save screening
    # --------------------------------------------------------

    screening = Screening(
        patient_id=patient_id,

        asha_id=user.id,

        image_path=(
            f"/uploads/{image_name}"
        ),

        image_quality=quality,

        quality_notes=quality_notes,

        risk_level=risk_level,

        confidence=confidence,

        model_version=model_version,
    )

    db.add(screening)

    db.flush()

    # --------------------------------------------------------
    # AUTOMATIC REFERRAL
    # --------------------------------------------------------

    if risk_level in {
        "yellow",
        "red",
    }:

        due_days = (
            2
            if risk_level == "red"
            else 7
        )

        anm = find_anm(
            db,
            patient.village,
        )

        referral = Referral(

            screening_id=screening.id,

            patient_id=patient_id,

            assigned_to=(
                anm.id
                if anm
                else None
            ),

            status="PENDING",

            due_date=(
                datetime.utcnow()
                + timedelta(
                    days=due_days
                )
            ),
        )

        db.add(referral)

    # --------------------------------------------------------
    # Commit everything
    # --------------------------------------------------------

    db.commit()

    db.refresh(screening)

    return screening


# ============================================================
# SCREENING — PATIENT HISTORY
# ============================================================

@app.get(
    "/patients/{patient_id}/screenings",
    response_model=list[ScreeningOut],
)
def patient_screenings(

    patient_id: int,

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    patient = db.get(
        Patient,
        patient_id,
    )

    if not patient:

        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    return (
        db.query(Screening)
        .filter(
            Screening.patient_id
            == patient_id
        )
        .order_by(
            Screening.screened_at.desc()
        )
        .all()
    )


# ============================================================
# REFERRALS — LIST
# ============================================================

@app.get(
    "/referrals",
    response_model=list[ReferralOut],
)
def list_referrals(

    status: str | None = None,

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    update_overdue_referrals(db)

    query = db.query(
        Referral
    )

    if status:

        query = query.filter(
            Referral.status
            == status.upper()
        )

    # ANM sees assigned referrals.
    if user.role == "ANM":

        query = query.filter(
            Referral.assigned_to
            == user.id
        )

    return (
        query
        .order_by(
            Referral.due_date
        )
        .all()
    )


# ============================================================
# REFERRAL — UPDATE
# ============================================================

@app.patch(
    "/referrals/{referral_id}",
    response_model=ReferralOut,
)
def update_referral(

    referral_id: int,

    data: ReferralUpdate,

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    if user.role not in {
        "ANM",
        "PHC",
    }:

        raise HTTPException(
            status_code=403,
            detail=(
                "Only ANM or PHC "
                "users can update referrals"
            ),
        )

    allowed_statuses = {
        "PENDING",
        "REFERRED",
        "OVERDUE",
        "RESOLVED",
    }

    new_status = data.status.upper()

    if new_status not in allowed_statuses:

        raise HTTPException(
            status_code=422,
            detail="Invalid referral status",
        )

    referral = db.get(
        Referral,
        referral_id,
    )

    if not referral:

        raise HTTPException(
            status_code=404,
            detail="Referral not found",
        )

    # ANM can only update assigned cases.
    if (
        user.role == "ANM"
        and referral.assigned_to
        not in {
            None,
            user.id,
        }
    ):

        raise HTTPException(
            status_code=403,
            detail=(
                "You are not assigned "
                "to this referral"
            ),
        )

    referral.status = new_status

    if data.notes is not None:

        referral.notes = data.notes

    if data.assigned_to is not None:

        assigned_user = db.get(
            User,
            data.assigned_to,
        )

        if not assigned_user:

            raise HTTPException(
                status_code=404,
                detail="Assigned user not found",
            )

        if assigned_user.role not in {
            "ANM",
            "PHC",
        }:

            raise HTTPException(
                status_code=422,
                detail=(
                    "Referral can only "
                    "be assigned to ANM "
                    "or PHC"
                ),
            )

        referral.assigned_to = (
            assigned_user.id
        )

    if new_status == "RESOLVED":

        referral.resolved_at = (
            datetime.utcnow()
        )

    else:

        referral.resolved_at = None

    db.commit()

    db.refresh(referral)

    return referral


# ============================================================
# DASHBOARD — SUMMARY
# ============================================================

@app.get("/dashboard")
def dashboard(

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    update_overdue_referrals(db)

    query = db.query(
        Referral
    )

    if user.role == "ANM":

        query = query.filter(
            Referral.assigned_to
            == user.id
        )

    return {
        "total_patients":
            db.query(Patient).count(),

        "total_screenings":
            db.query(Screening).count(),

        "referrals": {

            "pending":
                query.filter(
                    Referral.status
                    == "PENDING"
                ).count(),

            "referred":
                query.filter(
                    Referral.status
                    == "REFERRED"
                ).count(),

            "overdue":
                query.filter(
                    Referral.status
                    == "OVERDUE"
                ).count(),

            "resolved":
                query.filter(
                    Referral.status
                    == "RESOLVED"
                ).count(),
        },
    }


# ============================================================
# DASHBOARD — CASE LIST
# ============================================================

@app.get(
    "/dashboard/cases"
)
def dashboard_cases(

    status: str | None = None,

    risk: str | None = None,

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    if user.role not in {
        "ANM",
        "PHC",
    }:

        raise HTTPException(
            status_code=403,
            detail=(
                "Only ANM or PHC "
                "users can access "
                "the case dashboard"
            ),
        )

    update_overdue_referrals(db)

    query = (
        db.query(
            Referral,
            Patient,
            Screening,
        )

        .join(
            Patient,
            Referral.patient_id
            == Patient.id,
        )

        .join(
            Screening,
            Referral.screening_id
            == Screening.id,
        )
    )

    if user.role == "ANM":

        query = query.filter(
            Referral.assigned_to
            == user.id
        )

    if status:

        query = query.filter(
            Referral.status
            == status.upper()
        )

    if risk:

        query = query.filter(
            Screening.risk_level
            == risk.lower()
        )

    results = (
        query
        .order_by(
            Referral.due_date
        )
        .all()
    )

    return [

        {
            "referral_id":
                referral.id,

            "patient_id":
                patient.id,

            "patient_name":
                patient.name,

            "age":
                patient.age,

            "gender":
                patient.gender,

            "village":
                patient.village,

            "risk_level":
                screening.risk_level,

            "confidence":
                screening.confidence,

            "status":
                referral.status,

            "due_date":
                referral.due_date,

            "created_at":
                referral.created_at,

            "resolved_at":
                referral.resolved_at,

            "notes":
                referral.notes,

        }

        for (
            referral,
            patient,
            screening,
        ) in results
    ]


# ============================================================
# OFFLINE SYNC — PATIENTS
# ============================================================

@app.post(
    "/sync/patients"
)
def sync_patients(

    data: SyncRequest,

    db: Session =
    Depends(get_db),

    user: User =
    Depends(get_current_user),
):

    patient_id_map = {}

    for item in data.patients:

        if not item.offline_id:

            raise HTTPException(
                status_code=422,
                detail=(
                    "Every offline patient "
                    "needs offline_id"
                ),
            )

        patient = (
            db.query(Patient)
            .filter(
                Patient.offline_id
                == item.offline_id
            )
            .first()
        )

        if not patient:

            patient = Patient(
                **item.model_dump(),
                created_by_id=user.id,
            )

            db.add(patient)

            db.flush()

        patient_id_map[
            item.offline_id
        ] = patient.id

    db.commit()

    return {
        "message":
            "Offline patients synced successfully",

        "patient_id_map":
            patient_id_map,
    }