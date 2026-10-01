import { useEffect, useLayoutEffect, useState } from 'react';
import { Trash2, CheckCircle } from 'lucide-react';
import type { TicketBraining, TicketDuration, TicketStatus } from '../lib/planningConstants';
import {
  TICKET_BRAININGS,
  TICKET_DURATIONS,
  TICKET_MODULES,
  TICKET_STATUSES,
  brainingLabel,
  durationLabel,
  moduleLabel,
  statusLabel,
} from '../lib/planningConstants';
import { planningValidateFeedback } from '../lib/planningFeedback';
import { useAutoResizeTextarea } from '../lib/useAutoResizeTextarea';

export interface TicketData {
  id: string;
  status: TicketStatus;
  module: string;
  duration: TicketDuration;
  braining: TicketBraining;
  task: string;
  details: string;
  sheetRow?: number;
}

interface TicketProps {
  ticket: TicketData;
  onUpdate: (id: string, updates: Partial<TicketData>) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  onActionUnavailable: () => void;
  focusTask?: boolean;
  onTaskFocused?: () => void;
}

const selectClass =
  'coqli-select text-xs px-2 py-1 rounded font-mono appearance-none cursor-pointer outline-none';

export function Ticket({
  ticket,
  onUpdate,
  onDelete,
  canEdit,
  onActionUnavailable,
  focusTask = false,
  onTaskFocused,
}: TicketProps) {
  const [task, setTask] = useState(ticket.task);
  const [details, setDetails] = useState(ticket.details);
  const { ref: taskRef, onInput: syncTaskHeight } = useAutoResizeTextarea(task, 10);
  const { ref: detailsRef, onInput: syncDetailsHeight } = useAutoResizeTextarea(details);

  useEffect(() => {
    setTask(ticket.task);
    setDetails(ticket.details);
  }, [ticket.task, ticket.details]);

  useLayoutEffect(() => {
    if (!focusTask) return;
    const el = taskRef.current;
    if (!el) return;
    el.focus({ preventScroll: false });
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    onTaskFocused?.();
  }, [focusTask, onTaskFocused, taskRef]);

  const guard = () => {
    if (!canEdit) {
      onActionUnavailable();
      return false;
    }
    return true;
  };

  const handleUpdate = (updates: Partial<TicketData>) => {
    if (!guard()) return;
    onUpdate(ticket.id, updates);
  };

  const handleSelectChange = <K extends keyof TicketData>(
    field: K,
    value: TicketData[K],
    previous: TicketData[K],
  ) => {
    if (value === previous) return;
    handleUpdate({ [field]: value } as Partial<TicketData>);
  };

  const commitTask = () => {
    if (!guard()) {
      setTask(ticket.task);
      return;
    }
    if (task !== ticket.task) {
      onUpdate(ticket.id, { task });
    }
  };

  const commitDetails = () => {
    if (!guard()) {
      setDetails(ticket.details);
      return;
    }
    if (details !== ticket.details) {
      onUpdate(ticket.id, { details });
    }
  };

  const handleDelete = () => {
    if (!guard()) return;
    onDelete(ticket.id);
  };

  const moduleOptions =
    (TICKET_MODULES as readonly string[]).includes(ticket.module)
      ? TICKET_MODULES
      : [...TICKET_MODULES, ticket.module];

  return (
    <article className="coqli-ticket">
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="coqli-ticket-id">#{ticket.id}</span>

          <select
            value={ticket.status}
            onChange={(e) =>
              handleSelectChange('status', e.target.value as TicketStatus, ticket.status)
            }
            className={selectClass}
            disabled={!canEdit}
          >
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>

          <select
            value={ticket.module}
            onChange={(e) => handleSelectChange('module', e.target.value, ticket.module)}
            className={selectClass}
            disabled={!canEdit}
          >
            {moduleOptions.map((m) => (
              <option key={m} value={m}>
                {moduleLabel(m)}
              </option>
            ))}
          </select>

          <select
            value={ticket.duration}
            onChange={(e) =>
              handleSelectChange(
                'duration',
                e.target.value as TicketDuration,
                ticket.duration,
              )
            }
            className={selectClass}
            disabled={!canEdit}
          >
            {TICKET_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {durationLabel(d)}
              </option>
            ))}
          </select>

          <select
            value={ticket.braining}
            onChange={(e) =>
              handleSelectChange(
                'braining',
                e.target.value as TicketBraining,
                ticket.braining,
              )
            }
            className={selectClass}
            disabled={!canEdit}
          >
            {TICKET_BRAININGS.map((b) => (
              <option key={b} value={b}>
                {brainingLabel(b)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1 shrink-0">
          {ticket.status !== 'DONE' && (
            <button
              type="button"
              onClick={(e) => {
                planningValidateFeedback(e.currentTarget);
                handleUpdate({ status: 'DONE' });
              }}
              className="coqli-icon-btn"
              title="Marquer comme DONE"
            >
              <CheckCircle size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="coqli-icon-btn coqli-icon-btn-danger"
            title="Supprimer"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <textarea
        ref={taskRef}
        className="coqli-textarea coqli-textarea-task"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onInput={syncTaskHeight}
        onBlur={commitTask}
        placeholder="Tâche…"
        rows={1}
        readOnly={!canEdit}
      />
      <textarea
        ref={detailsRef}
        className="coqli-textarea"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        onInput={syncDetailsHeight}
        onBlur={commitDetails}
        placeholder="Détails…"
        rows={1}
        readOnly={!canEdit}
      />
    </article>
  );
}
