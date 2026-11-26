export type BrainstormNode = {
  id: number;
  title: string;
  parent: string;
  sheetRow?: number;
};

export type BrainstormTreeNode = BrainstormNode & {
  children: BrainstormTreeNode[];
  computedDuration: number;
  _w?: number;
  _h?: number;
  _depth?: number;
  _bsHdr?: number;
  _rect?: { x: number; y: number; w: number; h: number } | null;
  _area?: number;
};

export const BS_ROOT_W = 4000;
export const BS_ROOT_H = 2800;
export const BS_HEADER = 128;
export const BS_PAD = 8;
export const BS_GAP = 4;
export const BS_BORDER = 3;
export const BS_RADIUS = 8;

export const BS_PALETTE = [
  { bg: '#2d1b4e', border: '#8b5cf6', text: '#c4b5fd' },
  { bg: '#1a3a2a', border: '#22c55e', text: '#86efac' },
  { bg: '#3b2a00', border: '#f59e0b', text: '#fde68a' },
  { bg: '#3a1a1a', border: '#ef4444', text: '#fca5a5' },
] as const;

export const displayBrainstormTitle = (title: string) =>
  (title || '').replace(/\[BR\]/g, ' ');

export const encodeBrainstormTitle = (raw: string) =>
  raw.trim().replace(/\n/g, '[BR]');

/** Bande titre : rétrécit si la boîte est petite pour ne pas « manger » toute la hauteur. */
export function bsHeaderForHeight(h: number): number {
  const minChildren = 6;
  const minHdr = 10;
  const maxHdr = BS_HEADER;
  const maxForChildren = h - BS_PAD - minChildren;
  if (maxForChildren < minHdr) {
    return Math.max(6, Math.min(minHdr, Math.floor(h * 0.38)));
  }
  const prop = Math.floor(h * 0.2);
  const hdr = Math.min(maxHdr, Math.max(minHdr, prop));
  return Math.min(hdr, maxForChildren);
}

function worst(row: BrainstormTreeNode[], side: number): number {
  const s = row.reduce((a, r) => a + (r._area ?? 0), 0);
  if (s === 0) return Infinity;
  const s2 = s * s;
  const w2 = side * side;
  const mx = Math.max(...row.map((r) => r._area ?? 0));
  const mn = Math.min(...row.map((r) => r._area ?? 0));
  if (mn === 0) return Infinity;
  return Math.max((w2 * mx) / s2, s2 / (w2 * mn));
}

function layoutRow(
  row: BrainstormTreeNode[],
  rect: { x: number; y: number; w: number; h: number },
  isWide: boolean,
) {
  const totalArea = row.reduce((a, r) => a + (r._area ?? 0), 0);
  if (totalArea === 0) return rect;
  if (isWide) {
    const rowW = totalArea / rect.h;
    let y = rect.y;
    row.forEach((item) => {
      const h = (item._area ?? 0) / rowW;
      item._rect = { x: rect.x, y, w: rowW, h };
      y += h;
    });
    return { x: rect.x + rowW, y: rect.y, w: rect.w - rowW, h: rect.h };
  }
  const rowH = totalArea / rect.w;
  let x = rect.x;
  row.forEach((item) => {
    const w = (item._area ?? 0) / rowH;
    item._rect = { x, y: rect.y, w, h: rowH };
    x += w;
  });
  return { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH };
}

function squarifyImpl(
  items: BrainstormTreeNode[],
  startIdx: number,
  rect: { x: number; y: number; w: number; h: number },
) {
  if (startIdx >= items.length) return;
  if (rect.w <= 0 || rect.h <= 0) {
    for (let i = startIdx; i < items.length; i++) {
      items[i]._rect = { x: rect.x, y: rect.y, w: 0, h: 0 };
    }
    return;
  }
  if (items.length - startIdx === 1) {
    items[startIdx]._rect = { ...rect };
    return;
  }
  const isWide = rect.w >= rect.h;
  const side = isWide ? rect.h : rect.w;
  let row: BrainstormTreeNode[] = [];
  let bestWorst = Infinity;
  let bestEnd = startIdx;
  for (let i = startIdx; i < items.length; i++) {
    const newRow = [...row, items[i]];
    const w = worst(newRow, side);
    if (w <= bestWorst) {
      bestWorst = w;
      bestEnd = i + 1;
      row = newRow;
    } else break;
  }
  const remaining = layoutRow(row, rect, isWide);
  squarifyImpl(items, bestEnd, remaining);
}

export function treemapLayout(
  children: BrainstormTreeNode[],
  rect: { x: number; y: number; w: number; h: number },
  g: number,
) {
  if (!children.length) return;
  const area = rect.w * rect.h;
  const total = children.reduce((s, c) => s + c.computedDuration, 0);
  children.forEach((c) => {
    c._area = total > 0 ? (c.computedDuration / total) * area : area / children.length;
  });
  const sorted = [...children].sort((a, b) => (b._area ?? 0) - (a._area ?? 0));
  squarifyImpl(sorted, 0, rect);
  sorted.forEach((c) => {
    if (c._rect) {
      c._rect.x += g;
      c._rect.y += g;
      c._rect.w = Math.max(0, c._rect.w - g * 2);
      c._rect.h = Math.max(0, c._rect.h - g * 2);
    }
  });
}

export function bsBuildTree(nodes: BrainstormNode[]): BrainstormTreeNode | null {
  if (!nodes.length) return null;
  const map = new Map<string, BrainstormTreeNode>();
  nodes.forEach((n) =>
    map.set(n.title, {
      ...n,
      children: [],
      computedDuration: 1,
    }),
  );
  const roots: BrainstormTreeNode[] = [];
  map.forEach((node) => {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const weight = (n: BrainstormTreeNode): number => {
    if (!n.children.length) {
      n.computedDuration = 1;
      return 1;
    }
    n.computedDuration = n.children.reduce((s, c) => s + weight(c), 0);
    return n.computedDuration;
  };
  roots.forEach(weight);

  if (roots.length === 1) return roots[0];
  return {
    id: 0,
    title: 'Brainstorm',
    parent: '',
    children: roots,
    computedDuration: roots.reduce((s, r) => s + r.computedDuration, 0),
  };
}

export function bsLayoutNode(node: BrainstormTreeNode, w: number, h: number, depth: number) {
  node._w = w;
  node._h = h;
  node._depth = depth;
  if (!node.children.length) return;
  const hdr = bsHeaderForHeight(h);
  node._bsHdr = hdr;
  const innerW = w - BS_PAD * 2;
  const innerH = h - hdr - BS_PAD;
  if (innerW < 4 || innerH < 4) {
    node.children.forEach((c) => {
      c._rect = null;
    });
    return;
  }
  treemapLayout(
    node.children,
    { x: 0, y: 0, w: Math.max(0, innerW - BS_GAP), h: Math.max(0, innerH - BS_GAP) },
    BS_GAP,
  );
  node.children.forEach((c) => {
    if (c._rect) bsLayoutNode(c, c._rect.w, c._rect.h, depth + 1);
  });
}

export const nextBrainstormId = (nodes: BrainstormNode[]): number => {
  const max = nodes.reduce((m, n) => Math.max(m, n.id), 0);
  return max + 1;
};
