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
   Assistant, le jeton, conserver l’intervalle de 300 secondes et activer
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
