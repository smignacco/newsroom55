# Journal des modifications

## 1.0.0-ha.8

- Remplace les grandes cases à cocher de l’administration Activity & Sleep par
  des interrupteurs compacts et proportionnés.
- Affiche les indicateurs après activation du panneau; le mode confidentiel
  demeure disponible, mais n’est plus activé implicitement.
- Rend la liste des manchettes défilable dans le rail droit afin que la tuile
  Activity & Sleep ne masque plus les nouvelles suivantes.

## 1.0.0-ha.7

- Autorise une URL Home Assistant vide lorsque **Activity & Sleep Pulse** est
  désactivé, afin que la configuration par défaut soit acceptée par le
  Superviseur.

## 1.0.0-ha.6

- Ajout du panneau compact **Activity & Sleep Pulse** dans le rail droit, sans
  modifier la grille vidéo ni exposer les données dans `/api/board`.
- Connexion serveur à Apple Santé par l’API REST Home Assistant, découverte et
  association manuelle des capteurs, synchronisation périodique et historique
  SQLite sans doublons de nuit.
- Nouvel onglet d’administration pour la confidentialité, les objectifs
  facultatifs, les phases de sommeil et l’autorisation explicite de l’écran.
- Options Home Assistant pour l’URL, le jeton privé, l’intervalle et
  l’activation du module.

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
