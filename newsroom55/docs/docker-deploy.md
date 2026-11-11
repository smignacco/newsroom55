# NEWSROOM 55 — Docker deploy

Run the board as a single Compose service on your workstation. The Cisco Board then opens the URL in RoomOS Web Engine. This app does **not** depend on a Raspberry Pi or Home Assistant.

Run the Compose commands below from the repository root. Application source and
Home Assistant packaging live together in `newsroom55/`.

## What you need

- Docker Engine + Docker Compose v2
- Docker Desktop on macOS or Windows, or Docker Engine on Linux
- A `.env` file with admin credentials (never commit it)

The production image was built and the Compose service was started successfully on the Cloud Agent VM on 2026-11-10. `/api/health` reports healthy and the SQLite named volume survives container recreation.

## Configure

```bash
cp .env.example .env
```

Set at least:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Admin login (default `admin`) |
| `ADMIN_PASSWORD` | Min 8 characters. Hashed with bcrypt on boot; never stored in plaintext |
| `SESSION_SECRET` | Random string, ≥16 characters, for signed session cookies |
| `TZ` | Default `America/Montreal`; display timezone is adjustable in `/admin` |
| `MARKETS_PROVIDER` | Default `hybrid`: Cboe for selected US symbols plus Twelve Data only where assigned |
| `FINNHUB_API_KEY` or `TWELVE_DATA_API_KEY` | Optional metered provider; international coverage depends on its plan |
| `TWELVE_DATA_REFRESH_MINUTES` | Default `30`, never accepted below 15 minutes |
| `TWELVE_DATA_MAX_SYMBOLS` | Default and hard maximum `6` to protect API credits |
| `ROOMOS_DEVICE_IP`, `ROOMOS_USERNAME`, `ROOMOS_PASSWORD` | Local Board API connection used by setup and the protected `/remote` |
| `NEWSROOM_URL` | Docker host LAN URL that RoomOS should display |
| `ROOMOS_APPLY` | Keep `0` for dry run; set `1` only when ready to change the Board |

Do not put IPTV passwords in the browser. If you later add a stream URL in `/admin`, it is stored server-side only.

The Finance screen has separate **Cboe** and **Twelve Data** search choices. Cboe requires no key: use it for US stocks and ETFs. With `MARKETS_PROVIDER=hybrid`, each instrument stores its own provider, so only explicitly assigned symbols consume Twelve Data credits. The administrator can change that assignment from the ticker list. Twelve Data’s Basic plan is free but regular international coverage may require a paid plan. NEWSROOM enforces at most six enabled Twelve Data symbols and a default 30-minute refresh.

## Start

```bash
docker compose up --build -d
```

On a Linux host where Docker bridge egress is restricted, use the included host-network override:

```bash
docker compose -f docker-compose.yml -f docker-compose.host.yml up --build -d
```

The override is Linux-only. Docker Desktop users should use the standard command.

- Service name: `newsroom55`
- Port: `3000` → container `0.0.0.0:3000`
- Restart: `unless-stopped`
- Volume: `newsroom-data` → `/app/data` (SQLite)
- Health: `GET /api/health`

Local URL: [http://localhost:3000](http://localhost:3000)  
Admin: [http://localhost:3000/admin](http://localhost:3000/admin)
Mobile remote: [http://localhost:3000/remote](http://localhost:3000/remote)

Logs: `docker compose logs -f newsroom55`

Stop: `docker compose down` (volume is kept). Wipe the database with `docker compose down -v`.

## Persistence

News sources, cached headlines, market symbols, TV channel records, appearance settings, and the hashed admin password live in SQLite under the volume. They survive container restarts.

## macOS / Windows notes

- **macOS Docker Desktop:** `localhost:3000` works on the Mac. Other devices on the LAN must use the Mac’s LAN IP (System Settings → Network), not `localhost`. File sharing / VirtioFS does not matter because data is a named volume.
- **Windows Docker Desktop:** same idea — Board devices use the PC’s LAN IPv4 address. Hyper-V vs WSL2 backends both bind `0.0.0.0:3000` if the Compose port mapping is unchanged. Windows Firewall must allow TCP 3000 on the private network.
- **Linux:** bind is `0.0.0.0:3000`. Open the firewall for your LAN only; do not publish admin to the internet.

## HTTPS for the Board

RoomOS Web Engine should load **HTTPS** in production. This Compose file serves HTTP for local development.

Typical workstation pattern (not bundled here):

1. Give the PC a local DNS name (for example `newsroom.lan`).
2. Terminate TLS on Caddy, nginx, or Traefik in front of port 3000 with a certificate the Board trusts (private CA installed on the device, or a public cert).
3. Do **not** disable certificate validation on the Board to “make it work.”

HTTP is acceptable on the same machine for development. For the Board, use HTTPS.

## After start

Confirm:

```bash
curl -sS http://localhost:3000/api/health
```

Expect `ok: true`, `tz: "America/Montreal"`, and `video: "waiting"` until an HLS channel is enabled (`hls-ready` afterward). Markets should report provider `cboe`, `configured: true`, and delayed values for the stocks selected in `/admin`.

In `/admin` → **Television**, select one or more verified playlist files from the official `iptv-org/iptv` repository directory. Each list can be monitored manually, every 15 minutes, hourly, every 6 hours, or daily. The container needs outbound DNS plus HTTPS access to `api.github.com`, `raw.githubusercontent.com`, and the selected stream hosts.

Repository checks use the playlist ETag and only process changed content. Existing station rows are updated in place by stable catalogue identity, so an enabled station keeps its selection when its source URL changes. New stations remain disabled. A station removed from its source list is disabled and marked for attention rather than silently retaining a stale source.

Select one or more HLS entries and optionally set a default. The dashboard starts one selected stream muted through its same-origin signed proxy. A successful Chromium test does not prove that every upstream stream or the RoomOS Web Engine will work; follow `docs/roomos-setup.md` on the Board.

Do not expose `/admin` beyond your LAN. The login is a hashed password, not a substitute for network isolation.

## Mobile remote

Open `http://<DOCKER-HOST-LAN-IP>:3000/remote` on a phone connected to the same LAN. Sign in with the admin account. The page can select a 1–4 source layout, switch between equal-grid and focus layouts, choose the large focused source while the other live streams remain visible as thumbnails, assign an enabled HLS channel to every slot, choose exactly one source for audio, mute or unmute the dashboard, raise or lower the Board master volume, put the Board in standby, request half-wake so signage returns, and send `Standby Deactivate` to leave Halfwake for fully active mode.

Channel and audio commands are synchronized through SQLite and picked up by the dashboard in about 1.5 seconds. Standby and return commands are sent server-side to the local RoomOS API; the Board credentials never reach the phone. Docker must be able to route to `ROOMOS_DEVICE_IP`, and `ROOMOS_INSECURE_TLS=1` is required only for a trusted Board using a self-signed API certificate.

Four concurrent streams require four available channels and enough network/Web Engine decoding capacity. If RoomOS drops frames or reloads the page, reduce the layout to one or two sources.

On iPhone, open `/remote` in Safari, tap **Partager**, then **Sur l’écran d’accueil**. The bundled Apple touch icon and standalone web-app manifest create a `Télécommande` shortcut that opens directly on the remote. The remote uses its own touch-scrolling viewport even though the broadcast Board remains locked to a non-scrolling 16:9 canvas.
