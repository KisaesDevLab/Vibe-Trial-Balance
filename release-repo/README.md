# Vibe Trial Balance

Self-hosted trial balance, adjusting entries, tax mapping and workpaper application for
accounting firms, by Kisaes LLC.

This repository holds the files you need to **run** Vibe Trial Balance. The application ships as
two public container images:

| Image | Pull |
| --- | --- |
| Server (API) | `docker pull ghcr.io/kisaesdevlab/vibe-tb-server:latest` |
| Client (web) | `docker pull ghcr.io/kisaesdevlab/vibe-tb-client:latest` |

Images are `linux/amd64`. Tags: `latest`, release tags (`0.1.59`, `0.1`, `0`) and `sha-<commit>`.

## Vibe Appliance

On a Vibe Appliance, enable Vibe Trial Balance from the console. Nothing here is needed.

## Install with Docker Compose

Needs Docker with the Compose plugin.

```bash
mkdir -p /opt/vibe-tb && cd /opt/vibe-tb
curl -LO https://raw.githubusercontent.com/KisaesDevLab/vibe-tb-releases/main/docker-compose.prod.yml
curl -LO https://raw.githubusercontent.com/KisaesDevLab/vibe-tb-releases/main/.env.example
cp .env.example .env
# Edit .env: set DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY and ALLOWED_ORIGIN
# (each has a "Generate:" hint).
docker compose -f docker-compose.prod.yml up -d
```

Open `http://<host>` and sign in as `admin` / `admin1234`. You are asked to choose a new password
at once.

To share a host with other Vibe apps behind a Caddy ingress, also download
`docker-compose.grouped.yml`, set `VITE_BASE_PATH=/tb/` and `VIBE_HOST` in `.env`, and add
`-f docker-compose.grouped.yml` to every compose command.

## Upgrade

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Database migrations run on start. Pin a release with `IMAGE_TAG` in `.env` to control when you
upgrade. Take a backup (in the app: Backup & Restore) first.

## Licence

PolyForm Small Business License 1.0.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Larger
organisations need a commercial licence from Kisaes LLC.

## Support

Contact Kisaes LLC.
