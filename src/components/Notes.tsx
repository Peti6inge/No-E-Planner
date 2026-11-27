import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { NOTES_CELL_MAX, NOTES_PAGE_MARGIN_LINES, type NoteTab } from '../lib/notesFormat';
import {
  captureEditorRange,
  clipboardImage,
  fillNoteEditor,
  insertNoteChip,
  insertPlainText,
  readNoteEditor,
} from '../lib/noteEditorDom';
import { fetchNoteImage, uploadNoteImage } from '../services/googleSheets';

interface NotesProps {
  tabs: NoteTab[];
  canEdit: boolean;
  onSave: (tabs: NoteTab[]) => Promise<void>;
  onActionUnavailable: () => void;
}

const marginStyle = {
  ['--notes-margin-lines' as string]: String(NOTES_PAGE_MARGIN_LINES),
};

function NoteLightbox({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void fetchNoteImage(fileId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Image impossible à charger.');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="notes-lightbox" role="dialog" aria-modal="true" aria-label="Image" onClick={onClose}>
      <button type="button" className="notes-lightbox-close" onClick={onClose}>
        Fermer
      </button>
      {error && <p className="notes-lightbox-status">{error}</p>}
      {!error && !url && <p className="notes-lightbox-status">Chargement…</p>}
      {url && (
        <img
          src={url}
          alt=""
          onClick={(event) => event.stopPropagation()}
        />
      )}
    </div>
  );
}

function NotePage({
  pageIndex,
  value,
  canEdit,
  busy,
  onCommit,
  onDelete,
  onOpenImage,
  onActionUnavailable,
}: {
  pageIndex: number;
  value: string;
  canEdit: boolean;
  busy: boolean;
  onCommit: (text: string) => void;
  onDelete: () => void;
  onOpenImage: (fileId: string) => void;
  onActionUnavailable: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const renderedSource = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || document.activeElement === el) return;
    if (renderedSource.current === value) return;
    fillNoteEditor(el, value);
    renderedSource.current = value;
  }, [value]);

  const commit = () => {
    const el = rootRef.current;
    if (!el || !canEdit) return;
    const source = readNoteEditor(el);
    if (source.length > NOTES_CELL_MAX) {
      setNotice(`Cette page dépasse ${NOTES_CELL_MAX} caractères (limite d’une cellule).`);
      return;
    }
    setNotice(null);
    fillNoteEditor(el, source);
    renderedSource.current = source;
    if (source !== value) onCommit(source);
  };

  const pasteImage = async (file: File, range: Range | null) => {
    setUploading(true);
    setNotice('Envoi de l’image…');
    try {
      const fileId = await uploadNoteImage(file);
      const el = rootRef.current;
      if (!el) return;
      insertNoteChip(el, fileId, range);
      const source = readNoteEditor(el);
      if (source.length > NOTES_CELL_MAX) {
        setNotice(`Cette page dépasse ${NOTES_CELL_MAX} caractères (limite d’une cellule).`);
        return;
      }
      renderedSource.current = source;
      setNotice(null);
      onCommit(source);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Envoi de l’image impossible.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <article className="notes-page" style={marginStyle}>
      <div className="notes-page-bar">
        <span className="notes-page-label">Page {pageIndex + 1}</span>
        {canEdit && (
          <button
            type="button"
            className="notes-text-btn notes-text-btn-danger"
            disabled={busy || uploading}
            onClick={onDelete}
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        )}
      </div>

      <div
        ref={rootRef}
        className="notes-editor"
        role="textbox"
        aria-multiline="true"
        aria-label={`Texte de la page ${pageIndex + 1}`}
        contentEditable={canEdit ? 'true' : 'false'}
        spellCheck
        suppressContentEditableWarning
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const chip = target.closest<HTMLElement>('[data-note-image-id]');
          const fileId = chip?.dataset.noteImageId;
          if (!fileId) return;
          event.preventDefault();
          onOpenImage(fileId);
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          commit();
        }}
        onPaste={(event) => {
          if (!canEdit) {
            event.preventDefault();
            onActionUnavailable();
            return;
          }
          const image = clipboardImage(event.clipboardData);
          if (image) {
            event.preventDefault();
            const range = captureEditorRange(event.currentTarget);
            void pasteImage(image, range);
            return;
          }
          const text = event.clipboardData.getData('text/plain');
          event.preventDefault();
          if (text) insertPlainText(event.currentTarget, text);
          event.currentTarget.classList.toggle(
            'is-empty',
            readNoteEditor(event.currentTarget).trim() === '',
          );
        }}
        onInput={(event) => {
          event.currentTarget.classList.toggle(
            'is-empty',
            readNoteEditor(event.currentTarget).trim() === '',
          );
        }}
      />

      {notice && <p className={uploading ? 'notes-form-status' : 'notes-form-error'}>{notice}</p>}
      <div className="notes-margin" data-notes-margin={NOTES_PAGE_MARGIN_LINES} aria-hidden="true" />
    </article>
  );
}

export function Notes({ tabs, canEdit, onSave, onActionUnavailable }: NotesProps) {
  const [viewTabs, setViewTabs] = useState(tabs);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const tabsRef = useRef(tabs);
  const onSaveRef = useRef(onSave);
  const chainRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);
  const closeLightbox = useCallback(() => setLightboxId(null), []);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (pendingRef.current > 0) return;
    tabsRef.current = tabs;
    setViewTabs(tabs);
  }, [tabs, busy]);

  useEffect(() => {
    if (selected > 0 && selected >= viewTabs.length) {
      setSelected(Math.max(0, viewTabs.length - 1));
    }
  }, [selected, viewTabs.length]);

  const current = viewTabs[selected];

  useEffect(() => {
    setNameDraft(current?.name ?? '');
  }, [current?.name, selected]);

  const apply = (mutator: (current: NoteTab[]) => NoteTab[]): Promise<boolean> => {
    if (!canEdit) {
      onActionUnavailable();
      return Promise.resolve(false);
    }
    pendingRef.current += 1;
    setBusy(true);
    const run = chainRef.current.then(async () => {
      const next = mutator(tabsRef.current);
      tabsRef.current = next;
      setViewTabs(next);
      await onSaveRef.current(next);
    });
    const settled = run.then(
      () => true,
      () => false,
    );
    chainRef.current = settled.then(() => undefined);
    return settled.finally(() => {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (pendingRef.current === 0) setBusy(false);
    });
  };

  const addTab = () => {
    const name = 'Nouvel onglet';
    void apply((currentTabs) => [...currentTabs, { name, pages: [''] }]).then((saved) => {
      if (saved) setSelected(Math.max(0, tabsRef.current.length - 1));
    });
  };

  const renameTab = () => {
    const name = nameDraft.trim();
    if (!current || !name || name === current.name) {
      setNameDraft(current?.name ?? '');
      return;
    }
    const index = selected;
    void apply((curr) => curr.map((tab, i) => (i === index ? { ...tab, name } : tab)));
  };

  const deleteTab = () => {
    if (!current) return;
    const hasText = current.pages.some((page) => page.trim() !== '');
    if (hasText && !window.confirm(`Supprimer l’onglet « ${current.name} » ?`)) return;
    const index = selected;
    void apply((curr) => curr.filter((_, i) => i !== index));
  };

  return (
    <div className="notes-root">
      <aside className="notes-tabs" aria-label="Onglets de notes">
        {viewTabs.map((tab, index) => (
          <button
            key={`${tab.name}-${index}`}
            type="button"
            className={`notes-tab ${index === selected ? 'active' : ''}`}
            aria-current={index === selected ? 'page' : undefined}
            onClick={() => setSelected(index)}
          >
            {tab.name || 'Sans titre'}
          </button>
        ))}
        <button type="button" className="notes-add-tab" onClick={addTab} disabled={busy && canEdit}>
          <Plus size={14} />
          Onglet
        </button>
      </aside>

      <div className="notes-scroll">
        {viewTabs.length === 0 ? (
          <div className="notes-empty">
            <p>Aucun onglet. La feuille reste vide tant que vous n’en ajoutez pas — le Google Doc n’est pas importé.</p>
            <p>Ajoutez un onglet (No-E, BLENDER…). Chaque page s’agrandit avec le texte, plus {NOTES_PAGE_MARGIN_LINES} lignes.</p>
          </div>
        ) : current ? (
          <div className="notes-stack">
            <div className="notes-toolbar">
              <input
                className="notes-name"
                value={nameDraft}
                aria-label="Nom de l’onglet"
                disabled={!canEdit || busy}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={renameTab}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    (event.target as HTMLInputElement).blur();
                  }
                }}
              />
              {canEdit && (
                <button type="button" className="notes-text-btn notes-text-btn-danger" onClick={deleteTab} disabled={busy}>
                  <Trash2 size={14} />
                  Supprimer l’onglet
                </button>
              )}
            </div>

            {current.pages.length === 0 && (
              <p className="notes-empty-inline">Aucune page dans cet onglet.</p>
            )}

            {current.pages.map((page, pageIndex) => (
              <NotePage
                key={`${selected}-${pageIndex}-${current.pages.length}`}
                pageIndex={pageIndex}
                value={page}
                canEdit={canEdit}
                busy={busy}
                onActionUnavailable={onActionUnavailable}
                onOpenImage={setLightboxId}
                onCommit={(text) => {
                  const index = selected;
                  void apply((curr) =>
                    curr.map((tab, i) => {
                      if (i !== index) return tab;
                      const pages = tab.pages.slice();
                      pages[pageIndex] = text;
                      return { ...tab, pages };
                    }),
                  );
                }}
                onDelete={() => {
                  if (page.trim() && !window.confirm('Supprimer cette page ?')) return;
                  const index = selected;
                  void apply((curr) =>
                    curr.map((tab, i) =>
                      i === index
                        ? { ...tab, pages: tab.pages.filter((_, j) => j !== pageIndex) }
                        : tab,
                    ),
                  );
                }}
              />
            ))}

            {canEdit && (
              <button
                type="button"
                className="notes-add-page"
                disabled={busy}
                onClick={() => {
                  const index = selected;
                  void apply((curr) =>
                    curr.map((tab, i) => (i === index ? { ...tab, pages: [...tab.pages, ''] } : tab)),
                  );
                }}
              >
                <Plus size={14} />
                Nouvelle page
              </button>
            )}
          </div>
        ) : null}
      </div>

      {lightboxId && <NoteLightbox fileId={lightboxId} onClose={closeLightbox} />}
    </div>
  );
}
