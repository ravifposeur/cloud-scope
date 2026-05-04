FROM python:3.10-slim

# Hindari file .pyc dan pastikan stdout/stderr langsung muncul di log Docker
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /backend

# Install dependencies terlebih dahulu (layer ini di-cache jika requirements tidak berubah)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin source code
COPY ./app ./app

# Buat direktori temp yang dibutuhkan aplikasi
RUN mkdir -p /tmp/cloudscope

# Expose port FastAPI
EXPOSE 8000

# Default: jalankan FastAPI
# Untuk menjalankan Celery worker, override CMD di docker-compose.yml
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]