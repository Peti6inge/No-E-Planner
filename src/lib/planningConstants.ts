export type TicketStatus = 'LONG TERM' | 'TODO' | 'RUNNING' | 'DONE';
export type TicketDuration = 'SHORT' | 'MEDIUM' | 'LONG';
export type TicketBraining = 'NONE' | 'MEDIUM' | 'HARD';

export const TICKET_STATUSES: TicketStatus[] = ['LONG TERM', 'TODO', 'RUNNING', 'DONE'];

export const TICKET_MODULES = [
  'CONFIG',
  'CONCEPT',
  'DEV',
  'SCENES 3D',
  'ASSETS 3D',
  'MUSIC/SFX',
  'VFX',
  'LEARNING',
  'ASSETS',
  'OTHER',
] as const;

export type TicketModule = (typeof TICKET_MODULES)[number];

export const TICKET_DURATIONS: TicketDuration[] = ['SHORT', 'MEDIUM', 'LONG'];
export const TICKET_BRAININGS: TicketBraining[] = ['NONE', 'MEDIUM', 'HARD'];

const MODULE_EMOJI: Record<string, string> = {
  CONFIG: '⚙️',
  CONCEPT: '💡',
  CONCEPTUALISATION: '💡',
  'CONCEPT.': '💡',
  DEV: '💻',
  'SCENES 3D': '🎬',
  'ASSETS 3D': '🧊',
  'MUSIC/SFX': '🎵',
  VFX: '✨',
  LEARNING: '📚',
  ASSETS: '🎨',
  OTHER: '📦',
};

const DURATION_EMOJI: Record<TicketDuration, string> = {
  SHORT: '⚡',
  MEDIUM: '⏱️',
  LONG: '🏔️',
};

const BRAINING_EMOJI: Record<TicketBraining, string> = {
  NONE: '🐒',
  MEDIUM: '🧠',
  HARD: '🤯',
};

const STATUS_EMOJI: Record<TicketStatus, string> = {
  DONE: '✓',
  RUNNING: '🟢',
  'LONG TERM': '🟡',
  TODO: '🔵',
};

const stripSheetDecorations = (value: string): string =>
  value
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[✓✔✅]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const moduleLabel = (module: string) => {
  const emoji = MODULE_EMOJI[module] ?? '▫️';
  return `${emoji} ${module}`;
};

export const durationLabel = (duration: TicketDuration) =>
  `${DURATION_EMOJI[duration]} ${duration}`;

export const brainingLabel = (braining: TicketBraining) =>
  `${BRAINING_EMOJI[braining]} ${braining}`;

export const statusLabel = (status: TicketStatus) =>
  `${STATUS_EMOJI[status]} ${status}`;

export const brainingSheetValue = (braining: TicketBraining) => braining;

export const normalizeHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

export const parseStatus = (raw: string): TicketStatus => {
  const s = normalizeHeader(stripSheetDecorations(raw));
  if (s.includes('DONE') || s.includes('TERMINE') || s.startsWith('3')) return 'DONE';
  if (s.includes('RUNNING') || s.includes('EN COURS') || s.startsWith('2')) return 'RUNNING';
  if (s.includes('LONG') && (s.includes('TERM') || s.startsWith('0'))) return 'LONG TERM';
  if (s.includes('TODO') || s.includes('A FAIRE') || s.startsWith('1')) return 'TODO';
  return 'TODO';
};

export const statusToSheet = (status: TicketStatus): string => {
  switch (status) {
    case 'LONG TERM':
      return 'LONG TERM';
    case 'TODO':
      return 'TODO';
    case 'RUNNING':
      return 'RUNNING';
    case 'DONE':
      return 'DONE';
    default:
      return 'TODO';
  }
};

export const parseDuration = (raw: string): TicketDuration => {
  const d = normalizeHeader(raw);
  if (d.includes('LONG')) return 'LONG';
  if (d.includes('SHORT')) return 'SHORT';
  if (d.includes('MEDIUM')) return 'MEDIUM';
  return 'SHORT';
};

export const parseBraining = (raw: string): TicketBraining => {
  const b = normalizeHeader(stripSheetDecorations(raw));
  if (b.includes('HARD')) return 'HARD';
  if (b.includes('MEDIUM')) return 'MEDIUM';
  return 'NONE';
};

export const normalizeModule = (raw: string): string => {
  const m = normalizeHeader(raw);
  const aliases: Record<string, string> = {
    'CONCEPT.': 'CONCEPT',
    CONCEPTUALISATION: 'CONCEPT',
    'MUSIC /SFX': 'MUSIC & SFX',
    'MUSIC&SFX': 'MUSIC & SFX',
    'MUSIC AND SFX': 'MUSIC & SFX',
  };
  const mapped = aliases[m] ?? raw.trim().toUpperCase();
  if ((TICKET_MODULES as readonly string[]).includes(mapped)) return mapped;
  if ((TICKET_MODULES as readonly string[]).includes(m)) return m;
  return mapped || 'OTHER';
};

export const nextTicketId = (tickets: { id: string }[]): string => {
  const max = tickets.reduce((acc, t) => {
    const n = Number.parseInt(t.id, 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return String(max + 1);
};
