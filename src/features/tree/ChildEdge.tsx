import { memo } from 'react';
import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/**
 * Orthogonal parent -> child ("birth") connector with a per-couple bus lane.
 *
 * Every child of one couple shares the same trunk (a clean sibling bus), but
 * each couple's trunk sits at its own offset in the gap between generations
 * (`data.busOffset`, set in layout.ts). A long cross-family link crosses the
 * other buses transversally instead of running on top of them.
 *
 * Works in both orientations: vertical (top-down) draws a horizontal bus,
 * horizontal (left-to-right) draws a vertical bus.
 */
function ChildEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}: EdgeProps) {
  const busOffset = typeof data?.busOffset === 'number' ? data.busOffset : 40;
  const horizontal = data?.orientation === 'horizontal';

  let path: string;
  if (horizontal) {
    // Vertical bus: run out from the source, along a shared trunk just left of
    // the children, then into each child from the left.
    const busX = targetX - busOffset;
    const dy = Math.abs(targetY - sourceY);
    const r = Math.max(0, Math.min(10, dy / 2, (busX - sourceX) / 2, targetX - busX));
    if (dy < 1) {
      path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const dir = targetY > sourceY ? 1 : -1;
      path =
        `M ${sourceX} ${sourceY}` +
        `H ${busX - r}` +
        `Q ${busX} ${sourceY} ${busX} ${sourceY + dir * r}` +
        `V ${targetY - dir * r}` +
        `Q ${busX} ${targetY} ${busX + r} ${targetY}` +
        `H ${targetX}`;
    }
  } else {
    // Horizontal bus (default top-down).
    const busY = targetY - busOffset;
    const dx = Math.abs(targetX - sourceX);
    const r = Math.max(0, Math.min(10, dx / 2, (busY - sourceY) / 2, targetY - busY));
    if (dx < 1) {
      path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const dir = targetX > sourceX ? 1 : -1;
      path =
        `M ${sourceX} ${sourceY}` +
        `V ${busY - r}` +
        `Q ${sourceX} ${busY} ${sourceX + dir * r} ${busY}` +
        `H ${targetX - dir * r}` +
        `Q ${targetX} ${busY} ${targetX} ${busY + r}` +
        `V ${targetY}`;
    }
  }

  return <BaseEdge path={path} markerEnd={markerEnd} />;
}

export const ChildEdge = memo(ChildEdgeComponent);
