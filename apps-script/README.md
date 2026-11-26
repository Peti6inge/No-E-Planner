# Bridge Apps Script

Proxy lecture/écriture du classeur PLANNING (onglets `PLANNING` + `BRAINSTORM`) **sans OAuth dans le navigateur**.

## Déploiement (une fois)

1. Ouvre le [classeur PLANNING](https://docs.google.com/spreadsheets/d/1yLNRF8ylX5qUdvpPVgzmtucmd1AISJ18rfOhEfbo0Ak/edit).
2. **Extensions → Apps Script**.
3. Colle le contenu de [`Code.gs`](./Code.gs) (remplace le fichier par défaut).
4. **Déployer → Nouveau déploiement** :
   - Type : **Application Web**
   - Description : `no-e-planner-bridge`
   - Exécuter en tant que : **Moi**
   - Qui peut y accéder : **Tout le monde**
5. Autorise le compte Google quand Google le demande.
6. Copie l’URL qui se termine par `/exec`.

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

## Après une modif du script

**Déployer → Gérer les déploiements → ✎ → Nouvelle version** (sinon l’URL `/exec` sert encore l’ancienne version).

## Sécurité

L’URL `/exec` est publique : toute personne qui la connaît peut lire/écrire le classeur via le bridge. Acceptable ici car les données ne sont pas sensibles. Ne partage pas l’URL inutilement.
