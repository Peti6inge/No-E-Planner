/**
 * Notes — point d’entrée du format (feuille Google Sheets « NOTES »).
 *
 * Modèle (pas d’en-tête obligatoire) :
 *   - une ligne = un onglet de notes (No-E, BLENDER, …)
 *   - colonne A = nom de l’onglet
 *   - colonnes B, C, D… = pages de cet onglet, dans l’ordre
 *   - une page vide est stockée comme un seul saut de ligne (cellule non vide),
 *     pour ne pas la confondre avec une colonne absente quand les lignes
 *     n’ont pas le même nombre de pages
 *
 * Cellule = texte brut (valueInputOption RAW, ≤ 50 000 caractères) :
 *   sauts de ligne conservés
 *   https://…                         → lien
 *   [libellé](https://…)              → lien
 *   ![légende](https://…)             → image inline
 *   <img src="https://…" alt="…">     → image inline
 * Les images sont des URLs http(s). Pas de base64 ni de data:.
 */

export const NOTES_SHEET_TITLES = ['NOTES', 'Notes', 'notes'] as const;

/** Limite d’une cellule Google Sheets. */
export const NOTES_CELL_MAX = 50_000;

/** Marge sous le texte de chaque page, en lignes. */
export const NOTES_PAGE_MARGIN_LINES = 5;

/**
 * Marqueur de page volontairement vide.
 * Un saut de ligne seul : la cellule n’est pas vide, donc elle survit au
 * rectangle de la feuille, et l’UI l’affiche comme une page vide.
 */
export const NOTES_EMPTY_PAGE = '\n';

export type NoteTab = {
  name: string;
  pages: string[];
};

export type NoteToken =
  | { type: 'text'; text: string }
  | { type: 'link'; href: string; text: string }
  | { type: 'image'; src: string; alt: string };

const norm = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const cellString = (value: unknown): string => (value == null ? '' : String(value));

const isPageHeader = (value: string): boolean => /^PAGE\s*\d*$/.test(norm(value));

const isHeaderRow = (row: string[]): boolean => {
  const name = norm(row[0] ?? '');
  const page = norm(row[1] ?? '');
  const nameOk =
    name === 'ONGLET' || name === 'TAB' || name === 'NAME' || name === 'TITRE' || name === 'TITLE';
  if (!nameOk || !isPageHeader(page)) return false;
  return row.slice(2).every((cell) => cell.trim() === '' || isPageHeader(cell));
};

/** URL http(s) affichable. Rejette data:, javascript: et le base64 collé tel quel. */
export const safeHttpUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.length > 8_000) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
};

const readAttr = (tag: string, name: string): string | null => {
  const match = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  ).exec(tag);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
};

const readMarkdownLink = (
  source: string,
  bracketAt: number,
): { label: string; url: string; end: number } | null => {
  if (source[bracketAt] !== '[') return null;
  const labelEnd = source.indexOf(']', bracketAt + 1);
  if (labelEnd < 0 || source[labelEnd + 1] !== '(') return null;
  const urlEnd = source.indexOf(')', labelEnd + 2);
  if (urlEnd < 0) return null;
  const url = source.slice(labelEnd + 2, urlEnd).trim();
  if (!url || /\s/.test(url)) return null;
  return { label: source.slice(bracketAt + 1, labelEnd), url, end: urlEnd + 1 };
};

const readBareUrl = (source: string, start: number): string => {
  let end = start;
  while (end < source.length && !/\s/.test(source[end]) && source[end] !== '<') end += 1;
  return source.slice(start, end);
};

/** Retire la ponctuation finale collée à une URL nue (`voir https://a.co.`). */
const splitUrlTail = (raw: string): { href: string; tail: string } => {
  let href = raw;
  let tail = '';
  while (href.length > 0 && /[.,;:!?]/.test(href[href.length - 1])) {
    tail = href[href.length - 1] + tail;
    href = href.slice(0, -1);
  }
  let open = 0;
  let close = 0;
  for (const ch of href) {
    if (ch === '(') open += 1;
    else if (ch === ')') close += 1;
  }
  while (close > open && href.endsWith(')')) {
    tail = `)${tail}`;
    href = href.slice(0, -1);
    close -= 1;
  }
  return { href, tail };
};

const startsWithHttp = (source: string, index: number): boolean => {
  const head = source.slice(index, index + 8).toLowerCase();
  return head.startsWith('https://') || head.startsWith('http://');
};

/** Découpe une cellule en texte, liens et images. Le texte brut est conservé si l’URL est refusée. */
export const parseNoteCell = (source: string): NoteToken[] => {
  const tokens: NoteToken[] = [];
  let textStart = 0;
  let i = 0;

  const pushText = (end: number) => {
    if (end > textStart) tokens.push({ type: 'text', text: source.slice(textStart, end) });
  };

  while (i < source.length) {
    if (source.slice(i, i + 4).toLowerCase() === '<img') {
      const close = source.indexOf('>', i);
      if (close >= 0) {
        const tag = source.slice(i, close + 1);
        const src = readAttr(tag, 'src');
        const safe = src ? safeHttpUrl(src) : null;
        if (safe) {
          pushText(i);
          tokens.push({ type: 'image', src: safe, alt: readAttr(tag, 'alt') ?? '' });
          i = close + 1;
          textStart = i;
          continue;
        }
      }
    }

    if (source[i] === '!' && source[i + 1] === '[') {
      const parsed = readMarkdownLink(source, i + 1);
      if (parsed) {
        const safe = safeHttpUrl(parsed.url);
        if (safe) {
          pushText(i);
          tokens.push({ type: 'image', src: safe, alt: parsed.label });
          i = parsed.end;
          textStart = i;
          continue;
        }
      }
    }

    if (source[i] === '[') {
      const parsed = readMarkdownLink(source, i);
      if (parsed) {
        const safe = safeHttpUrl(parsed.url);
        if (safe) {
          pushText(i);
          tokens.push({ type: 'link', href: safe, text: parsed.label || safe });
          i = parsed.end;
          textStart = i;
          continue;
        }
      }
    }

    if (startsWithHttp(source, i)) {
      const raw = readBareUrl(source, i);
      const { href, tail } = splitUrlTail(raw);
      const safe = safeHttpUrl(href);
      if (safe) {
        pushText(i);
        tokens.push({ type: 'link', href: safe, text: href });
        i += raw.length - tail.length;
        textStart = i;
        continue;
      }
    }

    i += 1;
  }

  pushText(source.length);
  return tokens;
};

export const notesGridToTabs = (values: unknown[][] | undefined): NoteTab[] => {
  if (!values || values.length === 0) return [];

  const rows = values.map((row) => (row ?? []).map(cellString));
  const start = rows.length > 0 && isHeaderRow(rows[0]) ? 1 : 0;
  const tabs: NoteTab[] = [];

  for (const row of rows.slice(start)) {
    let pages = row.slice(1);
    while (pages.length > 0 && pages[pages.length - 1] === '') pages.pop();
    pages = pages.map((page) => (page === NOTES_EMPTY_PAGE ? '' : page));
    const name = (row[0] ?? '').trim();
    if (!name && pages.every((page) => page.trim() === '')) continue;
    tabs.push({ name: name || 'Sans titre', pages });
  }

  return tabs;
};

export const tabsToNotesGrid = (tabs: NoteTab[]): string[][] => {
  if (tabs.length === 0) return [];
  const width = Math.max(
    1,
    ...tabs.map((tab) => 1 + tab.pages.length),
  );
  return tabs.map((tab) => {
    const row = [
      tab.name,
      ...tab.pages.map((page) => (page === '' ? NOTES_EMPTY_PAGE : page)),
    ];
    while (row.length < width) row.push('');
    return row;
  });
};

export const assertNotesCellLimits = (tabs: NoteTab[]): void => {
  for (const tab of tabs) {
    if (tab.name.length > NOTES_CELL_MAX) {
      throw new Error(`Le nom « ${tab.name.slice(0, 40)} » dépasse ${NOTES_CELL_MAX} caractères.`);
    }
    tab.pages.forEach((page, index) => {
      if (page.length > NOTES_CELL_MAX) {
        throw new Error(
          `La page ${index + 1} de « ${tab.name || 'Sans titre'} » dépasse ${NOTES_CELL_MAX} caractères (limite d’une cellule Sheets).`,
        );
      }
    });
  }
};
