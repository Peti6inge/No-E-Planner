import { useCallback, useLayoutEffect, useRef } from 'react';

const MAX_AUTO_ROWS = 6;

function measureAutoHeight(el: HTMLTextAreaElement, maxRows: number) {
  const style = getComputedStyle(el);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const padding =
    Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const border =
    Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  const rowHeight = Number.isFinite(lineHeight) ? lineHeight : 21;
  const slack = rowHeight * 0.5;

  el.style.height = 'auto';
  const needed = el.scrollHeight;
  const maxHeight = rowHeight * maxRows + padding + border + slack;
  const autoHeight = Math.min(needed + slack, maxHeight);

  return { needed, maxHeight, autoHeight, slack };
}

export function useAutoResizeTextarea(value: string, maxRows = MAX_AUTO_ROWS) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const userHeightRef = useRef<number | null>(null);

  const syncSize = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const { needed, maxHeight, autoHeight, slack } = measureAutoHeight(el, maxRows);
    const userHeight = userHeightRef.current;
    const targetHeight = userHeight != null ? Math.max(autoHeight, userHeight) : autoHeight;

    el.style.height = `${targetHeight}px`;
    const exceedsMaxRows = needed + slack > maxHeight;
    el.style.overflowY =
      exceedsMaxRows || el.scrollHeight > el.clientHeight + 2 ? 'auto' : 'hidden';
  }, [maxRows]);

  useLayoutEffect(() => {
    syncSize();
  }, [value, syncSize]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerUp = () => {
      const { autoHeight } = measureAutoHeight(el, maxRows);
      const h = el.offsetHeight;
      if (h > autoHeight + 2) {
        userHeightRef.current = h;
      } else {
        userHeightRef.current = null;
      }
      syncSize();
    };

    el.addEventListener('mouseup', onPointerUp);
    el.addEventListener('touchend', onPointerUp);
    return () => {
      el.removeEventListener('mouseup', onPointerUp);
      el.removeEventListener('touchend', onPointerUp);
    };
  }, [maxRows]);

  return { ref, onInput: syncSize };
}
