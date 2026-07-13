import {
  Baby,
  BookOpen,
  Briefcase,
  Cake,
  Flower2,
  Heart,
  MapPin,
  Pencil,
  Trash2,
  Users,
  UserPlus,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { FamilyPerson, RelationKind } from '../types/family';
import { useFamily } from '../context/FamilyContext';
import { usePrivacy } from '../hooks/usePrivacy';
import { calculateAge } from '../utils/dates';
import { formatDate } from '../utils/dates';
import { displayName, fullName, sortByBirth } from '../utils/family';
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
  onAddRelative?: (kind: RelationKind, person: FamilyPerson) => void;
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
            className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-emerald-950/60"
          >
            {fullName(p)}
            {p.isDeceased ? ' †' : ''}
          </button>
        ))}
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
  onAddRelative,
}: PersonDetailsModalProps) {
  const { index, generations, getLabel } = useFamily();
  const privacy = usePrivacy();
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
  const location = [privacy.showCity() ? person.city : null, person.country]
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
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {privacy.showBirthDate() && person.birthDate && (
          <DetailRow icon={<Cake className="h-4 w-4" aria-hidden />} label="Born">
            {formatDate(person.birthDate)}
          </DetailRow>
        )}
        {privacy.showDeathDate() && person.deathDate && (
          <DetailRow icon={<Flower2 className="h-4 w-4" aria-hidden />} label="Died">
            {formatDate(person.deathDate)}
          </DetailRow>
        )}
        {age !== null && privacy.showAge(person) && (
          <DetailRow
            icon={<Users className="h-4 w-4" aria-hidden />}
            label={person.isDeceased ? 'Age at death' : 'Age'}
          >
            {age} years
          </DetailRow>
        )}
        {location && (
          <DetailRow icon={<MapPin className="h-4 w-4" aria-hidden />} label="Location">
            {location}
          </DetailRow>
        )}
        {privacy.showOccupation() && person.occupation && (
          <DetailRow icon={<Briefcase className="h-4 w-4" aria-hidden />} label="Occupation">
            {person.occupation}
          </DetailRow>
        )}
        {children.length > 0 && (
          <DetailRow icon={<Baby className="h-4 w-4" aria-hidden />} label="Children">
            {children.length}
          </DetailRow>
        )}
      </dl>

      {privacy.showBiography() && person.biography && (
        <div className="mt-3 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/60">
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> Biography
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
            {person.biography}
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <RelativeChips title="Parents" people={parents} onNavigate={onNavigate} />
        <RelativeChips
          title={spouses.length > 1 ? 'Spouses' : 'Spouse'}
          people={spouses}
          onNavigate={onNavigate}
        />
        <RelativeChips title="Siblings" people={siblings} onNavigate={onNavigate} />
        {spouses.length > 1 ? (
          // Blended family: show which children belong to which partner.
          <>
            {spouses.map((spouse) => (
              <RelativeChips
                key={spouse.id}
                title={`Children with ${fullName(spouse)}`}
                people={children.filter((c) => c.parentIds.includes(spouse.id))}
                onNavigate={onNavigate}
              />
            ))}
            <RelativeChips
              title="Children (other parent not listed)"
              people={children.filter((c) => !spouses.some((s) => c.parentIds.includes(s.id)))}
              onNavigate={onNavigate}
            />
          </>
        ) : (
          <RelativeChips title="Children" people={children} onNavigate={onNavigate} />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-4 dark:border-stone-700">
        {editMode ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {(['spouse', 'child', 'parent', 'sibling'] as RelationKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="btn-secondary !px-2.5 !py-1.5 !text-xs"
                  onClick={() => onAddRelative?.(kind, person)}
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  Add {kind}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button type="button" className="btn-secondary" onClick={() => onEdit?.(person)}>
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </button>
              {canDelete && (
                <button type="button" className="btn-danger" onClick={() => onDelete?.(person)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
              <Heart className="h-3.5 w-3.5" aria-hidden />
              Turn on edit mode on the Family Tree page to change this person.
            </span>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
