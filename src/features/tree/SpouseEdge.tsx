import { memo, useEffect, useState } from 'react';
import type { EdgeProps } from '@xyflow/react';
import { useT } from '../../i18n/useT';
import { useTreeInteraction } from './TreeInteractionContext';

/**
 * Marriage line with interlocking wedding rings. Sized for finger taps on
 * phones — the rose badge is the cue that the couple is tappable / editable.
 */
function SpouseEdgeComponent({ sourceX, sourceY, targetX, targetY, source, target, data }: EdgeProps) {
  const { onOpenCouple } = useTreeInteraction();
  const t = useT();
  const divorced = Boolean(data?.divorced);
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;

  // Bigger on touch devices so the rings read as a control, not decoration.
  const [touchy, setTouchy] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse), (hover: none)');
    const sync = () => setTouchy(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const r = touchy ? 8.5 : 7;
  const dx = touchy ? 5 : 4.2;
  const ringStroke = touchy ? 2.85 : 2.55;
  const padRx = touchy ? 22 : 18;
  const padRy = touchy ? 14 : 12;
  const hitR = touchy ? 30 : 24;

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
        strokeWidth={touchy ? 11 : 9}
        strokeLinecap="round"
        className="spouse-edge__halo pointer-events-none"
        aria-hidden
      />
      <path
        d={path}
        fill="none"
        strokeWidth={divorced ? 2.25 : touchy ? 3.25 : 2.85}
        strokeLinecap="round"
        strokeDasharray={divorced ? '3 5' : undefined}
        className="spouse-edge__line pointer-events-none"
      />

      {/* Soft rose badge — reads as a button between the two people */}
      <ellipse
        cx={midX}
        cy={midY}
        rx={padRx}
        ry={padRy}
        className={`spouse-edge__badge pointer-events-none ${divorced ? '' : 'spouse-edge__badge--glow'}`}
        aria-hidden
      />
      <ellipse
        cx={midX}
        cy={midY}
        rx={padRx - 1.5}
        ry={padRy - 1.5}
        className="spouse-edge__badge-inner pointer-events-none"
        aria-hidden
      />

      <g transform={`translate(${midX} ${midY}) rotate(-18)`} className="pointer-events-none" aria-hidden>
        <circle cx={-dx} cy={0} r={r} fill="none" strokeWidth={ringStroke} className="spouse-edge__ring" />
        <circle cx={dx} cy={0} r={r} fill="none" strokeWidth={ringStroke} className="spouse-edge__ring" />
        {!divorced && (
          <>
            <circle cx={-dx - 2} cy={-3} r={1.35} className="spouse-edge__shine" />
            <circle cx={dx - 2} cy={-3} r={1.35} className="spouse-edge__shine" />
          </>
        )}
      </g>

      {/* Finger-sized hit target */}
      <circle
        cx={midX}
        cy={midY}
        r={hitR}
        fill="#fff"
        fillOpacity={0.01}
        stroke="#fff"
        strokeOpacity={0.01}
        strokeWidth={10}
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
