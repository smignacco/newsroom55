# NEWSROOM 55 — Limits, licenses, remaining integrations

Honesty log. Nothing here is a fake success.

## Live in this build

- Main board UI (header, IPTV waiting viewfinder, news column, ticker, status)
- SQLite persistence, hashed admin, CSRF on admin and mobile-remote mutations
- RSS aggregation every 3 minutes from **verified** publisher feeds
- Market **provider interface** (Finnhub, Twelve Data, Unavailable)
- Modular video adapters (stubs only)
- `/api/health`
- Playwright captures at 1920×1080, 3840×2160, 1366×768, admin, IPTV wait

## News sources (verified 2026-11-10)

HTTP 200 + RSS/Atom from this environment, then wired as defaults:

| Outlet | URL | Result |
| --- | --- | --- |
| Radio-Canada À la une | https://ici.radio-canada.ca/info/rss/info | RSS 200 |
| Radio-Canada En continu | https://ici.radio-canada.ca/info/rss/info/en-continu | RSS 200 |
| Radio-Canada Québec | https://ici.radio-canada.ca/info/rss/regions/quebec/en-continu | RSS 200 |
| Radio-Canada Montréal | https://ici.radio-canada.ca/info/rss/regions/montreal-environs/en-continu | RSS 200 |
| Radio-Canada Techno | https://ici.radio-canada.ca/info/rss/info/techno/en-continu | RSS 200 |
| BBC News / World / Technology / Business | https://feeds.bbci.co.uk/news/{rss.xml,world/rss.xml,technology/rss.xml,business/rss.xml} | RSS 200 |
| La Presse Actualités, National, International, Affaires, Économie, Régional | `https://www.lapresse.ca/.../rss` | RSS 200 |
| CNBC Top / World / Tech | `https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=…` | RSS 200 |
| TechCrunch | https://techcrunch.com/feed/ | RSS 200 |
| The Verge | https://www.theverge.com/rss/index.xml | Atom 200 |

Radio-Canada International and Économie paths appear on the official RSS index (`https://ici.radio-canada.ca/info/rss`) but returned an Error body when fetched here. They are **not** in the default seed. You can add them in `/admin` if they answer later.

On a later cycle in this VM, several Radio-Canada feeds returned HTML (`Unexpected close tag`). The aggregator records that as a source error. Cached items remain. This is a publisher/rate-limit issue, not simulated news.

### Not wired (could not verify)

| Outlet | What happened |
| --- | --- |
| **CBC** | HTTP/2 reset, then HTTP/1.1 timeout. Official-looking `/webfeed/rss/…` URLs were **not** confirmed reachable from here, so they are not seeded. Add in `/admin` only after a successful fetch from your network. |
| **Reuters** | `https://www.reutersagency.com/feed/` → 404. `https://www.reuters.com/tools/rss` → 401 / bot wall. **No Reuters source is configured.** |
| Radio-Canada `/rss/5713` | 404 |

Titles, sources, timestamps, and outbound links only. Follow each publisher’s terms. This app does not republish full articles.

## Markets

The default provider is Cboe’s official public delayed-quotes endpoint, verified with CSCO, NVDA, MSFT, and AAPL from this environment on 2026-11-10. It requires no API key. Only enabled `equity` rows from `/admin` appear; unsupported or failed symbols show **UNAVAILABLE** rather than a guessed value.

The ticker displays Cboe’s reported current price, daily change, daily percentage, and timestamp. It is prominently labelled **DELAYED 15 MIN**. Green ▲ and red ▼ indicate the reported daily direction. This is informational display data, not execution-quality pricing.

The admin Finance screen can search Cboe’s official company directory by company or fund name, so US symbols no longer need to be entered manually. Cboe remains US-only and is the recommended no-cost mode. In `hybrid` mode, every ticker row is assigned independently to Cboe or Twelve Data; selecting Cboe for US symbols prevents them from consuming Twelve Data credits.

Twelve Data’s official pricing page reported 8 API credits per minute and 800 per day for Basic on 2026-11-10. Basic primarily covers US equities/ETFs, forex, and crypto; regular international exchange coverage progresses through paid plans. A free API key therefore does **not** guarantee free Canadian or global quotes. NEWSROOM defaults Twelve Data to a 30-minute interval, refuses intervals below 15 minutes, and caps quote requests at six symbols. These guardrails reduce usage but cannot change provider entitlements or guarantee that Twelve Data will keep its limits unchanged.

Cboe’s market-data policies govern use and redistribution. This build is intended for the local/internal Board display. Obtain the appropriate Cboe/data-owner permission before public or commercial redistribution.

Other providers:

1. Create an account at [Finnhub](https://finnhub.io/) or [Twelve Data](https://twelvedata.com/) and accept their terms (delayed quotes, redistribution limits, index coverage).
2. Set the key in `.env` (server only).
3. Set `MARKETS_PROVIDER=hybrid` to use Cboe and Twelve Data together, or select a single provider explicitly.
4. Restart. NEWSROOM conservatively labels API quotes **DELAYED** unless the provider integration explicitly proves real-time status.

Index symbols (`^GSPC`, `^IXIC`, `^GSPTSE`) may need provider-specific codes. Adjust **Provider symbol** in `/admin`. Finnhub in particular may not serve TSX/GSPTSE on a free plan — those rows should then read UNAVAILABLE, not a guessed number.

Set `MARKETS_PROVIDER=bankofcanada` for the keyless official daily FX feed, or `MARKETS_PROVIDER=cboe` for public delayed US stocks. Market-hours flags are clocks, not a claim that a quote is live.

## IPTV / video

Implemented:

- Editorial waiting state (not a black box, not a fake channel)
- Simultaneous 1–4 channel multiview with one explicitly selected audio source
- Remote-controlled focus layout: one large live source plus up to three continuously playing live thumbnails
- Adaptive in-memory HLS buffering: 60 seconds for one stream, 45 for two, and 25 per stream for three or four; low-latency mode is disabled and fatal network/media errors are retried
- Mobile remote layout, per-slot channel, audio-source, mute, Board volume, and power controls
- Backward-compatible protected import for the Canadian iptv-org playlist:
  `https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca.m3u`
- Selectable playlist directory loaded from the official GitHub repository (`streams/*.m3u`)
- Per-list monitoring: manual, 15 minutes, 1 hour, 6 hours, or 24 hours
- Conditional ETag checks and in-place source-link updates that preserve enabled station IDs
- Removed catalogue stations are marked and disabled instead of being presented as current
- An administrator may explicitly pin an archived station using its last known HLS link; pinned stations remain visible even while absent upstream and are clearly labelled
- Searchable channel catalogue; imported channels are disabled by default
- Admin selection of the channels exposed to the dashboard, plus one optional default

Four simultaneous HLS decoders increase network, CPU, GPU, and proxy load roughly with the selected stream bitrates. The interface is implemented and browser-tested, but sustained four-stream decoding on the Cisco Board Pro 55 G2 must be validated with the actual channels and RoomOS release. Reduce the layout to one or two sources if frames drop or the Web Engine reloads.
- Channel records in `/admin` with adapter choice (`hls`, `webrtc`, `rtmp`, `rtsp`)
- One active HLS stream at a time, using native HLS when available and bundled HLS.js otherwise
- Same-origin signed proxy for manifests, variants, segments, keys, redirects, range requests, and required referrer headers
- Upstream stream URLs remain server-side; the browser receives expiring proxy URLs
- Clear loading, unsupported-format, network/geoblock, and codec error states

The official repository directory returned 326 playlist files on 2026-11-10; the Canadian source playlist was also reachable and parsed from this environment. iptv-org describes its repository as a collection of publicly available channels, but inclusion does **not** prove that a stream is online, licensed for your use, geo-accessible, safe, or compatible. NEWSROOM 55 labels imported streams **catalogued / unverified** and does not enable them automatically.

Chromium playback through the proxy was verified with the currently available Canal Savoir HLS entry on 2026-11-10; that is a point-in-time browser test, not an uptime guarantee. DASH entries remain unsupported. WebRTC, RTSP, and RTMP adapters remain stubs.

The owner confirmed that signage and HLS playback work on the physical Board 55. This does not guarantee that every catalogue stream or codec is compatible.

## RoomOS / Board Pro 55 G2

Documented in `docs/roomos-setup.md`. The owner confirmed basic signage and video playback on the physical Board. The protected `/remote` sends standby, half-wake, deactivate, and volume increase/decrease through the local RoomOS API, but these remote hardware commands still require confirmation on the device.

## Docker

`newsroom55/Dockerfile` + the root `docker-compose.yml` were built and started on this Cloud Agent VM. The service is healthy on `0.0.0.0:3000`, and the SQLite named volume survived container recreation. This VM restricts Docker bridge egress, so its running instance uses the included Linux-only `docker-compose.host.yml` override; Docker Desktop should use the standard Compose file.

## Admin / security remaining

- Password hashing is bcrypt (cost 12), not Argon2id. Fine for a LAN console; upgrade if you expose it more widely.
- No MFA, no SSO.
- CSRF via session claim + `X-CSRF-Token` on mutations.
- `/remote` uses the same 12-hour admin session and is intended only for the trusted local LAN.
- SSRF: http(s) only, no URL userinfo, blocks link-local metadata hosts. Private LAN RSS is allowed on purpose.
- HLS proxy tokens are HMAC-signed and expire; proxy requests require an enabled iptv-org channel and reject private/reserved playback destinations after DNS resolution.
- `SESSION_SECRET` and API keys are environment variables on the workstation, not a KMS.

## Fonts / licenses

IBM Plex Sans, IBM Plex Mono, and Sora are bundled through Fontsource (SIL Open Font License). The white Cisco logo asset was supplied by the project owner; Cisco trademark and brand-use rules still apply. No runtime font or logo download.

## Tests that were actually run

- Vitest: 35 tests including adaptive HLS buffer profiles, archived-station pinning, four-source control persistence, hybrid provider routing, Twelve Data rate guards, RoomOS command XML, market-directory CSV parsing, playlist source-link preservation, Cboe and Bank of Canada parsing/failure, HLS token, manifest rewrite, private-network blocking, and M3U parsing — **passed**
- Playwright Chromium HLS smoke test: real proxied video reached decoded `readyState ≥ 2` and **Program live**
- Playwright visual suite: six browser scenarios, including the mobile remote and its CSRF rejection check — **passed**
- `/api/health` — **ok**
- RSS cycle: first cycle **19/19 fetched**; a later cycle **15 ok / 4 Radio-Canada HTML errors** (recorded, not hidden)

Not independently run from this Cloud VM: RoomOS standby / half-wake. The cloud VM cannot route to the owner’s private `192.168.10.245` address. Physical validation must be performed from the deployed local container.
