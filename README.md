# NEWSROOM55 — dépôt Home Assistant

Ce dépôt contient l’application Home Assistant **NEWSROOM55** dans le dossier
`newsroom55/`. Le même code source sert aux installations Home Assistant OS et
Docker Compose afin d’éviter deux copies difficiles à maintenir.

## Installation dans Home Assistant OS

1. Poussez ce dépôt vers un serveur Git accessible par le Raspberry Pi.
2. Dans Home Assistant, ouvrez **Paramètres → Applications → Installer une
   application → ⋮ → Dépôts**.
3. Ajoutez l’URL Git du dépôt.
4. Installez **NEWSROOM55**.
5. Dans l’onglet **Configuration**, saisissez le mot de passe administrateur
   (8 caractères minimum). Les autres champs (marchés, RoomOS) sont optionnels.
   Aucun fichier `.env` n’est utilisé sous Home Assistant OS.
6. Démarrez, puis **Ouvrir l’interface Web**. Le port par défaut est `3000`.

Home Assistant construit l’image ARM64 directement sur le Raspberry Pi. Le
premier build est plus long; les démarrages suivants utilisent l’image locale.
La base SQLite et le secret de session résident dans `/data` et sont inclus dans
les sauvegardes Home Assistant.

## Cycle de modification avec Cursor

Le code applicatif, le Dockerfile et la définition Home Assistant sont tous sous
`newsroom55/`.

1. Modifiez et testez le code avec Cursor.
2. Incrémentez la version avec
   `cd newsroom55 && npm run addon:version -- 1.0.0-ha.2`.
3. Commitez et poussez vers la branche par défaut du dépôt Git. Pour tester une
   autre branche, ajoutez `#nom-de-branche` à l’URL du dépôt dans Home Assistant.
4. Rechargez le dépôt dans le magasin Home Assistant et installez la mise à
   jour.

Pour développer localement :

```bash
cd newsroom55
npm ci
npm test
npm run dev
```

Pour tester le conteneur hors Home Assistant :

```bash
cp .env.example .env
docker compose up --build -d
```
