# Quick Reference — Trial Balance App

## First Time Setup
```powershell
# Run PowerShell as Administrator, then:
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup.ps1
```
This installs Git, Node.js, Docker, PostgreSQL, all dependencies, and seeds the database.
Safe to run multiple times — it skips anything already done.

---

## Daily Usage

### Start everything:
```powershell
.\start.ps1
```
Opens backend on http://localhost:3001 and frontend on http://localhost:5173.

### Test a branch from Claude Code:
```powershell
.\test-branch.ps1 build/phase-2
```
Switches to the branch, installs deps, runs migrations, starts servers.

### Go back to main after testing:
```powershell
git checkout main
git stash pop          # if you had uncommitted changes
```

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
| Check database tables | `docker exec -it trialbalance-db psql -U trialbalance -d trialbalance_db -c "\dt"` |
| Open database shell | `docker exec -it trialbalance-db psql -U trialbalance -d trialbalance_db` |

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
5. Connection tab → Host: `db`, Port: `5432`, Username: `trialbalance`, Password: `localdev123`
6. Save

---

## App Login
Default admin account (created by seed):
- Username: `admin`
- Password: `admin`
- **Change this immediately after first login**

---

## Troubleshooting

**"Docker Desktop is not running"**
→ Open Docker Desktop from Start Menu. Wait for the whale icon in system tray to stop animating.

**"Port 5432 already in use"**
→ Another PostgreSQL is running. Either stop it, or edit docker-compose.yml to use port 5433.

**"Cannot find module" errors**
→ Run `npm install` in the directory that's failing (root, server/, or client/).

**Database tables are missing**
→ Run `npm run migrate` from the project root.

**Want to start completely fresh**
→ Run `docker compose down -v && docker compose up -d`, wait 5 sec, then `npm run migrate && npm run seed`.

**Frontend shows blank page or API errors**
→ Make sure the backend is running (check http://localhost:3001/api/v1/health).
