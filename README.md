# ConverseIQ — Academic Meeting Intelligence Platform

Enterprise multi-speaker academic meeting transcription, editable MoM generation, grounded AI Query Assistant, and strategic action tracking for higher education institutions.

---

## 📁 Project Structure

```
ConverseIQ/
├── backend_v2/             # FastAPI Async Backend (Python 3.10+)
│   ├── app/
│   │   ├── core/           # Security, DB, Config, Dependencies
│   │   ├── models/         # SQLAlchemy DB Models (Users, Meetings, MoM, Action Items)
│   │   ├── routers/        # API Endpoints (auth, meetings, dashboard, users, ai, etc.)
│   │   ├── schemas/        # Pydantic Schemas
│   │   ├── services/       # AI Pipeline & Transcription Service
│   │   └── main.py         # Application Entrypoint
│   ├── seed.py             # Automatic Database Seeder
│   └── requirements.txt    # Python Dependencies
├── frontend/               # Next.js 14 App Router + Tailwind CSS
│   ├── src/
│   │   ├── app/            # Next.js Routes (dashboard, hod, meetings, schedule, settings, ai-assistant)
│   │   ├── components/     # UI Components & Modals (Sidebar, AddMeeting, etc.)
│   │   └── lib/            # API Client & Auth Utilities
│   └── package.json        # Frontend Dependencies
└── ConverseIQ.code-workspace # VS Code Multi-Root Workspace Configuration
```

---

## 🚀 How to Run in VS Code

### Option 1: Open via Terminal
```bash
code ~/Desktop/ConverseIQ
```

### Option 2: Open via VS Code Menu
1. Open **VS Code**.
2. Click **File** → **Open Folder...**
3. Select the **`ConverseIQ`** folder located on your **Desktop**.

---

## 💻 Local Development Setup

### 1. Run the Backend (Terminal 1)
```bash
cd backend_v2
pip install -r requirements.txt
uvicorn backend_v2.app.main:app --reload --port 8001
```
*Backend API will run at:* `http://localhost:8001`  
*Swagger Documentation:* `http://localhost:8001/docs`

### 2. Run the Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
*Frontend App will run at:* `http://localhost:3000`

---

## 🔐 Default Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Faculty** | `prof.sharma@converseiq.edu` | `Faculty@123` |
| **HOD** | `hod.cs@converseiq.edu` | `Hod@123` |
| **Admin** | `admin@converseiq.edu` | `Admin@123` |

---

## 🌐 Live Cloud Deployments
- **Backend (Render):** `https://converseiq.onrender.com`
- **Frontend (Vercel):** Connected directly to GitHub `main` branch
