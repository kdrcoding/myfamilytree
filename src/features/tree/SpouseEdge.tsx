import { memo } from 'react';
import type { EdgeProps } from '@xyflow/react';
import { useT } from '../../i18n/useT';
import { useTreeInteraction } from './TreeInteractionContext';

/**
 * Marriage line with interlocking wedding rings. Tap the rings to see the
 * wedding date and next anniversary.
 */
function SpouseEdgeComponent({ sourceX, sourceY, targetX, targetY, source, target, data }: EdgeProps) {
  const { onOpenCouple } = useTreeInteraction();
  const t = useT();
  const divorced = Boolean(data?.divorced);
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const r = 5.5;
  const dx = 3.2;

  return (
    <g className={divorced ? 'spouse-edge spouse-edge--divorced' : 'spouse-edge'}>
      <path
        d={path}
        fill="none"
        strokeWidth={9}
        strokeLinecap="round"
        className="spouse-edge__halo pointer-events-none"
        aria-hidden
      />
      <path
        d={path}
        fill="none"
        strokeWidth={divorced ? 2 : 2.75}
        strokeLinecap="round"
        strokeDasharray={divorced ? '3 5' : undefined}
        className="spouse-edge__line pointer-events-none"
      />
      <circle cx={midX} cy={midY} r={11} className="spouse-edge__pad pointer-events-none" aria-hidden />
      <g transform={`translate(${midX} ${midY}) rotate(-18)`} className="pointer-events-none" aria-hidden>
        <circle cx={-dx} cy={0} r={r} fill="none" strokeWidth={2.35} className="spouse-edge__ring" />
        <circle cx={dx} cy={0} r={r} fill="none" strokeWidth={2.35} className="spouse-edge__ring" />
        {!divorced && (
          <>
            <circle cx={-dx - 1.6} cy={-2.4} r={1.05} className="spouse-edge__shine" />
            <circle cx={dx - 1.6} cy={-2.4} r={1.05} className="spouse-edge__shine" />
          </>
        )}
      </g>
      {/* Large invisible hit target — tap rings to open anniversary card */}
      <circle
        cx={midX}
        cy={midY}
        r={18}
        fill="transparent"
        className="spouse-edge__hit cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onOpenCouple?.(source, target);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onOpenCouple?.(source, target);
          }
        }}
      >
        <title>{t('couple.title')}</title>
      </circle>
    </g>
  );
}

export const SpouseEdge = memo(SpouseEdgeComponent);
