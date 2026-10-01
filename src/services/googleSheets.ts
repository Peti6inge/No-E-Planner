declare var gapi: any;
declare var google: any;

export const SPREADSHEET_ID = '1yLNRF8ylX5qUdvpPVgzmtucmd1AISJ18rfOhEfbo0Ak';
export const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
export const API_KEY = (import.meta.env.VITE_GOOGLE_API_KEY ?? '').trim();
export const CLIENT_ID_CONFIGURED = CLIENT_ID.length > 0;
export const API_KEY_CONFIGURED = API_KEY.length > 0;
export const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

/** Preferred planning tab title; discovered dynamically if missing. */
const PREFERRED_SHEET_TITLES = ['PLANNING', 'Planning', 'planning'];

const TOKEN_STORAGE_KEY = 'coqli_planner_gs_token';

export type GoogleApiState = {
  apiReady: boolean;
  gisReady: boolean;
  isAuthenticated: boolean;
  clientIdConfigured: boolean;
  apiKeyConfigured: boolean;
  error: string | null;
};

export type SheetTicketRow = {
  id: string;
  type: string;
  priority: string;
  module: string;
  task: string;
  details: string;
  status: 'Long-terme' | 'Todo' | 'Running' | 'Done';
};

type StateListener = (state: GoogleApiState) => void;

type OAuthTokenError = {
  error?: string;
  error_description?: string;
};

type StoredToken = {
  access_token: string;
  expires_at: number;
};

/** Message utilisateur pour refus OAuth (app en mode test, etc.). */
export const formatOAuthSignInError = (tokenResponse: OAuthTokenError): string => {
  const code = tokenResponse.error?.toLowerCase();
  if (code === 'access_denied') {
    return (
      'Connexion Google refusée (access_denied). Si l’application OAuth est en mode « Test », ' +
      'ajoutez votre adresse Gmail comme utilisateur test dans Google Cloud Console ' +
      '(APIs et services → Écran de consentement OAuth → Utilisateurs test), puis reconnectez-vous.'
    );
  }
  if (code === 'popup_closed_by_user') {
    return 'Connexion annulée. Réessayez et acceptez les autorisations dans la fenêtre Google.';
  }
  const detail = tokenResponse.error_description?.trim();
  return detail
    ? `La connexion Google a échoué (${tokenResponse.error ?? 'erreur'}). ${detail}`
    : 'La connexion Google a échoué. Vérifiez VITE_GOOGLE_CLIENT_ID, les origines JavaScript autorisées et l’écran de consentement OAuth.';
};

/** Message utilisateur lors d’un échec de lecture Sheets. */
export const formatSheetReadError = (err: unknown): string => {
  const apiMessage = extractSheetsApiMessage(err);
  if (apiMessage?.includes('Unable to parse range')) {
    return (
      'Impossible de lire la feuille : plage A1 invalide (onglet introuvable). ' +
      'Vérifiez le nom de l’onglet dans Google Sheets.'
    );
  }
  return (
    'Impossible de lire la feuille Google Sheets. Vérifiez que VITE_GOOGLE_API_KEY est définie dans .env.local, ' +
    'que l’API Google Sheets est activée pour le même projet Google Cloud, et que la feuille est partagée ' +
    '(« Toute personne disposant du lien » en lecteur, ou accès pour le compte Google avec lequel vous êtes connecté).'
  );
};

const extractSheetsApiMessage = (err: unknown): string | null => {
  if (!err || typeof err !== 'object') return null;
  const body = (err as { body?: string; result?: { error?: { message?: string } } }).body
    ?? (err as { result?: { error?: { message?: string } } }).result?.error?.message;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      return parsed.error?.message ?? body;
    } catch {
      return body;
    }
  }
  if (typeof body === 'string') return body;
  return (err as { result?: { error?: { message?: string } } }).result?.error?.message ?? null;
};

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let scriptPromises = new Map<string, Promise<void>>();
let activeStateListener: StateListener | null = null;
let cachedSheetTitle: string | null = null;

const getInitialState = (): GoogleApiState => ({
  apiReady: false,
  gisReady: false,
  isAuthenticated: false,
  clientIdConfigured: CLIENT_ID_CONFIGURED,
  apiKeyConfigured: API_KEY_CONFIGURED,
  error: null,
});

const loadScript = (src: string) => {
  const existingPromise = scriptPromises.get(src);
  if (existingPromise) {
    return existingPromise;
  }

  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript) {
    const promise = Promise.resolve();
    scriptPromises.set(src, promise);
    return promise;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Impossible de charger le script Google : ${src}`));
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
};

const loadGapiClient = async () => {
  await loadScript('https://apis.google.com/js/api.js');
  if (typeof gapi === 'undefined' || !gapi.load) {
    throw new Error("L'API Google Sheets est indisponible dans cette page.");
  }

  await new Promise<void>((resolve, reject) => {
    try {
      gapi.load('client', {
        callback: resolve,
        onerror: () => reject(new Error("Impossible d'initialiser l'API Google Sheets.")),
        timeout: 5000,
        ontimeout: () => reject(new Error("L'initialisation de l'API Google Sheets a expiré.")),
      });
    } catch (error) {
      reject(error);
    }
  });

  const initOptions: Record<string, unknown> = {
    discoveryDocs: [DISCOVERY_DOC],
  };
  if (API_KEY_CONFIGURED) {
    initOptions.apiKey = API_KEY;
  }

  await gapi.client.init(initOptions);
  gapiInited = true;
};

/** Persist OAuth access token for ordinary page refreshes (≈1h lifetime). */
const persistToken = (token: { access_token?: string; expires_in?: number } | null) => {
  if (!token?.access_token) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  const expiresInSec = typeof token.expires_in === 'number' ? token.expires_in : 3600;
  const stored: StoredToken = {
    access_token: token.access_token,
    expires_at: Date.now() + expiresInSec * 1000,
  };
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // sessionStorage may be blocked in some iframe/bridge contexts
  }
};

const readStoredToken = (): StoredToken | null => {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed?.access_token || typeof parsed.expires_at !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

const restoreTokenIfValid = (): boolean => {
  const stored = readStoredToken();
  if (!stored) return false;
  // Refresh buffer: treat as expired 60s early
  if (Date.now() >= stored.expires_at - 60_000) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return false;
  }
  if (!gapiInited || !gapi?.client?.setToken) return false;
  gapi.client.setToken({ access_token: stored.access_token });
  return true;
};

const clearPersistedToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
};

const emitState = (listener: StateListener, state: GoogleApiState) => {
  activeStateListener = listener;
  listener(state);
};

export const initGoogleAPI = (onStateChange: StateListener) => {
  let active = true;
  const notify = (state: GoogleApiState) => {
    if (active) {
      emitState(onStateChange, state);
    }
  };

  const initialState = getInitialState();
  notify(initialState);

  // A missing client ID must never reach initTokenClient. The planner can
  // still show local data and, when configured, read a publicly shared sheet.
  if (!CLIENT_ID_CONFIGURED && !API_KEY_CONFIGURED) {
    notify({
      ...initialState,
      error: "Configuration Google manquante : ajoutez VITE_GOOGLE_CLIENT_ID pour l'authentification.",
    });
    return () => {
      active = false;
    };
  }

  void (async () => {
    try {
      await loadGapiClient();
      const apiState = {
        ...initialState,
        apiReady: true,
        error: null,
      };

      if (!CLIENT_ID_CONFIGURED) {
        notify(apiState);
        return;
      }

      await loadScript('https://accounts.google.com/gsi/client');
      if (typeof google === 'undefined' || !google.accounts?.oauth2?.initTokenClient) {
        throw new Error("Google Identity Services est indisponible dans cette page.");
      }

      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse?.error) {
            notify({
              ...apiState,
              gisReady: true,
              isAuthenticated: Boolean(gapi.client.getToken?.()),
              error: formatOAuthSignInError(tokenResponse),
            });
            return;
          }
          // GIS returns the token object; also ensure gapi has it for Sheets calls.
          if (tokenResponse?.access_token) {
            gapi.client.setToken({
              access_token: tokenResponse.access_token,
              expires_in: tokenResponse.expires_in,
            });
            persistToken(tokenResponse);
          } else {
            persistToken(gapi.client.getToken?.());
          }
          notify({
            ...apiState,
            gisReady: true,
            isAuthenticated: true,
            error: null,
          });
        },
      });
      gisInited = true;

      const restored = restoreTokenIfValid();
      const token = gapi.client.getToken?.();
      notify({
        ...apiState,
        gisReady: true,
        isAuthenticated: restored || Boolean(token),
        error: null,
      });

      // TODO(session): GIS access tokens last ~1h. sessionStorage restore covers
      // ordinary refresh while valid. Auto silent refresh via prompt:'' is unreliable
      // in Cursor iframe/bridge contexts — skip it; user clicks Sign In after expiry.
    } catch (error) {
      console.error('Google API initialization failed', error);
      notify({
        ...initialState,
        apiReady: gapiInited,
        gisReady: gisInited,
        error: error instanceof Error
          ? error.message
          : "Impossible d'initialiser les services Google.",
      });
    }
  })();

  return () => {
    active = false;
    if (activeStateListener === onStateChange) {
      activeStateListener = null;
    }
  };
};

export const handleAuthClick = (onError?: (message: string) => void) => {
  if (!CLIENT_ID_CONFIGURED || !gisInited || !tokenClient) {
    onError?.("La connexion Google n'est pas disponible : configurez VITE_GOOGLE_CLIENT_ID et rechargez la page.");
    return false;
  }

  try {
    // Prefer silent re-grant when possible; fall back to consent UX on first use.
    const hadGrant = Boolean(readStoredToken() || gapi.client.getToken?.());
    tokenClient.requestAccessToken({ prompt: hadGrant ? '' : 'consent' });
    return true;
  } catch (error) {
    console.error('Google sign-in failed', error);
    onError?.("La fenêtre de connexion Google n'a pas pu être ouverte.");
    return false;
  }
};

export const handleSignoutClick = (
  onAuthChange: (isAuthenticated: boolean) => void,
  onError?: (message: string) => void,
) => {
  if (!gapiInited || !gapi?.client?.getToken) {
    clearPersistedToken();
    onAuthChange(false);
    return;
  }

  const token = gapi.client.getToken();
  if (!token) {
    clearPersistedToken();
    onAuthChange(false);
    return;
  }

  try {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken(null);
      clearPersistedToken();
      onAuthChange(false);
    });
  } catch (error) {
    console.error('Google sign-out failed', error);
    onError?.("La déconnexion Google n'a pas pu être terminée.");
  }
};

/** Escape a sheet title for A1 notation (always quote; double internal quotes). */
export const escapeSheetTitleForA1 = (title: string): string =>
  `'${title.replace(/'/g, "''")}'`;

export const buildValuesRange = (sheetTitle: string, a1Range = 'A1:F'): string =>
  `${escapeSheetTitleForA1(sheetTitle)}!${a1Range}`;

/**
 * Resolve the planning tab title via spreadsheets.get.
 * Prefers PLANNING; falls back to the first sheet properties title.
 */
export const resolveSheetTitle = async (): Promise<string> => {
  if (cachedSheetTitle) return cachedSheetTitle;
  if (!gapiInited || !gapi?.client?.sheets) {
    throw new Error("La lecture Google Sheets n'est pas configurée.");
  }

  const response = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties(title,index,sheetId)',
  });

  const sheets: Array<{ properties?: { title?: string; index?: number } }> =
    response.result?.sheets ?? [];
  const titles = sheets
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));

  for (const preferred of PREFERRED_SHEET_TITLES) {
    const match = titles.find((t) => t === preferred);
    if (match) {
      cachedSheetTitle = match;
      return match;
    }
  }

  // Common French/English fallbacks, then first tab.
  const common = ['Feuille 1', 'Sheet1', 'Feuil1'];
  for (const name of common) {
    const match = titles.find((t) => t === name);
    if (match) {
      cachedSheetTitle = match;
      return match;
    }
  }

  const first = titles[0];
  if (!first) {
    throw new Error('Aucun onglet trouvé dans le classeur Google Sheets.');
  }
  cachedSheetTitle = first;
  return first;
};

const normalizeHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const mapStatus = (raw: string): SheetTicketRow['status'] => {
  const s = normalizeHeader(raw);
  if (s.includes('DONE') || s.includes('TERMINE') || s.startsWith('3')) return 'Done';
  if (s.includes('RUNNING') || s.includes('EN COURS') || s.startsWith('2')) return 'Running';
  if (s.includes('LONG') || s.startsWith('0')) return 'Long-terme';
  if (s.includes('TODO') || s.includes('A FAIRE') || s.startsWith('1')) return 'Todo';
  return 'Todo';
};

const mapDurationToPriority = (raw: string): string => {
  const d = normalizeHeader(raw);
  if (d === 'LONG') return 'High';
  if (d === 'MEDIUM') return 'Normal';
  if (d === 'SHORT') return 'Low';
  return raw || 'Normal';
};

export const parseSheetRows = (values: string[][] | undefined): SheetTicketRow[] => {
  if (!values || values.length < 2) return [];

  const headers = values[0].map((h) => normalizeHeader(String(h ?? '')));
  const indexOf = (...aliases: string[]) => {
    for (const alias of aliases) {
      const i = headers.indexOf(normalizeHeader(alias));
      if (i >= 0) return i;
    }
    return -1;
  };

  const col = {
    id: indexOf('ID'),
    status: indexOf('STATUT', 'STATUS'),
    module: indexOf('MODULE'),
    duration: indexOf('DURATION', 'DUREE', 'DURÉE'),
    braining: indexOf('BRAINING', 'DETAILS', 'DETAIL'),
    task: indexOf('TACHE', 'TÂCHE', 'TASK'),
    type: indexOf('TYPE'),
    priority: indexOf('PRIORITE', 'PRIORITÉ', 'PRIORITY'),
  };

  const cell = (row: string[], idx: number) =>
    idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';

  return values.slice(1).map((row, rowIndex) => {
    const duration = cell(row, col.duration);
    const explicitPriority = cell(row, col.priority);
    const explicitType = cell(row, col.type);

    return {
      id: cell(row, col.id) || String(rowIndex + 1),
      type: explicitType || 'Task',
      priority: explicitPriority || mapDurationToPriority(duration),
      module: cell(row, col.module) || 'OTHER',
      task: cell(row, col.task) || '',
      details: cell(row, col.braining) || '',
      status: mapStatus(cell(row, col.status)),
    };
  }).filter((t) => t.task || t.id);
};

/**
 * Fetch planning rows. Uses OAuth bearer token when signed in (gapi.client token);
 * otherwise falls back to the API key configured at init for public read.
 */
export const fetchPlanningData = async (): Promise<SheetTicketRow[]> => {
  if (!gapiInited || !gapi?.client?.sheets) {
    throw new Error("La lecture Google Sheets n'est pas configurée.");
  }

  try {
    // Prefer known tab PLANNING; resolveSheetTitle confirms via spreadsheets.get.
    const title = await resolveSheetTitle();
    // Columns: ID, STATUT, MODULE, DURATION, BRAINING, TÂCHE → A:F
    const range = buildValuesRange(title, 'A1:F');
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    return parseSheetRows(response.result?.values as string[][] | undefined);
  } catch (err) {
    console.error('Error fetching planning data', err);
    throw new Error(formatSheetReadError(err));
  }
};

/** @deprecated Prefer fetchPlanningData — kept for callers that pass an explicit range. */
export const fetchSheetData = async (range: string) => {
  if (!gapiInited || !gapi?.client?.sheets) {
    throw new Error("La lecture Google Sheets n'est pas configurée.");
  }

  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    return response.result.values;
  } catch (err) {
    console.error('Error fetching data', err);
    throw new Error(formatSheetReadError(err));
  }
};

export const updateSheetData = async (range: string, values: any[][]) => {
  if (!gapiInited || !gapi?.client?.sheets || !gapi?.client?.getToken?.()) {
    throw new Error("L'authentification Google est requise pour modifier la feuille.");
  }

  try {
    const response = await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values,
      },
    });
    return response.result;
  } catch (err) {
    console.error('Error updating data', err);
    throw new Error("La mise à jour de la feuille Google Sheets a échoué.");
  }
};
