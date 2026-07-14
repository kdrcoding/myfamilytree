import { memo } from 'react';
import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/**
 * Orthogonal parent -> child ("birth") connector with a per-couple bus lane.
 *
 * Every child of one couple shares the same horizontal trunk (a clean sibling
 * bus), but each couple's trunk sits at its own height inside the gap between
 * generations (`data.busOffset`, set in layout.ts). That way a long cross-
 * family link — e.g. someone who married in but descends from another founder
 * couple across the tree — crosses the other buses transversally instead of
 * running directly on top of them.
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
  const busY = targetY - busOffset;
  const dx = Math.abs(targetX - sourceX);
  // Keep the rounded corners from overshooting on short or near-vertical runs.
  const r = Math.max(0, Math.min(10, dx / 2, (busY - sourceY) / 2, targetY - busY));

  let path: string;
  if (dx < 1) {
    // Child sits directly below the junction: a single straight drop.
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

  return <BaseEdge path={path} markerEnd={markerEnd} />;
}

export const ChildEdge = memo(ChildEdgeComponent);
