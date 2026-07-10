[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I3D3227TTP)

# Vibe Trial Balance

A self-hosted tax preparation and accounting workpaper application for small CPA firms. Manage trial balances, journal entries, bank transactions, tax code assignments, financial statements, and client engagements — with AI-powered diagnostics, classification, and PDF import.

**License:** PolyForm Small Business 1.0.0 ([full text](LICENSE)) — free for companies with fewer than 100 people and under $1M (2019, inflation-adjusted) annual revenue. [Commercial license](COMMERCIAL_LICENSE.md) required for larger firms or client-facing access. [FAQ](docs/LICENSING_FAQ.md)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Development Setup (Windows)](#development-setup-windows)
- [Deployment: Docker — Prebuilt Images](#deployment-docker--prebuilt-images) ← recommended
- [Deployment: Raspberry Pi](#deployment-raspberry-pi)
- [Deployment: Docker (Build from Source)](#deployment-docker-build-from-source)
- [Deployment: Docker (Cloud / VPS)](#deployment-docker-cloud--vps)
- [AI Provider Configuration](#ai-provider-configuration)
- [Backup & Restore](#backup--restore)
- [MCP Integration (Claude Desktop)](#mcp-integration-claude-desktop)
- [License](#license)

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
| `NODE_ENV` | *(none)* | Set to `production` for production deployments — enforces required env vars |
| `PORT` | `3001` | Server listen port |
| `DATABASE_URL` | *(none)* | **Preferred** — full Postgres connection string (e.g. `postgres://user:pw@host:5432/db`). Takes precedence over `DB_*` vars when set. |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host (deprecated — prefer `DATABASE_URL`) |
| `DB_PORT` | `5432` | PostgreSQL port (deprecated — prefer `DATABASE_URL`) |
| `DB_NAME` | `vibe_tb_db` | Database name (deprecated — prefer `DATABASE_URL`) |
| `DB_USER` | `vibetb` | Database user (deprecated — prefer `DATABASE_URL`) |
| `DB_PASSWORD` | `localdev123` | Database password (deprecated — prefer `DATABASE_URL`) |
| `MIGRATIONS_AUTO` | `true` | When `false`, the server refuses to start with pending migrations. Set this in appliance/orchestrated deploys that run migrations as a separate step (`node dist/migrate.js`). |
| `JWT_SECRET` | *(none)* | **Required everywhere** — must be ≥32 chars. Server refuses to start without it. Generate with `openssl rand -hex 32` |
| `JWT_EXPIRY` | `8h` | JWT token lifetime |
| `ALLOWED_ORIGIN` | `http://localhost:5173,http://localhost:3000` | **Required in production**. Comma-separated list. Entries wrapped in `/.../` are treated as regex (e.g. `/^https:\/\/.*\.firm\.com$/`). |
| `ENCRYPTION_KEY` | *(falls back to JWT_SECRET in dev)* | **Required in production** — must be separate from JWT_SECRET. Generate with `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | *(none)* | Optional — can also be set in Admin > Settings |
| `APP_BASE_URL` | `http://localhost:3001` | Used in MCP integration for self-referencing URLs |
| `STRICT_AI_URL_SAFETY` | `false` | Set to `true` to block outbound AI/OCR URLs that resolve to RFC1918 / loopback / link-local. Cloud-metadata IPs are always blocked regardless. |

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

**First-time login:** username `admin`, password `admin1234`. The app forces you to pick a new password on first sign-in before you can reach anything else; new passwords require 8+ characters with uppercase, lowercase, and a number.

See [QUICKSTART.md](QUICKSTART.md) for detailed commands and troubleshooting.

---

## Deployment: Docker — Prebuilt Images

The fastest path to a running installation. Multi-arch images (`linux/amd64` and `linux/arm64`, so the same images run on a Pi) are published to GitHub Container Registry by the `Build and Publish Docker Images` workflow on every push to `main` and every `v*` tag.

| Image | Pull command |
|-------|--------------|
| Server | `docker pull ghcr.io/kisaesdevlab/vibe-tb-server:latest` |
| Client | `docker pull ghcr.io/kisaesdevlab/vibe-tb-client:latest` |

Available tags:
- `latest` — current main
- `v1.2.3`, `v1.2`, `v1` — release tags
- `sha-abcdef1` — specific commit (use for reproducible pins in production)

### 1. Get the compose file and the env template

```bash
# Pick an install directory on the host
mkdir -p /opt/vibe-tb && cd /opt/vibe-tb

curl -LO https://raw.githubusercontent.com/KisaesDevLab/Vibe-Trial-Balance/main/docker-compose.prod.yml
curl -LO https://raw.githubusercontent.com/KisaesDevLab/Vibe-Trial-Balance/main/.env.example
cp .env.example .env
```

### 2. Fill in the required secrets

Edit `.env` and set:

```bash
DB_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
ALLOWED_ORIGIN=http://YOUR_SERVER_IP_OR_HOSTNAME   # or https://tb.yourfirm.com
# Optional: IMAGE_TAG=v1.2.3   — pin to a release instead of `latest`
```

Compose will refuse to start if any required value is missing.

### 3. Start it

```bash
docker compose -f docker-compose.prod.yml up -d
```

On first boot the server runs migrations and seeds the default `admin` / `admin` account. **Change the admin password immediately after first login.**

### 4. Verify

```bash
docker compose -f docker-compose.prod.yml ps      # db, api, web all "Up"
curl http://localhost:3001/api/v1/health                 # {"status":"ok","database":"connected",...}
```

Open the app at `http://YOUR_SERVER_IP` (port 80).

### 5. Update to a newer version

```bash
cd /opt/vibe-tb
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

With `IMAGE_TAG=latest`, `pull` fetches whatever `main` currently points to. For reproducible production, pin `IMAGE_TAG` to a specific `v*` tag or `sha-*` and bump it deliberately.

### 6. Data persistence

Three named volumes survive recreations and updates:

- `pgdata` — the PostgreSQL data directory
- `uploads` — documents uploaded through the app (`server/uploads`)
- `backups` — `.tbak` archives written by the scheduled backup job (`server/backups`)

Back these up at the host level (e.g., `docker run --rm -v pgdata:/src alpine tar …`) in addition to using the app's in-product backup.

### Raspberry Pi note

The published images include `linux/arm64`, so the same `docker-compose.prod.yml` runs on a Pi 5 without any changes. Follow the steps above on the Pi — no compile step needed.

### Single-app vs multi-app

By default the compose above runs Vibe TB in **single-app mode** — the SPA is served at `/`, the web container publishes port 80 to the host, and `ALLOWED_ORIGIN` points at the host's bare URL.

When Vibe TB shares a host with other Vibe products (MyBooks, Connect, Payroll Time) behind a shared Caddy ingress, layer `docker-compose.grouped.yml` over the prod compose and set `VIBE_HOST` and `VITE_BASE_PATH=/tb/` in `.env`:

```bash
docker network create vibe_ingress     # one-time per host
docker compose -f docker-compose.prod.yml -f docker-compose.grouped.yml up -d
```

The same image runs in both modes — the web container substitutes `VITE_BASE_PATH` over the SPA assets at startup. The shared Caddy is provisioned by the [`vibe-installer`](https://github.com/KisaesDevLab/vibe-installer) repo; ad-hoc setups can stand up a Caddy attached to `vibe_ingress` with a single rule:

```
handle_path /tb/* {
    reverse_proxy web:80
}
```

That's enough — the web container's nginx already proxies `/api/*` to `api:3001` internally. `handle_path` strips the `/tb` prefix before forwarding, so the SPA's `/tb/api/v1/...` calls reach the backend as `/api/v1/...`.

### Upgrading from `vibe-tb-api` / `vibe-tb-web` images

The image names changed from `vibe-tb-api`/`vibe-tb-web` to `vibe-tb-server`/`vibe-tb-client` to align with the Vibe Appliance manifest convention (see `.appliance/manifest.json`). Compose service names (`api`, `web`) are unchanged in `docker-compose.prod.yml` — only the image references changed. To upgrade:

```bash
docker compose -f docker-compose.prod.yml down                                    # stop the old stack
curl -LO https://raw.githubusercontent.com/KisaesDevLab/Vibe-Trial-Balance/main/docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d                                    # pulls vibe-tb-server / vibe-tb-client
```

Existing named volumes (`pgdata`, `uploads`, `backups`) are scoped by Compose project, not service, so the data carries across the rename. The previous `vibe-tb-api`/`vibe-tb-web` GHCR packages will continue to receive `latest` for one release cycle before being deprecated.

### Deploying as part of Vibe Appliance

For multi-app deployments managed by the Vibe Appliance installer, this repo ships:

- `docker-compose.appliance.yml` — appliance overlay (no bundled Postgres, no published ports, points at shared Postgres via `DATABASE_URL`).
- `.appliance/manifest.json` — manifest the installer reads to wire up subdomains, env vars, migrations, and backup volumes.

In this mode, migrations and (on first install) seeds run as explicit one-shots before the API service starts:

```bash
# Always: apply pending migrations
docker compose run --rm vibe-tb-server node dist/migrate.js

# First install only: load admin user, tax codes, COA templates
docker compose run --rm vibe-tb-server node dist/seed.js

# Then bring the service up
docker compose -f docker-compose.appliance.yml up -d
```

`MIGRATIONS_AUTO=false` is set by the appliance overlay, which causes the entrypoint to skip both auto-migrate and auto-seed, AND the API refuses to start if a migration is still pending. The seed runner is idempotent (knex seed files use insert-ignore / on-conflict patterns) so it's safe to re-run if you're not sure whether the DB is fresh. The appliance's `enable-app.sh` handles this flow automatically; the manual commands above are for ad-hoc testing.

Emergency-access mode (`http://<lan-ip>:5172`) requires `ALLOWED_ORIGIN` to include that origin in the comma-separated list — the appliance synthesizes this; verify it if running the appliance compose by hand.

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
NODE_ENV=production
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=vibe_tb_db
DB_USER=vibetb
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE
JWT_SECRET=YOUR_RANDOM_SECRET_HERE
ENCRYPTION_KEY=YOUR_SEPARATE_RANDOM_SECRET_HERE
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

One-line update:
```bash
cd /opt/vibe-tb && git pull && ./deploy/deploy.sh
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

## Deployment: Docker (Build from Source)

Use this path only when you need a local modification baked in. Otherwise the [prebuilt images](#deployment-docker--prebuilt-images) path above is faster and produces identical containers.

### 1. Clone and prepare the environment

```bash
git clone https://github.com/KisaesDevLab/Vibe-Trial-Balance.git /opt/vibe-tb
cd /opt/vibe-tb
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, ALLOWED_ORIGIN.
```

### 2. Build and run

`docker-compose.prod.yml` itself only references prebuilt GHCR images. Layer `docker-compose.build.yml` on top to add `build:` directives that point at the in-repo `Dockerfile.server` / `Dockerfile.client`:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.build.yml up -d --build
```

The build overlay enforces `pull_policy: build` so Compose never tries to pull from GHCR when local sources are present. All required-secret env contracts from the prod compose still apply.

### 3. Verify

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.build.yml ps
curl http://localhost:3001/api/v1/health
```

### 4. Updates

```bash
git pull && docker compose -f docker-compose.prod.yml -f docker-compose.build.yml up -d --build
```

---

## Deployment: Docker (Cloud / VPS)

Same Docker setup as internal, with additional hardening for internet-facing deployments. Either the prebuilt-image path or the build-from-source path works; prefer the prebuilt images with `IMAGE_TAG` pinned to a `v*` release for reproducibility.

### Additional steps for cloud

#### 1. Add HTTPS with Let's Encrypt

Replace the web container's nginx with a Certbot-enabled config, or use a reverse proxy like Caddy or Traefik.

**Option A — Caddy (simplest, auto-HTTPS):**

Replace the `web` service in `docker-compose.prod.yml`:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
      - web_dist:/srv

volumes:
  # ... existing volumes ...
  caddy_data:
  caddy_config:
  web_dist:
```

Create a `Caddyfile`:
```
yourdomain.com {
    root * /srv
    try_files {path} /index.html
    file_server

    handle /api/* {
        reverse_proxy api:3001
    }

    handle /mcp/* {
        reverse_proxy api:3001 {
            flush_interval -1
            transport http {
                read_timeout 3600s
            }
        }
    }
}
```

Build the SPA into a volume (uses the prebuilt `web` image's static assets):
```bash
docker compose -f docker-compose.prod.yml run --rm \
  -v web_dist:/output web sh -c "cp -r /usr/share/nginx/html/* /output/"
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

- [ ] Set `NODE_ENV=production` in `server/.env`
- [ ] Change default `admin` / `admin` password immediately (new passwords require 8+ chars, uppercase, lowercase, number)
- [ ] Set a strong `JWT_SECRET` (64+ random characters) — **server refuses to start without it in production**
- [ ] Set a strong `ENCRYPTION_KEY` (separate from JWT_SECRET) — **server refuses to start without it in production**
- [ ] Set `ALLOWED_ORIGIN` to your exact domain (no wildcards) — **server refuses to start without it in production**
- [ ] Set a strong `DB_PASSWORD`
- [ ] Configure HTTPS (Caddy, Certbot, or cloud load balancer)
- [ ] Enable firewall (UFW, cloud security groups)
- [ ] Set up external database backups
- [ ] Regenerate your MCP token after upgrading (Admin > Settings > MCP Integration)
- [ ] Review PolyForm Small Business compliance: LICENSE file (with Required Notice line) included; confirm your firm qualifies as a small business under the license

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

## License

This project is licensed under the **PolyForm Small Business License 1.0.0**.

- **Free for:** Companies with fewer than 100 total individuals (employees + contractors) and under $1,000,000 USD (2019, inflation-adjusted) total revenue in the prior tax year — including use, self-hosting, modification, and distribution (with the license notices preserved)
- **Requires commercial license:** Use by companies at or above those thresholds, or providing client-facing access (clients get their own login)
- **Notices:** If you distribute copies, you must include the license terms (or their URL) and the `Required Notice: Copyright 2025-2026 Kisaes LLC` line
- The [LICENSE](LICENSE) file contains the full PolyForm Small Business 1.0.0 text. The canonical text is also at <https://polyformproject.org/licenses/small-business/1.0.0>.
- See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for commercial licensing terms.
- See [docs/LICENSING_FAQ.md](docs/LICENSING_FAQ.md) for common questions.
- All dependencies are MIT/Apache-2.0/BSD/ISC compatible (verified via `./scripts/license-audit.sh`).
- See `scripts/license-policy.json` for the complete dependency license policy.
- Contact **licensing@kisaes.com** for commercial inquiries.

Run `./scripts/license-audit.sh` before any release to verify compliance.