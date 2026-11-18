# Configuration de NEWSROOM55

Sur Home Assistant OS, tout se règle dans l’onglet **Configuration** de
l’application. Il n’y a pas de fichier `.env` à créer ou à éditer.

Avant le premier démarrage, Home Assistant exige le **mot de passe
administrateur** (8 caractères minimum). Il protège `/admin` et `/remote`.
Les clés API et les champs RoomOS peuvent rester vides.

L’interface principale est accessible avec **Ouvrir l’interface Web** ou à
`http://ADRESSE_HOME_ASSISTANT:3000`.

Le port sert HTTP sur le réseau local. Ne l’exposez jamais directement à
Internet. Pour un accès distant, utilisez le VPN Home Assistant ou un proxy
HTTPS correctement configuré.

## Activity & Sleep Pulse

Le module personnel est facultatif et désactivé par défaut.

1. Sur l’iPhone, ouvrir **Home Assistant Companion → Réglages → Companion App
   → Capteurs → Apple Santé**, puis activer les capteurs d’activité et de
   sommeil voulus. Les noms d’entités réels peuvent différer des exemples.
2. Dans le profil Home Assistant, créer un jeton d’accès longue durée dédié.
   Ne jamais le coller dans une URL, un fichier Git ou le navigateur du Board.
3. Dans la **Configuration** de NEWSROOM55, renseigner l’URL locale Home
   Assistant, le jeton, laisser l’intervalle à 15 secondes et activer
   Activity & Sleep Pulse. Enregistrer puis redémarrer l’application.
4. Ouvrir `/admin` → **Activity & Sleep**, tester la connexion, découvrir les
   capteurs, vérifier les associations et enregistrer les objectifs désirés.
   Aucun objectif n’est obligatoire.
5. Depuis le navigateur qui affiche le tableau (le Board lui-même), se
   connecter une fois à `/admin` et choisir **Autoriser cet écran**. Le jeton
   Home Assistant reste côté serveur; seul un cookie signé `HttpOnly` autorise
   la lecture de la synthèse.

Le mode confidentiel masque immédiatement toutes les mesures. L’historique
Recorder de Home Assistant améliore la reconstruction des sept dernières
nuits; si son historique est incomplet, NEWSROOM affiche le nombre réel de
nuits utilisées. Les phases absentes restent absentes et ne sont jamais
transformées en zéro.

## Indice synthétique Giverny Capital

Le bandeau au-dessus du fil de nouvelles estime la performance quotidienne du
livre 13F public de Giverny Capital Inc. (CIK 0001641864). Ce n’est **pas** la
valeur liquidative officielle du fonds.

Le livre de production n’est jamais saisi en dur : NEWSROOM télécharge le
dernier 13F EDGAR, extrait les positions, apparie les CUSIP américains
(OpenFIGI, avec cache SQLite) et applique les rendements de séance sur les
poids de la veille. Un cours manquant n’est pas un rendement de 0 % et un
dernier prix à 0 n’est jamais affiché.

Les cotations réutilisent la pile existante (Twelve Data sous quota, Finnhub
hors 429, Cboe différé, Yahoo en repli historique, USD/CAD Banque du Canada).
Les identifiants restent côté serveur. L’historique quotidien et les dépôts
sont dans SQLite (`/data` sur Home Assistant).

Dans `/admin` → **Giverny** : activer le module, choisir CAD ou USD, l’intervalle,
la plage du graphique, la hauteur, le bandeau d’alerte compact, forcer un
rafraîchissement 13F, et saisir les rendements mensuels officiels. Ces mois
servent à l’erreur de suivi ; ils ne remplacent pas la série synthétique.

EDGAR exige un User-Agent identifiable et un contact. NEWSROOM envoie un
profil de navigateur plus l’en-tête `From`, avec des reprises si le dépôt
répond 403/429/503. Si EDGAR refuse encore le trafic automatisé, le bandeau
affiche « indisponible » sans inventer de niveaux ni le livre 13F.

## Marchés

Le fournisseur `hybrid` utilise gratuitement les données différées Cboe pour
les titres américains. Les clés Finnhub et Twelve Data sont facultatives.
Twelve Data est limité par défaut à six symboles et à une actualisation toutes
les trente minutes.

## Cisco Board / RoomOS

Les paramètres RoomOS sont facultatifs. Indiquez l’adresse locale du Board, son
utilisateur et son mot de passe seulement si la télécommande doit contrôler
l’appareil. Activez l’option de certificat autosigné uniquement pour un Board
de confiance sur votre réseau local.

## Données et sauvegardes

La base SQLite, la configuration éditoriale et le secret de session sont
conservés dans `/data`. Home Assistant arrête brièvement l’application pendant
sa sauvegarde afin de garantir une copie cohérente.

Le premier build ARM64 sur un Raspberry Pi 4 peut prendre plusieurs minutes.
Les flux HLS sont relayés sans transcodage.
