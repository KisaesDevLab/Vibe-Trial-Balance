# Quick Reference — Vibe Trial Balance

## First Time Setup

### Linux / macOS / Git Bash
```bash
git clone https://github.com/KisaesDevLab/Vibe-Trial-Balance.git && cd Vibe-Trial-Balance && bash setup.sh
```

### Windows (PowerShell as Administrator)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup.ps1
```
This installs Git, Node.js, Docker, PostgreSQL, all dependencies, and seeds the database.
Safe to run multiple times — it skips anything already done.

Both scripts automatically detect **port conflicts** and suggest alternatives if ports 5432, 5050, 3001, or 5173 are already in use.

---

## Daily Usage

### Start everything:
```powershell
.\start.ps1          # Windows
npm run dev           # Any platform
```
Opens backend on http://localhost:3001 and frontend on http://localhost:5173.

---

## Common Commands

| Task | Command |
|------|---------|
| Start database only | `docker compose up -d` |
| Stop database | `docker compose down` |
| Wipe database clean | `docker compose down -v` then `docker compose up -d` |
| Reset database (keep container) | `npm run db:reset` |
| Run new migrations | `npm run migrate` |
| Seed database | `npm run seed` |
| Start backend only | `cd server && npm run dev` |
| Start frontend only | `cd client && npm run dev` |
| Start both | `npm run dev` |
| Check database tables | `docker exec -it vibe-tb-db psql -U vibetb -d vibe_tb_db -c "\dt"` |
| Open database shell | `docker exec -it vibe-tb-db psql -U vibetb -d vibe_tb_db` |

---

## URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | (app login) |
| Backend API | http://localhost:3001 | (JWT auth) |
| Health Check | http://localhost:3001/api/v1/health | (no auth) |
| pgAdmin | http://localhost:5050 | admin@local.dev / admin |

### pgAdmin: Adding the database connection
1. Open http://localhost:5050
2. Login with admin@local.dev / admin
3. Right-click "Servers" → Register → Server
4. General tab → Name: `Local`
5. Connection tab → Host: `db`, Port: `5432`, Username: `vibetb`, Password: `localdev123`
6. Save

---

## App Login
Default admin account (created by seed):
- Username: `admin`
- Password: `admin`
- **Change this immediately after first login**

New passwords must be at least 8 characters with uppercase, lowercase, and a number.

---

## Environment Variables

The server reads `.env` from `server/.env`. Key variables:

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3001` | Backend server port |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `JWT_SECRET` | *(dev default)* | **Required in production** |
| `ENCRYPTION_KEY` | *(falls back to JWT_SECRET)* | **Required in production** — set a unique value |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | **Required in production** — set to your domain |

---

## Troubleshooting

**"Docker Desktop is not running"**
→ Open Docker Desktop from Start Menu. Wait for the whale icon in system tray to stop animating.

**Port conflict (5432, 5050, 3001, or 5173 in use)**
→ The setup/start scripts automatically detect this and suggest alternative ports. If running manually, check `netstat` for the conflicting process and either stop it or change the port in `docker-compose.yml` / `server/.env`.

**"Cannot find module" errors**
→ Run `npm install` in the directory that's failing (root, server/, or client/).

**Database tables are missing**
→ Run `npm run migrate` from the project root.

**Want to start completely fresh**
→ Run `docker compose down -v && docker compose up -d`, wait 5 sec, then `npm run migrate && npm run seed`.

**Frontend shows blank page or API errors**
→ Make sure the backend is running (check http://localhost:3001/api/v1/health).

**"FATAL: JWT_SECRET environment variable is required in production"**
→ Set `JWT_SECRET` to a random 64+ character string in `server/.env`. The server refuses to start without it when `NODE_ENV=production`.

**"FATAL: ENCRYPTION_KEY environment variable is required in production"**
→ Set `ENCRYPTION_KEY` to a separate random string in `server/.env`. Must be different from `JWT_SECRET`.

**"FATAL: ALLOWED_ORIGIN environment variable is required in production"**
→ Set `ALLOWED_ORIGIN` to your exact domain (e.g., `https://tb.yourfirm.com`) in `server/.env`.
