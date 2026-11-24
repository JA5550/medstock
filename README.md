# MedStock — Hospital Stock Management (Full-Stack Starter)

## 1. Database Setup (PostgreSQL)
1. Create a PostgreSQL database (local or online via Supabase / Neon / Render).
2. Run `database/schema.sql` to create all 10 tables and seed the initial departments.

## 2. Backend API (Node.js + Express)
```bash
cd backend
cp .env.example .env   # Add your DATABASE_URL and JWT_SECRET
npm install
npm run dev
```

## 3. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
For online deployment, set `VITE_API_URL` to your deployed backend URL (e.g. Render/Railway) and host `frontend/` on Vercel or Netlify.
