# Bridge Apps Script

Proxy lecture/écriture du classeur PLANNING (onglets `PLANNING`, `BRAINSTORM` et `NOTES`) **sans OAuth dans le navigateur**.

## Déploiement (une fois)

1. Ouvre le [classeur PLANNING](https://docs.google.com/spreadsheets/d/1yLNRF8ylX5qUdvpPVgzmtucmd1AISJ18rfOhEfbo0Ak/edit).
2. **Extensions → Apps Script**.
3. Colle le contenu de [`Code.gs`](./Code.gs) (remplace le fichier par défaut).
4. Colle le manifeste [`appsscript.json`](./appsscript.json) — voir [Manifeste](#manifeste-scopes) ci-dessous.
5. Dans l’éditeur, choisis `authorizeDriveForNotes` → **Exécuter**, avec le compte qui déploiera le Web App. Accepte l’accès Drive.
6. **Déployer → Nouveau déploiement** :
   - Type : **Application Web**
   - Description : `no-e-planner-bridge`
   - Exécuter en tant que : **Moi**
   - Qui peut y accéder : **Tout le monde**
7. Copie l’URL qui se termine par `/exec`.

## Manifeste (scopes)

Le scope dans `appsscript.json` ne suffit pas. Le Web App garde le jeton OAuth de la dernière autorisation. Une nouvelle version déployée sans avoir ré-accepté Drive renvoie encore « Vous n'êtes pas autorisé à appeler DriveApp.Folder.createFile » (ou `DriveApp.getFileById`).

1. Éditeur Apps Script → **Paramètres du projet** (engrenage) → cocher **Afficher le fichier manifeste « appsscript.json » dans l’éditeur**.
2. Ouvrir `appsscript.json` et coller [`appsscript.json`](./appsscript.json). Scopes :

   - `https://www.googleapis.com/auth/spreadsheets` — le classeur
   - `https://www.googleapis.com/auth/drive` — lire et créer les fichiers du dossier `NOTES-IMAGES` (`drive.file` ne suffit pas : le classeur existe déjà, `DriveApp.getFileById` a besoin de `drive`)
   - `https://www.googleapis.com/auth/script.storage` — mémoriser l’id du dossier dans les propriétés du script

3. Enregistrer.
4. Dans la liste des fonctions, choisir **`authorizeDriveForNotes`** → **Exécuter**. Le compte doit être celui du déploiement (« Exécuter en tant que : Moi »). Accepter l’écran Google (accès Drive). La fonction crée le dossier si besoin, y dépose un fichier test, puis le met à la corbeille. Le journal d’exécution affiche l’id du dossier.
5. **Ensuite seulement** : **Déployer → Gérer les déploiements → ✎ → Nouvelle version**.

Le dossier peut aussi être créé à la main : nom exact `NOTES-IMAGES`, au même niveau que le classeur PLANNING. Pour le forcer, propriété de script `NOTES_IMAGES_FOLDER_ID` = l’id du dossier (Paramètres du projet → Propriétés du script). Sinon le script le retrouve par le nom, à côté du classeur, et enregistre l’id.

## Brancher le front

### Local

Dans `.env.local` :

```env
VITE_SHEETS_BRIDGE_URL=https://script.google.com/macros/s/XXXX/exec
```

Puis `npm run dev` (redémarrer Vite après modification du `.env`).

### GitHub Pages

**Settings → Secrets and variables → Actions** → secret :

| Secret | Valeur |
|---|---|
| `VITE_SHEETS_BRIDGE_URL` | l’URL `/exec` |

Relance le workflow **Deploy to GitHub Pages**.

Les secrets OAuth (`VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`) ne sont plus nécessaires si le bridge est défini.

## Images collées dans les notes

Le collage (Ctrl/Cmd+V) envoie l’image au bridge, action `uploadNoteImage` (`mimeType`, `dataBase64`). Le script crée si besoin le dossier **`NOTES-IMAGES`** à côté du classeur PLANNING et y dépose un fichier privé (pas de lien public). La cellule ne garde que le marqueur `{{img:FILE_ID}}`.

Le clic sur `(image)` appelle `getNoteImage` (`fileId`) et affiche le blob dans une fenêtre.

Si le collage répond « Vous n'êtes pas autorisé à appeler DriveApp.Folder.createFile » alors que le scope `drive` est déjà dans le manifeste : le jeton du déployeur n’a pas été rafraîchi. **Exécuter** `authorizeDriveForNotes` dans l’éditeur, accepter, **puis** publier une nouvelle version.

## Après une modif du script

**Déployer → Gérer les déploiements → ✎ → Nouvelle version** (sinon l’URL `/exec` sert encore l’ancienne version).

## Sécurité

L’URL `/exec` est publique : toute personne qui la connaît peut lire/écrire le classeur via le bridge. Acceptable ici car les données ne sont pas sensibles. Ne partage pas l’URL inutilement.
