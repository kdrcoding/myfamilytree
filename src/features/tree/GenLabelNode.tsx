import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useT } from '../../i18n/useT';
import type { GenLabelData } from './layout';

/**
 * A "Generation N" chip anchored beside each generation row (vertical) or
 * column (horizontal). Purely informational — non-interactive and skipped by
 * keyboard focus. Vertical trees right-align it so it hugs the row's cards;
 * horizontal trees centre it above the column.
 */
function GenLabelNodeComponent({ data }: NodeProps) {
  const t = useT();
  const { generation, orientation } = data as GenLabelData;
  const align = orientation === 'horizontal' ? 'justify-center' : 'justify-end';
  return (
    <div className={`pointer-events-none flex h-8 w-full items-center ${align} pr-3`}>
      <span className="rounded-full border border-stone-300 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-stone-600 shadow-sm backdrop-blur dark:border-stone-600 dark:bg-stone-800/90 dark:text-stone-300">
        {t('tree.generationN', { n: generation })}
      </span>
    </div>
  );
}

export const GenLabelNode = memo(GenLabelNodeComponent);
