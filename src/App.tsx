import { useEffect, useState } from 'react';
import {
  API_KEY_CONFIGURED,
  BRIDGE_CONFIGURED,
  CLIENT_ID_CONFIGURED,
  fetchBrainstormData,
  fetchPlanningData,
  formatSheetReadError,
  handleAuthClick,
  handleSignoutClick,
  initGoogleAPI,
  syncAppendTicket,
  syncDeleteTicket,
  syncReplaceBrainstorm,
  syncUpdateTicket,
} from './services/googleSheets';
import type { GoogleApiState } from './services/googleSheets';
import { AlertCircle, Loader2, LogIn, LogOut } from 'lucide-react';
import { Planner } from './components/Planner';
import { Brainstorm } from './components/Brainstorm';
import type { TicketData } from './components/Ticket';
import { ParticlesCanvas } from './components/ParticlesCanvas';
import { nextTicketId } from './lib/planningConstants';
import type { BrainstormNode } from './lib/brainstormTreemap';

type AppView = 'planner' | 'brainstorm';

const previewTickets: TicketData[] = [];

const initialGoogleState: GoogleApiState = {
  apiReady: false,
  gisReady: false,
  isAuthenticated: false,
  clientIdConfigured: CLIENT_ID_CONFIGURED,
  apiKeyConfigured: API_KEY_CONFIGURED,
  bridgeConfigured: BRIDGE_CONFIGURED,
  error: null,
};

function App() {
  const [view, setView] = useState<AppView>('planner');
  const [googleState, setGoogleState] = useState<GoogleApiState>(initialGoogleState);
  const [tickets, setTickets] = useState<TicketData[]>(previewTickets);
  const [brainstormNodes, setBrainstormNodes] = useState<BrainstormNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [hasLoadedSheet, setHasLoadedSheet] = useState(false);

  const loadPlanning = async () => {
    setIsLoading(true);
    setDataError(null);
    try {
      const parsed = await fetchPlanningData();

      if (parsed.length > 0) {
        setTickets(parsed);
        setHasLoadedSheet(true);
      } else if (!hasLoadedSheet) {
        setTickets(previewTickets);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setDataError(
        error instanceof Error
          ? error.message
          : formatSheetReadError(error),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadBrainstorm = async () => {
    setIsLoading(true);
    setDataError(null);
    try {
      const parsed = await fetchBrainstormData();
      setBrainstormNodes(parsed);
    } catch (error) {
      console.error('Error loading brainstorm:', error);
      setDataError(
        error instanceof Error
          ? error.message
          : formatSheetReadError(error),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveView = async () => {
    if (view === 'brainstorm') {
      await loadBrainstorm();
    } else {
      await loadPlanning();
    }
  };

  useEffect(() => {
    return initGoogleAPI((state) => {
      setGoogleState(state);
      if (state.apiReady) {
        void loadActiveView();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, []);

  useEffect(() => {
    if (googleState.apiReady) {
      void loadActiveView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleState.isAuthenticated, googleState.apiReady, view]);

  const isAuthenticated = googleState.isAuthenticated;
  const canSignIn = !BRIDGE_CONFIGURED && CLIENT_ID_CONFIGURED && googleState.gisReady;
  const canEdit = BRIDGE_CONFIGURED
    ? googleState.apiReady
    : isAuthenticated && CLIENT_ID_CONFIGURED;

  const editBlockedMessage = BRIDGE_CONFIGURED
    ? 'Le bridge Apps Script n’est pas prêt. Vérifiez VITE_SHEETS_BRIDGE_URL.'
    : CLIENT_ID_CONFIGURED
      ? 'Connectez-vous avec Google pour modifier la feuille.'
      : 'Configurez VITE_SHEETS_BRIDGE_URL (recommandé) ou VITE_GOOGLE_CLIENT_ID.';

  const handleUpdateTicket = async (id: string, updates: Partial<TicketData>) => {
    if (!canEdit) {
      setActionMessage(editBlockedMessage);
      return;
    }

    const previous = tickets;
    const current = previous.find((t) => t.id === id);
    if (!current) return;

    if (!current.sheetRow) {
      setActionMessage(
        'Cette carte n’est pas liée à une ligne Sheets. Rechargez les données.',
      );
      return;
    }

    const merged: TicketData = { ...current, ...updates };
    setTickets((prev) => prev.map((t) => (t.id === id ? merged : t)));
    setActionMessage(null);

    try {
      await syncUpdateTicket(current.sheetRow, merged);
    } catch (error) {
      setTickets(previous);
      setActionMessage(error instanceof Error ? error.message : 'Échec de la mise à jour.');
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (!canEdit) {
      setActionMessage(editBlockedMessage);
      return;
    }

    const previous = tickets;
    const current = previous.find((t) => t.id === id);
    if (!current) return;

    if (!current.sheetRow) {
      setActionMessage(
        'Cette carte n’est pas liée à une ligne Sheets. Rechargez les données.',
      );
      return;
    }

    const deletedRow = current.sheetRow;
    setTickets((prev) =>
      prev
        .filter((t) => t.id !== id)
        .map((t) =>
          t.sheetRow && t.sheetRow > deletedRow ? { ...t, sheetRow: t.sheetRow - 1 } : t,
        ),
    );
    setActionMessage(null);

    try {
      await syncDeleteTicket(deletedRow);
    } catch (error) {
      setTickets(previous);
      setActionMessage(error instanceof Error ? error.message : 'Échec de la suppression.');
    }
  };

  const handleAddTicket = (ticket: Omit<TicketData, 'id'>): string | null => {
    if (!canEdit) {
      setActionMessage(editBlockedMessage);
      return null;
    }

    const newTicket: TicketData = { ...ticket, id: nextTicketId(tickets) };
    const previous = tickets;
    setTickets((prev) => [newTicket, ...prev]);
    setActionMessage(null);

    void (async () => {
      try {
        const { sheetRow } = await syncAppendTicket(newTicket);
        setTickets((prev) =>
          prev.map((t) => (t.id === newTicket.id ? { ...t, sheetRow } : t)),
        );
      } catch (error) {
        setTickets(previous);
        setActionMessage(
          error instanceof Error ? error.message : 'Échec de l’ajout.',
        );
      }
    })();

    return newTicket.id;
  };

  const handleSaveBrainstorm = async (next: BrainstormNode[]) => {
    if (!canEdit) {
      setActionMessage(editBlockedMessage);
      throw new Error('Auth required');
    }

    const previous = brainstormNodes;
    setBrainstormNodes(next);
    setActionMessage(null);

    try {
      await syncReplaceBrainstorm(next);
      const refreshed = await fetchBrainstormData();
      setBrainstormNodes(refreshed);
    } catch (error) {
      setBrainstormNodes(previous);
      const message =
        error instanceof Error ? error.message : 'Échec de la sauvegarde brainstorm.';
      setActionMessage(message);
      throw error;
    }
  };

  const onLogin = () => {
    handleAuthClick(setActionMessage);
  };

  const onLogout = () => {
    handleSignoutClick(
      (authenticated) =>
        setGoogleState((prev) => ({ ...prev, isAuthenticated: authenticated, error: null })),
      setActionMessage,
    );
    setTickets(previewTickets);
    setBrainstormNodes([]);
    setHasLoadedSheet(false);
  };

  const statusMessage =
    dataError ??
    googleState.error ??
    (BRIDGE_CONFIGURED
      ? !googleState.apiReady
        ? 'Connexion au bridge Apps Script…'
        : null
      : !CLIENT_ID_CONFIGURED && !API_KEY_CONFIGURED
        ? 'Configuration manquante : définissez VITE_SHEETS_BRIDGE_URL (voir apps-script/).'
        : !CLIENT_ID_CONFIGURED
          ? "VITE_GOOGLE_CLIENT_ID n'est pas configuré. La lecture publique est tentée, mais les modifications sont désactivées."
          : !googleState.apiReady
            ? 'Connexion aux services Google en cours…'
            : !isAuthenticated && !API_KEY_CONFIGURED
              ? 'Connectez-vous pour modifier la feuille. Ajoutez VITE_GOOGLE_API_KEY pour activer la lecture publique.'
              : !isAuthenticated
                ? 'Lecture publique disponible. Connectez-vous pour modifier la feuille.'
                : null);

  const statusIsError = Boolean(dataError || googleState.error);
  const showStatusBar = Boolean(statusMessage || isLoading || actionMessage);

  return (
    <div className="coqli-app h-screen text-[#ececec] flex flex-col font-mono overflow-hidden">
      <ParticlesCanvas />
      <div className="scanlines" aria-hidden="true" />

      <header className="coqli-header shrink-0">
        <div className="coqli-header-views">
          <button
            type="button"
            className={`coqli-view-toggle ${view === 'planner' ? 'active' : ''}`}
            onClick={() => setView('planner')}
          >
            Planning
          </button>
          <button
            type="button"
            className={`coqli-view-toggle ${view === 'brainstorm' ? 'active' : ''}`}
            onClick={() => setView('brainstorm')}
          >
            Brainstorm
          </button>
        </div>
        <h1 className="neon-title">No-E</h1>
        <div className="coqli-header-auth">
          {!BRIDGE_CONFIGURED && isAuthenticated ? (
            <button type="button" onClick={onLogout} className="coqli-auth-btn coqli-auth-btn-out">
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          ) : !BRIDGE_CONFIGURED && canSignIn ? (
            <button type="button" onClick={onLogin} className="coqli-auth-btn coqli-auth-btn-in">
              <LogIn className="w-4 h-4" />
              Google
            </button>
          ) : null}
        </div>
      </header>

      {showStatusBar && (
        <div
          role="status"
          className={`border-b px-6 py-2 text-xs flex items-center gap-2 shrink-0 relative z-[20] ${
            statusIsError
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : 'border-[#2a2a2a] bg-[#181818] text-[#b4b4b4]'
          }`}
        >
          {statusIsError && <AlertCircle className="w-4 h-4 shrink-0" />}
          {statusMessage && <span>{statusMessage}</span>}
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" />}
          {actionMessage && <span className="ml-auto text-[#fbbf24]">{actionMessage}</span>}
        </div>
      )}

      <main className="flex-1 overflow-hidden relative z-[1]">
        {view === 'planner' ? (
          <Planner
            tickets={tickets}
            onUpdateTicket={handleUpdateTicket}
            onDeleteTicket={handleDeleteTicket}
            onAddTicket={handleAddTicket}
            canEdit={canEdit}
            onActionUnavailable={() => setActionMessage(editBlockedMessage)}
          />
        ) : (
          <Brainstorm
            nodes={brainstormNodes}
            canEdit={canEdit}
            onSave={handleSaveBrainstorm}
            onActionUnavailable={() => setActionMessage(editBlockedMessage)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
