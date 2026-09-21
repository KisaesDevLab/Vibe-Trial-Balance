# Single sign-on (Vibe Auth) — operator notes

Trial Balance signs users in through `@kisaesdevlab/vibe-auth`, the shared Vibe identity package:
Authorization Code + PKCE against the firm's identity provider (the Vibe Auth broker / authentik on the
appliance, or any OpenID Connect provider), just-in-time provisioning, IdP group → role sync, back-channel
logout, a Settings → Authentication page and a break-glass local admin. The package owns the OIDC flow; the
product side of the contract lives in `server/src/lib/vibeAuth.ts` (engine, session adapter, `/auth/*`
middleware, local-login policy) and `server/src/lib/vibeAuthUsers.ts` (user adapter over `app_users`, audit
sink), shared with the break-glass CLI adapter `server/src/vibeAuthAdapter.ts`.

**Session model.** Sessions stay the same 8 h bearer JWTs a password login mints. An SSO login mints one
with a `sid` claim and lands the browser on `/login#sso_token=<jwt>`; the login page stores it exactly like
a password login (the fragment never reaches a server or a log). The identity behind the token (issuer,
subject, IdP session id, ID token) is parked in `auth_sessions_oidc` keyed by `sid`, so RP-initiated logout
and back-channel logout can find it. Local login is never removed; SSO is additive (mode `local` by default).

## Environment

Set by the appliance console at registration (never by hand on an appliance), or by the operator on a
standalone install. Values saved on Settings → Authentication (`auth_settings`) override the environment.

| Variable | Meaning |
|---|---|
| `VIBE_AUTH_MODE` | `local` (default) — password/passkey only; `both` — SSO button plus local login; `oidc_only` — SSO only, local login refused except for the break-glass user. Changed from Settings → Authentication or the console Identity panel; registration never sets it. |
| `VIBE_OIDC_ISSUER` | The provider's issuer URL (discovery at `<issuer>/.well-known/openid-configuration`). |
| `VIBE_OIDC_CLIENT_ID` / `VIBE_OIDC_CLIENT_SECRET` | The registered client. The secret is stored encrypted with `ENCRYPTION_KEY` when saved through Settings. |
| `VIBE_OIDC_PUBLIC_URL` | This app's public URL **including its prefix** (`https://host/tb` in multi-app mode). The redirect URI is `<public URL>/auth/oidc/callback`, the back-channel logout URI `<public URL>/auth/oidc/backchannel`. Falls back to the Settings public URL / `APP_BASE_URL`. |
| `VIBE_OIDC_INTERNAL_BASE` | Optional container-to-container base for discovery/token calls when the public issuer is not reachable from inside the network. |
| `VIBE_OIDC_ROLE_MAP` | JSON, IdP group → `admin` / `reviewer` / `preparer`. Default: `vibe-admin`, `vibe-it`, `vibe-partner` → `admin`; `vibe-manager` → `reviewer`; `vibe-staff` → `preparer`. |
| `VIBE_OIDC_DEFAULT_ROLE` | Role for a provisioned user matching no group. |
| `VIBE_OIDC_ALLOW_JIT` | Create unknown users on first login (default on). Off = only pre-created users (linked by verified email) may sign in. |
| `VIBE_OIDC_REQUIRE_MFA_AMR` | Refuse an SSO login whose `amr` claim shows no second factor. Recommended on, since the IdP's MFA stands in for the firm's local 2FA policy (below). |
| `VIBE_OIDC_IDP_NAME` | Button label on the login page. |
| `VIBE_BREAKGLASS_USERNAME` | Default `vibe-breakglass`. `VIBE_BREAKGLASS_PASSWORD` is read only by the CLI when provisioning. |

## Paths and proxies

The engine is created with `basePath: ""` and answers `/auth/*` on the API, outside `/api/v1`. Every
deployment strips the SPA prefix before the API sees a request (the Vite dev proxy, the single-app nginx,
the appliance Caddy `handle_path /tb/*`), while the React components get the prefix from
`import.meta.env.BASE_URL`; the redirect URI is always built from `VIBE_OIDC_PUBLIC_URL`, never from
`basePath`. **The reverse proxy must route `/auth/*` to the API like `/api/*`** — `deploy/nginx.conf`,
`deploy/nginx-docker.conf` and `client/vite.config.ts` do; on the appliance the manifest's `/auth/*` matcher
does (`.appliance/manifest.json`, a vendored copy of `Vibe-Appliance/console/manifests/vibe-tb.json`).

| Route | Purpose |
|---|---|
| `GET /auth/status` | Mode, whether SSO is enabled/reachable, the start path. Unauthenticated; the login page reads it. |
| `GET /auth/oidc/start[?return_to=]` | Begin the PKCE login. |
| `GET /auth/oidc/callback` | Provider redirect; ends on `<return_to>#sso_token=<jwt>`. |
| `GET /auth/oidc/logout[?local=1]` | RP-initiated logout (bearer). Without `local=1` the browser is sent to the provider's end-session endpoint and back to `/auth/oidc/logged-out`; with it only the app session ends. |
| `POST /auth/oidc/backchannel` | Provider back-channel logout (form `logout_token`). Revokes the user's tokens. |
| `GET /auth/me` | The engine's view of the current user and linked identities (bearer). |
| `GET/PUT /auth/settings`, `POST /auth/settings/test` | Settings → Authentication API, admin only. Enabling `oidc_only` needs a provisioned break-glass user **and** a successful test connection by the same admin within the hour. |

The browser-driven steps (`start`, `callback`, `exchange`, `settings/test`) are rate-limited at 100 per
15 minutes per address; the back-channel endpoint is not, because the provider posts from one address for
every user.

## Break-glass account

`vibe-breakglass` is a local admin, the one account that may sign in locally while the mode is `oidc_only`;
the server refuses to start in that mode without it (missing **or** inactive).

- **Sign-in identifier: the username `vibe-breakglass`** (or whatever `VIBE_BREAKGLASS_USERNAME` is set
  to), typed into the *Username* box at `/login/local`, with the password from the console's secret store.
  Trial Balance signs in by username, not by email: the account's address `breakglass@vibe-tb.local` is a
  placeholder that receives no mail and is **not** a sign-in identifier.
- **Protected account.** In every sign-in mode (`local`, `both`, `oidc_only`) no admin can deactivate it,
  change its role away from `admin`, or rename it: `PATCH`/`DELETE /api/v1/users/:id` answer
  `409 { error: { code: "BREAKGLASS_PROTECTED" } }` and the attempt is audited (`breakglass_protected`).
  Role sync from the identity provider never demotes it either. Display name, email and password remain
  editable; an admin password set on this account does **not** set `must_change_password`, so the
  emergency account is never trapped in a forced rotation. The account is recognised by username
  (case-insensitive) — `server/src/lib/accountGuards.ts`. Change it the supported way: `vibe identity
  rotate-breakglass` on the appliance, or the CLI below.
- **Second factor.** The firm's admin policy `security.require_two_factor` (default **off**) decides. Off: break-glass is password only. On: break-glass is treated like anyone else — its first
  password sign-in lands on the two-factor enrolment screen and it must enrol before it gets in. Enrolment
  is local (an authenticator app needs no network), so this still works while the identity provider is
  down, but do not leave it for the outage: **enrol TOTP at provisioning** and keep the seed with the
  password. A lost factor is cleared with `npm run reset-2fa -- vibe-breakglass` (from `server/`).
- **No self-service password reset** for this account (see below); rotate it instead.
- **The appliance's "break-glass ready" pill means only that a password is stored** in the console's
  secret store. It does not prove the account is active in this app, that the stored password still
  matches (an admin may have changed it here), or that a second factor is enrolled. `breakglass status`
  (below) answers the first; a test sign-in at `/login/local` answers the rest.

Provision or rotate it with the package CLI, which finds this app's users through
`server/src/vibeAuthAdapter.ts`:

```
# host / PM2 deploy (from server/, with the app's env)
npx vibe-auth breakglass ensure | rotate | status

# inside the published image (WORKDIR is /app; the image sets VIBE_AUTH_ADAPTER for the CLI)
docker exec -i vibe-tb-server node server/node_modules/@kisaesdevlab/vibe-auth/dist/cli.js breakglass status
```

`ensure` prints the generated password **once** (`--json` for machines); the appliance console runs the
manifest's `sso.breakglassCommand` at registration and stores the password in its secret store
(`sudo vibe credentials`). Provisioning and every break-glass sign-in are audited.

## Two-factor and password rules for SSO sessions

SSO tokens carry no `stage` claim, so the firm's local `security.require_two_factor` policy never bounces an
SSO user to enrolment — the identity provider's MFA stands in (turn on `VIBE_OIDC_REQUIRE_MFA_AMR` so the
IdP is actually asked for it). Likewise the forced password rotation (`must_change_password`) is skipped
for SSO tokens: the flag is about the local credential, which the session never used; it still applies to
that user's next password login. **Every local sign-in path honours the mode**: password login, and passkey
sign-in (a passkey is a local credential, so in `oidc_only` only the break-glass user may use one).

## Accounts that only sign in through the identity provider

A just-in-time provisioned user has no usable local password (a bcrypt hash of random bytes fills the
`NOT NULL` column) and carries `app_users.sso_only_since`. **Self-service password reset ("Forgot
password") is refused for such an account** while it has a linked identity (`auth_identities`), and for the
break-glass account: otherwise access to the mailbox alone would mint a local password for an account
whose only credential is the identity provider, around the provider's MFA and offboarding. The refusal is
invisible to the caller — `POST /api/v1/auth/password-reset/request` gives the same `200` and the same body
as for an unknown identifier, mints no token, sends no mail — and leaves an `audit_log` row
(`entity_type = 'user'`, `action = 'password_reset_refused'`).

An admin can still give such a user a local password (Users → edit → password, or an invite); that clears
`sso_only_since` and self-service reset applies from then on. An existing local user who was later *linked*
by verified email keeps a real password and is unaffected. Every code path that writes a real
`password_hash` must clear `sso_only_since`; a forgotten one fails closed (reset refused, admin set works).

## Role sync

IdP groups map to roles through the explicit `VIBE_TB_ROLE_MAP` in `server/src/lib/vibeAuth.ts` (the table
under `VIBE_OIDC_ROLE_MAP` above; pinned by `vibeAuthWiring.test.ts`) unless Settings or the environment
override it, and the role is re-evaluated on every SSO sign-in. One demotion is never applied: **the last
active admin stays an admin** — the break-glass account does not count as another admin, and is itself
never demoted. The sign-in succeeds with the role the account holds, and `audit_log` gets a
`vibe.auth.role.demotion_refused` row (`reason`: `last_admin` or `breakglass`). The package cannot be told
about the refusal, so its own `vibe.auth.role.changed` row still follows it; the refusal row and
`app_users.role` are the truth. Fix the group membership at the provider, or make someone else an admin
first.

## Registration

On the appliance nothing is registered by hand: `lib/identity.sh` reads the manifest's `sso` block
(`redirectPaths`, `logoutPaths`, `internalUrl`, `breakglassService`/`breakglassCommand`), registers the
product with the Vibe Auth broker, writes the returned `VIBE_OIDC_*` block into `/opt/vibe/env/vibe-tb.env`,
recreates the container and provisions the break-glass admin. On a standalone install register the product
with the broker yourself:

```
POST <vibe-auth>/vibe-auth/registrations
{ "slug": "vibe-tb", "displayName": "Vibe Trial Balance",
  "baseUrl": "https://host/tb", "internalUrl": "http://vibe-tb-server:3001",
  "redirectPaths": ["/auth/oidc/callback"], "logoutPaths": ["/auth/oidc/backchannel"] }
```

and put the returned env block into the server's environment. With any other OpenID Connect provider,
register the redirect URI `<public URL>/auth/oidc/callback` and the back-channel logout URI
`<public URL>/auth/oidc/backchannel` (or `<internal URL>/auth/oidc/backchannel` when the provider can reach
the container network directly).

## Migration, audit, revocation

- `server/migrations/20260916000001_vibe_auth.js` creates `auth_identities`, `auth_settings`,
  `auth_revocations` (the package's own SQL, verbatim) and this app's `auth_sessions_oidc`.
- `server/migrations/20260920000001_sso_only_marker.js` adds the nullable `app_users.sso_only_since` and
  backfills it for accounts that were already provisioned by SSO (identity linked within a minute of the
  user row's creation, never invited, no forced rotation pending, no audit trail of a password being set).
  Reversible: `down` drops the column.
- Every package event is an `audit_log` row with `entity_type = 'auth'`, `action = vibe.auth.*` (login
  success/failure, user provisioned/linked, role changed, logout, mode/settings changed, break-glass
  used/rotated), the user id in `entity_id`/`user_id` and the event payload as JSON in `description`.
- A back-channel logout revokes the user's tokens through `auth_revocations`, checked on **every** request
  in `authMiddleware` ahead of its 30 s user cache; a later login stays valid. A back-channel token that
  carries only the provider's `sid` and no `sub` cannot reach this app's tokens (their `sid` is the app's
  own id) — real providers send `sub`. User-initiated logout drops the identity row and the SPA discards
  the token; it does not revoke it. Rows in `auth_sessions_oidc` older than one token lifetime are swept
  on each SSO login.

## Building from source

`@kisaesdevlab/vibe-auth` is served from GitHub Packages, which refuses anonymous reads even for public
packages. Published GHCR images need nothing. Building yourself:

- **Developers and the Pi deploy (`deploy/deploy.sh`)** need a GitHub token with `read:packages` in
  `~/.npmrc`: `//npm.pkg.github.com/:_authToken=<token>` (with the GitHub CLI signed in,
  `gh auth token`). `server/.npmrc` and `client/.npmrc` only map the `@kisaesdevlab` scope to the registry;
  the token is never committed.
- **Docker** takes the token as a BuildKit secret that never lands in a layer:
  `docker build --secret id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN -f Dockerfile.server .` (and
  `docker-compose.build.yml` reads `NODE_AUTH_TOKEN` from the environment).
- **GitHub Actions** (`docker-publish.yml`, `sso-e2e.yml`) use `GITHUB_TOKEN`, which can read the package
  once the package grants this repository access: Vibe-Auth → Packages → `vibe-auth` → Package settings →
  *Manage Actions access* → add `trial-balance-app` (read).

## Testing

- `npm run test:sso-e2e` (repo root or `server/`): boots the real server against a scratch database and
  the fake OpenID provider in `test/fake-idp.mjs` and walks status in `local`/`both`, PKCE login → JIT with
  the mapped role, email link + role sync, unverified email denied, `/auth/settings` 403/200, the
  `oidc_only` guard, break-glass provisioning + local login + audit, back-channel revocation, a fresh login
  after revocation, RP-initiated logout, boot refusal without break-glass, `oidc_only` itself, and the
  hardening rules (H1–H4: break-glass protected from deactivate/demote/rename in mode `both`, no forced
  rotation for it, self-service reset refused for SSO-only and break-glass accounts with the
  unknown-account answer, last-admin demotion refused). Needs a
  Postgres the dev credentials can `CREATE DATABASE` on (`docker compose up -d db`); point
  `E2E_PG_ADMIN_URL` at it when it is not on 5432. Runs in CI (`.github/workflows/sso-e2e.yml`).
- `cd server && npm test` includes `vibeAuthWiring.test.ts` (fragment hand-off, revocation hook, rate-limit
  path set, local-login policy, the pinned group → role map), `accountGuards.test.ts` (the break-glass,
  self-service-reset and last-admin rules) and the SSO cases in `authGates.test.ts`.
- Against a real provider: the Vibe-Auth repo's `test/compose.yml` stack (authentik), then Settings →
  Authentication → Test connection.

## Deviations from the integration plan (`Vibe-Auth/docs/INTEGRATION-PLAN.md`)

1. **Stateless JWT, not a cookie session** (rule I6): the token is handed to the SPA on the redirect's
   fragment; `auth_sessions_oidc` maps `sid` → identity; revocation is checked on every request.
2. **Prefix handling** (rule I2): engine `basePath: ""`, SPA `import.meta.env.BASE_URL`, redirect URI from
   `VIBE_OIDC_PUBLIC_URL`; the engine's browser-facing paths are re-prefixed by `lib/vibeAuth.ts`.
3. **No `guardLocalLogin` middleware from the package** (rule I5): `requireLocalLoginAllowed` /
   `localLoginRefusal` keep this API's `{ data, error }` envelope and cover passkey sign-in too.
4. **Break-glass CLI in the image** resolves the adapter through `VIBE_AUTH_ADAPTER` baked into
   `Dockerfile.server`, because the image's `WORKDIR` is `/app` while the app lives in `/app/server`.
5. **The product manifest is a vendored copy** of the console's `vibe-tb.json`; edit the console file and
   copy it here, never the other way round.
