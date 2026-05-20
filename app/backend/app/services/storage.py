import os
import logging
from minio import Minio
from datetime import timedelta
from app.core.config import settings

logger = logging.getLogger(__name__)


endpoint    = settings.MINIO_ENDPOINT
access_key  = settings.MINIO_ACCESS_KEY
secret_key  = settings.MINIO_SECRET_KEY
bucket_name = settings.MINIO_BUCKET_NAME

# Internal client: untuk fput_object via Docker network
minio_client = Minio(
    endpoint=endpoint,
    access_key=access_key,
    secret_key=secret_key,
    secure=False,
)

# External client: untuk generate presigned URL yang bisa diakses browser di luar container
minio_external_client = Minio(
    endpoint="localhost:9000",
    access_key=access_key,
    secret_key=secret_key,
    secure=False,
    region="us-east-1",  # Menggunakan region valid untuk AWS Signature
)

try:
    if not minio_client.bucket_exists(bucket):
        minio_client.make_bucket(bucket)
        logger.info(f"Bucket '{bucket}' berhasil dibuat otomatis.")
except Exception as e:
    logger.error(f"Gagal inisialisasi bucket MinIO: {e}")

def upload_analysis_results(project_id: str, csv_path: str, json_path: str, czi_path: str):
    """Mengunggah ketiga file ke MinIO dan mengembalikan presigned URLs."""
    csv_object = f"{project_id}/{os.path.basename(csv_path)}"
    json_object = f"{project_id}/{os.path.basename(json_path)}"
    czi_object = f"{project_id}/{os.path.basename(czi_path)}"

    # Upload files
    minio_client.fput_object(bucket_name, csv_object, csv_path)
    minio_client.fput_object(bucket_name, json_object, json_path)
    minio_client.fput_object(bucket_name, czi_object, czi_path)

    # Generate URLs (berlaku 24 jam)
    csv_url = minio_external_client.presigned_get_object(
        bucket_name, csv_object, expires=timedelta(hours=24)
    )
    json_url = minio_external_client.presigned_get_object(
        bucket_name, json_object, expires=timedelta(hours=24)
    )

    return {
        "csv_url": csv_url,
        "json_url": json_url
    }
