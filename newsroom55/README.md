# Centre de nouvelles

Premium broadcast intelligence center for a Cisco Board Pro 55 G2. Next.js application with SQLite, verified RSS aggregation, modular market-data providers, and protected HLS playback.

This is not a SaaS dashboard. The main board is a 16:9 on-air canvas: no vertical scroll, configurable timezone (America/Montreal by default), editorial news column, market ticker, and a 1–4 stream HLS multiview with one selectable audio source.

## Run locally (without Docker)

```bash
cp .env.example .env
# Set ADMIN_PASSWORD (min 8 chars) and SESSION_SECRET (min 16 chars)
npm install
npm run dev
```

Open http://localhost:3000  
Admin: http://localhost:3000/admin

Production-style:

```bash
npm run build
npm start
```

Listens on `0.0.0.0:3000`.

## Docker

From the repository root:

```bash
cp .env.example .env
docker compose up --build -d
```

Health: `GET /api/health`

## Home Assistant OS

This folder is a self-contained Home Assistant app. Add
`https://github.com/smignacco/newsroom55` to the app store, install
**NEWSROOM55**, then fill **Configuration** (administrator password is
required). Do not create a `.env` file on Home Assistant OS: options are stored
by Supervisor and the session secret is generated under `/data`.

Activity & Sleep Pulse is disabled by default. Configure its Home Assistant
URL and dedicated long-lived token in **Configuration**, then use
`/admin` → **Activity & Sleep** to discover and map Apple Health entities.
The token is server-only and personal aggregates never enter `/api/board`.
See [DOCS.md](./DOCS.md) for the complete setup.

## What is live vs unconfigured

| Module | State |
| --- | --- |
| News | Live when publisher RSS fetches succeed (Radio-Canada, BBC, La Presse, CNBC, TechCrunch, The Verge — verified 2026-11-10) |
| Markets | Cboe delayed US quotes work without a key. Optional Twelve Data symbols are routed separately in `hybrid` mode. No prices are invented. |
| IPTV | 1–4 concurrent protected HLS streams; other adapter types remain stubs. |
| Activity & Sleep | Optional Apple Health summaries through Home Assistant; private display authorization and privacy mode required. |
| RoomOS | Documented, **not proven on a Board Pro 55 G2 in this project** |

## Tests

```bash
npm test
npx playwright install chromium
npm run test:e2e
```

## License notes

UI fonts: IBM Plex Sans, IBM Plex Mono, Sora (SIL Open Font License, bundled locally through Fontsource).
Publisher RSS: titles, sources, and links only — follow each outlet’s terms; this app does not republish full articles.
