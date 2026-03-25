# Vibe Trial Balance

A self-hosted tax preparation and accounting workpaper application for small CPA firms. Manage trial balances, journal entries, bank transactions, tax code assignments, financial statements, and client engagements — with AI-powered diagnostics, classification, and PDF import.

**License:** AGPL-3.0-only ([full text](LICENSE))

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Development Setup (Windows)](#development-setup-windows)
- [Deployment: Raspberry Pi](#deployment-raspberry-pi)
- [Deployment: Docker (Internal Network)](#deployment-docker-internal-network)
- [Deployment: Docker (Cloud / VPS)](#deployment-docker-cloud--vps)
- [AI Provider Configuration](#ai-provider-configuration)
- [Backup & Restore](#backup--restore)
- [MCP Integration (Claude Desktop)](#mcp-integration-claude-desktop)
- [License Compliance](#license-compliance)

---

## Features

- Trial balance grid with inline editing, CSV/PDF import, prior year comparison
- Book and tax adjusting journal entries with balance validation
- Bank transaction import (OFX/CSV) with AI classification and reconciliation
- Tax code management with AI auto-assignment (500+ seeded codes for 1040/1065/1120/1120S)
- Financial statements: Income Statement, Balance Sheet, Cash Flow, Tax-Basis P&L
- Multi-period comparison with flux analysis and variance notes
- Tax software exports: UltraTax, CCH, Lacerte, GoSystem, Generic CSV/Excel
- Server-side PDF generation (pdfmake) for all report types
- Workpaper package bundling with tickmarks and workpaper references
- AI diagnostics, support chat, and scanned PDF vision-mode import
- Document storage, backup/restore (.tbak archives), engagement checklists
- MCP integration for Claude Desktop (18 tools, 8 resources, 5 prompts)
- Multi-provider AI: Claude (Anthropic), Ollama (self-hosted), OpenAI-compatible (vLLM, LM Studio)

---

## Architecture

```
client/          React 18 + TypeScript + Vite + Tailwind + TanStack Query/Table
server/          Node.js 20 + Express + TypeScript + Knex.js
database         PostgreSQL 16
ai               Anthropic SDK / OpenAI SDK (Ollama & OpenAI-compat)
pdf              pdfmake (server-side generation)
hosting          Raspberry Pi 5 (8GB) / Docker / any Linux server
```

---

## Environment Variables

Create a `.env` file in `server/` (or set these as system environment variables):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server listen port |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `vibe_tb_db` | Database name |
| `DB_USER` | `vibetb` | Database user |
| `DB_PASSWORD` | `localdev123` | Database password |
| `JWT_SECRET` | `local-dev-secret-12345` | **Change in production** — JWT signing key |
| `JWT_EXPIRY` | `8h` | JWT token lifetime |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | CORS allowed origin (set to your domain in production) |
| `ANTHROPIC_API_KEY` | *(none)* | Optional — can also be set in Admin > Settings |
| `APP_BASE_URL` | `http://localhost:3001` | Used in MCP integration for self-referencing URLs |

---

## Development Setup

### One-line install (Linux / macOS / Git Bash)
```bash
git clone https://github.com/KisaesDevLab/Vibe-Trial-Balance.git && cd Vibe-Trial-Balance && bash setup.sh
```
Clones the repo, installs all dependencies, starts PostgreSQL via Docker, runs migrations, and seeds demo data.

### Quick start (Windows PowerShell)
```powershell
# PowerShell as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup.ps1       # One-time: installs Git, Node, Docker, deps, seeds DB
.\start.ps1       # Daily: starts backend (3001) + frontend (5173)
```

### Manual setup
```bash
# Prerequisites: Node.js 20+, Docker Desktop
docker compose up -d                         # Start PostgreSQL + pgAdmin
npm install                                  # Root dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..
npm run migrate                              # Run all migrations
npm run seed                                 # Seed demo data
npm run dev                                  # Start both servers
```

**URLs:** Frontend http://localhost:5173 | API http://localhost:3001 | pgAdmin http://localhost:5050

**Default login:** `admin` / `admin` — change immediately.

See [QUICKSTART.md](QUICKSTART.md) for detailed commands and troubleshooting.

---

## Deployment: Raspberry Pi

The primary production target. Runs directly on the OS with Nginx as a reverse proxy and PM2 for process management.

### Prerequisites
- Raspberry Pi 5 (8GB recommended) with Raspberry Pi OS (64-bit)
- External SSD recommended for database and uploads

### 1. Initial setup
```bash
# Clone the repo
git clone https://github.com/kwkcp/vibe-tb.git /opt/vibe-tb
cd /opt/vibe-tb

# Run the automated setup (installs Node 20, PostgreSQL 16, Nginx, PM2)
chmod +x deploy/setup-pi.sh
./deploy/setup-pi.sh
```

### 2. Configure environment
```bash
cat > /opt/vibe-tb/server/.env << 'EOF'
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=vibe_tb_db
DB_USER=vibetb
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE
JWT_SECRET=YOUR_RANDOM_SECRET_HERE
ALLOWED_ORIGIN=http://YOUR_PI_IP_OR_HOSTNAME
EOF
```

Update the PostgreSQL password to match:
```bash
sudo -u postgres psql -c "ALTER USER vibetb WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';"
```

### 3. Deploy
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

This builds the TypeScript server, builds the React client, copies the frontend to Nginx's web root, runs migrations, and starts/restarts PM2.

### 4. Verify
```bash
curl http://localhost:3001/api/v1/health   # Should return {"status":"ok"}
pm2 status                                  # Should show "vibe-tb-server" as online
sudo nginx -t                               # Should show "syntax is ok"
```

Access the app at `http://YOUR_PI_IP` (port 80 via Nginx).

### 5. Auto-start on boot
```bash
pm2 save
pm2 startup                                 # Follow the printed command
sudo systemctl enable nginx
sudo systemctl enable postgresql
```

### 6. Updates
```bash
cd /opt/vibe-tb
git pull
./deploy/deploy.sh
```

### Optional: Scanned PDF support
```bash
sudo apt install poppler-utils              # Enables vision-mode PDF import
```

### Optional: Ollama for local AI
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull qwen3-vl:8b                     # Vision model for PDF extraction
ollama pull qwq:32b                         # Reasoning model for support chat
# Then in app: Admin > Settings > AI Provider > Ollama
# Set Base URL to http://localhost:11434
```

---

## Deployment: Docker (Internal Network)

For running on an office server, NAS, or any machine on your local network.

### 1. Create `docker-compose.prod.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: vibetb
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
      POSTGRES_DB: vibe_tb_db
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vibetb -d vibe_tb_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PORT: 3001
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: vibe_tb_db
      DB_USER: vibetb
      DB_PASSWORD: ${DB_PASSWORD:-changeme}
      JWT_SECRET: ${JWT_SECRET:-change-this-in-production}
      ALLOWED_ORIGIN: ${ALLOWED_ORIGIN:-http://localhost}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
    volumes:
      - uploads:/app/server/uploads
      - backups:/app/server/backups
    ports:
      - "3001:3001"

  client:
    build:
      context: .
      dockerfile: Dockerfile.client
    restart: unless-stopped
    depends_on:
      - server
    ports:
      - "80:80"

volumes:
  pgdata:
  uploads:
  backups:
```

### 2. Create `Dockerfile.server`

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN cd server && npm install --production

COPY server/ server/
RUN cd server && npx tsc

# For scanned PDF support (optional — adds ~50MB)
RUN apk add --no-cache poppler-utils

EXPOSE 3001
CMD ["sh", "-c", "cd server && npx knex migrate:latest --knexfile knexfile.js && node dist/app.js"]
```

### 3. Create `Dockerfile.client`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
RUN cd client && npm install
COPY client/ client/
RUN cd client && npm run build

FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
# Adjust nginx.conf: change root to /usr/share/nginx/html
# and proxy_pass to http://server:3001
EXPOSE 80
```

### 4. Create `.env` for production

```bash
DB_PASSWORD=your_strong_password_here
JWT_SECRET=your_random_64_char_secret_here
ALLOWED_ORIGIN=http://your-server-ip
ANTHROPIC_API_KEY=sk-ant-...       # Optional — can configure in app Settings instead
```

### 5. Build and run

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 6. Verify

```bash
docker compose -f docker-compose.prod.yml ps       # All services "Up"
curl http://localhost:3001/api/v1/health             # {"status":"ok"}
```

Access the app at `http://YOUR_SERVER_IP`.

### 7. Seed the admin user (first time only)

```bash
docker compose -f docker-compose.prod.yml exec server \
  sh -c "cd server && npx knex seed:run --knexfile knexfile.js"
```

### 8. Updates

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Deployment: Docker (Cloud / VPS)

Same Docker setup as internal, with additional hardening for internet-facing deployments.

### Additional steps for cloud

#### 1. Add HTTPS with Let's Encrypt

Replace the client Dockerfile's nginx with a Certbot-enabled config, or use a reverse proxy like Caddy or Traefik.

**Option A — Caddy (simplest, auto-HTTPS):**

Replace the `client` service in `docker-compose.prod.yml`:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      - server
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
      - client_dist:/srv

volumes:
  # ... existing volumes ...
  caddy_data:
  caddy_config:
  client_dist:
```

Create a `Caddyfile`:
```
yourdomain.com {
    root * /srv
    try_files {path} /index.html
    file_server

    handle /api/* {
        reverse_proxy server:3001
    }

    handle /mcp/* {
        reverse_proxy server:3001 {
            flush_interval -1
            transport http {
                read_timeout 3600s
            }
        }
    }
}
```

Build the client to a volume:
```bash
docker compose -f docker-compose.prod.yml run --rm \
  -v client_dist:/output client sh -c "cp -r /usr/share/nginx/html/* /output/"
```

**Option B — Nginx + Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

#### 2. Set environment for cloud

```bash
ALLOWED_ORIGIN=https://yourdomain.com
APP_BASE_URL=https://yourdomain.com
```

#### 3. Firewall

```bash
# Only allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### 4. Database backups

The app has built-in backup (Admin > Backup & Restore), but also set up external backups:

```bash
# Cron job for daily pg_dump
0 2 * * * docker compose -f /path/to/docker-compose.prod.yml exec -T db \
  pg_dump -U vibetb vibe_tb_db | gzip > /backups/tb-$(date +\%Y\%m\%d).sql.gz
```

#### 5. Security checklist

- [ ] Change default `admin` / `admin` password immediately
- [ ] Set a strong `JWT_SECRET` (64+ random characters)
- [ ] Set a strong `DB_PASSWORD`
- [ ] Configure HTTPS (Caddy, Certbot, or cloud load balancer)
- [ ] Set `ALLOWED_ORIGIN` to your exact domain (no wildcards)
- [ ] Enable firewall (UFW, cloud security groups)
- [ ] Set up external database backups
- [ ] Review AGPL-3.0 compliance: source code link in app footer must point to a public repo

---

## AI Provider Configuration

The app supports three AI backends. Configure at **Admin > Settings > AI Provider**.

| Provider | Best For | Setup |
|----------|----------|-------|
| **Claude** (Anthropic) | Highest quality, native vision | Enter API key in Settings |
| **Ollama** (self-hosted) | Full privacy, no cloud dependency | Install Ollama, pull models, enter server URL |
| **OpenAI-compatible** | vLLM, LM Studio, text-generation-inference | Enter server URL and model name |

All AI features (diagnostics, tax auto-assign, bank classification, CSV/PDF import, support chat) work identically regardless of provider. See the in-app support chat or `server/knowledge/ai-providers.md` for detailed setup instructions.

---

## Backup & Restore

- **In-app:** Admin > Backup & Restore — create `.tbak` archives (full, client, period, or settings-only)
- **Scheduled:** Nightly automatic backups via node-cron (configurable in Settings)
- **Restore modes:** "As new" (creates new client), "Replace" (overwrites), "Settings only"
- **External:** Use `pg_dump` for database-level backups (see cloud deployment section)

---

## MCP Integration (Claude Desktop)

Connect Claude Desktop directly to the app for AI-assisted accounting workflows.

1. Go to **Admin > Settings > MCP Integration**
2. Generate an MCP token
3. Copy the connection snippet (stdio or HTTP/SSE) into your Claude Desktop config
4. Claude Desktop can now: read trial balances, create journal entries, run diagnostics, assign tax codes, and more

See `server/knowledge/mcp-integration.md` for the full tool/resource/prompt reference.

---

## License Compliance

This project is licensed under **AGPL-3.0-only**. Key obligations:

- The LICENSE file contains the full AGPL-3.0 text
- The app footer includes a link to the source code repository (AGPL Section 13)
- All dependencies are MIT/Apache-2.0/BSD/ISC compatible (verified via `./scripts/license-audit.sh`)
- See `scripts/license-policy.json` for the complete dependency license policy

Run `./scripts/license-audit.sh` before any release to verify compliance.
