# Single sign-on (Vibe Auth) — operator notes

Trial Balance signs users in through `@kisaesdevlab/vibe-auth`. Sessions stay the same 8 h bearer tokens; an SSO login lands on `/login#sso_token=…` and the SPA stores it like a password login.

- **Mode** — `VIBE_AUTH_MODE=local|both|oidc_only` (default `local`). Admins can change it under **Admin → Authentication** (`/settings/authentication`); the stored value overrides the env.
- **Identity provider** — `VIBE_OIDC_ISSUER`, `VIBE_OIDC_CLIENT_ID`, `VIBE_OIDC_CLIENT_SECRET`, `VIBE_OIDC_PUBLIC_URL` (this app's public URL, `https://host/tb` in multi-app mode; falls back to the Settings public URL / `APP_BASE_URL`), optional `VIBE_OIDC_INTERNAL_BASE`, `VIBE_OIDC_ROLE_MAP` (JSON, IdP group → `admin|reviewer|preparer`), `VIBE_OIDC_DEFAULT_ROLE`, `VIBE_OIDC_ALLOW_JIT`, `VIBE_OIDC_REQUIRE_MFA_AMR`, `VIBE_OIDC_IDP_NAME`. Register the redirect URI `<public URL>/auth/oidc/callback` and the back-channel logout URI `<public URL>/auth/oidc/backchannel` with the provider.
- **Reverse proxy** — `/auth/*` must reach the API like `/api/*` does (`deploy/nginx*.conf` and the Vite dev proxy already do this).
- **Break-glass account** — `VIBE_BREAKGLASS_USERNAME` (default `vibe-breakglass`), optional `VIBE_BREAKGLASS_PASSWORD`. Provision or rotate from `server/` with the app's env: `npx vibe-auth breakglass ensure | rotate | status` (prints the password once). It signs in at `/login/local`; `oidc_only` refuses to start without it.
- **Revocation** — an IdP back-channel logout revokes the user's tokens (`auth_revocations`, checked on every request, ≤ 30 s cache). Local sign-out of an SSO session calls `/auth/oidc/logout?local=1`, which keeps the provider session.
- **Audit** — every SSO event is an `audit_log` row with `entity_type = 'auth'` and `action = vibe.auth.*`.
- **Migration** — `20260916000001_vibe_auth.js` creates `auth_identities`, `auth_settings`, `auth_revocations` (package SQL) and `auth_sessions_oidc`.
