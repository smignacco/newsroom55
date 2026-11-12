# Journal des modifications

## 1.0.0-ha.11

- Retire automatiquement le bandeau **ALERTE / IMPORTANT** lorsque la nouvelle
  a plus de 24 heures et normalise ces priorités au prochain cycle RSS.
- Ajoute un contrôle de sous-titres en mode focus lorsque l’audio est coupé,
  uniquement lorsque le flux HLS fournit réellement une piste.
- Ajoute dans le coin inférieur droit un bouton de veille visuelle de
  NEWSROOM, avec réactivation tactile.

## 1.0.0-ha.10

- Remplace l’autorisation déposée dans le navigateur d’administration par un
  code temporaire affiché sur le Board et approuvé dans l’onglet
  **Activity & Sleep**.
- Le cookie confidentiel est maintenant émis directement au navigateur du
  Board, même lorsque l’administration utilise un autre appareil ou un autre
  nom d’hôte.
- Les demandes répétées d’un même Board réutilisent son code en attente au
  lieu d’occuper de nouvelles places d’association.
- Permet de révoquer en une fois toutes les autorisations d’écran existantes.

## 1.0.0-ha.9

- Ajoute à la télécommande les contrôles d’affichage Activity & Sleep et une
  commande pour recharger le tableau.
- Permet de sélectionner une nouvelle depuis la télécommande, de l’afficher
  dans une fenêtre détaillée sur le Board et de la fermer à distance.
- Charge la nouvelle sélectionnée par son identifiant lorsqu’elle n’est pas
  encore présente dans le cache du Board.
- Tente d’afficher le site de l’éditeur dans un cadre isolé, avec un lien de
  remplacement lorsque l’éditeur interdit l’intégration.

## 1.0.0-ha.8

- Remplace les grandes cases à cocher de l’administration Activity & Sleep par
  des interrupteurs compacts et proportionnés.
- Affiche les indicateurs après activation du panneau; le mode confidentiel
  demeure disponible, mais n’est plus activé implicitement.
- Fait défiler automatiquement les manchettes dans le rail droit, avec pause
  pendant une interaction tactile, clavier ou souris, afin que la tuile
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
