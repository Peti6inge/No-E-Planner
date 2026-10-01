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
import { AlertCircle, Info, Loader2, LogIn, LogOut } from 'lucide-react';
import { Planner } from './components/Planner';
import type { TicketData } from './components/Ticket';

// Helper to generate a random ID for new tickets
const generateId = () => Math.floor(1000 + Math.random() * 9000).toString();

const previewTickets: TicketData[] = [
  {
    id: '1001',
    type: 'Feature',
    priority: 'High',
    module: 'Frontend',
    task: 'Integrate Coqli UI',
    details: 'Port the HTML/CSS to React components.',
    status: 'Running',
  },
  {
    id: '1002',
    type: 'Bug',
    priority: 'Urgent',
    module: 'Backend',
    task: 'Fix Google Sheets Auth',
    details: 'Users are getting 403 errors on login.',
    status: 'Todo',
  },
];

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
      // Columns from PLANNING tab: ID, STATUT, MODULE, DURATION, BRAINING, TÂCHE
      // Range resolved as 'PLANNING'!A1:Z500 inside fetchPlanningData.
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

  // Re-fetch when auth flips to true so the OAuth token path is used after sign-in.
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

  const handleAddTicket = async (ticket: Omit<TicketData, 'id'>) => {
    if (!canEdit) {
      setActionMessage(
        CLIENT_ID_CONFIGURED
          ? 'Connectez-vous avec Google pour ajouter une ligne.'
          : "L'ajout nécessite VITE_GOOGLE_CLIENT_ID et une connexion Google.",
      );
      return;
    }

    const newTicket: TicketData = { ...ticket, id: generateId() };
    const previous = tickets;
    setTickets((prev) => [newTicket, ...prev]);
    setActionMessage(null);

    try {
      const { sheetRow } = await syncAppendTicket(newTicket);
      setTickets((prev) =>
        prev.map((t) => (t.id === newTicket.id ? { ...t, sheetRow } : t)),
      );
    } catch (error) {
      setTickets(previous);
      setActionMessage(error instanceof Error ? error.message : 'Échec de l’ajout dans Google Sheets.');
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
          : !isAuthenticated
            ? API_KEY_CONFIGURED
              ? 'Lecture publique disponible. Connectez-vous pour modifier la feuille.'
              : 'Connectez-vous pour modifier la feuille. Ajoutez VITE_GOOGLE_API_KEY pour activer la lecture publique.'
            : 'Connecté à Google. Les modifications sont disponibles.');

  const statusIsError = Boolean(dataError || googleState.error);

  return (
    <div className="h-screen bg-[#141414] text-[#ececec] flex flex-col font-mono overflow-hidden">
      <header className="border-b border-[#2a2a2a] bg-[#1a1a1a] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#67e8f9] to-[#c4b5fd] rounded-md flex items-center justify-center text-[#141414] font-bold text-lg">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tight">Planning Coqli</h1>
        </div>
        {isAuthenticated ? (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-md transition-colors border border-transparent hover:border-red-500/30"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        ) : canSignIn ? (
          <button
            onClick={onLogin}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#ececec] text-[#141414] hover:bg-white rounded-md transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign In with Google
          </button>
        ) : null}
      </header>

      <div
        role="status"
        className={`border-b px-6 py-2 text-xs flex items-center gap-2 shrink-0 ${
          statusIsError
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : 'border-[#2a2a2a] bg-[#181818] text-[#b4b4b4]'
        }`}
      >
        {statusIsError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
        <span>{statusMessage}</span>
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" />}
        {actionMessage && <span className="ml-auto text-[#fbbf24]">{actionMessage}</span>}
      </div>

      <main className="flex-1 overflow-hidden">
        <div className="h-full">
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
        </div>
      </main>
    </div>
  );
}

export default App;
