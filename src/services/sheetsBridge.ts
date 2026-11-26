export const BRIDGE_URL = (import.meta.env.VITE_SHEETS_BRIDGE_URL ?? '').trim();
export const BRIDGE_CONFIGURED = BRIDGE_URL.length > 0;

type BridgeOk = { ok: true } & Record<string, unknown>;
type BridgeErr = { ok: false; error?: string };
type BridgeResponse = BridgeOk | BridgeErr;

export const callSheetsBridge = async <T extends BridgeOk>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> => {
  if (!BRIDGE_CONFIGURED) {
    throw new Error('Bridge Apps Script non configuré (VITE_SHEETS_BRIDGE_URL).');
  }

  let response: Response;
  try {
    response = await fetch(BRIDGE_URL, {
      method: 'POST',
      // text/plain évite le preflight CORS ; Apps Script lit le body tel quel.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
    });
  } catch (err) {
    console.error('Bridge fetch failed', err);
    throw new Error(
      'Impossible de joindre le bridge Apps Script. Vérifiez VITE_SHEETS_BRIDGE_URL et le déploiement « Tout le monde ».',
    );
  }

  const text = await response.text();
  let data: BridgeResponse;
  try {
    data = JSON.parse(text) as BridgeResponse;
  } catch {
    throw new Error(
      'Réponse invalide du bridge Apps Script. Redéployez le script (nouvelle version) et vérifiez l’URL /exec.',
    );
  }

  if (!response.ok || !data || data.ok !== true) {
    const message =
      data && 'error' in data && data.error
        ? String(data.error)
        : `Bridge Apps Script a échoué (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return data as T;
};
