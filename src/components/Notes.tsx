import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  NOTES_CELL_MAX,
  NOTES_PAGE_MARGIN_LINES,
  parseNoteCell,
  safeHttpUrl,
  type NoteTab,
  type NoteToken,
} from '../lib/notesFormat';

interface NotesProps {
  tabs: NoteTab[];
  canEdit: boolean;
  onSave: (tabs: NoteTab[]) => Promise<void>;
  onActionUnavailable: () => void;
}

const marginStyle = {
  ['--notes-margin-lines' as string]: String(NOTES_PAGE_MARGIN_LINES),
};

function NoteRichText({ source }: { source: string }) {
  const tokens = parseNoteCell(source);
  if (tokens.length === 0 || tokens.every((token) => token.type === 'text' && token.text.trim() === '')) {
    return <span className="notes-placeholder">Page vide</span>;
  }
  return (
    <>
      {tokens.map((token, index) => (
        <NoteTokenView key={index} token={token} />
      ))}
    </>
  );
}

function NoteTokenView({ token }: { token: NoteToken }) {
  if (token.type === 'image') {
    return <img src={token.src} alt={token.alt} className="notes-inline-img" />;
  }
  if (token.type === 'link') {
    return (
      <a href={token.href} target="_blank" rel="noopener noreferrer">
        {token.text}
      </a>
    );
  }
  return <span>{token.text}</span>;
}

function NotePage({
  pageIndex,
  value,
  canEdit,
  busy,
  onCommit,
  onDelete,
  onActionUnavailable,
}: {
  pageIndex: number;
  value: string;
  canEdit: boolean;
  busy: boolean;
  onCommit: (text: string) => void;
  onDelete: () => void;
  onActionUnavailable: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [imageUrl, setImageUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  useLayoutEffect(() => {
    if (!editing) return;
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  useLayoutEffect(() => {
    if (editing) areaRef.current?.focus();
  }, [editing]);

  const rememberSelection = () => {
    const el = areaRef.current;
    if (!el) return;
    selectionRef.current = {
      start: el.selectionStart ?? draft.length,
      end: el.selectionEnd ?? draft.length,
    };
  };

  const beginEdit = () => {
    if (!canEdit) {
      onActionUnavailable();
      return;
    }
    setFormError(null);
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    if (draft.length > NOTES_CELL_MAX) {
      setFormError(`Cette page dépasse ${NOTES_CELL_MAX} caractères (limite d’une cellule).`);
      return;
    }
    setEditing(false);
    setFormError(null);
    if (draft !== value) onCommit(draft);
  };

  const insertImage = () => {
    const safe = safeHttpUrl(imageUrl);
    if (!safe) {
      setFormError('Image : une URL http(s) seulement. Pas de fichier encodé en base64.');
      return;
    }
    const snippet = `![image](${safe})`;
    const { start, end } = selectionRef.current;
    const next = `${draft.slice(0, start)}${snippet}${draft.slice(end)}`;
    setDraft(next);
    setImageUrl('');
    setFormError(null);
    const caret = start + snippet.length;
    selectionRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      const el = areaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <article
      className="notes-page"
      style={marginStyle}
      onBlur={(event) => {
        if (!editing) return;
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        commit();
      }}
    >
      <div className="notes-page-bar">
        <span className="notes-page-label">Page {pageIndex + 1}</span>
        {editing && canEdit && (
          <form
            className="notes-image-form"
            onSubmit={(event) => {
              event.preventDefault();
              insertImage();
            }}
          >
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://…/image.png"
              aria-label="URL de l’image"
              disabled={busy}
            />
            <button type="submit" disabled={busy} onMouseDown={(event) => event.preventDefault()}>
              <ImagePlus size={14} />
              Insérer
            </button>
          </form>
        )}
        {canEdit && !editing && (
          <button type="button" className="notes-text-btn" onClick={beginEdit} disabled={busy}>
            <Pencil size={14} />
            Modifier
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            className="notes-text-btn notes-text-btn-danger"
            disabled={busy}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onDelete}
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          ref={areaRef}
          className="notes-editor"
          value={draft}
          spellCheck
          aria-label={`Texte de la page ${pageIndex + 1}`}
          onChange={(event) => {
            setDraft(event.target.value);
            rememberSelection();
          }}
          onSelect={rememberSelection}
          onKeyUp={rememberSelection}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(value);
              setEditing(false);
              setFormError(null);
            }
          }}
        />
      ) : (
        <div
          className="notes-rendered"
          onClick={(event) => {
            const target = event.target;
            if (target instanceof HTMLElement && target.closest('a, img, button')) return;
            beginEdit();
          }}
        >
          <NoteRichText source={value} />
        </div>
      )}

      {formError && <p className="notes-form-error">{formError}</p>}
      <div className="notes-margin" data-notes-margin={NOTES_PAGE_MARGIN_LINES} aria-hidden="true" />
    </article>
  );
}

export function Notes({ tabs, canEdit, onSave, onActionUnavailable }: NotesProps) {
  const [viewTabs, setViewTabs] = useState(tabs);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const tabsRef = useRef(tabs);
  const onSaveRef = useRef(onSave);
  const chainRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);

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
    void apply((current) => [...current, { name, pages: [''] }]).then((saved) => {
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

  const example =
    'Lien automatique : https://peti6inge.github.io/No-E-Planner/\nImage : ![favicon](https://peti6inge.github.io/No-E-Planner/favicon.svg)';

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
        <p className="notes-format-hint">
          Feuille NOTES : une ligne par onglet, une colonne par page. Images par URL, pas en base64.
        </p>
      </aside>

      <div className="notes-scroll">
        {viewTabs.length === 0 ? (
          <div className="notes-stack">
            <div className="notes-empty">
              <p>Aucun onglet. La feuille reste vide tant que vous n’en ajoutez pas — le Google Doc n’est pas importé.</p>
              <p>Ajoutez un onglet (No-E, BLENDER…). Chaque page s’agrandit avec le texte, plus {NOTES_PAGE_MARGIN_LINES} lignes.</p>
            </div>
            <article className="notes-page" style={marginStyle}>
              <div className="notes-page-bar">
                <span className="notes-page-label">Aperçu du format (non enregistré)</span>
              </div>
              <div className="notes-rendered notes-rendered-static">
                <NoteRichText source={example} />
              </div>
              <div className="notes-margin" data-notes-margin={NOTES_PAGE_MARGIN_LINES} aria-hidden="true" />
            </article>
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
    </div>
  );
}
