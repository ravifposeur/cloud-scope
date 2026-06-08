Berikut dokumen lengkap hasil penggabungan dengan gaya logo tech stack (menggunakan badge/shields.io) dan bagian deployment diubah ke versi lama (dengan Cloudflare Tunnel).

---

# 🔬 CloudScope

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![Celery](https://img.shields.io/badge/Celery-5.3+-brightgreen.svg)](https://docs.celeryq.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-316192.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D.svg)](https://redis.io/)
[![MinIO](https://img.shields.io/badge/MinIO-S3--compatible-C72A48.svg)](https://min.io/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Tunnel-F38020.svg)](https://www.cloudflare.com/)
[![License](https://img.shields.io/badge/License-GNU-yellow.svg)](LICENSE)

**CloudScope** adalah arsitektur *backend* modular berbasis **microservices** untuk memproses dan mengorkestrasi analisis berkas gambar mikroskopi (seperti `.czi`, `.tif`, `.lif`). 

Sistem ini dirancang dengan prinsip desentralisasi dan kemandirian data, memanfaatkan:
- 🔄 Antrean asinkron (Celery + Redis) untuk komputasi berat
- 🗄️ Sistem penyimpanan objek internal (MinIO)
- 🔒 Mesin privasi untuk membersihkan metadata sensitif (*scrubbing*) sebelum hasil analisis disimpan
- 🌐 Akses global tanpa NAT/port forwarding (Cloudflare Tunnel)

---

## 📚 Daftar Isi
- [Fitur Utama](#fitur-utama)
- [Arsitektur Singkat](#arsitektur-singkat)
- [Teknologi](#teknologi)
- [Prasyarat](#prasyarat)
- [Instalasi & Konfigurasi](#instalasi--konfigurasi)
- [Menjalankan Sistem](#menjalankan-sistem)
- [Menggunakan API](#menggunakan-api)
- [Pemeliharaan (Garbage Collection)](#pemeliharaan-garbage-collection)
- [Kontribusi](#kontribusi)
- [Lisensi](#lisensi)

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|-------|------------|
| 📤 Unggah asinkron | File besar langsung disimpan ke MinIO + task Celery |
| 🧹 Pembersih metadata | Otomatis hapus data sensitif dari hasil analisis |
| 📊 Log audit lengkap | Setiap aksi tercatat di PostgreSQL |
| 🐳 Siap produksi | Docker Compose, health checks, volume persisten |
| 🔐 Autentikasi JWT | Endpoint terproteksi dengan token |
| 🧪 Dokumentasi interaktif | Swagger UI di `/api/docs` |
| 🌍 Akses global publik | Cloudflare Tunnel, SSL otomatis, tanpa port forwarding |

---

## 🧱 Arsitektur Singkat

```text
Client → Cloudflare Tunnel → FastAPI (Gateway) → Redis/Celery → Worker → MinIO
                                   ↓                    ↓
                              PostgreSQL            Analisis (OpenCV, dll)
                                   ↓                    ↓
                              Log audit           Hasil → MinIO + scrubbing
```

> **Prinsip:** Setiap mikroservis mandiri, data disimpan dalam object storage, komputasi berat dijalankan di *background worker*, dan layanan diekspos ke publik via tunneling terenkripsi.

---

## 🛠️ Teknologi

| Komponen | Teknologi |
|----------|-----------|
| **API Gateway** | FastAPI (Python) [![FastAPI](https://img.shields.io/badge/FastAPI-109989?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/) |
| **Task Queue** | Celery + Redis [![Celery](https://img.shields.io/badge/Celery-37814A?logo=celery&logoColor=white)](https://docs.celeryq.dev/) [![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)](https://redis.io/) |
| **Database** | PostgreSQL [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org/) |
| **Object Storage** | MinIO [![MinIO](https://img.shields.io/badge/MinIO-C72A48?logo=minio&logoColor=white)](https://min.io/) |
| **Container** | Docker + Compose [![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/) |
| **Tunneling** | Cloudflare Tunnel [![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://www.cloudflare.com/) |
| **Analisis gambar** | OpenCV / scikit-image [![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?logo=opencv&logoColor=white)](https://opencv.org/) |

---

## 📋 Prasyarat

Sebelum memulai, pastikan lingkungan Anda sudah terpasang:

- **Git**
- **Docker** (≥ 20.10)
- **Docker Compose Plugin** (≥ 2.0)
- **Bash** (untuk skrip `cleanup.sh`)
- **Arsitektur CPU:** x86_64 (Intel/AMD Ryzen) — ARM tidak direkomendasikan karena stabilitas JVM
- **RAM:** Minimal 16 GB untuk host
- **Koneksi internet outbound aktif** (tidak perlu port forwarding)

---

## ⚙️ Instalasi & Konfigurasi

### 1. Kloning repositori
```bash
git clone https://github.com/username-anda/cloudscope.git
cd cloudscope
```

### 2. Buat berkas konfigurasi rahasia
Salin berkas contoh dan **segera ubah nilai bawaan** (terutama password, kunci JWT, dan kredensial MinIO):
```bash
cp .env.example .env
nano .env   # atau vim / code .
```

> ⚠️ **Keamanan:** Jangan pernah melakukan commit file `.env` ke repositori publik. Nilai di dalamnya harus kuat dan unik.

Contoh isi `.env`:
```env
# Database Credentials
POSTGRES_USER=admin
POSTGRES_PASSWORD=rahasia_komunitas
POSTGRES_DB=cloudscope

# MinIO Storage Credentials
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=rahasia_komunitas

# Celery & Redis Configuration
CELERY_BROKER_URL=redis://cloudscope-redis:6379/0
CELERY_RESULT_BACKEND=redis://cloudscope-redis:6379/0

# JWT Secret (ubah dengan nilai random yang kuat)
JWT_SECRET=super_rahasia_jwt_key_ganti_ini
```

### 3. Siapkan volume bersama (*shared volume*)
Worker dan API perlu berbagi file sementara untuk proses unggah. Buat direktori dan beri izin:
```bash
sudo mkdir -p /tmp/cloudscope
sudo chmod 777 /tmp/cloudscope
```

> Direktori ini akan di-mount ke container sebagai `/app/shared`.

### 4. Konfigurasi Pembatasan Sumber Daya (Resource Limits)

Karena pemrosesan makro ImageJ/Fiji bersifat rakus memori (memory-intensive), sistem dilengkapi dengan pembatas (cgroups) di level kontainer agar tidak memicu OOM Killer pada mesin host.

Di dalam berkas `docker-compose.yml`, komponen worker telah disetel batasannya:
```yaml
worker:
  deploy:
    resources:
      limits:
        memory: 4g      # Batas memori maksimum per kontainer worker
        cpus: "2"       # Alokasi core CPU untuk pemrosesan paralel
```

---

## 🚀 Menjalankan Sistem

Arsitektur CloudScope terdiri dari microservices terisolasi: **Nginx** (Gateway), **FastAPI** (Backend), **PostgreSQL** (Database), **Redis** (Message Broker), **MinIO** (Object Storage), **Celery** (Task Queue), dan **Cloudflared** (Tunneling).

Build dan jalankan semua container di latar belakang:
```bash
docker compose up -d --build --force-recreate
```

Verifikasi kesehatan sistem (healthcheck) dari seluruh kontainer:
```bash
docker compose ps
```
> Pastikan kontainer inti memiliki status `Up (healthy)`.

### 🌐 Akses Layanan (Lokal)

| Layanan | URL | Catatan |
|---------|-----|---------|
| Swagger UI (dokumentasi API) | `http://localhost/api/docs` | Gunakan untuk testing interaktif |
| MinIO Console | `http://localhost:9001` | Login dengan `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` dari `.env` |

### 🌍 Eksposur Publik (Cloudflare Edge Tunneling)

Untuk memenuhi kriteria aksesibilitas awan (cloud accessibility), sistem menggunakan agen Cloudflare Tunnel secara kontainerisasi. Ini melewati NAT lokal dan menerbitkan antarmuka Nginx (Port 80) ke URL publik dengan enkripsi SSL otomatis.

Untuk mendapatkan URL publik yang sedang aktif (bersifat dinamis per sesi deployment), periksa log dari kontainer tunnel:
```bash
docker compose logs quick-tunnel | grep "trycloudflare.com"
```

**Output yang Diharapkan:**
```plaintext
INF | Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
INF | https://[nama-domain-acak].trycloudflare.com
```

> Tautan inilah yang dibagikan kepada pengguna/penguji untuk mengakses Dasbor React secara global. URL bersifat dinamis dan berubah setiap sesi deployment ulang.

---

## 🧪 Menggunakan API

Berikut contoh alur lengkap menggunakan **Swagger UI** atau `curl`.

### 1. Daftar akun baru
```http
POST /auth/register
Content-Type: application/json

{
  "email": "peneliti@example.com",
  "password": "Rahasia123!"
}
```

### 2. Login → ambil JWT token
```http
POST /auth/login
Content-Type: application/json

{
  "email": "peneliti@example.com",
  "password": "Rahasia123!"
}
```
→ Simpan token yang dikembalikan.

### 3. Autentikasi di Swagger UI
- Klik tombol **Authorize** (ikon gembok)
- Masukkan token: `Bearer <token_anda>`

### 4. Unggah berkas mikroskopi
```http
POST /analysis/upload/
Content-Type: multipart/form-data

file: (pilih file .czi / .tif / .lif)
```
**Respon:** `{"task_id": "uuid-celery", "status": "queued"}`

### 5. Cek status tugas
```http
GET /analysis/status/{task_id}
```
Setelah selesai, hasil akan tersimpan di bucket MinIO dengan metadata yang sudah dibersihkan (*scrubbed*).

---

## 🧹 Pemeliharaan (Garbage Collection)

Proses analisis menghasilkan file sementara di `/tmp/cloudscope` dan cache worker. Kami sediakan skrip otomatis.

### Menjalankan manual
```bash
chmod +x cleanup.sh
./cleanup.sh
```

### Otomatis dengan cron (produksi)
Agar berjalan setiap hari Minggu jam 02:00 pagi:
```bash
crontab -e
# Tambahkan baris (sesuaikan path absolut repositori):
0 2 * * 0 /path/ke/cloudscope/cleanup.sh >> /tmp/cloudscope_cleanup.log 2>&1
```

---

## 🤝 Kontribusi

Proyek ini dikembangkan untuk mendukung penelitian akar rumput secara mandiri.  
Kami sangat terbuka terhadap:
- 🐛 Laporan bug
- 💡 Usulan fitur
- 🔧 Pull request (perbaikan kode, optimasi worker, peningkatan keamanan)

Silakan buka *issue* atau *pull request* di repositori GitHub.

---

## 📄 Lisensi

Distribusikan di bawah lisensi **GNU**. Lihat berkas `LICENSE` untuk informasi lebih lanjut.

---