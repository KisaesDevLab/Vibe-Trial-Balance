# Development Environment Setup — Windows

## What We're Installing

1. **Git** — version control
2. **Node.js 20 LTS** — JavaScript runtime for both frontend and backend
3. **Docker Desktop** — runs PostgreSQL in a container (no manual install)
4. **VS Code Extensions** — TypeScript, Tailwind, PostgreSQL tools
5. **Project dependencies** — npm packages for client and server

Total setup time: ~30 minutes.

---

## Step 1: Install Git

1. Download from https://git-scm.com/download/win
2. Run the installer — accept all defaults
3. Verify in a new terminal (PowerShell or Command Prompt):
   ```
   git --version
   ```
   Should show something like `git version 2.44.0`

### Configure Git
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

---

## Step 2: Install Node.js 20 LTS

1. Download from https://nodejs.org/ (choose the LTS version, 20.x)
2. Run the installer — accept all defaults, including "Add to PATH"
3. **Restart your terminal** after installation
4. Verify:
   ```
   node --version    # Should show v20.x.x
   npm --version     # Should show 10.x.x
   ```

---

## Step 3: Install Docker Desktop

Docker runs PostgreSQL in a container — no Windows PostgreSQL installer needed.

1. Download from https://www.docker.com/products/docker-desktop/
2. Run the installer
3. It will ask to enable WSL 2 (Windows Subsystem for Linux) — say yes
4. If prompted to install a WSL 2 kernel update, follow the link and install it
5. Restart your computer when prompted
6. Open Docker Desktop — wait for it to say "Docker Desktop is running"
7. Verify in terminal:
   ```
   docker --version
   docker compose version
   ```

**Note:** Docker Desktop is free for personal use and small businesses (<250 employees, <$10M revenue).

---

## Step 4: Clone the Repository

Open PowerShell or your preferred terminal:

```bash
cd C:\Users\YourName\Projects    # or wherever you keep code
git clone https://github.com/YOUR_USERNAME/vibe-tb.git
cd vibe-tb
```

---

## Step 5: Set Up the Project Files

If you haven't already committed the starter kit files to the repo, 
create this folder structure and add the files from the starter kit:

```
vibe-tb/
├── client/                      # (created by Claude Code in Phase 1)
├── server/
│   ├── migrations/
│   │   └── 20260315000000_initial_schema.ts
│   ├── seeds/
│   │   ├── 001_default_admin.ts
│   │   └── 002_tax_line_reference.ts
│   ├── knexfile.ts
│   ├── package.json             # (see below)
│   └── tsconfig.json            # (see below)
├── shared/
│   └── types.ts
├── specs/
│   └── plan.md
├── docker-compose.yml           # (see below — creates PostgreSQL)
├── .env                         # (see below — local config)
├── .env.example                 # (see below — template for team)
├── .gitignore                   # (see below)
├── CLAUDE.md
└── package.json                 # (root workspace — see below)
```

---

## Step 6: Create the Docker Compose File

This file defines your local PostgreSQL database. One command starts it,
one command stops it.

**File: `docker-compose.yml`** (project root)

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: vibe-tb-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: vibetb
      POSTGRES_PASSWORD: localdev123
      POSTGRES_DB: vibe_tb_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  # Optional: pgAdmin web UI for browsing your database
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: vibe-tb-pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@local.dev
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_LISTEN_PORT: 5050
    ports:
      - "5050:5050"
    depends_on:
      - db

volumes:
  pgdata:
```

---

## Step 7: Create the Environment File

**File: `.env`** (project root — never commit this)

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=vibe_tb_db
DB_USER=vibetb
DB_PASSWORD=localdev123

# Auth
JWT_SECRET=local-dev-secret-change-in-production
JWT_EXPIRY=1h

# Anthropic API (for AI features — add when you get to Phase 5)
ANTHROPIC_API_KEY=

# Server
PORT=3001
NODE_ENV=development
```

**File: `.env.example`** (commit this as a template)

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=vibe_tb_db
DB_USER=vibetb
DB_PASSWORD=

# Auth
JWT_SECRET=
JWT_EXPIRY=1h

# Anthropic API
ANTHROPIC_API_KEY=

# Server
PORT=3001
NODE_ENV=development
```

---

## Step 8: Create the .gitignore

**File: `.gitignore`** (project root)

```gitignore
# Dependencies
node_modules/

# Environment
.env
.env.local

# Build output
client/dist/
server/dist/

# IDE
.vscode/settings.json
.idea/

# OS
Thumbs.db
.DS_Store

# Logs
*.log
npm-debug.log*

# Docker (don't commit volume data)
pgdata/

# Uploaded documents (stored outside repo on Pi)
uploads/
```

---

## Step 9: Start PostgreSQL

Open a terminal in the project root:

```bash
docker compose up -d
```

That's it. PostgreSQL is now running on `localhost:5432`.

**Useful Docker commands:**
```bash
docker compose up -d          # Start database (runs in background)
docker compose down            # Stop database (data preserved)
docker compose down -v         # Stop AND delete all data (fresh start)
docker compose logs db         # View PostgreSQL logs
docker compose ps              # Check what's running
```

**To access pgAdmin** (optional database browser):
1. Open http://localhost:5050
2. Login: `admin@local.dev` / `admin`
3. Add server: Host = `db`, Port = `5432`, User = `vibetb`, Password = `localdev123`

---

## Step 10: Verify the Database Connection

Quick test to confirm PostgreSQL is accessible:

```bash
docker exec -it vibe-tb-db psql -U vibetb -d vibe_tb_db -c "SELECT version();"
```

Should output something like: `PostgreSQL 16.x on x86_64...`

---

## Step 11: Install VS Code Extensions

Open VS Code, go to Extensions (Ctrl+Shift+X), install:

1. **ESLint** — JavaScript/TypeScript linting
2. **Tailwind CSS IntelliSense** — autocomplete for Tailwind classes
3. **Prettier** — code formatting
4. **PostgreSQL** (by Chris Kolkman) — query runner and DB browser in VS Code
5. **Docker** (by Microsoft) — manage containers from VS Code
6. **Thunder Client** (or REST Client) — test API endpoints without Postman

### VS Code PostgreSQL Connection
After installing the PostgreSQL extension:
1. Click the database icon in the sidebar
2. Add connection: Host `127.0.0.1`, Port `5432`, User `vibetb`, Password `localdev123`, Database `vibe_tb_db`, SSL off
3. You can now browse tables and run queries directly in VS Code

---

## Step 12: Run Database Migrations and Seeds

Once Claude Code completes Phase 1 (or after you commit the starter 
kit files), install server dependencies and run migrations:

```bash
cd server
npm install
npx knex migrate:latest --knexfile knexfile.ts
npx knex seed:run --knexfile knexfile.ts
```

This creates all tables, the adjusted trial balance view, and seeds
the admin user + tax line reference data.

**Verify tables were created:**
```bash
docker exec -it vibe-tb-db psql -U vibetb -d vibe_tb_db -c "\dt"
```

Should list all 12 tables plus the `knex_migrations` tracking table.

---

## Step 13: Run the App

You need two terminal windows — one for the backend, one for the frontend.

### Terminal 1: Backend
```bash
cd server
npm run dev
```
Server starts on http://localhost:3001

### Terminal 2: Frontend
```bash
cd client
npm run dev
```
Vite dev server starts on http://localhost:5173 (with hot reload)

Open http://localhost:5173 in your browser. You should see the app.

---

## Daily Workflow

### Starting your day:
```bash
# 1. Make sure Docker is running (Docker Desktop should auto-start)
# 2. Start the database if it's not running:
docker compose up -d

# 3. Pull latest changes from GitHub:
git pull origin main

# 4. Start the servers (two terminals):
cd server && npm run dev
cd client && npm run dev
```

### Testing a new phase branch:
```bash
# Switch to the branch Claude Code built:
git fetch origin
git checkout build/phase-2

# Install any new dependencies:
cd server && npm install
cd client && npm install

# Run any new migrations:
cd server && npx knex migrate:latest --knexfile knexfile.ts

# Start both servers and test
```

### Resetting the database (fresh start):
```bash
# Option A: Roll back and re-migrate
cd server
npx knex migrate:rollback --all --knexfile knexfile.ts
npx knex migrate:latest --knexfile knexfile.ts
npx knex seed:run --knexfile knexfile.ts

# Option B: Nuclear — destroy and recreate the Docker volume
docker compose down -v
docker compose up -d
# Wait 5 seconds for PostgreSQL to initialize, then:
cd server
npx knex migrate:latest --knexfile knexfile.ts
npx knex seed:run --knexfile knexfile.ts
```

---

## Troubleshooting

### "Port 5432 already in use"
Something else is using PostgreSQL's port. Either:
- Stop the other service, or
- Change the port in docker-compose.yml: `"5433:5432"` and update `.env` accordingly

### "docker compose" not recognized
- Make sure Docker Desktop is running (check system tray)
- Restart your terminal after installing Docker
- Try `docker-compose` (with hyphen) if you have an older version

### "ECONNREFUSED 127.0.0.1:5432"
- Database container isn't running: `docker compose up -d`
- Check container status: `docker compose ps`
- Check container logs: `docker compose logs db`

### Migration fails
- Make sure the database exists: `docker exec -it vibe-tb-db psql -U vibetb -d vibe_tb_db -c "SELECT 1;"`
- Check `.env` credentials match docker-compose.yml

### "Cannot find module" errors
- Run `npm install` in both `client/` and `server/`
- Make sure you're in the right directory

### Frontend can't reach backend API
- Backend must be running on port 3001
- Check Vite proxy config in `client/vite.config.ts` — it should proxy `/api` to `http://localhost:3001`
