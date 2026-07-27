import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

/**
 * Small dot on a couple's marriage line where child connectors start.
 * Coloured to match that couple's DNA strand on the tree.
 */
function JunctionNodeComponent({ data }: NodeProps) {
  const horizontal = data?.orientation === 'horizontal';
  const dnaColor = typeof data?.dnaColor === 'string' ? data.dnaColor : '#059669';
  return (
    <div
      className="h-3 w-3 rounded-full border-2 border-white shadow dark:border-stone-900"
      style={{ backgroundColor: dnaColor }}
    >
      <Handle
        type="source"
        position={horizontal ? Position.Right : Position.Bottom}
        id="out"
        className="!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent"
      />
    </div>
  );
}

export const JunctionNode = memo(JunctionNodeComponent);
