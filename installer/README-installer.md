# Building the Vibe Trial Balance Windows Installer

## Prerequisites

1. **Inno Setup 6+** — Download free from https://jrsoftware.org/isdl.php
2. A checkout of this repository (the installer packs `docker-compose.prod.yml`, the batch
   scripts, LICENSE and NOTICE; no application source)

## Building the Installer

1. Open **Inno Setup Compiler** from the Start Menu
2. File → Open → select `installer/vibetb-installer.iss`
3. Click **Compile** (or press Ctrl+F9)
4. The installer is created at `installer/Output/VibeTB-Setup.exe`

## What the Installer Does

1. Shows a welcome screen and the PolyForm Small Business 1.0.0 license agreement
2. Checks for Docker Desktop — if not installed, opens the download page
3. Lets the user choose an install directory (default: `C:\VibeTB`)
4. Copies `docker-compose.prod.yml` and the batch scripts; the app runs from the public images
   `ghcr.io/kisaesdevlab/vibe-tb-server` and `vibe-tb-client` (amd64), pulled on first launch
5. Generates unique random secrets for JWT, encryption, and database password
6. Creates Start Menu and Desktop shortcuts
7. Optionally launches the app after installation

## What the User Needs

- **Windows 10/11** (64-bit)
- **Docker Desktop** — the installer prompts to download if missing
- **Internet connection** for first launch and updates (Docker pulls the app images)
- ~2 GB free disk space (Docker images + database)

## Shortcuts Created

| Shortcut | Action |
|----------|--------|
| Vibe Trial Balance | Starts the app and opens the browser |
| Stop Vibe TB | Stops all containers (preserves data) |
| Update Vibe TB | Downloads the latest images and restarts |

## Updating the App

Run "Update Vibe TB" from the Start Menu (or `update.bat`). It pulls the tag set by `IMAGE_TAG`
in `.env` (default `latest`) and recreates the containers; data is kept.

## Uninstalling

Use "Add or Remove Programs" in Windows Settings. The uninstaller:
- Removes app files and shortcuts
- Does NOT remove Docker Desktop
- Does NOT delete the database (Docker volume `pgdata` persists)

To fully remove data: run `docker volume rm vibetb_pgdata` after uninstalling.

## Customization

- **Port**: Edit `docker-compose.prod.yml` — change `"80:80"` to your desired port
- **API Key**: After install, edit `.env` in the install directory to add `ANTHROPIC_API_KEY`, or configure it in Admin > Settings after logging in
- **HTTPS**: For internet-facing deployments, add a reverse proxy (Caddy, Nginx) in front — see the main README for Caddy/Certbot instructions
