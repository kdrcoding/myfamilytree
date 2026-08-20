import { useId, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { FamilyPerson } from '../types/family';
import { useFamily } from '../context/FamilyContext';
import { useT } from '../i18n/useT';
import { fullName, sortByBirth } from '../utils/family';
import { Avatar } from './Avatar';

interface PersonSearchProps {
  /** Extra classes on the outer wrapper. */
  className?: string;
  /** Larger input — used on the Easy Mode home screen. */
  large?: boolean;
  placeholder?: string;
  /** Called instead of navigating to the tree (e.g. relationship picker). */
  onPick?: (person: FamilyPerson) => void;
  /** Exclude these ids from results (e.g. the other picker). */
  excludeIds?: string[];
}

/**
 * Type-ahead people search. Default action: open that person on the tree.
 */
export function PersonSearch({
  className = '',
  large = false,
  placeholder,
  onPick,
  excludeIds = [],
}: PersonSearchProps) {
  const { people } = useFamily();
  const t = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const excluded = new Set(excludeIds);
    return [...people]
      .filter((p) => !excluded.has(p.id))
      .filter((p) => {
        const hay = `${p.firstName} ${p.lastName} ${p.nickname ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort(sortByBirth)
      .slice(0, 8);
  }, [people, query, excludeIds]);

  const select = (person: FamilyPerson) => {
    setQuery('');
    if (onPick) {
      onPick(person);
      return;
    }
    navigate(`/tree?person=${encodeURIComponent(person.id)}`);
  };

  return (
    <div className={`relative ${className}`}>
      <label className="sr-only" htmlFor={inputId}>
        {t('search.label')}
      </label>
      <div className="relative">
        <Search
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 ${
            large ? 'h-6 w-6' : 'h-4 w-4'
          }`}
          aria-hidden
        />
        <input
          id={inputId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          className={`input ${large ? '!py-4 !pl-12 !pr-10 !text-lg' : '!pl-10'}`}
          placeholder={placeholder ?? t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2"
            onClick={() => setQuery('')}
            aria-label={t('search.clear')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <ul
          className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900"
          role="listbox"
        >
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                role="option"
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-emerald-50 focus-visible:bg-emerald-50 dark:hover:bg-emerald-950/40 dark:focus-visible:bg-emerald-950/40"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => select(person)}
              >
                <Avatar person={person} size={large ? 'md' : 'sm'} />
                <span className={`font-medium ${large ? 'text-base' : 'text-sm'}`}>
                  {fullName(person)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 1 && results.length === 0 && (
        <p className="mt-2 text-sm text-stone-500">{t('search.noMatches')}</p>
      )}
    </div>
  );
}
