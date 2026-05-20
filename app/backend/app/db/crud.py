import os
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models import AuditLog, AuditStatus, Metadata, PixelType

logger = logging.getLogger(__name__)

DB_ENCRYPTION_KEY = os.getenv("DB_ENCRYPTION_KEY", "dev-secret-key-change-in-production")

def get_audit_log(db: Session, task_id: str):
    """Mengecek apakah log untuk task ini sudah ada."""
    return db.query(AuditLog).filter(AuditLog.input_checksum == task_id).first()

def save_analysis_result(db: Session, task_id: str, result_data: dict):
    """Menyimpan log audit dan mengenkripsi data privasi ke PostgreSQL."""
    sensitive = result_data.get("sensitive_metadata", {})

    try:
        # --- 1. Simpan Encrypted Metadata ---
        metadata_record = Metadata(
            operator_name=func.pgp_sym_encrypt(
                sensitive.get("operator_name", "unknown"), DB_ENCRYPTION_KEY
            ),
            instrument_serial=func.pgp_sym_encrypt(
                sensitive.get("instrument_serial", "unknown"), DB_ENCRYPTION_KEY
            ),
            clinical_notes=func.pgp_sym_encrypt(
                sensitive.get("clinical_notes", ""), DB_ENCRYPTION_KEY
            ) if sensitive.get("clinical_notes") else None,

            size_x=int(sensitive.get("size_x", 0)),
            size_y=int(sensitive.get("size_y", 0)),
            size_z=int(sensitive.get("size_z", 1)),
            size_c=int(sensitive.get("size_c", 1)),
            pixel_type=PixelType.uint8,
            dimension_order=sensitive.get("dimension_order", "XYCZT"),
        )
        db.add(metadata_record)

        # --- 2. Simpan Audit Log ---
        audit_record = AuditLog(
            macro_text=sensitive.get("macro_text", "analysis.ijm"),
            imagej_version=sensitive.get("imagej_version", "unknown"),
            bioformats_version=sensitive.get("bioformats_version", "unknown"),
            parameters=json.dumps({"project_id": result_data.get("project_id", "DEFAULT")}),
            input_checksum=task_id,
            output_checksum=sensitive.get("output_checksum", "unknown"),
            status=AuditStatus.success,
        )
        db.add(audit_record)

        db.commit()
        logger.info(f"[{task_id}] Audit log & encrypted metadata tersimpan di DB.")

    except Exception as e:
        db.rollback()
        logger.error(f"[{task_id}] Gagal menyimpan ke DB: {e}")
