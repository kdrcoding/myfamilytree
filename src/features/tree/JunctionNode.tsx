import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

/**
 * Small dot on a couple's marriage line where child connectors start. The
 * outgoing handle points down (vertical tree) or right (horizontal tree) so
 * child edges leave toward the next generation.
 */
function JunctionNodeComponent({ data }: NodeProps) {
  const horizontal = data?.orientation === 'horizontal';
  return (
    <div className="h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow dark:border-stone-900">
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
