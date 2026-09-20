import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Baby, Heart, UserRoundPlus } from 'lucide-react';
import { useFamily } from '../../context/FamilyContext';
import { usePrivacy } from '../../hooks/usePrivacy';
import { useT } from '../../i18n/useT';
import { lifespan } from '../../utils/dates';
import { fullName, prettyLabel } from '../../utils/family';
import { isProfileComplete } from '../../utils/profileComplete';
import { Avatar } from '../../components/Avatar';
import { DeceasedBadge, GenderBadge } from '../../components/badges';
import { CARD_H, CARD_W } from './layout';
import type { PersonFlowNode } from './layout';
import { useTreeInteraction } from './TreeInteractionContext';

const GENDER_ACCENT = {
  male: 'border-l-sky-400 dark:border-l-cyan-400',
  female: 'border-l-rose-400 dark:border-l-rose-400',
  unspecified: 'border-l-teal-400 dark:border-l-teal-300',
};

const HANDLE = '!h-1.5 !w-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent';

function PersonNodeComponent({ data, width, height }: NodeProps<PersonFlowNode>) {
  const { getPerson, getLabel } = useFamily();
  const privacy = usePrivacy();
  const t = useT();
  const { onOpen, onQuickAdd, editMode } = useTreeInteraction();
  const person = getPerson(data.personId);
  if (!person) return null;

  const name = fullName(person);
  const complete = isProfileComplete(person);
  const years = privacy.showBirthDate()
    ? lifespan(
        person.birthDate,
        privacy.showDeathDate() ? person.deathDate : undefined,
        person.isDeceased,
        t('common.bornAbbr'),
        t('common.diedAbbr'),
      )
    : person.isDeceased
      ? t('common.deceasedShort')
      : '';

  return (
    <div style={{ width: width ?? CARD_W, height: height ?? CARD_H }} className="relative">
      <Handle type="target" position={Position.Top} id="top" className={HANDLE} />
      <Handle type="target" position={Position.Left} id="left" className={HANDLE} />
      <Handle type="source" position={Position.Right} id="right" className={HANDLE} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE} />

      <button
        type="button"
        onClick={() => onOpen(person.id)}
        aria-label={
          complete
            ? t('tree.openDetailsComplete', { name })
            : t('tree.openDetails', { name })
        }
        title={complete ? `${name} · ${t('tree.profileComplete')}` : name}
        className={`tree-person-card relative flex h-full w-full items-center gap-2.5 rounded-2xl border border-l-4 px-3 text-left ring-1 ring-teal-900/10 focus-visible:ring-2 focus-visible:ring-teal-400 dark:ring-teal-200/10 ${
          GENDER_ACCENT[person.gender]
        } ${
          person.isDeceased
            ? 'border-dashed border-stone-400/80 dark:border-stone-500'
            : 'border-teal-500/25 dark:border-teal-400/20'
        } ${complete ? 'tree-person-card--complete' : ''}`}
      >
        {complete && (
          <span className="tree-person-complete-spark" aria-hidden>
            ✦
          </span>
        )}
        <Avatar person={person} size="sm" />
        <span className="min-w-0 flex-1">
          <span
            className="tree-person-name block text-[15px] font-semibold leading-tight text-stone-900 dark:text-stone-100"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {name}
          </span>
          {person.nickname && (
            <span className="tree-person-nick tree-person-meta block truncate text-[13px] text-stone-400">
              “{prettyLabel(person.nickname)}”
            </span>
          )}
          <span className="tree-person-meta block truncate text-[13px] text-stone-500 dark:text-stone-400">
            {years || getLabel(person)}
          </span>
          <span className="tree-person-badges mt-1 flex gap-1">
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
            title={t('tree.quickSpouse', { name })}
            aria-label={t('tree.quickSpouse', { name })}
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
            title={t('tree.quickChild', { name })}
            aria-label={t('tree.quickChild', { name })}
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
              title={t('tree.quickParent', { name })}
              aria-label={t('tree.quickParent', { name })}
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
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
