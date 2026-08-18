import { memo } from 'react';
import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/**
 * Orthogonal parent -> child connector. Colour comes from the couple's DNA
 * palette so siblings match. One quiet stroke — no animated dashed strands.
 */
function ChildEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
  style,
}: EdgeProps) {
  const busOffset = typeof data?.busOffset === 'number' ? data.busOffset : 48;
  const horizontal = data?.orientation === 'horizontal';
  const dnaTrunk = typeof data?.dnaTrunk === 'string' ? data.dnaTrunk : style?.stroke ?? '#059669';

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
      <path
        d={path}
        fill="none"
        stroke="var(--child-edge-halo)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none"
        aria-hidden
      />
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: dnaTrunk, strokeWidth: 2.25, opacity: 0.88 }}
      />
    </>
  );
}

export const ChildEdge = memo(ChildEdgeComponent);
