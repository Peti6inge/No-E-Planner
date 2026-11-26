import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BS_BORDER,
  BS_PAD,
  BS_PALETTE,
  BS_RADIUS,
  BS_ROOT_H,
  BS_ROOT_W,
  bsBuildTree,
  bsHeaderForHeight,
  bsLayoutNode,
  displayBrainstormTitle,
  encodeBrainstormTitle,
  type BrainstormNode,
  type BrainstormTreeNode,
} from '../lib/brainstormTreemap';

type BrainstormProps = {
  nodes: BrainstormNode[];
  canEdit: boolean;
  onSave: (nodes: BrainstormNode[]) => Promise<void>;
  onActionUnavailable: () => void;
};

type DialogMode = 'add' | 'edit' | null;

export function Brainstorm({ nodes, canEdit, onSave, onActionUnavailable }: BrainstormProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const fulltextRef = useRef<HTMLDivElement>(null);

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const panningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const fittedRef = useRef(false);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [dlgName, setDlgName] = useState('');
  const [dlgParent, setDlgParent] = useState('');
  const [busy, setBusy] = useState(false);

  const applyTransform = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.style.transform = `translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`;
  }, []);

  const fitToView = useCallback(() => {
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp?.width || !vp.height) return;
    const zx = vp.width / BS_ROOT_W;
    const zy = vp.height / BS_ROOT_H;
    zoomRef.current = Math.min(zx, zy) * 0.95;
    panRef.current = {
      x: (vp.width - BS_ROOT_W * zoomRef.current) / 2,
      y: (vp.height - BS_ROOT_H * zoomRef.current) / 2,
    };
    applyTransform();
  }, [applyTransform]);

  const showFulltext = useCallback((e: MouseEvent, text: string) => {
    const el = fulltextRef.current;
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    let x = e.clientX + 14;
    let y = e.clientY + 14;
    if (x + 370 > window.innerWidth) x = e.clientX - 374;
    if (y + 100 > window.innerHeight) y = e.clientY - 110;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  const moveFulltext = useCallback((e: MouseEvent) => {
    const el = fulltextRef.current;
    if (!el || el.style.display === 'none') return;
    let x = e.clientX + 14;
    let y = e.clientY + 14;
    if (x + 370 > window.innerWidth) x = e.clientX - 374;
    if (y + 100 > window.innerHeight) y = e.clientY - 110;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  const hideFulltext = useCallback(() => {
    const el = fulltextRef.current;
    if (el) el.style.display = 'none';
  }, []);

  const openAdd = useCallback(
    (parentTitle: string) => {
      if (!canEdit) {
        onActionUnavailable();
        return;
      }
      setDialogMode('add');
      setEditingTitle(null);
      setDlgName('');
      setDlgParent(parentTitle === 'Brainstorm' ? '' : parentTitle);
    },
    [canEdit, onActionUnavailable],
  );

  const openEdit = useCallback(
    (title: string) => {
      if (!canEdit) {
        onActionUnavailable();
        return;
      }
      const node = nodes.find((n) => n.title === title);
      if (!node) return;
      setDialogMode('edit');
      setEditingTitle(title);
      setDlgName(title.replace(/\[BR\]/g, '\n'));
      setDlgParent(node.parent);
    },
    [canEdit, nodes, onActionUnavailable],
  );

  const closeDialog = useCallback(() => {
    setDialogMode(null);
    setEditingTitle(null);
  }, []);

  const renderNode = useCallback(
    function renderTreeNode(node: BrainstormTreeNode): HTMLDivElement | null {
      if (!node._w || !node._h || node._w < 2 || node._h < 2) return null;

      const isLeaf = !node.children.length;
      const depth = node._depth || 0;
      const pal = BS_PALETTE[depth % BS_PALETTE.length];
      const hdr = node._bsHdr != null ? node._bsHdr : bsHeaderForHeight(node._h);
      const showChildren = !isLeaf && node._h > hdr + BS_PAD + 4;
      const displayTitle = displayBrainstormTitle(node.title);
      const isVirtualRoot = node.title === 'Brainstorm' && node.id === 0;

      const div = document.createElement('div');
      div.className = 'tm-node';
      div.style.cssText =
        `width:${node._w}px;height:${node._h}px;border-width:${BS_BORDER}px;` +
        `border-radius:${BS_RADIUS}px;border-color:${pal.border};background:${pal.bg}`;
      div.dataset.bsTitle = node.title;

      const bar = document.createElement('div');
      bar.className = showChildren ? 'tm-header' : 'tm-label';
      bar.style.color = pal.text;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tm-title';
      titleSpan.textContent = displayTitle;
      bar.appendChild(titleSpan);

      if (!isVirtualRoot) {
        const overlay = document.createElement('div');
        overlay.className = 'tm-bar-overlay';

        const btnEdit = document.createElement('span');
        btnEdit.className = 'tm-btn';
        btnEdit.title = 'Modifier';
        btnEdit.innerHTML = '&#9998;';
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          openEdit(node.title);
        });

        const btnAdd = document.createElement('span');
        btnAdd.className = 'tm-btn';
        btnAdd.title = 'Ajouter un enfant';
        btnAdd.innerHTML = '&#43;';
        btnAdd.addEventListener('click', (e) => {
          e.stopPropagation();
          openAdd(node.title);
        });

        overlay.appendChild(btnEdit);
        overlay.appendChild(btnAdd);
        bar.appendChild(overlay);
      } else {
        const overlay = document.createElement('div');
        overlay.className = 'tm-bar-overlay';
        const btnAdd = document.createElement('span');
        btnAdd.className = 'tm-btn';
        btnAdd.title = 'Ajouter une racine';
        btnAdd.innerHTML = '&#43;';
        btnAdd.addEventListener('click', (e) => {
          e.stopPropagation();
          openAdd('');
        });
        overlay.appendChild(btnAdd);
        bar.appendChild(overlay);
      }

      if (showChildren) {
        bar.style.height = `${hdr}px`;
        bar.style.whiteSpace = 'nowrap';
        bar.style.overflow = 'hidden';
        bar.style.textOverflow = 'ellipsis';
        bar.style.lineHeight = '1';

        let fontSize = Math.max(13, hdr * 0.7);
        fontSize = Math.min(fontSize, Math.max(8, hdr - 4));
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxW = node._w - 20;
        if (ctx) {
          while (fontSize > 8) {
            ctx.font = `${fontSize}px sans-serif`;
            if (ctx.measureText(displayTitle).width <= maxW) break;
            fontSize -= 1;
          }
        }
        bar.style.fontSize = `${fontSize}px`;
      } else {
        bar.style.fontSize = '30px';
        bar.style.whiteSpace = 'normal';
        bar.style.wordBreak = 'break-word';
        bar.style.lineHeight = '1.3';
      }

      div.addEventListener('mouseenter', (e) => showFulltext(e, displayTitle));
      div.addEventListener('mousemove', moveFulltext);
      div.addEventListener('mouseleave', hideFulltext);

      div.appendChild(bar);

      if (showChildren) {
        const innerW = node._w - BS_PAD * 2;
        const innerH = node._h - hdr - BS_PAD;
        if (innerW > 4 && innerH > 4) {
          const cc = document.createElement('div');
          cc.className = 'tm-children';
          cc.style.left = `${BS_PAD}px`;
          cc.style.top = `${hdr}px`;
          cc.style.width = `${innerW}px`;
          cc.style.height = `${innerH}px`;
          node.children.forEach((child) => {
            if (child._rect) {
              const cd = renderTreeNode(child);
              if (cd) {
                cd.style.left = `${child._rect.x}px`;
                cd.style.top = `${child._rect.y}px`;
                cc.appendChild(cd);
              }
            }
          });
          div.appendChild(cc);
        }
      }

      return div;
    },
    [hideFulltext, moveFulltext, openAdd, openEdit, showFulltext],
  );

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.innerHTML = '';
    const tree = bsBuildTree(nodes);
    if (!tree) return;
    bsLayoutNode(tree, BS_ROOT_W, BS_ROOT_H, 0);
    const rootDiv = renderNode(tree);
    if (rootDiv) {
      rootDiv.style.left = '0px';
      rootDiv.style.top = '0px';
      world.appendChild(rootDiv);
    }
    applyTransform();
    if (!fittedRef.current) {
      fittedRef.current = true;
      requestAnimationFrame(() => fitToView());
    }
  }, [nodes, renderNode, applyTransform, fitToView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const nz = Math.max(0.05, Math.min(5, zoomRef.current * factor));
      const rect = viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const s = nz / zoomRef.current;
      panRef.current = {
        x: mx - s * (mx - panRef.current.x),
        y: my - s * (my - panRef.current.y),
      };
      zoomRef.current = nz;
      applyTransform();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        panningRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!panningRef.current) return;
      panRef.current = {
        x: panRef.current.x + (e.clientX - lastPointerRef.current.x),
        y: panRef.current.y + (e.clientY - lastPointerRef.current.y),
      };
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      applyTransform();
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) panningRef.current = false;
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    viewport.addEventListener('contextmenu', onContextMenu);

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      viewport.removeEventListener('contextmenu', onContextMenu);
    };
  }, [applyTransform]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeDialog]);

  const handleSaveDialog = async () => {
    if (!canEdit) {
      onActionUnavailable();
      return;
    }
    const name = encodeBrainstormTitle(dlgName);
    if (!name) return;

    let next = [...nodes];
    if (dialogMode === 'edit' && editingTitle) {
      const node = next.find((n) => n.title === editingTitle);
      if (!node) return;
      if (editingTitle !== name) {
        if (next.some((n) => n.title === name && n.title !== editingTitle)) {
          window.alert('Un nœud avec ce titre existe déjà.');
          return;
        }
        next = next.map((n) =>
          n.parent === editingTitle ? { ...n, parent: name } : n,
        );
        next = next.map((n) =>
          n.title === editingTitle ? { ...n, title: name, parent: dlgParent } : n,
        );
      } else {
        next = next.map((n) =>
          n.title === editingTitle ? { ...n, parent: dlgParent } : n,
        );
      }
    } else {
      if (next.some((n) => n.title === name)) {
        window.alert('Un nœud avec ce titre existe déjà.');
        return;
      }
      const maxId = next.reduce((m, n) => Math.max(m, n.id), 0);
      next = [...next, { id: maxId + 1, title: name, parent: dlgParent }];
    }

    setBusy(true);
    try {
      await onSave(next);
      closeDialog();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit || !editingTitle) {
      onActionUnavailable();
      return;
    }
    const toDelete = new Set<string>();
    const collect = (t: string) => {
      toDelete.add(t);
      nodes.filter((n) => n.parent === t).forEach((n) => collect(n.title));
    };
    collect(editingTitle);
    const count = toDelete.size;
    if (
      !window.confirm(
        `Supprimer ce nœud${count > 1 ? ` et ses ${count - 1} enfant(s)` : ''} ?`,
      )
    ) {
      return;
    }
    const next = nodes.filter((n) => !toDelete.has(n.title));
    setBusy(true);
    try {
      await onSave(next);
      closeDialog();
    } finally {
      setBusy(false);
    }
  };

  const parentOptions = nodes
    .filter((n) => n.title !== editingTitle)
    .map((n) => ({
      value: n.title,
      label: displayBrainstormTitle(n.title).substring(0, 60),
    }));

  return (
    <div className="brainstorm-root">
      <div ref={viewportRef} className="bs-viewport" id="bs-viewport">
        <div ref={worldRef} className="bs-world" id="bs-world" />
      </div>

      <div className="bs-hint">
        Molette : zoom · Clic droit : déplacer · Survol : édition
      </div>

      <div ref={fulltextRef} id="bs-fulltext" className="bs-fulltext" />

      {dialogMode && (
        <div
          className="bs-dialog-overlay open"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div className="bs-dialog">
            <h3>{dialogMode === 'edit' ? 'Modifier le nœud' : 'Ajouter un nœud'}</h3>
            <label htmlFor="bsDlgName">Titre</label>
            <textarea
              id="bsDlgName"
              value={dlgName}
              onChange={(e) => setDlgName(e.target.value)}
              placeholder="Titre du nœud"
              rows={3}
              autoFocus
            />
            <label htmlFor="bsDlgParent">Parent</label>
            <select
              id="bsDlgParent"
              value={dlgParent}
              onChange={(e) => setDlgParent(e.target.value)}
            >
              <option value="">(racine)</option>
              {parentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="bs-dialog-actions">
              {dialogMode === 'edit' && (
                <button
                  type="button"
                  className="btn-delete"
                  onClick={() => void handleDelete()}
                  disabled={busy}
                >
                  Supprimer
                </button>
              )}
              <button type="button" className="btn-cancel" onClick={closeDialog} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={() => void handleSaveDialog()}
                disabled={busy}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
