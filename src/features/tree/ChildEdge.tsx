import { memo } from 'react';
import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/**
 * Orthogonal parent -> child ("birth") connector with a per-couple bus lane.
 *
 * A soft solid trunk carries the arrow; two dashed overlays animate along the
 * path so inheritance reads as DNA flowing from parents down to each child.
 */
function ChildEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}: EdgeProps) {
  const busOffset = typeof data?.busOffset === 'number' ? data.busOffset : 48;
  const horizontal = data?.orientation === 'horizontal';

  let path: string;
  if (horizontal) {
    const busX = targetX - busOffset;
    const dy = Math.abs(targetY - sourceY);
    const r = Math.max(0, Math.min(12, dy / 2, (busX - sourceX) / 2, targetX - busX));
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
    const busY = targetY - busOffset;
    const dx = Math.abs(targetX - sourceX);
    const r = Math.max(0, Math.min(12, dx / 2, (busY - sourceY) / 2, targetY - busY));
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

  return (
    <>
      {/* Halo so crossing lines stay visible on the dotted canvas */}
      <path
        d={path}
        fill="none"
        stroke="var(--child-edge-halo, #ffffff)"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none dark:[stroke:var(--color-stone-950)]"
        aria-hidden
      />
      {/* Quiet solid trunk + arrowhead toward the child */}
      <BaseEdge path={path} markerEnd={markerEnd} style={{ strokeWidth: 2, opacity: 0.45 }} />
      {/* DNA strand A — dashes flow parent → child */}
      <path
        d={path}
        fill="none"
        className="edge-child-flow edge-child-flow--a"
        aria-hidden
      />
      {/* DNA strand B — phase-shifted twin for a double-helix feel */}
      <path
        d={path}
        fill="none"
        className="edge-child-flow edge-child-flow--b"
        aria-hidden
      />
    </>
  );
}

export const ChildEdge = memo(ChildEdgeComponent);
