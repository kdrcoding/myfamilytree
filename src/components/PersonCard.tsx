import { Baby, Briefcase, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { FamilyPerson } from '../types/family';
import { useFamily } from '../context/FamilyContext';
import { usePrivacy } from '../hooks/usePrivacy';
import { calculateAge } from '../utils/dates';
import { lifespan } from '../utils/dates';
import { displayName } from '../utils/family';
import { Avatar } from './Avatar';
import { DeceasedBadge, GenderBadge, GenerationBadge } from './badges';

interface PersonCardProps {
  person: FamilyPerson;
  onOpen: (id: string) => void;
  onEdit?: (person: FamilyPerson) => void;
  onDelete?: (person: FamilyPerson) => void;
}

/** Card used in the Members grid. Click opens the full details panel. */
export function PersonCard({ person, onOpen, onEdit, onDelete }: PersonCardProps) {
  const { generations, getLabel } = useFamily();
  const privacy = usePrivacy();
  const age = calculateAge(person.birthDate, person.deathDate);
  const years = privacy.showBirthDate()
    ? lifespan(
        person.birthDate,
        privacy.showDeathDate() ? person.deathDate : undefined,
        person.isDeceased,
      )
    : '';

  return (
    <article
      className={`card group relative flex flex-col gap-3 p-4 transition-shadow hover:shadow-md ${
        person.isDeceased ? 'border-dashed' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(person.id)}
        className="absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={`Open details for ${displayName(person)}`}
      />
      <div className="flex items-start gap-3">
        <Avatar person={person} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-stone-900 dark:text-stone-100">
            {displayName(person)}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {getLabel(person)}
            {years && ` · ${years}`}
            {age !== null && privacy.showAge(person) && !person.isDeceased && ` · ${age} yrs`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <GenderBadge gender={person.gender} />
        <GenerationBadge generation={generations.get(person.id) ?? 1} />
        <DeceasedBadge person={person} />
      </div>

      <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-400">
        {(privacy.showCity() && person.city) || person.country ? (
          <li className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {[privacy.showCity() ? person.city : null, person.country].filter(Boolean).join(', ')}
          </li>
        ) : null}
        {privacy.showOccupation() && person.occupation && (
          <li className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {person.occupation}
          </li>
        )}
        {person.childIds.length > 0 && (
          <li className="flex items-center gap-1.5">
            <Baby className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {person.childIds.length} {person.childIds.length === 1 ? 'child' : 'children'}
          </li>
        )}
      </ul>

      {(onEdit || onDelete) && (
        <div className="relative z-10 mt-auto flex gap-1.5 border-t border-stone-100 pt-3 dark:border-stone-800">
          {onEdit && (
            <button
              type="button"
              className="btn-secondary flex-1 !py-1.5 !text-xs"
              onClick={() => onEdit(person)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn-danger flex-1 !py-1.5 !text-xs"
              onClick={() => onDelete(person)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}
