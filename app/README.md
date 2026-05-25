# 🔬 CloudScope

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![Celery](https://img.shields.io/badge/Celery-5.3+-brightgreen.svg)](https://docs.celeryq.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-GNU-yellow.svg)](LICENSE)

**CloudScope** adalah arsitektur *backend* modular berbasis **microservices** untuk memproses dan mengorkestrasi analisis berkas gambar mikroskopi (seperti `.czi`, `.tif`, `.lif`). 

Sistem ini dirancang dengan prinsip desentralisasi dan kemandirian data, memanfaatkan:
- 🔄 Antrean asinkron (Celery + Redis) untuk komputasi berat
- 🗄️ Sistem penyimpanan objek internal (MinIO)
- 🔒 Mesin privasi untuk membersihkan metadata sensitif (*scrubbing*) sebelum hasil analisis disimpan

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

---

## 🧱 Arsitektur Singkat

```text
Client → FastAPI (Gateway) → Redis/Celery → Worker → MinIO
                ↓                  ↓
           PostgreSQL          Analisis (OpenCV, dll)
                ↓                  ↓
           Log audit          Hasil → MinIO + scrubbing
```

> **Prinsip:** Setiap mikroservis mandiri, data disimpan dalam object storage, komputasi berat dijalankan di *background worker*.

---

## 🛠️ Teknologi

| Komponen | Teknologi |
|----------|------------|
| **API Gateway** | FastAPI (Python) |
| **Task Queue** | Celery + Redis (broker) |
| **Database** | PostgreSQL (entitas akun, log audit) |
| **Object Storage** | MinIO (S3‑compatible) |
| **Container** | Docker + Docker Compose |
| **Analisis gambar** | OpenCV / library sesuai kebutuhan |

---

## 📋 Prasyarat

Sebelum memulai, pastikan lingkungan Anda sudah terpasang:

- **Git**
- **Docker** (≥ 20.10)
- **Docker Compose Plugin** (≥ 2.0)
- **Bash** (untuk skrip `cleanup.sh`)

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

### 3. Siapkan volume bersama (*shared volume*)
Worker dan API perlu berbagi file sementara untuk proses unggah. Buat direktori dan beri izin:
```bash
sudo mkdir -p /tmp/cloudscope
sudo chmod 777 /tmp/cloudscope
```

> Direktori ini akan di-mount ke container sebagai `/app/shared`.

---

## 🚀 Menjalankan Sistem

Build dan jalankan semua container di latar belakang:
```bash
docker compose up -d --build
```

Tunggu hingga semua layanan menunjukkan status **healthy** (bisa dicek dengan `docker compose ps`).

### 🌐 Akses Layanan

| Layanan | URL | Catatan |
|---------|-----|---------|
| Swagger UI (dokumentasi API) | `http://localhost/api/docs` | Gunakan untuk testing interaktif |
| MinIO Console | `http://localhost:9001` | Login dengan `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` dari `.env` |

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
