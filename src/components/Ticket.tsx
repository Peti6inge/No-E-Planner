import { useState } from 'react';
import { Trash2, CheckCircle, Edit2, Save, X } from 'lucide-react';

export interface TicketData {
  id: string;
  type: string;
  priority: string;
  module: string;
  task: string;
  details: string;
  status: 'Long-terme' | 'Todo' | 'Running' | 'Done';
  /** Ligne 1-based dans l’onglet PLANNING (donnée ; en-tête = 1). */
  sheetRow?: number;
}

interface TicketProps {
  ticket: TicketData;
  onUpdate: (id: string, updates: Partial<TicketData>) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  onActionUnavailable: () => void;
}

export function Ticket({ ticket, onUpdate, onDelete, canEdit, onActionUnavailable }: TicketProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(ticket.task);
  const [editedDetails, setEditedDetails] = useState(ticket.details);

  const handleSave = () => {
    if (!canEdit) {
      onActionUnavailable();
      return;
    }
    onUpdate(ticket.id, { task: editedTask, details: editedDetails });
    setIsEditing(false);
  };

  const handleUpdate = (updates: Partial<TicketData>) => {
    if (!canEdit) {
      onActionUnavailable();
      return;
    }
    onUpdate(ticket.id, updates);
  };

  const handleDelete = () => {
    if (!canEdit) {
      onActionUnavailable();
      return;
    }
    onDelete(ticket.id);
  };

  const handleCancel = () => {
    setEditedTask(ticket.task);
    setEditedDetails(ticket.details);
    setIsEditing(false);
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bug': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'feature': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'tech': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'high': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'normal': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'low': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-md p-4 mb-4 flex flex-col gap-3 transition-all hover:border-[#3a3a3a]">
      <div className="flex justify-between items-start">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[#ececec] font-bold font-mono text-sm">#{ticket.id}</span>
          
          <select 
            value={ticket.type} 
            onChange={(e) => handleUpdate({ type: e.target.value })}
            className={`text-xs px-2 py-1 rounded border font-mono appearance-none cursor-pointer outline-none ${getTypeColor(ticket.type)}`}
          >
            <option value="Bug">Bug</option>
            <option value="Feature">Feature</option>
            <option value="Tech">Tech</option>
            <option value="Task">Task</option>
          </select>

          <select 
            value={ticket.priority} 
            onChange={(e) => handleUpdate({ priority: e.target.value })}
            className={`text-xs px-2 py-1 rounded border font-mono appearance-none cursor-pointer outline-none ${getPriorityColor(ticket.priority)}`}
          >
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>

          <select 
            value={ticket.module} 
            onChange={(e) => handleUpdate({ module: e.target.value })}
            className="bg-[#2a2a2a] text-[#ececec] border border-[#3a3a3a] text-xs px-2 py-1 rounded font-mono appearance-none cursor-pointer outline-none"
          >
            {/* Prefer sheet MODULE values; keep legacy Coqli options as fallbacks. */}
            <option value="CONFIG">CONFIG</option>
            <option value="CONCEPTUALISATION">CONCEPTUALISATION</option>
            <option value="LEARNING">LEARNING</option>
            <option value="ASSETS">ASSETS</option>
            <option value="MUSIC /SFX">MUSIC /SFX</option>
            <option value="SCENES 3D">SCENES 3D</option>
            <option value="OTHER">OTHER</option>
            <option value="Frontend">Frontend</option>
            <option value="Backend">Backend</option>
            <option value="General">General</option>
            {!['CONFIG','CONCEPTUALISATION','LEARNING','ASSETS','MUSIC /SFX','SCENES 3D','OTHER','Frontend','Backend','General'].includes(ticket.module) && (
              <option value={ticket.module}>{ticket.module}</option>
            )}
          </select>
        </div>

        <div className="flex gap-2">
          {ticket.status !== 'Done' && (
            <button 
              onClick={() => handleUpdate({ status: 'Done' })}
              className="text-[#b4b4b4] hover:text-green-400 p-1 rounded transition-colors"
              title="Mark as Done"
            >
              <CheckCircle size={18} />
            </button>
          )}
          <button 
            onClick={handleDelete}
            className="text-[#b4b4b4] hover:text-red-400 p-1 rounded transition-colors"
            title="Delete ticket"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <input 
              type="text" 
              value={editedTask} 
              onChange={(e) => setEditedTask(e.target.value)}
              className="bg-[#141414] border border-[#3a3a3a] text-[#ececec] px-3 py-2 rounded font-mono text-sm focus:outline-none focus:border-[#67e8f9]"
              placeholder="Task title..."
            />
            <textarea 
              value={editedDetails} 
              onChange={(e) => setEditedDetails(e.target.value)}
              className="bg-[#141414] border border-[#3a3a3a] text-[#b4b4b4] px-3 py-2 rounded font-mono text-sm min-h-[80px] focus:outline-none focus:border-[#67e8f9]"
              placeholder="Task details..."
            />
            <div className="flex gap-2 justify-end mt-1">
              <button onClick={handleCancel} className="flex items-center gap-1 text-xs text-[#b4b4b4] hover:text-white px-2 py-1">
                <X size={14} /> Cancel
              </button>
              <button onClick={handleSave} className="flex items-center gap-1 text-xs bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white px-3 py-1 rounded border border-[#4a4a4a]">
                <Save size={14} /> Save
              </button>
            </div>
          </div>
        ) : (
          <div className="group relative">
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-[#b4b4b4] hover:text-white p-1 bg-[#2a2a2a] rounded transition-opacity"
            >
              <Edit2 size={14} />
            </button>
            <h3 className="text-[#ececec] font-mono text-sm font-semibold mb-1">{ticket.task}</h3>
            {ticket.details && (
              <p className="text-[#b4b4b4] font-mono text-xs whitespace-pre-wrap">{ticket.details}</p>
            )}
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center mt-2 pt-3 border-t border-[#2a2a2a]">
        <select 
          value={ticket.status} 
          onChange={(e) => handleUpdate({ status: e.target.value as TicketData['status'] })}
          className="bg-transparent text-[#b4b4b4] text-xs font-mono appearance-none cursor-pointer outline-none hover:text-white"
        >
          <option value="Long-terme">Long-terme</option>
          <option value="Todo">Todo</option>
          <option value="Running">Running</option>
          <option value="Done">Done</option>
        </select>
      </div>
    </div>
  );
}
