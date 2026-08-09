import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

/**
 * Small junction on a couple's marriage line where child connectors start.
 * Sits under the wedding-ring marker; coloured to match that couple's DNA strand.
 */
function JunctionNodeComponent({ data }: NodeProps) {
  const horizontal = data?.orientation === 'horizontal';
  const dnaColor = typeof data?.dnaColor === 'string' ? data.dnaColor : '#059669';
  return (
    <div className="relative flex h-2.5 w-2.5 items-center justify-center">
      <div
        className="h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm dark:border-stone-900"
        style={{ backgroundColor: dnaColor }}
      />
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
