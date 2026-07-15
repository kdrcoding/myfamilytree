import {
  Baby,
  BookOpen,
  Briefcase,
  Cake,
  Flower2,
  Heart,
  HeartCrack,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { FamilyPerson } from '../types/family';
import { useFamily } from '../context/FamilyContext';
import { usePrivacy } from '../hooks/usePrivacy';
import { useLanguage, useT } from '../i18n/useT';
import { countryLabel } from '../utils/countries';
import { calculateAge, formatDate } from '../utils/dates';
import { displayName, fullName, isDivorced, sortByBirth } from '../utils/family';
import { Avatar } from './Avatar';
import { DeceasedBadge, GenderBadge, GenerationBadge } from './badges';
import { Modal } from './ui/Modal';

interface PersonDetailsModalProps {
  personId: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
  editMode?: boolean;
  /** Only the owner role may delete; hides the delete button otherwise. */
  canDelete?: boolean;
  onEdit?: (person: FamilyPerson) => void;
  onDelete?: (person: FamilyPerson) => void;
  /**
   * View-mode "Edit" button: lets a viewer jump straight into editing this
   * person (prompting for the password first if needed), so they don't have
   * to hunt for the edit-mode toggle in the toolbar — which is easy to miss
   * on phones where it scrolls off the right edge.
   */
  onRequestEdit?: (person: FamilyPerson) => void;
  /**
   * When provided, a small "copy share link" button appears in the header.
   * The tree passes this so a person can be shared; the shared link reopens
   * this person automatically.
   */
  onCopyLink?: (person: FamilyPerson) => void;
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="mt-0.5 text-stone-400 dark:text-stone-500">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {label}
        </dt>
        <dd className="text-sm text-stone-800 dark:text-stone-200">{children}</dd>
      </div>
    </div>
  );
}

function RelativeChips({
  title,
  people,
  onNavigate,
}: {
  title: string;
  people: FamilyPerson[];
  onNavigate: (id: string) => void;
}) {
  if (people.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {title}
      </h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onNavigate(p.id)}
            className="rounded-full border border-stone-300 bg-stone-50 px-3.5 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-emerald-950/60"
          >
            {fullName(p)}
            {p.isDeceased ? ' †' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Spouse list with divorce status: a "divorced" badge on ex-partners and,
 * in edit mode, a per-spouse button to mark / unmark the divorce.
 */
function SpouseChips({
  title,
  person,
  spouses,
  editMode,
  onNavigate,
}: {
  title: string;
  person: FamilyPerson;
  spouses: FamilyPerson[];
  editMode: boolean;
  onNavigate: (id: string) => void;
}) {
  const { setDivorcedStatus } = useFamily();
  const t = useT();
  if (spouses.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {title}
      </h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {spouses.map((spouse) => {
          const divorced = isDivorced(person, spouse);
          return (
            <span key={spouse.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => onNavigate(spouse.id)}
                className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  divorced
                    ? 'border-stone-300 bg-stone-100 text-stone-500 dark:border-stone-600 dark:bg-stone-800/60 dark:text-stone-400'
                    : 'border-stone-300 bg-stone-50 text-stone-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-emerald-950/60'
                }`}
              >
                {fullName(spouse)}
                {spouse.isDeceased ? ' †' : ''}
                {divorced && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    · {t('person.divorced')}
                  </span>
                )}
              </button>
              {editMode && (
                <button
                  type="button"
                  onClick={() => setDivorcedStatus(person.id, spouse.id, !divorced)}
                  title={
                    divorced
                      ? t('person.unmarkDivorced', { name: fullName(spouse) })
                      : t('person.markDivorced', { name: fullName(spouse) })
                  }
                  aria-label={
                    divorced
                      ? t('person.unmarkDivorced', { name: fullName(spouse) })
                      : t('person.markDivorced', { name: fullName(spouse) })
                  }
                  aria-pressed={divorced}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    divorced
                      ? 'border-amber-400 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'border-stone-300 bg-white text-stone-400 hover:border-amber-400 hover:text-amber-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-500 dark:hover:text-amber-400'
                  }`}
                >
                  {divorced ? (
                    <Heart className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <HeartCrack className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function PersonDetailsModal({
  personId,
  onClose,
  onNavigate,
  editMode = false,
  canDelete = false,
  onEdit,
  onDelete,
  onRequestEdit,
  onCopyLink,
}: PersonDetailsModalProps) {
  const { index, generations, getLabel } = useFamily();
  const privacy = usePrivacy();
  const t = useT();
  const language = useLanguage();
  const person = index.get(personId);
  if (!person) return null;

  const parents = person.parentIds.map((id) => index.get(id)).filter(Boolean) as FamilyPerson[];
  const spouses = person.spouseIds.map((id) => index.get(id)).filter(Boolean) as FamilyPerson[];
  const children = (
    person.childIds.map((id) => index.get(id)).filter(Boolean) as FamilyPerson[]
  ).sort(sortByBirth);
  const siblings = [
    ...new Set(parents.flatMap((parent) => parent.childIds).filter((id) => id !== person.id)),
  ]
    .map((id) => index.get(id))
    .filter(Boolean) as FamilyPerson[];

  const age = calculateAge(person.birthDate, person.deathDate);
  const location = [privacy.showCity() ? person.city : null, countryLabel(person.country, language)]
    .filter(Boolean)
    .join(', ');

  return (
    <Modal onClose={onClose} labelledBy="person-details-title" size="md">
      <div className="flex items-start gap-4">
        <Avatar person={person} size="lg" />
        <div className="min-w-0 flex-1">
          <h2
            id="person-details-title"
            className="text-xl font-bold text-stone-900 dark:text-stone-100"
          >
            {displayName(person)}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">{getLabel(person)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <GenderBadge gender={person.gender} />
            <GenerationBadge generation={generations.get(person.id) ?? 1} />
            <DeceasedBadge person={person} />
          </div>
        </div>
        {onCopyLink && (
          <button
            type="button"
            onClick={() => onCopyLink(person)}
            className="shrink-0 rounded-lg border border-stone-300 bg-white p-2 text-stone-500 shadow-sm transition-colors hover:border-emerald-400 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-400 dark:hover:text-emerald-300"
            title={t('tree.copyLink')}
            aria-label={t('tree.copyLink')}
          >
            <LinkIcon className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {privacy.showBirthDate() && person.birthDate && (
          <DetailRow icon={<Cake className="h-4 w-4" aria-hidden />} label={t('person.born')}>
            {formatDate(person.birthDate, language)}
          </DetailRow>
        )}
        {privacy.showDeathDate() && person.deathDate && (
          <DetailRow icon={<Flower2 className="h-4 w-4" aria-hidden />} label={t('person.died')}>
            {formatDate(person.deathDate, language)}
          </DetailRow>
        )}
        {age !== null && privacy.showAge(person) && (
          <DetailRow
            icon={<Users className="h-4 w-4" aria-hidden />}
            label={person.isDeceased ? t('person.ageAtDeath') : t('person.age')}
          >
            {age === 1 ? t('person.yearOne') : t('person.years', { n: age })}
          </DetailRow>
        )}
        {location && (
          <DetailRow icon={<MapPin className="h-4 w-4" aria-hidden />} label={t('person.location')}>
            {location}
          </DetailRow>
        )}
        {privacy.showOccupation() && person.occupation && (
          <DetailRow
            icon={<Briefcase className="h-4 w-4" aria-hidden />}
            label={t('person.occupation')}
          >
            {person.occupation}
          </DetailRow>
        )}
        {children.length > 0 && (
          <DetailRow
            icon={<Baby className="h-4 w-4" aria-hidden />}
            label={t('person.childrenCount')}
          >
            {children.length}
          </DetailRow>
        )}
      </dl>

      {privacy.showBiography() && person.biography && (
        <div className="mt-3 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/60">
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> {t('person.biography')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
            {person.biography}
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <RelativeChips title={t('person.parents')} people={parents} onNavigate={onNavigate} />
        <SpouseChips
          title={spouses.length > 1 ? t('person.spouses') : t('person.spouse')}
          person={person}
          spouses={spouses}
          // Divorce is a relationship change, so the toggle is owner-only —
          // family editors only edit detail fields.
          editMode={editMode && canDelete}
          onNavigate={onNavigate}
        />
        <RelativeChips title={t('person.siblings')} people={siblings} onNavigate={onNavigate} />
        {spouses.length > 1 ? (
          // Blended family: show which children belong to which partner.
          <>
            {spouses.map((spouse) => (
              <RelativeChips
                key={spouse.id}
                title={t('person.childrenWith', { name: fullName(spouse) })}
                people={children.filter((c) => c.parentIds.includes(spouse.id))}
                onNavigate={onNavigate}
              />
            ))}
            <RelativeChips
              title={t('person.childrenOther')}
              people={children.filter((c) => !spouses.some((s) => c.parentIds.includes(s.id)))}
              onNavigate={onNavigate}
            />
          </>
        ) : (
          <RelativeChips title={t('person.children')} people={children} onNavigate={onNavigate} />
        )}
      </div>

      <div className="mt-5 border-t border-stone-200 pt-4 dark:border-stone-700">
        {editMode ? (
          // Relatives are added straight from the tree cards (the heart / baby
          // / parent icons), so this popup only needs Edit and Delete.
          <div className="flex justify-end gap-1.5">
            <button type="button" className="btn-secondary" onClick={() => onEdit?.(person)}>
              <Pencil className="h-4 w-4" aria-hidden /> {t('person.edit')}
            </button>
            {canDelete && (
              <button type="button" className="btn-danger" onClick={() => onDelete?.(person)}>
                <Trash2 className="h-4 w-4" aria-hidden /> {t('person.delete')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t('person.viewHint')}
            </span>
            <div className="flex gap-1.5">
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t('common.close')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onRequestEdit?.(person)}
              >
                <Pencil className="h-4 w-4" aria-hidden /> {t('person.edit')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
