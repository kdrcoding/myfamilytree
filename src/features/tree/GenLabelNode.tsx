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
      <span className="rounded-lg border border-teal-400/30 bg-[var(--tree-card-bg)] px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-wider text-teal-100/90 shadow-sm backdrop-blur-md dark:border-teal-400/25 dark:text-teal-200/90">
        {t('tree.generationN', { n: generation })}
      </span>
    </div>
  );
}

export const GenLabelNode = memo(GenLabelNodeComponent);
