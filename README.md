# TaskFlow — Task Assignment Platform

Secure task assignment platform for business owners and vendors.
Built with **FastAPI** · **Supabase** · **React + Vite**

---

## Architecture

```
React (Vite)  →  FastAPI Backend  →  Supabase (PostgreSQL + Storage + Auth)
```

---

## Quick Start

### 1. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase_migration.sql` (in project root)
3. Go to **Authentication → Users** and create your **owner** account manually
4. Copy the owner's UUID and run this SQL to set their role:
   ```sql
   INSERT INTO profiles (id, role, full_name, email)
   VALUES ('<owner-uuid>', 'owner', 'Your Name', 'owner@email.com');
   ```
5. From **Project Settings → API**, copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key
   - `JWT Secret` (Settings → API → JWT Settings)

---

### 2. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Copy and fill env
copy .env.example .env
```

Edit `backend\.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:5173
```

Run the backend:
```bash
python main.py
# API docs: http://localhost:8000/docs
```

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Project Structure

```
jira_ins/
├── backend/
│   ├── main.py                  # FastAPI entry
│   ├── config.py                # Supabase client
│   ├── middleware/auth.py       # JWT verification
│   ├── routers/
│   │   ├── auth.py              # Login, /me
│   │   ├── vendors.py           # Vendor CRUD
│   │   ├── tasks.py             # Task CRUD
│   │   └── files.py             # Upload/signed URLs
│   ├── models/schemas.py        # Pydantic models
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── api/                 # Axios API layer
│       ├── components/          # Sidebar, FileUploadZone, etc.
│       ├── context/             # Auth + Toast providers
│       ├── pages/
│       │   ├── owner/           # Dashboard, Tasks, Vendors, CreateTask
│       │   └── vendor/          # Dashboard, Tasks, TaskDetail
│       └── App.jsx              # Router
│
└── supabase_migration.sql       # Run this first!
```

---

## Security

- All passwords managed by **Supabase Auth** (bcrypt)
- **JWT tokens** verified on every API request
- **Row Level Security (RLS)** — vendors can only see their own tasks
- **Private storage bucket** — all files accessed via signed URLs (1hr expiry)
- **HTTPS** enforced in production

---

## File Limits

| Who | Type | Formats | Max Files | Max Size |
|-----|------|---------|-----------|----------|
| Owner | Attachments | PDF, JPEG, PNG | 5 | 10MB each |
| Vendor | Deliverables | PDF only | 2 | 10MB each |

---

## Payments (Coming Soon)

The database schema already has a `payments` table ready.
Enable it by adding payment routes and UI when needed.
