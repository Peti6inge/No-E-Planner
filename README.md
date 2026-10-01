# Planner App

A React/Vite planning board backed by Google Sheets. The board renders in local preview mode even when Google is not configured.

## Prerequisites

- Node.js (v18+)
- A Google Cloud Project with the Google Sheets API enabled.
- OAuth 2.0 Client ID configured for a Web application (required for sign-in and writes).

## Setup

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set the Google credentials:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=your-google-api-key
   ```

`VITE_GOOGLE_CLIENT_ID` is required for Google sign-in and authenticated sheet
writes. Never commit `.env.local` or real credentials. `VITE_GOOGLE_API_KEY`
enables unauthenticated reads when the spreadsheet is shared publicly; without
it, the planner still renders local preview data until Google is configured.

In Google Cloud Console, enable the Google Sheets API, configure the OAuth
client as a Web application, and add the local/deployed origin to its
authorized JavaScript origins. To use public reads, share the spreadsheet with
the required audience and restrict the API key to the Sheets API and your
HTTP referrers.

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
`VITE_BASE` to `/No-E-Planner/` for this project Pages site. For a user/org site at
`https://peti6inge.github.io/`, change the workflow env to `VITE_BASE: /`.

Published URL (after Pages is enabled):

`https://peti6inge.github.io/No-E-Planner/`

### 1. Push to GitHub

Keep the existing Origin remote if present, and add a `github` remote:

```bash
git remote add github https://github.com/Peti6inge/No-E-Planner.git
# or SSH: git@github.com:Peti6inge/No-E-Planner.git
git push -u github main
```

Prefer a **public** repo so GitHub Pages works without a paid plan.

### 2. Enable GitHub Pages (Actions)

1. Open the repo → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

**Private repo caveat:** GitHub Pages on private repositories typically requires
GitHub Pro (or a Team/Enterprise plan). Public repos can use Pages for free.

### 3. Add repository secrets

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret name | Value |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | OAuth 2.0 Web client ID |
| `VITE_GOOGLE_API_KEY` | Google API key (Sheets) |

Do not commit these values. The workflow injects them at build time only.

**Important — Vite intègre les variables d’environnement au moment du build**, pas au chargement du site dans le navigateur. Si vous ajoutez ou modifiez `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_API_KEY` après un déploiement, le bundle publié ne contiendra pas les nouvelles valeurs tant qu’un **nouveau build** n’a pas tourné.

Après avoir créé ou mis à jour ces secrets Actions :

1. Ouvrez **Actions** → **Deploy to GitHub Pages** → **Run workflow** (branche `main`), **ou** poussez un commit sur `main`.
2. Attendez la fin du job ; vérifiez ensuite `https://peti6inge.github.io/No-E-Planner/`.

Sans cette relance, la connexion Google échouera (client ID absent du bundle) même si les secrets sont bien définis dans le dépôt.

Dans Google Cloud Console, l’**origine JavaScript autorisée** du client OAuth Web doit inclure **`https://peti6inge.github.io`** (en plus de `http://localhost:43123` pour le dev local). Une origine limitée à localhost ne suffit pas pour le site Pages.

### 4. Allow the Pages origin in Google Cloud

Add in [Google Cloud Console](https://console.cloud.google.com/):

- **OAuth client → Authorized JavaScript origins**
  - `https://peti6inge.github.io`
  - (also keep local: `http://localhost:43123`)
- **API key → Application restrictions → HTTP referrers**
  - `https://peti6inge.github.io/No-E-Planner/*`
  - (optional local: `http://localhost:43123/*`)

Push to `main` (or run **Actions** → **Deploy to GitHub Pages** → **Run workflow**).
The site will be published at `https://peti6inge.github.io/No-E-Planner/`.

## Build

```bash
npm run build
```

Output is written to `dist/`.
