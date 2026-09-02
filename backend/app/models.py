from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(120), nullable=False)

    phone = Column(
        String(20),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    role = Column(
        String(20),
        nullable=False,
        default="ASHA",
    )

    village = Column(
        String(160),
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )


class Patient(Base):
    __tablename__ = "patients"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    offline_id = Column(
        String(64),
        unique=True,
        nullable=True,
        index=True,
    )

    name = Column(
        String(160),
        nullable=False,
    )

    age = Column(
        Integer,
        nullable=False,
    )

    gender = Column(
        String(30),
        nullable=True,
    )

    pregnancy_status = Column(
        String(50),
        nullable=True,
    )

    village = Column(
        String(160),
        nullable=True,
    )

    phone = Column(
        String(20),
        nullable=True,
    )

    created_by_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    screenings = relationship(
        "Screening",
        back_populates="patient",
        cascade="all, delete-orphan",
    )


class Screening(Base):
    __tablename__ = "screenings"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False,
    )

    asha_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    image_path = Column(
        String(500),
        nullable=False,
    )

    image_quality = Column(
        String(30),
        nullable=False,
    )

    quality_notes = Column(
        String(500),
        nullable=True,
    )

    risk_level = Column(
        String(20),
        nullable=False,
    )

    confidence = Column(
        Float,
        nullable=False,
    )

    model_version = Column(
        String(100),
        nullable=False,
    )

    screened_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    patient = relationship(
        "Patient",
        back_populates="screenings",
    )

    referral = relationship(
        "Referral",
        back_populates="screening",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    screening_id = Column(
        Integer,
        ForeignKey("screenings.id"),
        unique=True,
        nullable=False,
    )

    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False,
    )

    assigned_to = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    status = Column(
        String(20),
        default="PENDING",
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    due_date = Column(
        DateTime,
        nullable=False,
    )

    resolved_at = Column(
        DateTime,
        nullable=True,
    )

    notes = Column(
        String(2000),
        nullable=True,
    )

    screening = relationship(
        "Screening",
        back_populates="referral",
    )