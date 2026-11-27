import { isNoteImageFileId, noteImageMarker, parseNoteCell } from './notesFormat';

const NOTE_IMAGE_LABEL = '(image)';

/** Image présente dans un collage (fichier, pas une URL). */
export const clipboardImage = (data: DataTransfer | null): File | null => {
  if (!data) return null;
  if (data.items) {
    for (const item of data.items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  if (data.files) {
    for (const file of data.files) {
      if (file.type.startsWith('image/')) return file;
    }
  }
  return null;
};

export const captureEditorRange = (root: HTMLElement): Range | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  return range.cloneRange();
};

const placeCaretAfter = (node: Node) => {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const insertNodeAt = (root: HTMLElement, node: Node, range: Range | null) => {
  if (range && root.contains(range.startContainer)) {
    range.deleteContents();
    range.insertNode(node);
    placeCaretAfter(node);
    return;
  }
  root.appendChild(node);
  placeCaretAfter(node);
};

export const insertPlainText = (root: HTMLElement, text: string) => {
  insertNodeAt(root, document.createTextNode(text), captureEditorRange(root));
};

export const insertNoteChip = (root: HTMLElement, fileId: string, range: Range | null) => {
  if (!isNoteImageFileId(fileId)) return;
  insertNodeAt(root, createChip(fileId), range);
};

const createChip = (fileId: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'notes-img-link';
  button.dataset.noteImageId = fileId;
  button.contentEditable = 'false';
  button.textContent = NOTE_IMAGE_LABEL;
  button.title = 'Afficher l’image';
  return button;
};

const appendText = (root: HTMLElement, text: string) => {
  if (!text) return;
  root.appendChild(document.createTextNode(text));
};

/** Affiche le texte, les liens, et chaque {{img:id}} comme un lien « (image) ». */
export const fillNoteEditor = (root: HTMLElement, source: string) => {
  root.replaceChildren();
  for (const token of parseNoteCell(source)) {
    if (token.type === 'text') {
      appendText(root, token.text);
      continue;
    }
    if (token.type === 'driveImage') {
      root.appendChild(createChip(token.fileId));
      continue;
    }
    if (token.type === 'link') {
      const link = document.createElement('a');
      link.href = token.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = token.text;
      root.appendChild(link);
      continue;
    }
    const image = document.createElement('img');
    image.src = token.src;
    image.alt = token.alt;
    image.className = 'notes-inline-img';
    root.appendChild(image);
  }
  root.classList.toggle('is-empty', source.trim() === '');
};

const readElement = (node: HTMLElement, into: { text: string }) => {
  const imageId = node.dataset.noteImageId;
  if (imageId && isNoteImageFileId(imageId)) {
    into.text += noteImageMarker(imageId);
    return;
  }
  if (node.tagName === 'BR') {
    into.text += '\n';
    return;
  }
  if (node.tagName === 'IMG') {
    const alt = (node.getAttribute('alt') ?? '').replace(/[[\]]/g, '');
    const src = node.getAttribute('src') ?? '';
    if (src) into.text += `![${alt}](${src})`;
    return;
  }
  if (node.tagName === 'A') {
    const text = node.textContent ?? '';
    const href = node.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(text)) into.text += text;
    else if (href) into.text += `[${text}](${href})`;
    else into.text += text;
    return;
  }
  const block = node.tagName === 'DIV' || node.tagName === 'P';
  if (block && into.text.length > 0 && !into.text.endsWith('\n')) into.text += '\n';
  for (const child of node.childNodes) readNode(child, into);
};

const readNode = (node: Node, into: { text: string }) => {
  if (node.nodeType === Node.TEXT_NODE) {
    into.text += node.textContent ?? '';
    return;
  }
  if (node instanceof HTMLElement) readElement(node, into);
};

/** Relit le DOM éditable vers le format de cellule. */
export const readNoteEditor = (root: HTMLElement): string => {
  const into = { text: '' };
  for (const child of root.childNodes) readNode(child, into);
  return into.text;
};
