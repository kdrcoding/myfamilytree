import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useT } from '../../i18n/useT';
import type { GenLabelData } from './layout';

/**
 * A subtle "Generation N" chip anchored before each generation row (vertical)
 * or column (horizontal). Purely informational — non-interactive and skipped
 * by keyboard focus.
 */
function GenLabelNodeComponent({ data }: NodeProps) {
  const t = useT();
  const generation = (data as GenLabelData).generation;
  return (
    <div className="pointer-events-none flex h-8 items-center">
      <span className="rounded-full border border-stone-300/70 bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 shadow-sm backdrop-blur dark:border-stone-600/70 dark:bg-stone-800/70 dark:text-stone-400">
        {t('tree.generationN', { n: generation })}
      </span>
    </div>
  );
}

export const GenLabelNode = memo(GenLabelNodeComponent);
