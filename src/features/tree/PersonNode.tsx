import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Baby, ChevronDown, ChevronUp, Heart, UserRoundPlus } from 'lucide-react';
import { useFamily } from '../../context/FamilyContext';
import { usePrivacy } from '../../hooks/usePrivacy';
import { useT } from '../../i18n/useT';
import { lifespan } from '../../utils/dates';
import { fullName } from '../../utils/family';
import { Avatar } from '../../components/Avatar';
import { DeceasedBadge, GenderBadge } from '../../components/badges';
import { CARD_H, CARD_W } from './layout';
import type { PersonFlowNode } from './layout';
import { useTreeInteraction } from './TreeInteractionContext';

const GENDER_ACCENT = {
  male: 'border-l-sky-400 dark:border-l-sky-600',
  female: 'border-l-rose-400 dark:border-l-rose-600',
  unspecified: 'border-l-violet-400 dark:border-l-violet-600',
};

const HANDLE = '!h-1.5 !w-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent';

function PersonNodeComponent({ data }: NodeProps<PersonFlowNode>) {
  const { getPerson, getLabel } = useFamily();
  const privacy = usePrivacy();
  const t = useT();
  const { onOpen, onToggleCollapse, onQuickAdd, editMode, highlightedId, dimmedIds } =
    useTreeInteraction();
  const person = getPerson(data.personId);
  if (!person) return null;

  const highlighted = highlightedId === person.id;
  const dimmed = dimmedIds.has(person.id) && !highlighted;
  const years = privacy.showBirthDate()
    ? lifespan(
        person.birthDate,
        privacy.showDeathDate() ? person.deathDate : undefined,
        person.isDeceased,
        t('common.bornAbbr'),
      )
    : person.isDeceased
      ? t('common.deceasedShort')
      : '';

  return (
    <div
      style={{ width: CARD_W, height: CARD_H }}
      className={`relative transition-opacity duration-300 ${dimmed ? 'opacity-25' : ''}`}
    >
      <Handle type="target" position={Position.Top} id="top" className={HANDLE} />
      <Handle type="target" position={Position.Left} id="left" className={HANDLE} />
      <Handle type="source" position={Position.Right} id="right" className={HANDLE} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE} />

      <button
        type="button"
        onClick={() => onOpen(person.id)}
        aria-label={t('tree.openDetails', { name: fullName(person) })}
        className={`flex h-full w-full items-center gap-2.5 rounded-xl border border-l-4 bg-white px-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-stone-900 ${
          GENDER_ACCENT[person.gender]
        } ${
          person.isDeceased
            ? 'border-dashed border-stone-300 dark:border-stone-600'
            : 'border-stone-200 dark:border-stone-700'
        } ${highlighted ? 'ring-4 ring-amber-400 dark:ring-amber-500' : ''}`}
      >
        <Avatar person={person} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
            {fullName(person)}
          </span>
          {person.nickname && (
            <span className="block truncate text-xs text-stone-400">“{person.nickname}”</span>
          )}
          <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
            {years || getLabel(person)}
          </span>
          <span className="mt-1 flex gap-1">
            <GenderBadge gender={person.gender} compact />
            <DeceasedBadge person={person} compact />
          </span>
        </span>
      </button>

      {editMode && (
        <>
          {/* One-click relative buttons: heart = spouse, baby = child,
              person+ = parent (only when no parents are known yet). */}
          <button
            type="button"
            className="quick-add absolute -right-3 top-1/2 z-10 -translate-y-1/2"
            title={t('tree.quickSpouse', { name: fullName(person) })}
            aria-label={t('tree.quickSpouse', { name: fullName(person) })}
            onClick={(event) => {
              event.stopPropagation();
              onQuickAdd('spouse', person.id);
            }}
          >
            <Heart className="h-3 w-3" aria-hidden />
          </button>
          <button
            type="button"
            className="quick-add absolute -bottom-3 right-5 z-10"
            title={t('tree.quickChild', { name: fullName(person) })}
            aria-label={t('tree.quickChild', { name: fullName(person) })}
            onClick={(event) => {
              event.stopPropagation();
              onQuickAdd('child', person.id);
            }}
          >
            <Baby className="h-3 w-3" aria-hidden />
          </button>
          {person.parentIds.length === 0 && (
            <button
              type="button"
              className="quick-add absolute -top-3 left-1/2 z-10 -translate-x-1/2"
              title={t('tree.quickParent', { name: fullName(person) })}
              aria-label={t('tree.quickParent', { name: fullName(person) })}
              onClick={(event) => {
                event.stopPropagation();
                onQuickAdd('parent', person.id);
              }}
            >
              <UserRoundPlus className="h-3 w-3" aria-hidden />
            </button>
          )}
        </>
      )}

      {data.collapsible && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse(person.id);
          }}
          aria-label={
            data.collapsed
              ? t('tree.expandBranch', { n: data.hiddenCount })
              : t('tree.collapseBranch')
          }
          className="absolute -bottom-3.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-600 shadow-sm transition-colors hover:border-emerald-400 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300"
        >
          {data.collapsed ? (
            <>
              <ChevronDown className="h-3 w-3" aria-hidden />
              {data.hiddenCount}
            </>
          ) : (
            <ChevronUp className="h-3 w-3" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
