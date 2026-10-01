import { useCallback, useEffect, useRef, useState } from 'react';
import { planningAddFeedback } from '../lib/planningFeedback';
import { Ticket } from './Ticket';
import type { TicketData } from './Ticket';
import type { TicketStatus } from '../lib/planningConstants';
import { Plus, LayoutGrid, ListTodo, PlayCircle, CheckCircle2, List } from 'lucide-react';

type ViewMode = TicketStatus | 'All';

interface PlannerProps {
  tickets: TicketData[];
  onUpdateTicket: (id: string, updates: Partial<TicketData>) => void;
  onDeleteTicket: (id: string) => void;
  onAddTicket: (ticket: Omit<TicketData, 'id'>) => string | null;
  canEdit: boolean;
  onActionUnavailable: () => void;
}

const isTypingTarget = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

export function Planner({
  tickets,
  onUpdateTicket,
  onDeleteTicket,
  onAddTicket,
  canEdit,
  onActionUnavailable,
}: PlannerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('RUNNING');
  const [focusTaskTicketId, setFocusTaskTicketId] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const filteredTickets = tickets.filter((t) => viewMode === 'All' || t.status === viewMode);

  const handleAddTicket = useCallback(() => {
    if (!canEdit) {
      onActionUnavailable();
      return;
    }
    const newId = onAddTicket({
      status: 'RUNNING',
      module: 'OTHER',
      duration: 'SHORT',
      braining: 'NONE',
      task: '',
      details: '',
    });
    if (newId) {
      setFocusTaskTicketId(newId);
    }
    if (addButtonRef.current) {
      planningAddFeedback(addButtonRef.current);
    } else {
      planningAddFeedback({ clientX: window.innerWidth / 2, clientY: 120 });
    }
  }, [canEdit, onActionUnavailable, onAddTicket]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isPlus =
        e.key === '+' ||
        e.code === 'NumpadAdd' ||
        (e.key === '=' && e.shiftKey);
      if (!isPlus || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      handleAddTicket();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAddTicket]);

  const counts = {
    'LONG TERM': tickets.filter((t) => t.status === 'LONG TERM').length,
    TODO: tickets.filter((t) => t.status === 'TODO').length,
    RUNNING: tickets.filter((t) => t.status === 'RUNNING').length,
    DONE: tickets.filter((t) => t.status === 'DONE').length,
    All: tickets.length,
  };

  return (
    <div className="flex flex-col h-full relative z-[1]">
      <div className="coqli-filters-bar">
        <div className="flex flex-wrap gap-2 justify-center items-center">
          <FilterButton
            active={viewMode === 'All'}
            onClick={() => setViewMode('All')}
            icon={<LayoutGrid size={16} />}
            label="Tous"
            count={counts.All}
          />
          <FilterButton
            active={viewMode === 'LONG TERM'}
            onClick={() => setViewMode('LONG TERM')}
            icon={<List size={16} />}
            label="LONG TERM"
            count={counts['LONG TERM']}
          />
          <FilterButton
            active={viewMode === 'TODO'}
            onClick={() => setViewMode('TODO')}
            icon={<ListTodo size={16} />}
            label="TODO"
            count={counts.TODO}
          />
          <FilterButton
            active={viewMode === 'RUNNING'}
            onClick={() => setViewMode('RUNNING')}
            icon={<PlayCircle size={16} />}
            label="RUNNING"
            count={counts.RUNNING}
          />
          <FilterButton
            active={viewMode === 'DONE'}
            onClick={() => setViewMode('DONE')}
            icon={<CheckCircle2 size={16} />}
            label="DONE"
            count={counts.DONE}
          />
        </div>

        <button
          ref={addButtonRef}
          type="button"
          onClick={handleAddTicket}
          title={canEdit ? 'Ajouter un ticket (+)' : 'Connectez-vous pour ajouter des tickets'}
          className="coqli-add-btn"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-[920px] mx-auto">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-[#b4b4b4] font-mono border border-dashed border-[#2a2a2a] rounded-lg">
              Aucun ticket dans cette vue.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredTickets.map((ticket) => (
                <Ticket
                  key={ticket.id}
                  ticket={ticket}
                  onUpdate={onUpdateTicket}
                  onDelete={onDeleteTicket}
                  canEdit={canEdit}
                  onActionUnavailable={onActionUnavailable}
                  focusTask={ticket.id === focusTaskTicketId}
                  onTaskFocused={() => setFocusTaskTicketId(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-sm transition-colors whitespace-nowrap ${
        active
          ? 'bg-[#2a2a2a] text-white border border-[#4a4a4a]'
          : 'text-[#b4b4b4] hover:bg-[#1c1c1c] hover:text-white border border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-[#3a3a3a]' : 'bg-[#1c1c1c]'}`}>
        {count}
      </span>
    </button>
  );
}
