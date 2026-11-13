# Journal des modifications

## 1.0.0-ha.17

- Permet de commander la multivue depuis le Board, sans télécommande : icônes
  1 / 2 / 3 / 4 écrans, grille ou focus, sélection de chaîne et audio actif.
- Un cliqué-glissé vers le haut place un écran en mode focus ; relâcher sur
  un autre écran l’échange ou déplace le focus. Glisser le grand écran vers
  le bas revient à la grille.
- Restaure l’ouverture du menu d’une tuile au clavier (Entrée / Espace)
  sans doubler un tap ni ouvrir le menu à la fin d’un glisser.

## 1.0.0-ha.16

- Affiche XEQT et les autres titres TSX même si Twelve Data ou Finnhub
  n’ont plus de quota ou ne couvrent pas le Canada : repli sur le cours
  Yahoo différé (`XEQT.TO`), jamais un zéro inventé. Les actions US
  restent en repli Cboe.
- Force le suffixe Yahoo `.TO` pour un titre CAD sans bourse enregistrée,
  sauf les indices (`GSPTSE` reste `GSPTSE`, pas `GSPTSE.TO`).
- Remplace l’arc de sommeil sans légende par la date lisible de la nuit
  (ex. 12 nov.) et une barre de cible réelle. Les phases chiffrées restent
  dans le détail, pas sur le Board compact.
- Trace une ligne pointillée de la cible d’exercice quotidienne sur le
  diagramme à barres des sept jours, seulement si une cible réelle existe.

## 1.0.0-ha.15

- Ajoute un menu contextuel tactile sur chaque tuile du Board (chaîne de
  l’écran et audio de cette tuile) sans quitter NEWSROOM.
- Centre verticalement le cours et la variation du ticker; aligne le symbole
  et le nom de l’organisation à gauche.
- Fiabilise la résolution des titres TSX/TSXV (ex. XEQT.TO → XEQT @ TSX pour
  Twelve Data, XEQT.TO pour Finnhub) et affiche INDISPONIBLE si le cours
  manque, jamais un zéro inventé.
- Remplace le rendu texte/barres d’Activity & Sleep par un traitement
  d’antenne (cadrans, arcs de nuit, orbite hebdomadaire) sans inventer
  d’échantillons.

## 1.0.0-ha.14

- Retire entièrement les contrôles et la détection des sous-titres du tableau
  et de la télécommande afin de préserver la stabilité du Web Engine RoomOS.
- Désactive explicitement le traitement WebVTT, IMSC1 et CEA-708 dans le
  lecteur HLS; aucun accès à `video.textTracks` n’est conservé.

## 1.0.0-ha.13

- Revoit la télécommande pour une utilisation simple sur iPhone avec contrôles
  rapides, grandes zones tactiles, navigation fixe et sections hiérarchisées.
- Ajoute le contrôle distant des sous-titres en mode focus lorsque le son est
  coupé; l’activation reste conditionnelle à la présence d’une piste dans le
  flux.
- Synchronise périodiquement l’état de veille affiché avec le statut réel du
  Webex Board par l’API RoomOS, sans exposer ses identifiants au navigateur.
- Restaure la signalisation en mode Halfwake depuis la veille et rend l’option
  de source audio **Aucune** réellement fonctionnelle.
- Fiabilise le retour vers la télécommande après la connexion administrateur.

## 1.0.0-ha.12

- Rend la détection facultative des sous-titres tolérante aux implémentations
  partielles de `TextTrackList` dans les Web Engines intégrés.
- Une API de sous-titres indisponible ne peut plus interrompre le rendu du
  tableau ou des flux vidéo.

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
