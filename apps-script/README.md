# Bridge Apps Script

Proxy lecture/écriture du classeur PLANNING (onglets `PLANNING`, `BRAINSTORM` et `NOTES`) **sans OAuth dans le navigateur**.

## Déploiement (une fois)

1. Ouvre le [classeur PLANNING](https://docs.google.com/spreadsheets/d/1yLNRF8ylX5qUdvpPVgzmtucmd1AISJ18rfOhEfbo0Ak/edit).
2. **Extensions → Apps Script**.
3. Colle le contenu de [`Code.gs`](./Code.gs) (remplace le fichier par défaut).
4. Colle le manifeste [`appsscript.json`](./appsscript.json) — voir [Manifeste](#manifeste-scopes) ci-dessous. Sans les scopes Drive, `DriveApp.getFileById` répond « Vous n'êtes pas autorisé à appeler DriveApp.getFileById ».
5. **Déployer → Nouveau déploiement** :
   - Type : **Application Web**
   - Description : `no-e-planner-bridge`
   - Exécuter en tant que : **Moi**
   - Qui peut y accéder : **Tout le monde**
6. Autorise le compte Google quand Google le demande.
7. Copie l’URL qui se termine par `/exec`.

## Manifeste (scopes)

Le Web App n’hérite pas tout seul du droit Drive. Il faut le déclarer dans le manifeste, **puis** publier une nouvelle version et ré-autoriser.

1. Éditeur Apps Script → **Paramètres du projet** (engrenage) → cocher **Afficher le fichier manifeste « appsscript.json » dans l’éditeur**.
2. Ouvrir `appsscript.json` et coller [`appsscript.json`](./appsscript.json). Scopes :

   - `https://www.googleapis.com/auth/spreadsheets` — le classeur
   - `https://www.googleapis.com/auth/drive` — lire et créer les fichiers du dossier `NOTES-IMAGES` (`drive.file` ne suffit pas : le classeur existe déjà, `DriveApp.getFileById` a besoin de `drive`)
   - `https://www.googleapis.com/auth/script.storage` — mémoriser l’id du dossier dans les propriétés du script

3. Enregistrer.
4. **Déployer → Gérer les déploiements → ✎ → Nouvelle version**.
5. Ré-autoriser : dans l’éditeur, exécuter une fois une fonction qui touche Drive (`uploadNoteImage` ou le chemin de `getNoteImage`), **ou** rouvrir le flux OAuth du déploiement quand Google le redemande. Une nouvelle version sans cette autorisation laisse l’erreur « Vous n'êtes pas autorisé à appeler DriveApp.getFileById ».

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

Après un collage qui échoue avec « Vous n'êtes pas autorisé à appeler DriveApp.getFileById » : le manifeste ci-dessus n’est pas encore sur le déploiement. Coller les scopes, nouvelle version, puis ré-autoriser.

## Après une modif du script

**Déployer → Gérer les déploiements → ✎ → Nouvelle version** (sinon l’URL `/exec` sert encore l’ancienne version).

## Sécurité

L’URL `/exec` est publique : toute personne qui la connaît peut lire/écrire le classeur via le bridge. Acceptable ici car les données ne sont pas sensibles. Ne partage pas l’URL inutilement.
