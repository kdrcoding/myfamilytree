import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

/** Small dot on a couple's marriage line where child connectors start. */
function JunctionNodeComponent() {
  return (
    <div className="h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow dark:border-stone-900">
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        className="!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent"
      />
    </div>
  );
}

export const JunctionNode = memo(JunctionNodeComponent);
