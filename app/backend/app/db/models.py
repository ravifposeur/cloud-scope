from sqlalchemy import (
    Column, Integer, Text, TIMESTAMP, ForeignKey,
    PrimaryKeyConstraint, Enum as SAEnum, LargeBinary
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from .database import Base


# ---------------------------------------------------------------------------
# Python Enums — mirror the PostgreSQL ENUM types in init-db.sql
# ---------------------------------------------------------------------------

class UserRole(enum.Enum):
    researcher = "researcher"
    viewer = "viewer"


class AuditStatus(enum.Enum):
    success = "success"
    failure = "failure"


class PixelType(enum.Enum):
    uint8   = "uint8"
    uint16  = "uint16"
    uint32  = "uint32"
    float32 = "float32"
    float64 = "float64"
    int8    = "int8"
    int16   = "int16"
    int32   = "int32"


# ---------------------------------------------------------------------------
# Table: users
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, index=True)
    email       = Column(Text, unique=True, nullable=False)
    password    = Column(Text, nullable=False)          # hashed — never plain text
    name        = Column(Text, nullable=False)
    affiliation = Column(Text)
    created_at  = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    project_memberships = relationship("ProjectUser", back_populates="user")
    audit_logs          = relationship("AuditLog", back_populates="user")


# ---------------------------------------------------------------------------
# Table: projects
# ---------------------------------------------------------------------------

class Project(Base):
    __tablename__ = "projects"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(Text, nullable=False)
    description = Column(Text)
    created_at  = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    members    = relationship("ProjectUser", back_populates="project")
    audit_logs = relationship("AuditLog", back_populates="project")


# ---------------------------------------------------------------------------
# Table: project_users  (junction table — many-to-many with role)
# ---------------------------------------------------------------------------

class ProjectUser(Base):
    __tablename__ = "project_users"
    __table_args__ = (
        PrimaryKeyConstraint("project_id", "user_id"),
    )

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    role       = Column(SAEnum(UserRole, name="user_role"), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="members")
    user    = relationship("User", back_populates="project_memberships")


# ---------------------------------------------------------------------------
# Table: audit_logs
# ---------------------------------------------------------------------------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id                  = Column(Integer, primary_key=True, index=True)
    macro_text          = Column(Text, nullable=False)
    imagej_version      = Column(Text, nullable=False)
    bioformats_version  = Column(Text, nullable=False)
    parameters          = Column(Text, nullable=False)
    input_checksum      = Column(Text, nullable=False)   # SHA-256 of input file
    output_checksum     = Column(Text, nullable=False)   # SHA-256 of output CSV
    status              = Column(SAEnum(AuditStatus, name="audit_status"), nullable=False)
    created_at          = Column(TIMESTAMP, server_default=func.now())

    project_id = Column(Integer, ForeignKey("projects.id"))
    user_id    = Column(Integer, ForeignKey("users.id"))

    # Relationships
    project = relationship("Project", back_populates="audit_logs")
    user    = relationship("User", back_populates="audit_logs")


# ---------------------------------------------------------------------------
# Table: metadata
# Sensitive fields (operator_name, instrument_serial, clinical_notes) are
# stored as BYTEA — encrypted by pgp_sym_encrypt() before insert.
# ---------------------------------------------------------------------------

class Metadata(Base):
    __tablename__ = "metadata"

    id                 = Column(Integer, primary_key=True, index=True)

    # Encrypted sensitive fields (BYTEA — output of pgp_sym_encrypt)
    operator_name      = Column(LargeBinary, nullable=False)
    instrument_serial  = Column(LargeBinary, nullable=False)
    clinical_notes     = Column(LargeBinary)                  # nullable

    # Safe public fields — stored as plain integers/text
    size_x             = Column(Integer, nullable=False)
    size_y             = Column(Integer, nullable=False)
    size_z             = Column(Integer, nullable=False)
    size_c             = Column(Integer, nullable=False)
    pixel_type         = Column(SAEnum(PixelType, name="pixel_type"), nullable=False)
    dimension_order    = Column(Text, nullable=False)