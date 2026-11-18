# Indice synthétique Giverny Capital

Module natif du Board : estimation quotidienne à partir des 13F publics, pas le
VL officiel.

## Données

- Dépôts : SEC EDGAR, CIK `0001641864` (réglable). Le livre n’est pas saisi en dur.
- Appariement CUSIP → ticker : OpenFIGI, cache SQLite.
- Cours : pile marchés existante (Twelve Data, Finnhub, Cboe, Yahoo historique).
- Change : Banque du Canada `FXUSDCAD` (déjà dans le dépôt).
- Persistance : tables `giverny_*` dans SQLite (`/data` sur Home Assistant).

## Calcul

Les rendements du jour utilisent les **poids de la séance précédente** × rendements
des titres. Les poids dérivent ; pas de rebalance quotidien. Un nouveau 13F public
réinitialise les poids à la date de dépôt, sans anticipation.

Un cours manquant n’est pas un rendement de 0 %. Un dernier prix à 0 n’est pas
affiché. La couverture du livre est indiquée. GIV-CAD applique le USD/CAD du jour
lorsqu’il est disponible ; sinon le niveau CAD reste vide.

## API

- `GET /api/giverny/summary`
- `GET /api/giverny/holdings`
- `GET /api/giverny/history`
- `GET /api/giverny/contributors`
- `GET /api/giverny/filings`
- `GET /api/giverny/validation`

Administration : `/admin` → Giverny.
