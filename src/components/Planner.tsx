import { useState } from 'react';
import { Ticket } from './Ticket';
import type { TicketData } from './Ticket';
import { Plus, LayoutGrid, ListTodo, PlayCircle, CheckCircle2, List } from 'lucide-react';

type ViewMode = 'Long-terme' | 'Todo' | 'Running' | 'Done' | 'All';

interface PlannerProps {
  tickets: TicketData[];
  onUpdateTicket: (id: string, updates: Partial<TicketData>) => void;
  onDeleteTicket: (id: string) => void;
  onAddTicket: (ticket: Omit<TicketData, 'id'>) => void;
  canEdit: boolean;
  onActionUnavailable: () => void;
}

export function Planner({
  tickets,
  onUpdateTicket,
  onDeleteTicket,
  onAddTicket,
  canEdit,
  onActionUnavailable,
}: PlannerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('All');

  const filteredTickets = tickets.filter(t => viewMode === 'All' || t.status === viewMode);

  const handleAddTicket = () => {
    if (!canEdit) {
      onActionUnavailable();
      return;
    }
    onAddTicket({
      type: 'Task',
      priority: 'Normal',
      module: 'OTHER',
      task: 'New Task',
      details: '',
      status: viewMode === 'All' ? 'Todo' : viewMode
    });
  };

  const getCounts = () => {
    return {
      'Long-terme': tickets.filter(t => t.status === 'Long-terme').length,
      'Todo': tickets.filter(t => t.status === 'Todo').length,
      'Running': tickets.filter(t => t.status === 'Running').length,
      'Done': tickets.filter(t => t.status === 'Done').length,
      'All': tickets.length
    };
  };

  const counts = getCounts();

  return (
    <div className="flex flex-col h-full bg-[#141414]">
      {/* Header / Filters */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] p-4 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-10">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterButton 
            active={viewMode === 'All'} 
            onClick={() => setViewMode('All')}
            icon={<LayoutGrid size={16} />}
            label="All"
            count={counts['All']}
          />
          <FilterButton 
            active={viewMode === 'Long-terme'} 
            onClick={() => setViewMode('Long-terme')}
            icon={<List size={16} />}
            label="Long-terme"
            count={counts['Long-terme']}
          />
          <FilterButton 
            active={viewMode === 'Todo'} 
            onClick={() => setViewMode('Todo')}
            icon={<ListTodo size={16} />}
            label="Todo"
            count={counts['Todo']}
          />
          <FilterButton 
            active={viewMode === 'Running'} 
            onClick={() => setViewMode('Running')}
            icon={<PlayCircle size={16} />}
            label="Running"
            count={counts['Running']}
          />
          <FilterButton 
            active={viewMode === 'Done'} 
            onClick={() => setViewMode('Done')}
            icon={<CheckCircle2 size={16} />}
            label="Done"
            count={counts['Done']}
          />
        </div>
        
        <button 
          onClick={handleAddTicket}
          title={canEdit ? 'Add ticket' : 'Configure Google authentication to add tickets'}
          className="flex items-center gap-2 bg-[#67e8f9]/10 text-[#67e8f9] hover:bg-[#67e8f9]/20 border border-[#67e8f9]/30 px-4 py-2 rounded-md font-mono text-sm transition-colors whitespace-nowrap"
        >
          <Plus size={16} />
          Add Ticket
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-[#b4b4b4] font-mono border border-dashed border-[#2a2a2a] rounded-lg">
              No tickets found in this view.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTickets.map(ticket => (
                <Ticket 
                  key={ticket.id} 
                  ticket={ticket} 
                  onUpdate={onUpdateTicket}
                  onDelete={onDeleteTicket}
                  canEdit={canEdit}
                  onActionUnavailable={onActionUnavailable}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count: number }) {
  return (
    <button
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
