<div align="center">
  <img src="./public/readme-banner.svg" alt="Bithour Production" width="100%"/>
</div>

<br/>

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=flat-square&logo=redis&logoColor=white)
![Fly.io](https://img.shields.io/badge/Deployed-Fly.io-8B5CF6?style=flat-square&logo=flydotio&logoColor=white)

**Internal Document Management & Creator Pipeline System**

[**Live App**](https://bithour-production.fly.dev) · [Creator Portal](#creator-portal) · [Local Dev](#local-development)

</div>

---

## Overview

Portal internal Bithour Production untuk manajemen kreator konten TikTok — dari onboarding hingga pembayaran. Sistem menangani seluruh alur kerja: pembuatan MoU dan Invoice PDF, review video, signing digital, hingga monitoring creator pipeline.

## Features

| Modul | Deskripsi |
|---|---|
| **Creator Pipeline** | Manajemen status kreator dari REACHOUT hingga FINISHED |
| **Document Generation** | Auto-generate Invoice dan MoU PDF via background worker |
| **Digital Signing** | Portal kreator untuk tanda tangan dokumen secara digital |
| **Video Review** | Upload, review, dan approval konten video kreator |
| **AI Parsing** | Parse data kreator dari teks bebas via Gemini AI |
| **Multi-role Access** | BD, Team Leader, Finance, Manager, Curator, Analyst |
| **Creator Portal** | Portal khusus kreator via link unik (tanpa login) |
| **Messaging** | Chat internal antara tim dan kreator |

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Fly.io (Singapore)                 │
│                                                 │
│  ┌─────────────┐    ┌──────────────────────┐   │
│  │  Next.js    │    │   BullMQ Workers      │   │
│  │  App Router │    │  documentWorker       │   │
│  │  + API      │    │  videoProcessor       │   │
│  │  Routes     │    │  chatWorker           │   │
│  └──────┬──────┘    └──────────┬───────────┘   │
│         │                      │               │
└─────────┼──────────────────────┼───────────────┘
          │                      │
    ┌─────▼──────┐    ┌──────────▼───────┐
    │    Neon    │    │  Upstash Redis   │
    │ PostgreSQL │    │  (BullMQ Queue)  │
    └────────────┘    └──────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Tigris S3      │
                    │  (File Storage) │
                    └─────────────────┘
```

## Tech Stack

- **Framework**: Next.js 16.1 (App Router, React 19, TypeScript)
- **Database**: PostgreSQL via Prisma ORM (Neon serverless)
- **Queue**: BullMQ + Redis (Upstash)
- **Storage**: S3-compatible (Tigris on Fly.io / MinIO local)
- **Auth**: NextAuth.js (JWT credentials)
- **AI**: Google Gemini 2.0 Flash (parsing, feedback improvement)
- **PDF**: pdf-lib + sharp (Invoice & MoU generation)
- **Deploy**: Fly.io (Docker multi-stage, standalone mode)

---

## Local Development

### Prerequisites

- Node.js 20+
- Docker Desktop

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd bithour-production
npm install

# 2. Start infrastructure (Postgres, Redis, MinIO)
docker compose -f docker-compose.dev.yml up -d

# 3. Push schema and seed
npx prisma db push
npx tsx prisma/seed.ts

# 4. Start dev server
npm run dev
```

App berjalan di `http://localhost:3000`

### Environment Variables (Local)

File `.env.local` sudah dikonfigurasi untuk Docker local:

```env
DATABASE_URL=postgresql://crowncare:crowncare_secret@localhost:5433/crowncare
REDIS_HOST=localhost
REDIS_PORT=6379
NEXTAUTH_SECRET=local-dev-secret-change-in-production-32chars!
NEXTAUTH_URL=http://localhost:3000
R2_ENDPOINT=http://localhost:9000
R2_BUCKET_NAME=crowncare
GEMINI_API_KEY=your_key_here
```

### Docker (Full Stack)

```powershell
# Start full stack including app
.\docker-local.ps1 up

# Seed database
.\docker-local.ps1 seed

# View logs
.\docker-local.ps1 logs
```

---

## Test Accounts

Password semua akun: **`crowncare123`**

| Username | Role | Akses |
|---|---|---|
| `bd_andi` | Business Development | Input kreator, buat dokumen |
| `tl_dewi` | Team Leader | Review video kreator |
| `manager_david` | Manager | Lihat semua data, laporan |
| `finance_rina` | Finance | Proses pembayaran |
| `curator_maya` | Curator | Endorsement video |
| `analyst_putri` | Analyst | Analytics dashboard |

---

## Creator Portal

Setiap kreator mendapat URL unik untuk mengakses portalnya:

```
https://bithour-production.fly.dev/creator/s/{username}/{token}
```

Kreator bisa:
- Melihat status pipeline mereka
- Upload video draft
- Tanda tangan dokumen (MoU/Invoice)
- Chat dengan tim internal

Login kreator dari halaman utama → tab **Kreator** → masukkan Kode Akses.

---

## Production Deployment

App di-deploy ke Fly.io dengan konfigurasi:

```toml
app = 'bithour-production'
primary_region = 'sin'   # Singapore
```

```powershell
# Deploy
fly deploy --app bithour-production --remote-only

# Logs
fly logs --app bithour-production

# Status
fly status --app bithour-production
```

### Production Services

| Service | Provider | Keterangan |
|---|---|---|
| App Hosting | Fly.io | 2 machines, Singapore |
| Database | Neon PostgreSQL | Serverless |
| Cache + Queue | Upstash Redis | Pay-as-you-go |
| File Storage | Tigris (Fly.io) | S3-compatible |
| AI | Google Gemini 2.0 Flash | Parsing & feedback |

---

## Project Structure

```
app/
├── dashboard/            # Protected internal dashboard
│   ├── creators/         # Creator pipeline management
│   ├── documents/        # Document management
│   ├── review/           # Video review
│   └── settings/         # System settings
├── creator/s/[u]/[token]/ # Public creator portal
├── login/                # Auth page (staff + kreator)
└── api/                  # API routes
lib/
├── workers/              # BullMQ background workers
├── redis.ts              # Redis connection (Upstash TLS)
├── s3.ts                 # S3/Tigris storage client
└── queue.ts              # BullMQ queue definitions
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Mock data seeder
```

---

<div align="center">
  <sub>Built for Bithour Production · Internal Use Only</sub>
</div>
