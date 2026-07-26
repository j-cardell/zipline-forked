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
  ratioSum: number;
};

export function computeJustifiedRows(
  items: JustifiedItem[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number,
): JustifiedRow[] {
  if (containerWidth <= 0 || items.length === 0) return [];

  const rows: JustifiedRow[] = [];
  let currentRow: JustifiedItem[] = [];
  let currentRatioSum = 0;

  const flushRow = () => {
    if (currentRow.length === 0) return;

    const gaps = Math.max(0, currentRow.length - 1) * gap;
    const availableWidth = Math.max(1, containerWidth - gaps);

    // Scale row to fill available width while keeping aspect ratios.
    // For a single item this naturally fills the whole width.
    let rowHeight = targetRowHeight;
    if (currentRatioSum * targetRowHeight > availableWidth) {
      rowHeight = availableWidth / currentRatioSum;
    }

    rows.push({ items: currentRow, rowHeight, ratioSum: currentRatioSum });

    currentRow = [];
    currentRatioSum = 0;
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const projectedGaps = Math.max(0, currentRow.length) * gap;

    if (
      currentRow.length > 0 &&
      (currentRatioSum + item.originalRatio) * targetRowHeight + projectedGaps > containerWidth
    ) {
      flushRow();
    }

    currentRow.push(item);
    currentRatioSum += item.originalRatio;
  }

  flushRow();

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
