import { useEffect, useState } from 'react';
import {
  API_KEY_CONFIGURED,
  CLIENT_ID_CONFIGURED,
  fetchPlanningData,
  formatSheetReadError,
  handleAuthClick,
  handleSignoutClick,
  initGoogleAPI,
  syncAppendTicket,
  syncDeleteTicket,
  syncUpdateTicket,
} from './services/googleSheets';
import type { GoogleApiState } from './services/googleSheets';
import { AlertCircle, Loader2, LogIn, LogOut } from 'lucide-react';
import { Planner } from './components/Planner';
import type { TicketData } from './components/Ticket';
import { ParticlesCanvas } from './components/ParticlesCanvas';
import { nextTicketId } from './lib/planningConstants';

const previewTickets: TicketData[] = [];

const initialGoogleState: GoogleApiState = {
  apiReady: false,
  gisReady: false,
  isAuthenticated: false,
  clientIdConfigured: CLIENT_ID_CONFIGURED,
  apiKeyConfigured: API_KEY_CONFIGURED,
  error: null,
};

function App() {
  const [googleState, setGoogleState] = useState<GoogleApiState>(initialGoogleState);
  const [tickets, setTickets] = useState<TicketData[]>(previewTickets);
  const [isLoading, setIsLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [hasLoadedSheet, setHasLoadedSheet] = useState(false);

  const loadData = async () => {
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
        error instanceof Error && error.message.includes('Impossible de lire la feuille')
          ? error.message
          : formatSheetReadError(error),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return initGoogleAPI((state) => {
      setGoogleState(state);
      if (state.apiReady) {
        void loadData();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; loadData closes over latest setters
  }, []);

  useEffect(() => {
    if (googleState.apiReady && googleState.isAuthenticated) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleState.isAuthenticated, googleState.apiReady]);

  const isAuthenticated = googleState.isAuthenticated;
  const canSignIn = CLIENT_ID_CONFIGURED && googleState.gisReady;
  const canEdit = isAuthenticated && CLIENT_ID_CONFIGURED;

  const handleUpdateTicket = async (id: string, updates: Partial<TicketData>) => {
    if (!canEdit) {
      setActionMessage(
        CLIENT_ID_CONFIGURED
          ? 'Connectez-vous avec Google pour modifier la feuille.'
          : 'Les modifications nécessitent VITE_GOOGLE_CLIENT_ID et une connexion Google.',
      );
      return;
    }

    const previous = tickets;
    const current = previous.find((t) => t.id === id);
    if (!current) return;

    if (!current.sheetRow) {
      setActionMessage(
        'Cette carte n’est pas liée à une ligne Sheets. Rechargez les données après connexion.',
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
      setActionMessage(error instanceof Error ? error.message : 'Échec de la mise à jour Google Sheets.');
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (!canEdit) {
      setActionMessage(
        CLIENT_ID_CONFIGURED
          ? 'Connectez-vous avec Google pour supprimer une ligne.'
          : 'La suppression nécessite VITE_GOOGLE_CLIENT_ID et une connexion Google.',
      );
      return;
    }

    const previous = tickets;
    const current = previous.find((t) => t.id === id);
    if (!current) return;

    if (!current.sheetRow) {
      setActionMessage(
        'Cette carte n’est pas liée à une ligne Sheets. Rechargez les données après connexion.',
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
      setActionMessage(error instanceof Error ? error.message : 'Échec de la suppression Google Sheets.');
    }
  };

  const handleAddTicket = (ticket: Omit<TicketData, 'id'>): string | null => {
    if (!canEdit) {
      setActionMessage(
        CLIENT_ID_CONFIGURED
          ? 'Connectez-vous avec Google pour ajouter une ligne.'
          : "L'ajout nécessite VITE_GOOGLE_CLIENT_ID et une connexion Google.",
      );
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
          error instanceof Error ? error.message : 'Échec de l’ajout dans Google Sheets.',
        );
      }
    })();

    return newTicket.id;
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
    setHasLoadedSheet(false);
  };

  const statusMessage =
    dataError ??
    googleState.error ??
    (!CLIENT_ID_CONFIGURED && !API_KEY_CONFIGURED
      ? 'Configuration Google manquante. Le tableau reste disponible en aperçu local.'
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
        <h1 className="neon-title">No-E</h1>
        <div className="coqli-header-auth">
          {isAuthenticated ? (
            <button type="button" onClick={onLogout} className="coqli-auth-btn coqli-auth-btn-out">
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          ) : canSignIn ? (
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
        <Planner
          tickets={tickets}
          onUpdateTicket={handleUpdateTicket}
          onDeleteTicket={handleDeleteTicket}
          onAddTicket={handleAddTicket}
          canEdit={canEdit}
          onActionUnavailable={() =>
            setActionMessage(
              CLIENT_ID_CONFIGURED
                ? 'Connectez-vous avec Google pour modifier la feuille.'
                : 'Configurez VITE_GOOGLE_CLIENT_ID pour activer les modifications.',
            )
          }
        />
      </main>
    </div>
  );
}

export default App;
