# Indice synthétique Giverny Capital

Module natif du Board : estimation quotidienne à partir des 13F publics, pas le
VL officiel.

## Données

- Dépôts : import XML 13F manuel uniquement (CIK `0001641864` pour le lien
  d’archive). NEWSROOM n’appelle plus sec.gov. Sans XML, l’indice reste
  indisponible ; le livre n’est jamais inventé.
- Appariement CUSIP → ticker : OpenFIGI par lots (10 jobs sans clé, 100 avec
  `OPENFIGI_API_KEY`), cadence selon `ratelimit-*` / `retry-after`. Un 413
  relance le même livre en lots plus petits. Cache SQLite, réappliqué sur les
  13F déjà stockés. Aucun ticker n’est inventé.
- Cours : pile marchés existante (Twelve Data, Finnhub, Cboe, Yahoo historique).
- Change : Banque du Canada `FXUSDCAD` (déjà dans le dépôt).
- Persistance : tables `giverny_*` dans SQLite (`/data` sur Home Assistant).

## Calcul

Les rendements du jour utilisent les **poids de la séance précédente** × rendements
des titres. Les poids dérivent ; pas de rebalance quotidien. Un nouveau 13F public
réinitialise les poids à la date de dépôt, sans anticipation.

Un cours manquant n’est pas un rendement de 0 %. Un dernier prix à 0 n’est pas
affiché. La couverture du livre inclut les titres sans ticker ; sous 85 % le
niveau du jour reste indisponible. Une séance indisponible ne décale pas la
base du rendement suivant. GIV-CAD applique le USD/CAD du jour lorsqu’il est
disponible, historisé depuis le premier 13F public ; sinon le niveau CAD reste
vide. Un historique SPX manquant laisse vs S&P et α vides, mais n’empêche plus
GIV de s’afficher. Une séance sans SPX n’avance pas la base du benchmark : le
niveau S&P récupère le mouvement du trou, et α reste vide tant que le S&P du
jour n’est pas lisible. Les cours live sont rangés sous la séance NY du timestamp,
pas sous la date civile du rafraîchissement. Le Board n’affiche pas de courbe
de l’indice.

## API

- `GET /api/giverny/summary`
- `GET /api/giverny/holdings`
- `GET /api/giverny/history`
- `GET /api/giverny/contributors`
- `GET /api/giverny/filings`
- `GET /api/giverny/validation`

Administration : `/admin` → Giverny.
