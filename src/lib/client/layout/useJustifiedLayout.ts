import { useMemo } from 'react';

export type JustifiedItem = {
  id: string;
  width: number;
  height: number;
  originalRatio: number;
};

export type JustifiedRow = {
  items: JustifiedItem[];
  rowHeight: number;
  totalWidth: number;
  isLast: boolean;
};

export function computeJustifiedRows(
  items: JustifiedItem[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number,
  maxRowHeight = targetRowHeight * 2,
): JustifiedRow[] {
  if (containerWidth <= 0 || items.length === 0) return [];

  const rows: JustifiedRow[] = [];
  let currentRow: JustifiedItem[] = [];
  let currentWidth = 0;

  const flushRow = (isLast: boolean) => {
    if (currentRow.length === 0) return;

    const gaps = Math.max(0, currentRow.length - 1) * gap;
    const rawWidth = currentWidth + gaps;

    let rowHeight = targetRowHeight;

    if (rawWidth > containerWidth && currentRow.length > 1) {
      // scale down to fit container width
      const scale = (containerWidth - gaps) / (rawWidth - gaps);
      rowHeight = Math.min(maxRowHeight, targetRowHeight * scale);
    }

    const totalWidth = currentRow.reduce((sum, item) => sum + item.originalRatio * rowHeight, 0) + gaps;

    rows.push({ items: currentRow, rowHeight, totalWidth, isLast });

    currentRow = [];
    currentWidth = 0;
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemWidth = item.originalRatio * targetRowHeight;

    const newGaps = Math.max(0, currentRow.length) * gap;
    const projectedWidth = currentWidth + itemWidth + newGaps;

    if (currentRow.length > 0 && projectedWidth > containerWidth) {
      flushRow(false);
    }

    currentRow.push(item);
    currentWidth += itemWidth;
  }

  flushRow(true);

  return rows;
}

export function useJustifiedLayout(
  items: JustifiedItem[],
  containerWidth: number | undefined,
  targetRowHeight: number,
  gap: number,
): JustifiedRow[] {
  return useMemo(
    () => (containerWidth ? computeJustifiedRows(items, containerWidth, targetRowHeight, gap) : []),
    [items, containerWidth, targetRowHeight, gap],
  );
}
