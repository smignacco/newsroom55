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
