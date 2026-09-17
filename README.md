# ConverseIQ Phase 2: Production System

ConverseIQ is an enterprise-grade academic meeting intelligence platform designed for Higher Education institutions. It captures, transcribes, and diarizes multi-speaker faculty meetings, generates structured and editable Minutes of Meeting (MoM), tracks action item accountability with priority and status, provides calendar reminders, and offers institutional administration and analytics.

---

## 🏗️ Architecture

- **Backend**: FastAPI with async SQLAlchemy 2.0
- **Database**: PostgreSQL 16 (with asyncpg, pgvector-ready) + SQLite fallback for seamless local tests
- **Authentication**: JWT tokens (8-hour expiration), bcrypt password hashing, role-based access control (`Faculty`, `HOD`, `Admin`), login rate-limiting (429 lockout on 6th failed attempt)
- **Document Export**: PDF (ReportLab) & Microsoft Word (.docx)
- **AI Engine**: AssemblyAI for audio transcription & speaker diarization, OpenRouter/Gemini LLM for structured MoM synthesis & RAG Q&A
- **Frontend**: Next.js & React with Tailwind CSS, Lucide icons, responsive tables, and interactive dashboards

---

## 🚀 Directory Structure

```
converseiq-phase2/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Modular API endpoints (auth, dashboard, meetings, mom, action_items, export, ai, admin)
│   │   ├── core/            # Config, security (JWT/bcrypt/RBAC), database, audit helpers
│   │   ├── models/          # PostgreSQL SQLAlchemy models (User, Department, Meeting, ActionItem, AuditLog, etc.)
│   │   ├── schemas/         # Pydantic validation schemas
│   │   ├── services/        # Exporter (PDF/Docx), AI analysis, Transcription, RAG
│   │   └── main.py          # FastAPI application entrypoint with seed data & CORS
│   ├── tests/               # Automated test suite (RBAC 403, Rate-limiting 429, MoM export, etc.)
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment template
├── frontend/                # Next.js frontend application
└── docker-compose.yml       # Production Docker deployment
```

---

## 🔑 Default Seed Credentials for Testing

- **Admin Account**: `admin@converseiq.edu` / `Admin@123`
- **HOD Account**: `hod.cs@converseiq.edu` / `Hod@123`
- **Faculty Account**: `prof.sharma@converseiq.edu` / `Faculty@123`
- **Faculty Account 2**: `prof.mishra@converseiq.edu` / `Faculty@123`
