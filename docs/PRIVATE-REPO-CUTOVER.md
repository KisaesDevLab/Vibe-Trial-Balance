# Private source repo, public images: owner cutover

Taking `KisaesDevLab/Vibe-Trial-Balance` private while Vibe Appliance and Docker users keep
pulling the images anonymously. The repo-side work is done (owner 2026-11-22):

- **Workflow:** `.github/workflows/docker-publish.yml` builds `linux/amd64` only, and still pushes
  with `GITHUB_TOKEN` (the `source` label links each package to this repo).
- **Images:**
  - `.dockerignore` keeps `.git`, `.env*`, tests, docs and source maps out of the build context.
  - The server image is built with `tsc --sourceMap false`, so it ships no `.map`, `src/` or tests.
  - The client image is the minified Vite bundle with no source maps.
- **Windows installer:** `installer/` now pulls the images and no longer ships `server/src` or
  `client/src`.
- **User-facing install files** (compose files, `.env.example`, a README, LICENSE, NOTICE) go to a
  public repo, `KisaesDevLab/vibe-tb-releases`, through `scripts/publish-release-files.ps1`.
- **Links:** the docs and the Sidebar link point there.

The images are `vibe-tb-server` and `vibe-tb-client`. The compose file's optional `ai` profile
also pulls `ghcr.io/kisaesdevlab/vibe-glm-ocr`. If that package is private, flip it public as
well, or the OCR profile will need a token.

## Steps (owner)

1. **Check the images before making anything public** (visibility is one-way). After the next
   `main` build:
   ```bash
   for i in vibe-tb-server vibe-tb-client; do
     docker run --rm --entrypoint sh ghcr.io/kisaesdevlab/$i:latest \
       -c 'find / -xdev \( -name "*.map" -o -name ".git" -o -name "CLAUDE.md" -o -name ".env*" -o -name "__tests__" \) 2>/dev/null'
     docker history --no-trunc ghcr.io/kisaesdevlab/$i:latest | grep -iE 'token|secret|password' || true
   done
   ```
   Expect no output. The server image's `node_modules` may contain third-party `.map` files; those
   come from public npm packages.
2. **Org settings:** Settings → Packages → Package creation must allow Public. This is done once
   for `KisaesDevLab`.
3. **Make both packages public:** org → Packages → `vibe-tb-server` → Package settings → Danger
   Zone → Change visibility → Public. Repeat for `vibe-tb-client` (and `vibe-glm-ocr` if it is
   used).
4. **Create the release repo:**
   - Create `KisaesDevLab/vibe-tb-releases` on GitHub, public and empty.
   - Decide whether its Issues are open. The Inno installer's support URL is `<repo>/issues`.
   - Then, from this repo:
     ```powershell
     pwsh scripts/publish-release-files.ps1 -DryRun
     pwsh scripts/publish-release-files.ps1
     git -C C:\Projects\vibe-tb-releases remote add origin https://github.com/KisaesDevLab/vibe-tb-releases.git
     git -C C:\Projects\vibe-tb-releases push -u origin main
     ```
   - Re-run the script (with `-Push`) whenever the compose files or `.env.example` change.
5. **Licence wording (still open, owner's call):** `NOTICE` says "Source code:
   https://github.com/KisaesDevLab/Vibe-Trial-Balance". `COMMERCIAL_LICENSE.md` and
   `docs/LICENSING_FAQ.md` link there too. Once the repo is private, decide what licensees are
   told about getting the source. Keep the `Required Notice` line unchanged.
6. **Old releases:** the repo has two releases, `v0.1.0-polyform` and `v0.1.0-elv2`. Neither has
   any assets, so they can be deleted or left; nothing public depends on them.
7. **Make the source repo private:** Settings → General → Danger Zone → Change repository
   visibility → Private. Stars and watchers are dropped, and Actions minutes become metered.
8. **Verify** from a machine not logged in to GHCR:
   ```bash
   docker logout ghcr.io
   docker pull ghcr.io/kisaesdevlab/vibe-tb-server:latest
   docker pull ghcr.io/kisaesdevlab/vibe-tb-client:latest
   curl -fsSLO https://raw.githubusercontent.com/KisaesDevLab/vibe-tb-releases/main/docker-compose.prod.yml
   ```
   - On an appliance, Configuration → System → GitHub access should list both images as `public`.
     The console caches this for about 10 minutes.
   - Then disable and re-enable the app, and run an update check.
9. **Tokens:** once every image a customer uses is public, remove the appliance's
   `read:packages` token and revoke any tokens you issued.
   - Source builds still need a `read:packages` token for `@kisaesdevlab/vibe-auth`, plus access
     to this repo.

## Arm64

The arm64 builds were dropped. Images up to and including v0.1.58 are multi-arch; later ones are
amd64 only. A Pi running Docker stays on v0.1.58 unless arm64 comes back. To restore it, add the
two `ubuntu-24.04-arm` matrix entries back to the workflow.
