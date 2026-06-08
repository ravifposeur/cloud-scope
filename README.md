# 🔬 CloudScope: Decentralized Microscopy Analytics Platform

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72A48?style=for-the-badge&logo=minio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)

CloudScope adalah arsitektur backend modular berbasis **microservices** untuk mengonversi, memproses, dan mengorkestrasi analisis berkas citra mikroskopi multidimensi (seperti `.czi`, `.tif`, `.lif`).

Sistem ini didesain menggunakan prinsip komputasi *Bare-Metal Edge Node* untuk penelitian akar rumput. Komputasi berat dijauhkan dari ketergantungan korporasi cloud, memanfaatkan prosesor lokal x86 secara maksimal sambil tetap terhubung secara global melalui jaringan tepi (*Edge Tunneling*).

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|------------|
| Headless Fiji Engine | Eksekusi makro ImageJ/Fiji (`.ijm`) kustom tanpa antarmuka grafis untuk efisiensi RAM |
| Dynamic Macro Registry | Pilihan makro dinamis (Standard, Cell Counting, Edge Detection) yang disuntikkan langsung via API |
| Format Agnostic | Integrasi `bftools` (Bio-Formats) untuk mengonversi format instrumen proprietary menjadi OME-TIFF standar |
| Privacy Scrubbing Engine | Penghapusan metadata instrumen sensitif dari berkas hasil analisis sebelum dipublikasikan |
| Edge-Cloud Tunneling | Akses global menggunakan Cloudflare Quick Tunnel tanpa konfigurasi router atau IP publik statis |
| Asynchronous Task Queue | Orkestrasi tugas berat dengan Celery dan Redis tanpa membebani Gateway API |

---

Berikut diagram alur data dalam format **Mermaid** yang dapat dirender langsung di GitHub, GitLab, atau editor Markdown yang mendukung Mermaid:

---

## Arsitektur & Alur Data

### Diagram Infrastruktur

```mermaid
flowchart TB
    subgraph PUBLIC["Public Internet"]
        Client["Web Browser / API Client"]
    end

    subgraph EDGE["Cloudflare Edge"]
        Tunnel["Cloudflare Tunnel - SSL + Dynamic URL"]
    end

    subgraph LOCAL["Bare-Metal Edge Node x86_64"]
        subgraph PROXY["Reverse Proxy Layer"]
            Nginx["Nginx - Port 80/443"]
        end

        subgraph GATEWAY["API Gateway Layer"]
            FastAPI["FastAPI - JWT Auth + Routing"]
        end

        subgraph MESSAGE["Message Queue Layer"]
            Redis["Redis - Broker + Result Backend"]
            Celery["Celery Worker - Task Executor"]
        end

        subgraph PROCESSING["Processing Layer"]
            BF["Bio-Formats bftools - Format Conversion"]
            Fiji["ImageJ Fiji Headless - Macro Execution"]
            Scrub["Privacy Scrubbing Engine - Metadata Sanitization"]
        end

        subgraph STORAGE["Storage Layer"]
            PostgreSQL["PostgreSQL - User Data + Audit Log"]
            MinIO["MinIO - Object Storage"]
            SharedVolume["Shared Volume - Temporary Files"]
        end
    end

    Client -->|HTTPS| Tunnel
    Tunnel -->|HTTP| Nginx
    Nginx -->|"/api/*"| FastAPI
    Nginx -->|"/storage/*"| MinIO

    FastAPI -->|Store Task| Redis
    FastAPI -->|Log Action| PostgreSQL
    FastAPI -->|Upload File| SharedVolume

    Redis -->|Pull Task| Celery
    Celery -->|Read File| SharedVolume
    Celery -->|Convert| BF
    BF -->|OME-TIFF| Fiji
    Fiji -->|Raw Results| Scrub
    Scrub -->|Clean Results| Celery
    Celery -->|Upload Results| MinIO
    Celery -->|Update Status| Redis
    Celery -->|Cleanup| SharedVolume
```
### Alur Request Pengguna

```mermaid
sequenceDiagram
    participant Client as Client
    participant CF as Cloudflare Tunnel
    participant Nginx as Nginx
    participant FastAPI as FastAPI
    participant DB as PostgreSQL
    participant Redis as Redis
    participant Worker as Celery Worker
    participant BF as bftools
    participant Fiji as ImageJ
    participant MinIO as MinIO

    Client->>CF: 1. Upload File (.czi/.lif)
    CF->>Nginx: 2. Forward Request
    Nginx->>FastAPI: 3. Route to /api/upload
    
    FastAPI->>FastAPI: 4. Validate JWT Token
    FastAPI->>DB: 5. Log Upload Action
    FastAPI->>Redis: 6. Create Celery Task
    FastAPI-->>Client: 7. Return task_id
    
    Redis->>Worker: 8. Worker Picks Task
    Worker->>BF: 9. Convert to OME-TIFF
    BF-->>Worker: 10. Converted File
    Worker->>Fiji: 11. Execute Macro
    Fiji-->>Worker: 12. Analysis Results
    Worker->>Worker: 13. Scrub Metadata
    Worker->>MinIO: 14. Upload Results
    Worker->>Redis: 15. Update Task Status
    
    loop Polling Status
        Client->>FastAPI: 16. GET /status/{task_id}
        FastAPI->>Redis: 17. Check Status
        FastAPI-->>Client: 18. Return Progress
    end
    
    Client->>MinIO: 19. Download Results (via Nginx)
```

### Komponen Sistem

```mermaid
flowchart LR
    subgraph BACKEND["Backend Services"]
        direction TB
        A[FastAPI<br/>REST Gateway]
        B[Celery<br/>Task Queue]
        C[Redis<br/>Message Broker]
    end

    subgraph STORAGE_SERVICES["Storage Services"]
        direction TB
        D[PostgreSQL<br/>Relational DB]
        E[MinIO<br/>S3 Storage]
    end

    subgraph WORKER_SERVICES["Worker Services"]
        direction TB
        F[Bio-Formats<br/>Converter]
        G[ImageJ/Fiji<br/>Analyst]
        H[Scrubber<br/>Metadata Cleaner]
    end

    subgraph NETWORK["Network Layer"]
        I[Nginx<br/>Reverse Proxy]
        J[Cloudflared<br/>Tunnel Agent]
    end

    J --> I
    I --> A
    A <--> B
    B <--> C
    A <--> D
    B --> F --> G --> H
    H --> E
    A --> E
```

---
## Technical Stack

### Backend Core

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

### Database & Storage

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72A48?style=for-the-badge&logo=minio&logoColor=white)

### Image Processing

![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)

### Infrastructure & Networking

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)

---

## Prasyarat Sistem

| Persyaratan | Spesifikasi |
|-------------|-------------|
| Arsitektur CPU | x86_64 (Intel/AMD) - ARM tidak didukung karena stabilitas JVM |
| Memori (RAM) | Minimal 16 GB untuk host |
| Perangkat Lunak | Docker Engine ≥ 24.0, Docker Compose Plugin |
| Jaringan | Koneksi internet outbound aktif (tidak perlu port forwarding) |

---

## Instalasi & Konfigurasi

### 1. Kloning Repositori

```bash
git clone https://github.com/username-anda/cloudscope.git
cd cloudscope
```

### 2. Konfigurasi Lingkungan

Buat berkas `.env` dari contoh:

```bash
cp .env.example .env
```

Edit kredensial bawaan:

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
```

### 3. Persiapan Volume Bersama

```bash
sudo mkdir -p /tmp/cloudscope
sudo chmod 777 /tmp/cloudscope
```

### 4. Konfigurasi Pembatasan Sumber Daya

Di dalam `docker-compose.yml`, komponen worker dibatasi sumber dayanya:

```yaml
worker:
  deploy:
    resources:
      limits:
        memory: 4g
        cpus: "2"
```

---

## Eksekusi Deployment

### Menjalankan Seluruh Layanan

```bash
docker compose up -d --build --force-recreate
```

### Memeriksa Status Kontainer

```bash
docker compose ps
```

Pastikan kontainer inti berstatus `Up (healthy)`.

### Mengaktifkan Tunneling Publik

```bash
docker compose up -d quick-tunnel
```

### Mendapatkan URL Publik

```bash
docker compose logs quick-tunnel | grep "trycloudflare.com"
```

Output yang diharapkan:

```text
INF | Your quick Tunnel has been created! Visit it at:
INF | https://[nama-domain-acak].trycloudflare.com
```

---

## Monitoring & Telemetri

### Flower Dashboard (Monitoring Celery)

Akses `http://localhost:5555` untuk melihat:
- Metrik antrean
- Status worker
- Tugas sukses/gagal
- Waktu eksekusi real-time

### Pemantauan Sumber Daya

```bash
docker stats
```

### Investigasi Log Analitik

```bash
docker compose logs worker --tail 50
```

### Log Gateway dan Proxy

```bash
docker compose logs nginx
docker compose logs fastapi
```

---

## Panduan Interaksi API

### 1. Autentikasi Pengguna

```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=peneliti@example.com&password=Rahasia123!
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### 2. Inisiasi Analisis Citra

```http
POST /api/upload/
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: (file .czi / .tif)
project_id: "PROJECT_ALPHA"
macro_type: "PROJECT_CELLCOUNT"
```

Response:

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

### 3. Pemantauan Status Tugas

```http
GET /api/status/{task_id}
Authorization: Bearer <token>
```

Response saat selesai:

```json
{
  "status": "SUCCESS",
  "result": {
    "csv_url": "/storage/results/task_id/data.csv",
    "metadata_url": "/storage/results/task_id/metadata.json"
  }
}
```

---

## Pemeliharaan Berkala

### Pembersihan Manual

```bash
chmod +x cleanup.sh
./cleanup.sh
```

### Otomatisasi dengan Cron (Produksi)

```bash
crontab -e
```

Tambahkan baris berikut:

```bash
0 2 * * 0 /path/ke/cloudscope/cleanup.sh >> /var/log/cloudscope_cleanup.log 2>&1
```

---

## Akses Layanan

| Layanan | URL Lokal | Keterangan |
|---------|-----------|-------------|
| Swagger UI (Dokumentasi API) | `http://localhost/api/docs` | Testing interaktif |
| MinIO Console | `http://localhost:9001` | Manajemen objek storage |
| Flower Dashboard | `http://localhost:5555` | Monitoring Celery |

---

## Kontribusi

Proyek ini dikembangkan untuk mendukung penelitian mandiri di lingkungan akademis dan komunitas. Kontribusi terbuka untuk:

- Laporan bug dan masalah keamanan
- Usulan fitur baru
- Pull request untuk optimasi worker dan peningkatan kode

Silakan buka issue atau pull request di repositori GitHub.

---

## Lisensi

Distribusikan di bawah lisensi **GNU General Public License**. Lihat berkas `LICENSE` untuk informasi lengkap.

---
