import os
from celery import Celery

# Ambil URL Redis dari environment variable (fallback ke localhost untuk dev lokal)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

celery = Celery(
    "cloudscope_worker",
    broker=f"{REDIS_URL}/0",
    backend=f"{REDIS_URL}/1",
    include=["app.tasks"],  # Pastikan tasks ter-autodiscover
)

celery.conf.update(
    # --- Konkurensi & Timeout ---
    worker_concurrency=4,
    task_soft_time_limit=240,   # Kirim sinyal SoftTimeLimitExceeded di detik ke-240
    task_time_limit=300,        # Hard kill di detik ke-300

    # --- Keandalan ---
    task_acks_late=True,        # Task baru di-ack setelah selesai, bukan saat diterima
    task_reject_on_worker_lost=True,  # Re-queue task jika worker mati mendadak

    # --- Serialisasi ---
    accept_content=["json"],
    task_serializer="json",
    result_serializer="json",

    # --- Result Backend ---
    result_expires=3600,        # Hasil di Redis otomatis terhapus setelah 1 jam

    # --- Monitoring ---
    worker_send_task_events=True,   # Aktifkan event untuk Flower monitoring
    task_send_sent_event=True,
)