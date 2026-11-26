# Planner App

A React/Vite planning board + brainstorm treemap backed by Google Sheets.

## Prerequisites

- Node.js (v18+)
- Accès au classeur PLANNING (onglets `PLANNING`, `BRAINSTORM` et `NOTES` — notes, créé à la première sauvegarde)

## Setup (recommandé : bridge Apps Script)

Pas de connexion Google dans le navigateur. Un Web App Apps Script lit/écrit le classeur à ta place.

1. Clone et installe :
   ```bash
   npm install
   ```

2. Déploie le bridge (une fois) : suis [apps-script/README.md](apps-script/README.md).

3. Copie `.env.example` → `.env.local` :
   ```env
   VITE_SHEETS_BRIDGE_URL=https://script.google.com/macros/s/XXXX/exec
   ```

Ne commit jamais `.env.local`.

### Legacy OAuth (optionnel)

Si `VITE_SHEETS_BRIDGE_URL` est absent, l’app retombe sur OAuth + API key :

```env
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_API_KEY=...
```

## Running Locally

```bash
npm run dev
```

The app is available at `http://localhost:43123`.

Optional: to preview asset paths as on GitHub project Pages:

```bash
VITE_BASE=/No-E-Planner/ npm run build && VITE_BASE=/No-E-Planner/ npm run preview
```

## Deploy to GitHub Pages

Target repository: [Peti6inge/No-E-Planner](https://github.com/Peti6inge/No-E-Planner).

Vite `base` is `process.env.VITE_BASE || '/'`. The GitHub Actions workflow sets
`VITE_BASE` to `/No-E-Planner/` for this project Pages site.

Published URL (after Pages is enabled):

`https://peti6inge.github.io/No-E-Planner/`

### 1. Push to GitHub

```bash
git remote add github https://github.com/Peti6inge/No-E-Planner.git
git push -u github main
```

### 2. Enable GitHub Pages (Actions)

1. Open the repo → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

### 3. Add repository secrets

**Settings** → **Secrets and variables** → **Actions** :

| Secret name | Value |
|---|---|
| `VITE_SHEETS_BRIDGE_URL` | URL `/exec` du Web App Apps Script |

(Legacy si pas de bridge : `VITE_GOOGLE_CLIENT_ID` + `VITE_GOOGLE_API_KEY`.)

Vite intègre les variables au **build**. Après ajout/modif d’un secret, relance **Deploy to GitHub Pages**.

### 4. Build

```bash
npm run build
```

Output is written to `dist/`.
