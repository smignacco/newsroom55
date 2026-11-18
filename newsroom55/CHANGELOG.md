# Journal des modifications

## 1.0.0-ha.30

- La tuile Giverny peut alterner avec une carte (treemap) des titres du 13F
  public : taille = poids, couleur = rendement de séance. Un cours manquant
  reste gris, jamais 0 %. L’intervalle se règle dans l’admin (off à 30 s).
  Ce n’est pas le livre officiel NBN125 ; aucun titre n’est inventé.

## 1.0.0-ha.29

- Le Board affiche le VL estimé (étiquette VL CAD) dès qu’un VL de fin de
  mois est saisi. Un mois n’est « en cours » que si la fin de mois calendrier
  n’est pas encore passée — pas selon le dernier CAD disponible. Un mois
  révolu sans CAD de clôture n’est pas ancré sur une séance antérieure.
  L’admin indique si le Board est passé sur l’estimation.

## 1.0.0-ha.28

- Un VL de fin de mois saisi en admin ancre GIV-CAD pour estimer le prix
  unitaire entre deux rapports mensuels (ex. NBN125). L’ancre préfère la
  dernière séance NY du mois ; si ce jour n’a pas de CAD 13F (dépôt après
  la fin de mois), l’estimation part de la première séance suivante, sans
  inventer le trou et sans reculer à une séance antérieure. L’estimation
  n’apparaît que sur un jour dont la couverture passe le plancher. Le VL
  CAD se saisit sans % mensuel. Elle n’invente ni titres ni VL, et n’est
  pas le VL officiel.

## 1.0.0-ha.27

- Le Board affiche la dernière durée de sommeil de la nuit (18 h–18 h
  Toronto), plus un échantillon Recorder plus ancien. 481 minutes restent
  8 h 01 ; 4 h 55 n’est plus conservé s’il précède le total final. Les nuits
  déjà en base sont reconstruites avant la règle d’horodatage, pour qu’un
  ancien 481 h (28 860 min) ou un `last_updated` trop tardif ne bloque pas
  le total corrigé. Aucune mesure Santé n’est inventée.

## 1.0.0-ha.26

- Affiche le dernier niveau GIV réellement calculé : une séance du jour sans
  USD/CAD Banque du Canada ne masque plus le CAD de la veille, et n’invente
  pas de taux.
- Ignore l’ancienne santé `edgar` (403) après l’abandon du téléchargement SEC.
- L’actualisation admin publie une progression (CUSIP, Yahoo, change, indice)
  au lieu d’un bouton « en cours » silencieux. Un tick planifié ou un import
  XML n’écrit plus cette progression et ne bloque plus le bouton.

## 1.0.0-ha.25

- Arrête tout téléchargement automatique des 13F sur sec.gov. Le livre vient
  uniquement de l’import XML manuel. Actualiser relance CUSIP + cours, sans
  appeler EDGAR (plus de 403 qui masque un XML déjà importé).
- Calcule GIV même si l’historique SPX manque : vs S&P et α restent vides
  plutôt que de cacher l’indice. Une séance sans SPX n’avance pas la base du
  benchmark : le niveau S&P et α se rétablissent sur la prochaine observation,
  sans publier α contre un SPX périmé.

## 1.0.0-ha.24

- Si OpenFIGI répond 413 (trop de CUSIP dans une requête), le mapping relance
  le même livre en lots plus petits (jusqu’à 1) au lieu d’abandonner. Aucun
  ticker n’est inventé.

## 1.0.0-ha.23

- Apparie les CUSIP OpenFIGI par lots (10 sans clé, 100 avec) et réécrit les
  tickers sur les 13F déjà importés, même si EDGAR reste en 403. Un livre sans
  tickers ne démarre plus l’indice à 100 ni un MTD CAD dû au seul change.
- Respecte le quota OpenFIGI (`ratelimit-remaining` / `retry-after`) et relance
  un lot 429 après l’attente indiquée, au lieu d’abandonner le reste du livre.
- Ancre MTD/YTD à la dernière séance : un mois ou une année sans observation
  qualifiée reste vide, ce n’est pas le rendement de la période précédente.
- Retire la courbe de l’indice synthétique du Board et le réglage de plage.

## 1.0.0-ha.22

- Relit EDGAR avec l’identité déclarée exigée par la SEC (pas un User-Agent de
  navigateur), un courriel de contact configurable, et un repli TLS natif
  (curl/wget) si Node est refusé. Un import XML 13F manuel reste possible ; le
  livre n’est jamais inventé.
- Corrige le diagramme d’effort : les totaux quotidiens suivent `last_changed`
  (pas un sondage HA), ignorent le report du total de la veille, et étiquettent
  LU/MA/ME/JE/VE/SA/DI.

## 1.0.0-ha.21

- Intègre Activité & Sommeil dans la colonne du fil : au plus un cinquième à
  un quart de la hauteur restante, sans recouvrir les manchettes. La liste
  reste visible et défilable sous Giverny. La télémétrie compacte (semaine et
  résumé) tient dans cette rangée.
- Relit les 13F EDGAR avec un User-Agent de navigateur, l’en-tête de contact
  exigé par la SEC, et des reprises avec délai (y compris 403). Si EDGAR
  refuse encore le trafic, l’indice reste indisponible — aucun livre ni cours
  inventé.

## 1.0.0-ha.20

- Retire la tuile « à la une » (importante / alerte) du fil de nouvelles. La
  pastille compacte ALERTE / IMPORTANT dans l’en-tête du fil reste. La liste
  affiche davantage de manchettes dans l’espace récupéré.

## 1.0.0-ha.19

- Ajoute l’indice synthétique Giverny Capital au Board, au-dessus du fil de
  nouvelles : GIV-CAD / GIV-USD / GIV-ALPHA, 5 séances, MTD, YTD, vs S&P 500,
  contributions et horodatage du dernier succès. Ce n’est pas le VL officiel.
- Lit les 13F EDGAR (CIK 0001641864 par défaut), apparie les CUSIP, reconstitue
  l’historique sans anticipation et refuse tout cours manquant ou égal à zéro
  comme un rendement de 0 %. Livre USD/CAD Banque du Canada déjà en place.
- Remplace le grand bandeau d’alerte par une pastille compacte dans l’en-tête
  du fil (sans décalage de mise en page). Le grand bandeau reste optionnel.
- Administration → Giverny : activation, intervalle, CAD/USD, plage, hauteur,
  bandeau, rafraîchissement 13F manuel, mois officiels (comparés, jamais
  substitués) et santé des fournisseurs.
- Couvre l’historique USD/CAD depuis le plus ancien 13F reconstitué, compte
  les titres non appariés dans la couverture, conserve le dernier niveau
  valable sur une séance indisponible, et range les cours live sous la séance
  NY du timestamp (jamais sous le calendrier du week-end).

## 1.0.0-ha.18

- Ajoute un curseur de volume tactile à côté des icônes 1–4 / grille / focus
  sur le Board. Le glisser règle le volume RoomOS (ou le lecteur HLS si le
  Board n’est pas joignable). Si RoomOS est configuré mais injoignable, le
  lecteur HLS suit le curseur (`applied: player`) au lieu de rester à 1.
- N’écrit le volume matériel RoomOS que depuis un Board associé (même cookie
  d’écran qu’Activité & Sommeil) ou une session administrateur. Sans cela, le
  curseur règle uniquement le lecteur HLS.
- Permet de fixer le volume initial dans Administration → Apparence. Ce
  niveau est réappliqué au lancement et lorsque NEWSROOM redevient visible
  après un appel.
- Relit Activité & Sommeil près du temps réel : le Board interroge la
  synthèse toutes les 10 s et déclenche une lecture live Home Assistant,
  sans attendre l’ancienne synchro de plusieurs minutes.

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
