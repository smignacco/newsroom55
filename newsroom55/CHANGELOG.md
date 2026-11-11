# Journal des modifications

## 1.0.0-ha.5

- Retrait des mentions « Board online », « Montréal desk » et « STANDBY » du
  bandeau.
- Francisation des commandes, états vidéo, sélecteur de chaînes, marchés,
  panneaux de détail et barre d’état du tableau principal.
- Dates et nombres affichés avec la locale française du Canada.

## 1.0.0-ha.4

- Les libellés compacts des stations sont placés dans le coin supérieur gauche
  de chaque image, y compris le grand écran et les vignettes en mode focus.

## 1.0.0-ha.3

- En mode focus, l’identification de l’écran et de la chaîne est maintenant
  compacte et placée dans le coin supérieur droit sans masquer le bas de
  l’image.
- Le ticker affiche le nom complet de l’entreprise sous chaque symbole.

## 1.0.0-ha.2

- Formulaire Home Assistant complet : mot de passe administrateur obligatoire
  avant le démarrage, clés marché et RoomOS visibles dans **Configuration**.
- Plus aucun fichier `.env` sur Home Assistant OS ; le secret de session est
  généré dans `/data`.
- Fuseau par défaut `America/Toronto`. Champ `newsroom_url` pour l’URL LAN du
  Board.

## 1.0.0-ha.1

- Première version empaquetée comme application Home Assistant OS.
- Construction locale ARM64 et AMD64 à partir du même code que Docker Compose.
- Options Home Assistant pour l’administration, les marchés et RoomOS.
- Persistance et sauvegarde de la base SQLite dans `/data`.
