import { memo, useEffect, useState } from 'react';
import type { EdgeProps } from '@xyflow/react';
import { useT } from '../../i18n/useT';
import { useTreeInteraction } from './TreeInteractionContext';

/**
 * Marriage line with small interlocking rings. Soft gold — not a giant pink badge.
 * Hit area stays larger than the drawing so taps still work on phones.
 */
function SpouseEdgeComponent({ sourceX, sourceY, targetX, targetY, source, target, data }: EdgeProps) {
  const { onOpenCouple } = useTreeInteraction();
  const t = useT();
  const divorced = Boolean(data?.divorced);
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;

  const [touchy, setTouchy] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse), (hover: none)');
    const sync = () => setTouchy(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const r = touchy ? 5.25 : 4.75;
  const dx = touchy ? 3.1 : 2.85;
  const ringStroke = touchy ? 1.85 : 1.7;
  const padRx = touchy ? 12.5 : 11;
  const padRy = touchy ? 9 : 8;
  const hitR = touchy ? 20 : 16;

  const open = (event: { stopPropagation: () => void; preventDefault?: () => void }) => {
    event.stopPropagation();
    event.preventDefault?.();
    onOpenCouple?.(source, target);
  };

  return (
    <g className={divorced ? 'spouse-edge spouse-edge--divorced' : 'spouse-edge'}>
      <path
        d={path}
        fill="none"
        strokeWidth={touchy ? 8 : 7}
        strokeLinecap="round"
        className="spouse-edge__halo pointer-events-none"
        aria-hidden
      />
      <path
        d={path}
        fill="none"
        strokeWidth={divorced ? 2 : touchy ? 2.35 : 2.1}
        strokeLinecap="round"
        strokeDasharray={divorced ? '3 5' : undefined}
        className="spouse-edge__line pointer-events-none"
      />

      <ellipse
        cx={midX}
        cy={midY}
        rx={padRx}
        ry={padRy}
        className="spouse-edge__badge pointer-events-none"
        aria-hidden
      />
      <ellipse
        cx={midX}
        cy={midY}
        rx={padRx - 1.25}
        ry={padRy - 1.25}
        className="spouse-edge__badge-inner pointer-events-none"
        aria-hidden
      />

      <g transform={`translate(${midX} ${midY}) rotate(-18)`} className="pointer-events-none" aria-hidden>
        <circle cx={-dx} cy={0} r={r} fill="none" strokeWidth={ringStroke} className="spouse-edge__ring" />
        <circle cx={dx} cy={0} r={r} fill="none" strokeWidth={ringStroke} className="spouse-edge__ring" />
        {!divorced && (
          <>
            <circle cx={-dx - 1.4} cy={-2.2} r={0.9} className="spouse-edge__shine" />
            <circle cx={dx - 1.4} cy={-2.2} r={0.9} className="spouse-edge__shine" />
          </>
        )}
      </g>

      <circle
        cx={midX}
        cy={midY}
        r={hitR}
        fill="#fff"
        fillOpacity={0.01}
        stroke="#fff"
        strokeOpacity={0.01}
        strokeWidth={8}
        className="spouse-edge__hit"
        role="button"
        tabIndex={0}
        aria-label={t('couple.tapHint')}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') open(event);
        }}
      >
        <title>{t('couple.tapHint')}</title>
      </circle>
    </g>
  );
}

export const SpouseEdge = memo(SpouseEdgeComponent);
