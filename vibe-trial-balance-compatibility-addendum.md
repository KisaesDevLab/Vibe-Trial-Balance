# Vibe-Trial-Balance — Appliance Compatibility Addendum

Companion to `docs/PLAN.md` (the Vibe-Appliance plan) and to `vibe-appliance-emergency-access-addendum.md`. This document specifies the changes needed in `KisaesDevLab/Vibe-Trial-Balance` so that a single set of GHCR images runs cleanly in two deployment modes:

- **Standalone:** customer runs the app's existing install path; bundled Postgres; current behavior, must not regress.
- **Appliance:** the Vibe-Appliance composes Vibe-TB alongside other Vibe apps; shared Postgres + Redis; behind Caddy at `tb.<domain>` with three documented access methods.

**Vibe-TB is the most-ready app in the Vibe family.** The audit below is mostly verification. The genuine code change is one line of CORS-list parsing. The bulk of this addendum is the appliance-overlay scaffolding and the emergency-access compatibility audit — neither of which require deep refactors.

---

## 1. Design principles

Same three rules as MyBooks and Payroll-Time addenda. If a future change violates one, push back on the change.

1. **Standalone behavior must not change for existing customers.** Identical setup, identical defaults, identical first-login flow after this work ships.
2. **One image, two modes.** Same `ghcr.io/kisaesdevlab/vibe-tb-*` images run both standalone and appliance.
3. **Configuration over forks.** Every behavioral difference is an env var or compose overlay.

---

## 2. Audit summary

| Item | Today | Target | Gap |
|---|---|---|---|
| Stack | React 18 + Node 20 + Express + Knex + PG16 | Same | None |
| License | BSL 1.1 (4-year Apache 2.0 conversion) | Same | None — BSL allows redistribution in the appliance |
| Standalone install | Existing flow | Unchanged | None |
| GHCR images | Multi-arch published (`vibe-tb-server`, `vibe-tb-client`) | Same | Verify amd64 + arm64 manifests |
| DB config | `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Add `DATABASE_URL` as preferred; keep existing as deprecated for one cycle | Code change |
| Redis | Not currently used | Optional — may be used for sessions later, not required for v1 | None for v1 |
| `ALLOWED_ORIGIN` | **Single-value, enforced at startup** | Comma-separated list with regex | **Code change — the only confirmed gap** |
| Migrations | Knex auto-migrate on startup | Gated by `MIGRATIONS_AUTO` (default `true`) | Code change |
| `/api/v1/health` | Exists | Verify returns 503 (not 200) when DB is down | Audit + likely fix |
| `/api/v1/ping` | Need verification | Cheap liveness, no DB dependency | Add if missing |
| Default first-login | `admin` / `admin` with forced reset | Same | None |
| AI features | Anthropic API (Sonnet) for support chat | Configurable + graceful degradation when key absent | §5.4 |
| Tax code crosswalk | 1,061 mappings shipped in image | Same | Document update path |
| Logs | Need audit | Stdout/stderr structured JSON in production | Likely audit + small fix |
| `PUBLIC_URL` | N/A — TB has no email/SMS-embedded URLs | None needed | None |
| Compose files | `docker-compose.yml` + `docker-compose.prod.images.yml` | Add `docker-compose.appliance.yml` | New file |
| Manifest | None | `.appliance/manifest.json` with `emergencyPort: 5172` | New file |
| Volumes | Bundled | Bundled in standalone; named-volume references in appliance | §5.8 |
| Emergency-access compatibility | Likely fails (HTTPS-redirect, Secure cookies hardcoded) | Audited and conformant | §5.9 |

The "Gap" column is the actionable shortlist. Two **code changes** (`ALLOWED_ORIGIN` list, `MIGRATIONS_AUTO` gate). Three **audits** (`/health` 503 behavior, log format, cookie `Secure` flag). Two **new files** (appliance compose, manifest). The rest is verification.

---

## 3. Common-requirements pass

PLAN.md §8.1 items, applied to Vibe-TB:

| # | Common requirement | TB status |
|---|---|---|
| 1 | All infra config from env vars | ✅ Already done |
| 2 | `ALLOWED_ORIGIN` accepts list | ❌ Single-value — fix in §5.1 |
| 3 | `MIGRATIONS_AUTO` env var | ❌ Auto-migrate hardcoded — fix in §5.2 |
| 4 | `/health` real readiness | ⚠️ Exists but verify 503 behavior — §5.3 |
| 5 | GHCR multi-arch | ✅ Already done — verify manifests |
| 6 | `.appliance/manifest.json` | ❌ Missing — add in §5.7 |
| 7 | Two compose files (standalone + appliance) | ⚠️ `prod.images.yml` exists — add `appliance.yml` in §5.6 |
| 8 | Configurable port via `PORT` | ✅ Server reads `PORT` env |
| 9 | No 80/443 ownership assumption | ✅ Server on 3001, client nginx on 80 |
| 10 | Stdout structured logs | ⚠️ Audit format |

Three confirmed code changes (#2, #3, possibly #4). The rest is audit + scaffolding.

---

## 4. Three access methods

TB is a **staff-internal workpaper tool**. No client portal, no kiosk, no PWA, no service worker. This makes the access-methods matrix trivial — every method works fully for every audience because there's only one audience (staff).

|  | Primary domain<br>(`https://tb.firm.com`) | Tailscale<br>(`https://tb.<tailnet>.ts.net`) | Emergency<br>(`http://<ip>:5172`) |
|---|---|---|---|
| **Staff** (preparers, reviewers, partners) | ✅ Full | ✅ Full | ✅ Full |

The only caveats:

- **AI support chat** requires outbound HTTPS to `api.anthropic.com`. If the customer is air-gapped or has restrictive egress, AI chat is disabled regardless of access method (§5.4 covers graceful degradation).
- **PDF/CSV import** uploads files, which works on all three methods (no service worker dependency).
- **Emergency mode** is a true full fallback for TB — staff can do everything they normally would, just over plain HTTP. This is unlike MyBooks (magic-link client portal breaks on HTTP) and Payroll-Time (kiosk PWA breaks on HTTP).

This is a property worth advertising to customers: *"If primary access fails, Trial Balance staff can keep working at the emergency URL — full functionality, just an insecure-connection warning."*

---

## 5. TB-specific changes

### 5.1 `ALLOWED_ORIGIN` accepts a list

**Goal.** Same image works at `http://localhost:5173` and `https://tb.firm.com` simultaneously, and accepts the appliance-rendered origin without breaking standalone.

**This is the only confirmed code change in the addendum.** Single-value `ALLOWED_ORIGIN` is the most fragile spot in TB today.

**Action.**

- CORS middleware reads `ALLOWED_ORIGIN`; split on `,`, trim whitespace, ignore empty entries.
- Treat any entry as a regex if it starts and ends with `/` (e.g., `/^https:\/\/.*\.firm\.com$/`); otherwise exact-match.
- If `ALLOWED_ORIGIN` is unset, default to `http://localhost:5173,http://localhost:3000` (dev-friendly).
- Reject the request with 403 only if no entry matches; log the offending origin at `info` to aid debugging.
- Server's startup-time enforcement of `ALLOWED_ORIGIN` presence stays — but accepts list values now.

**Tests.**

- Unit test: list of three origins, request from each → 200.
- Unit test: regex entry, request matching → 200.
- Unit test: request from un-listed origin → 403 with log entry.
- Integration test: standalone install with `ALLOWED_ORIGIN=http://localhost:5173` works as today.
- Integration test: appliance-mode `ALLOWED_ORIGIN=https://tb.firm.com,http://192.168.1.50:5172` allows both primary and emergency-mode origins.

**Standalone impact.** Default value matches today's behavior. Existing `.env` files unaffected.

### 5.2 `MIGRATIONS_AUTO` env var

**Goal.** Standalone migrates on startup (preserves current behavior). Appliance disables auto-migration; appliance's `enable-app.sh` runs migrations as an explicit step with rollback.

**Action.**

- Server boot reads `MIGRATIONS_AUTO` (default `true`).
- If `true`: run `knex migrate:latest` before listening on port. Current behavior.
- If `false`: skip migration step, but check schema version via `knex migrate:currentVersion` and **refuse to start** if a migration is pending. Log a clear error: "Schema migration pending. Run migration container before starting server."
- Provide a separate command for migration-only runs: `node dist/migrate.js` (wrapper around `knex migrate:latest`). This is what the appliance invokes as a one-shot container.

**Tests.**

- `MIGRATIONS_AUTO=true` (default): server applies pending migrations and starts.
- `MIGRATIONS_AUTO=false` with no pending migrations: server starts.
- `MIGRATIONS_AUTO=false` with pending migrations: server exits with the documented error.
- Migration-only command: applies migrations, exits 0; idempotent if no pending migrations.

**Standalone impact.** None — `MIGRATIONS_AUTO` defaults to `true`.

### 5.3 `/health` and `/ping` audit

**Goal.** `/health` returns 503 (not 200) when DB is down. `/ping` is cheap liveness for HAProxy backend health check.

**Action.**

- Audit existing `/api/v1/health`. If it returns 200 when the Express process is up regardless of DB state, change to:
  - 200 with `{ok: true, version, checks: {db: {ok: true, ms: <n>}, schema: {ok: true, current, expected}}}` when all checks pass.
  - 503 with `{ok: false, checks: {...}}` when any check fails.
- Add `/api/v1/ping` returning 200 with `{ok: true, version}` regardless of DB state. Used by Docker `HEALTHCHECK` and by the appliance's HAProxy backend probes.
- Don't conflate liveness with readiness — `/ping` is "process is up," `/health` is "process is ready to serve traffic."

**Tests.**

- Stop Postgres → `/health` returns 503 within 5s; `/ping` keeps returning 200.
- Pending migration with `MIGRATIONS_AUTO=false` → `/health` returns 503 with `schema.ok: false`.
- Healthy state → `/health` returns 200 with all checks ok.

**Standalone impact.** Existing customers' monitoring that pings `/health` will start seeing 503s during DB outages — which is the *correct* behavior, but technically a change. Document in the release notes.

### 5.4 Anthropic API key configuration with graceful degradation

**Goal.** AI support chat (Sonnet-backed) works when configured, gracefully disables when not. Customers who don't want to pay Anthropic for chat features can run TB without it.

**Action.**

- New env var:
  - `ANTHROPIC_API_KEY` — Claude API key. Optional. If empty, AI support chat is disabled.
- Boot logic:
  - If `ANTHROPIC_API_KEY` is set: AI features enabled; key is validated on first chat request (not at startup, to keep startup fast).
  - If unset: AI chat UI is hidden everywhere. No errors, no broken affordances. The "Help" button still works for documentation; the chat tab simply doesn't appear.
- Health endpoint reports AI status separately from required dependencies. Health stays green even if AI is down — AI is non-essential.
- Future enhancement (out of scope for this addendum): support `LLM_ENDPOINT` + `LLM_MODEL` for self-hosted alternatives (Qwen3-8B via local Ollama). The hooks should be in place but the implementation can come in v1.1.

**Tests.**

- `ANTHROPIC_API_KEY` unset: AI chat UI hidden everywhere. App fully functional.
- Valid key: chat works; sample request returns coherent response.
- Invalid key: first chat request returns user-friendly error; UI explains "AI chat is misconfigured" without breaking other features.
- API outage (Anthropic down): chat shows "temporary unavailable"; rest of app unaffected.

**Standalone impact.** Existing customers with `ANTHROPIC_API_KEY` set see no change. Customers without it get the same hidden-chat behavior they have today.

### 5.5 Tax code crosswalk update path

**Goal.** The 1,061 pre-built tax code mappings (UltraTax CS, Lacerte, GoSystem, CCH Axcess) ship with the image and need to be updateable for tax-year-end changes (typically December–January each year).

**Action.**

- Crosswalk lives in the image at `/app/data/tax-crosswalk-<tax-year>.json`. Multiple years bundled (e.g., `2024`, `2025`).
- App reads the configured year via `TAX_YEAR` env var, default to current year. Falls back to most recent available year if requested year is missing.
- Year-end update flow:
  1. Kurt updates the JSON in the repo for the new tax year.
  2. New image tag published.
  3. Appliance's update flow pulls new image; customer sees updated mappings on next restart.
  4. No DB migration needed — crosswalk is read-only reference data.
- Document: customers who want to override or add mappings (firm-specific custom mappings) do so via DB-stored override table that takes precedence over the bundled crosswalk. Already in TB's data model; verify and document.

**Tests.**

- Override table entry takes precedence over bundled crosswalk for the same source code.
- New tax year not yet released: app falls back to most recent year, logs a warning.

**Standalone impact.** None — current behavior preserved.

### 5.6 `docker-compose.appliance.yml`

**Goal.** A purpose-built appliance overlay distinct from the existing `docker-compose.prod.images.yml`.

**Why a new file rather than modifying the existing.** The existing `docker-compose.prod.images.yml` may publish host ports for direct standalone use of GHCR images (rather than build-from-source). The appliance overlay must *not* publish host ports — Caddy and HAProxy handle ingress. Two different deployment patterns, two different files, both pull the same images.

**Action.** Add `docker-compose.appliance.yml`:

```yaml
# docker-compose.appliance.yml
# Appliance overlay for Vibe-Trial-Balance. Used by Vibe-Appliance.
# For standalone GHCR-image deploys, use docker-compose.prod.images.yml instead.

services:
  vibe-tb-server:
    image: ghcr.io/kisaesdevlab/vibe-tb-server:${VIBE_TB_TAG:-latest}
    networks: [vibe_net]
    environment:
      DATABASE_URL: ${VIBE_TB_DATABASE_URL}
      ALLOWED_ORIGIN: ${VIBE_TB_ALLOWED_ORIGIN}
      JWT_SECRET: ${VIBE_TB_JWT_SECRET}
      ENCRYPTION_KEY: ${VIBE_TB_ENCRYPTION_KEY}
      DB_PASSWORD: ${VIBE_TB_DB_PASSWORD}
      ANTHROPIC_API_KEY: ${VIBE_TB_ANTHROPIC_API_KEY:-}
      TAX_YEAR: ${VIBE_TB_TAX_YEAR:-2025}
      MIGRATIONS_AUTO: "false"
      LOG_LEVEL: ${VIBE_TB_LOG_LEVEL:-info}
      PORT: "3001"
    volumes:
      - vibe-tb-uploads:/app/uploads
      - vibe-tb-imports:/app/imports
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/v1/ping"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

  vibe-tb-client:
    image: ghcr.io/kisaesdevlab/vibe-tb-client:${VIBE_TB_TAG:-latest}
    networks: [vibe_net]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
    depends_on: [vibe-tb-server]

networks:
  vibe_net:
    external: true

volumes:
  vibe-tb-uploads:
  vibe-tb-imports:
```

Notes:

- No Postgres service — points at shared appliance Postgres via `DATABASE_URL`.
- No published ports — Caddy fronts everything via `vibe_net`.
- `MIGRATIONS_AUTO: "false"` — appliance runs migrations as an explicit one-shot.
- Volumes named with `vibe-tb-` prefix so the appliance can find them for backup.
- Migration runs as one-shot via `docker compose run --rm vibe-tb-server node dist/migrate.js`.

**Backward compat.** `DATABASE_URL` is added as the preferred config var. Existing `DB_HOST`/`DB_PORT`/etc. keep working through one deprecation cycle (logged warning at startup), then removed. This requires a tiny code change in TB to construct `DATABASE_URL` internally from the deprecated vars when the new var is absent.

**Tests.**

- `docker compose -f docker-compose.appliance.yml config` validates.
- Composed with the appliance's parent compose: containers come up, `/health` returns 200 within 60s.
- Standalone `docker-compose.yml` and `docker-compose.prod.images.yml` still work unchanged.

### 5.7 `.appliance/manifest.json`

```json
{
  "schemaVersion": 1,
  "slug": "vibe-tb",
  "displayName": "Vibe Trial Balance",
  "description": "Tax preparation and trial balance workpaper application",
  "logo": "tb.svg",
  "userFacing": true,
  "image": {
    "server": "ghcr.io/kisaesdevlab/vibe-tb-server",
    "client": "ghcr.io/kisaesdevlab/vibe-tb-client",
    "defaultTag": "latest"
  },
  "ports": { "server": 3001, "client": 80 },
  "subdomains": [
    {
      "name": "tb",
      "target": "vibe-tb-client:80",
      "audience": "default",
      "emergencyPort": 5172
    }
  ],
  "depends": ["postgres"],
  "websocket": false,
  "env": {
    "required": [
      { "name": "JWT_SECRET", "generate": "hex32" },
      { "name": "ENCRYPTION_KEY", "generate": "hex32" },
      { "name": "DATABASE_URL", "from": "shared-postgres-url", "database": "vibe_tb_db", "user": "vibetb" },
      { "name": "DB_PASSWORD", "from": "shared-postgres-password" },
      { "name": "ALLOWED_ORIGIN", "from": "subdomain-url" }
    ],
    "optional": [
      { "name": "ANTHROPIC_API_KEY", "secret": true, "doc": "Claude API key for AI support chat. AI features disabled if absent." },
      { "name": "TAX_YEAR", "default": "2025", "doc": "Default tax year for crosswalk lookups" },
      { "name": "LOG_LEVEL", "default": "info" }
    ]
  },
  "database": { "name": "vibe_tb_db", "user": "vibetb" },
  "firstLogin": {
    "type": "default-credentials-forced-reset",
    "username": "admin",
    "password": "admin",
    "url": "/login",
    "note": "Default admin credentials are admin/admin. The app forces a password reset on first login."
  },
  "health": "/api/v1/health",
  "ping": "/api/v1/ping",
  "migrations": {
    "command": ["node", "dist/migrate.js"],
    "autoEnvVar": "MIGRATIONS_AUTO"
  },
  "backup": {
    "volumes": ["vibe-tb-uploads", "vibe-tb-imports"],
    "databases": ["vibe_tb_db"]
  }
}
```

Note: TB does not declare `optionalDepends: ["vibe-glm-ocr"]` because TB's AI features call Anthropic's hosted API rather than a self-hosted model. Future v1.1 enhancement could add `LLM_ENDPOINT` for self-hosted alternatives, at which point GLM-OCR would become an optional dependency.

### 5.8 Volume strategy

- Volumes: `vibe-tb-uploads` (PDF/CSV imports staged for processing), `vibe-tb-imports` (post-processing extracted data). No reports or exports volume — TB generates these on demand and streams them; nothing persistent beyond DB.
- Standalone `docker-compose.yml`: volumes declared with default driver, project-scoped.
- Appliance: same volume names, mapped to `/opt/vibe/data/apps/vibe-tb/` for Duplicati visibility.
- App code must not write non-ephemeral data outside these volumes.

**Standalone impact.** None.

### 5.9 Emergency-access compatibility

**Goal.** When accessed via the appliance's emergency proxy at `http://<server-ip>:5172`, all TB features work correctly. As noted in §4, TB is unique among Vibe apps in that emergency mode is a true full fallback — no PWA, no kiosk, no client portal, no magic-link flows to break.

**Action — same five items as MyBooks §3.14:**

1. **Disable HTTPS-redirect inside the app.** Audit Express middleware. Remove any `req.secure` redirect logic — Caddy handles redirects at the edge in primary mode, emergency path needs HTTP to stay HTTP.
2. **No `X-Forwarded-Proto: https` requirement.** Audit any middleware that demands HTTPS. Either drop or gate on `REQUIRE_HTTPS=true|false` env var defaulting to `false` in appliance mode.
3. **Host header allowlist tolerates IP:port form.** If validation exists, allowlist `<server-ip>:5172` patterns or read `ALLOWED_HOSTS` from env.
4. **Cookies use `secure: 'auto'`.** Express's session config should set Secure flag based on request scheme. **Hard-coded `secure: true` breaks emergency access silently** — login appears to succeed, then immediately logs out on next request.
5. **`/api/v1/ping` works without DB or Redis.** Already covered by §5.3.

**Tests.**

- Kill Caddy, hit `http://<lan-ip>:5172/`. Log in with valid credentials, navigate workpaper, save changes, log out. Should all succeed.
- Cookie inspection: log in via emergency URL, confirm session cookie is set without `Secure` flag and persists across requests on the same emergency URL.
- Stop Postgres container, hit `http://<lan-ip>:5172/api/v1/ping` → should still return 200.
- Verify no requests to `http://<lan-ip>:5172` redirect to `https://`. Use `curl -i` and check for absence of `Location:` headers with HTTPS scheme.
- AI chat over emergency: confirm AI requests still work (TB's AI uses outbound HTTPS to Anthropic, which is separate from the inbound HTTP-vs-HTTPS question).

**Standalone impact.** Items 1, 2, and 4 make standalone behavior more correct (any standalone running plain HTTP behind an external proxy benefits). Items 3 and 5 are no-ops in standalone if not currently broken.

---

## 6. PR plan

**Two PRs** against `KisaesDevLab/Vibe-Trial-Balance`, in order. TB's smaller gap list collapses what was three PRs in MyBooks/Payroll-Time into two.

### PR 1: Code changes — common-requirements gaps + emergency compat (sections 5.1, 5.2, 5.3, 5.4, 5.9)

The behavior-changing PR.

- `ALLOWED_ORIGIN` accepts comma-separated list with regex.
- `MIGRATIONS_AUTO` env var; explicit migration entrypoint.
- `/health` returns 503 on DB failure; add `/ping`.
- `ANTHROPIC_API_KEY` optional with graceful degradation.
- Emergency-access compatibility: HTTPS-redirect removal, `X-Forwarded-Proto` gating, cookie `secure: 'auto'`.
- Structured stdout logging audit if needed.

Estimated scope: ~10 files touched, mostly middleware and env-var handling.

### PR 2: Appliance overlay + manifest + volumes (sections 5.5, 5.6, 5.7, 5.8)

The "make it appliance-ready" PR. No app code changes — all configuration and metadata.

- Adds `docker-compose.appliance.yml`.
- Adds `.appliance/manifest.json` with `emergencyPort: 5172`.
- Updates `README.md` with a "Deploying as part of Vibe Appliance" section.
- Volume strategy documentation.
- Tax-year crosswalk update path documentation.

After PR 2 merges and a tagged image publishes, the Vibe-Appliance Phase 3 work for Vibe-TB becomes:

1. Drop `apps/vibe-tb.yml` overlay in the appliance repo.
2. Drop `env-templates/per-app/vibe-tb.env.tmpl`.
3. Test toggle on/off via primary, Tailscale, and emergency on a fresh droplet.

This is the lowest-effort integration of any Vibe app — TB is already most of the way there.

---

## 7. Backward compatibility commitments

Things that must not change for existing standalone customers:

- Existing standalone install path produces a working install on a fresh Ubuntu host with no env-var changes required.
- An existing customer's `.env` file continues to work after upgrade. `DB_HOST`/`DB_PORT`/etc. still functional through one deprecation cycle.
- Default port mappings unchanged.
- Default `admin` / `admin` first-login flow unchanged.
- AI chat behavior with `ANTHROPIC_API_KEY` set is identical to today.
- Database schema and data unaffected — no data migration needed.
- Existing `docker-compose.prod.images.yml` continues to work for customers who currently use it.

If anything in section 5 violates these, that section is wrong and needs revision.

---

## 8. Out of scope

Things deliberately **not** in this addendum:

- **Self-hosted LLM endpoint for AI chat** (LLM_ENDPOINT, LLM_API_KEY). The hooks should be in place mentally but the implementation is a v1.1 enhancement. Customers who can't or won't pay Anthropic run TB without AI chat for now.
- **Redis dependency.** Not currently used; not adding for v1.
- **Multi-tenant mode.** TB is single-firm by design; the appliance is single-firm by design; no change.
- **Knowledge base hot-reload.** AI support chat's knowledge base is bundled with the image. Changes ship with image updates.
- **SSO with other Vibe apps.** Each app keeps its own auth.
- **Mobile companion app.** Out of scope for the appliance work.

---

## 9. Definition of done

This addendum is complete when:

1. Both PRs are merged.
2. A new image tag is published to GHCR with both architectures verified.
3. Standalone install on a fresh Ubuntu 24.04 droplet via the existing flow produces a working app — same behavior as before this work.
4. Appliance integration test: parent appliance compose with this app's overlay brings up Vibe-TB at `tb.<test-domain>` with `admin` / `admin` first-login, forced password reset, basic workpaper creation, and AI chat (if `ANTHROPIC_API_KEY` provided) working.
5. Tailscale access test: `https://tb.<test-tailnet>.ts.net` works fully on a tablet joined to the test tailnet.
6. Emergency-access integration test: with Caddy stopped, `http://<lan-ip>:5172` allows full staff workflow — login, workpaper edit, save, log out — without any HTTPS redirects emitted by the app.
7. The seven backward-compat commitments in §7 hold under regression testing.

When that's true, the appliance Phase 3 integration of Vibe-TB reduces to the three-step task at the end of §6.

This is by a wide margin the smallest piece of integration work in the Vibe family. **TB is the right first app to integrate in the appliance.**
