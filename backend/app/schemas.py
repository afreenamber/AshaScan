from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# =========================
# USER
# =========================

class UserCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=120,
    )

    phone: str = Field(
        min_length=8,
        max_length=20,
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    role: str = "ASHA"

    village: Optional[str] = None


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    role: str
    village: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True
    )


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# =========================
# PATIENT
# =========================

class PatientCreate(BaseModel):
    offline_id: Optional[str] = None

    name: str = Field(
        min_length=2,
        max_length=160,
    )

    age: int = Field(
        ge=0,
        le=120,
    )

    gender: Optional[str] = None

    pregnancy_status: Optional[str] = None

    village: Optional[str] = None

    phone: Optional[str] = None


class PatientOut(PatientCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


# =========================
# SCREENING
# =========================

class ScreeningOut(BaseModel):
    id: int
    patient_id: int

    image_quality: str

    quality_notes: Optional[str] = None

    risk_level: str

    confidence: float

    model_version: str

    screened_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


# =========================
# REFERRAL
# =========================

class ReferralOut(BaseModel):
    id: int

    screening_id: int

    patient_id: int

    assigned_to: Optional[int] = None

    status: str

    due_date: datetime

    resolved_at: Optional[datetime] = None

    notes: Optional[str] = None

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class ReferralUpdate(BaseModel):
    status: str

    assigned_to: Optional[int] = None

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )


# =========================
# OFFLINE SYNC
# =========================

class SyncRequest(BaseModel):
    patients: list[PatientCreate] = Field(
        default_factory=list
    )