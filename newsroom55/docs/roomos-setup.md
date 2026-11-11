# NEWSROOM 55 — Cisco RoomOS setup (Board Pro 55 G2)

Target: **Cisco Board Pro 55 G2**, 55" 16:9, opened as a web page in **RoomOS Web Engine** / **Interactive Digital Signage**.

The owner has confirmed that signage and HLS playback load on the physical Board. The new remote standby / half-wake commands still need to be confirmed on that device; do not treat the checks below as an automatic hardware certification.

Do not push automatic configuration to the Board from this app. RoomOS settings stay on the device / Control Hub.

## What the page assumes

- A normal web page (no browser extension, no Board filesystem access, no pop-ups, no downloads)
- Fullscreen, no vertical scroll on the main board
- HTTP is for development on a computer; the Board should use **HTTPS**
- Incoming Webex calls remain **RoomOS’s job**. This page does not control call events
- After a call or half-wake Digital Signage, a reload of the URL should restore the desk (the app re-fetches news and status)

## 1. Network

1. Workstation and Board on the same LAN (or a route the Board can reach).
2. Confirm the PC’s IPv4 (not `localhost` from the Board).
3. Open TCP 3000 (HTTP lab) or 443 (HTTPS reverse proxy) on the PC firewall for that LAN only.
4. From a laptop, open `http://<pc-ip>:3000` first. If that fails, the Board will fail too.

## 2. Web Engine

On the Board (or Control Hub / xAPI, depending on how you administer RoomOS):

1. Enable **Web Engine**.
2. Allow the device to open a URL.
3. Interactive mode if you want touch (channel selector, story detail, ticker hold, admin is **not** meant to be used from the Board).

Exact menu names vary by RoomOS version. Use Cisco’s current RoomOS Web Engine / Digital Signage documentation for the software on the device. This repo does not ship xAPI macros.

## 3. Interactive Digital Signage

1. Enable **Digital Signage**.
2. Set the URL to the HTTPS address of NEWSROOM 55 (for example `https://newsroom.lan/`).
3. Choose **Interactive** if you want touch. Passive signage still shows the board; chrome controls stay hidden until touch.
4. Configure wake / half-wake so the URL is shown outside of calls, per your office policy.
5. Confirm that an **incoming call** takes over, and that after the call the signage URL returns. That return path is RoomOS, not this app.

### 3a. Load this configuration over the local RoomOS API

The included script uses Cisco’s documented local HTTP API (`POST /putxml`, then `GET /getxml` for verification). Run it from the Mac or PC on the same LAN as the Board—not from a cloud agent.

For the Board at `192.168.10.245`:

```bash
cd newsroom55
# Edit these entries in .env:
# ROOMOS_DEVICE_IP=192.168.10.245
# ROOMOS_USERNAME=localadmin
# ROOMOS_PASSWORD=<local password; never commit this file>
# NEWSROOM_URL=http://<DOCKER-HOST-LAN-IP>:3000
# ROOMOS_APPLY=0

# Safe dry run; the command loads .env automatically.
npm run roomos:configure

# After reviewing the dry run, set ROOMOS_APPLY=1 in .env:
npm run roomos:configure
```

HTTPS is used for the device API by default. If the Board has only its self-signed factory certificate, first verify you are on the trusted local network and then add `ROOMOS_INSECURE_TLS=1` to the apply command. If the device API is intentionally configured for plain HTTP, set `ROOMOS_PROTOCOL=http`.

The script enables Web Engine, Digital Signage, interactive mode, and signage audio, sets `NEWSROOM_URL`, then verifies that RoomOS reports the URL. It loads `.env` automatically and never prints the password. `.env` is gitignored and excluded from release archives. The signage URL must point to the Docker host’s LAN address; `localhost` is rejected.

### 3b. Control it from a phone

Open `http://<DOCKER-HOST-LAN-IP>:3000/remote` on a phone on the same LAN and sign in with the admin account. The remote can:

- switch among the HLS channels enabled in `/admin`;
- mute or unmute the web player (separate from the Board master volume);
- send `Audio Volume Increase` or `Audio Volume Decrease` to the Board;
- send `Standby Activate` to turn the display off;
- send `Standby Halfwake` to restore digital signage;
- send `Standby Deactivate` to leave Halfwake and return the Board to fully active mode.

The phone never receives the RoomOS password. The Next.js container sends RoomOS commands over the LAN using the `ROOMOS_*` values passed by Compose. Keep `/remote` and `/admin` LAN-only. Volume, standby, half-wake, and deactivate behavior varies with device policy and must be tested on the physical Board before relying on it.

## 4. Display notes

- Design target: 1920×1080 and 3840×2160 CSS pixels, plus 1366×768 adaptability.
- RoomOS CSS resolution may differ from the panel’s hardware pixels. If the desk looks small or overscaled, use **Appearance → text size** in `/admin` rather than zooming the Web Engine if that setting exists.
- The main board must not scroll. If RoomOS adds a URL bar, use kiosk / signage fullscreen.

## 5. HTTPS and certificates

- Do not turn off certificate checks on the Board to simplify lab HTTPS.
- Use a certificate the Board trusts (private CA installed on the device, or a public CA).
- Mixed content is not used by the page: fonts and HLS.js are bundled. The server fetches an enabled upstream HLS source and presents it to the Board through a same-origin signed proxy.

## 6. Checks on the real device (not done here)

Work through these on the Board Pro 55 G2 and record the result:

- [ ] Web Engine enabled
- [ ] Interactive Digital Signage URL loads
- [ ] Clock shows the timezone selected in `/admin` (default America/Montreal)
- [ ] News column fills from RSS (or empty state if offline)
- [ ] Market ticker shows UNAVAILABLE until a key is set
- [ ] Import the Canadian catalogue in `/admin` from a computer
- [ ] Enable one HLS channel and set it as default
- [ ] Board shows **Connecting**, then **Program live**, or a specific honest error
- [ ] Video continues for at least 10 minutes without accumulating delay
- [ ] Touch **Muted / Audio ready** and confirm whether RoomOS permits audio after the gesture
- [ ] Change to a second enabled HLS channel; only one stream remains active
- [ ] Touch: story detail, ticker pause, channel selector
- [ ] Incoming call interrupts; return to signage after hangup
- [ ] Half-wake still shows the page
- [ ] Reload after overnight still healthy (`/api/health`)

## 7. If it fails

| Symptom | What to check |
| --- | --- |
| White / blank | HTTPS cert, mixed content, Web Engine disabled |
| Cannot reach host | LAN IP, firewall, Docker bind `0.0.0.0` |
| Looks zoomed / tiny | CSS vs panel resolution; `/admin` text size |
| News empty | `/admin` source status; publisher RSS errors |
| Signal unavailable | Try another enabled HLS channel; the source may be offline, geoblocked, or use an unsupported codec |
| “HLS/Media Source unsupported” | Record the RoomOS version; its Web Engine cannot run either available playback path |
| Video but no audio | Touch **Muted** once; autoplay policies normally require a user gesture for audio |
| Touch exits to the RoomOS home screen | Re-run the current loader and verify `Standby Signage InteractionMode=Interactive` |
| Proxy error | Confirm the Docker host has outbound HTTPS/DNS access and inspect `docker compose logs newsroom55` |
| Stale after sleep | Reload; scheduler runs in the Node process, not in the Board |

The owner has confirmed basic signage and video on the Board. Remaining unchecked items, especially remote standby / half-wake and long-duration playback, are not yet confirmed.
