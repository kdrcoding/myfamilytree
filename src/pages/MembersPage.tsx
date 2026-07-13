import { useMemo, useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import type { FamilyPerson, RelationLink } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { calculateAge, birthYear } from '../utils/dates';
import { fullName } from '../utils/family';
import { DEFAULT_FILTERS, matchesFilters, matchesSearch } from '../utils/filters';
import type { Filters } from '../utils/filters';
import { FilterPanel } from '../components/FilterPanel';
import { PersonCard } from '../components/PersonCard';
import { PersonDetailsModal } from '../components/PersonDetailsModal';
import { PersonFormModal } from '../components/PersonFormModal';
import { UnlockModal } from '../components/UnlockModal';

type SortKey = 'name' | 'age' | 'birthYear' | 'generation' | 'children';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'age', label: 'Age' },
  { key: 'birthYear', label: 'Birth year' },
  { key: 'generation', label: 'Generation' },
  { key: 'children', label: 'Number of children' },
];

export function MembersPage() {
  const { people, generations, deletePerson } = useFamily();
  const { canEdit, canDelete } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [form, setForm] = useState<{ person?: FamilyPerson; link?: RelationLink } | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const visible = useMemo(() => {
    const filtered = people.filter(
      (p) => matchesSearch(p, query) && matchesFilters(p, filters, generations),
    );
    const sorters: Record<SortKey, (a: FamilyPerson, b: FamilyPerson) => number> = {
      name: (a, b) => fullName(a).localeCompare(fullName(b)),
      age: (a, b) =>
        (calculateAge(b.birthDate, b.deathDate) ?? -1) -
        (calculateAge(a.birthDate, a.deathDate) ?? -1),
      birthYear: (a, b) => (birthYear(a.birthDate) ?? 9999) - (birthYear(b.birthDate) ?? 9999),
      generation: (a, b) => (generations.get(a.id) ?? 0) - (generations.get(b.id) ?? 0),
      children: (a, b) => b.childIds.length - a.childIds.length,
    };
    return [...filtered].sort(sorters[sortKey]);
  }, [people, query, filters, sortKey, generations]);

  const handleDelete = async (person: FamilyPerson) => {
    const proceed = await confirm({
      title: `Delete ${fullName(person)}?`,
      message: 'This removes the person and all their relationship links. This cannot be undone.',
      confirmLabel: 'Delete person',
      danger: true,
    });
    if (!proceed) return;
    deletePerson(person.id);
    setDetailsId(null);
    toast(`${fullName(person)} was removed.`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Family members</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {visible.length} of {people.length} people shown
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (canEdit ? setForm({}) : setUnlockOpen(true))}
        >
          <UserPlus className="h-4 w-4" aria-hidden /> Add person
        </button>
      </div>

      <div className="card mt-5 flex flex-wrap items-end gap-3 p-4">
        <label className="relative block w-full sm:w-64">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            Search
          </span>
          <Search
            className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-stone-400"
            aria-hidden
          />
          <input
            type="search"
            className="input !pl-9"
            placeholder="Name, city, occupation…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            Sort by
          </span>
          <select
            className="input"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          generationCount={Math.max(...[...generations.values(), 1])}
          countries={[...new Set(people.map((p) => p.country?.trim()).filter(Boolean))] as string[]}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-16 text-center">
          <Users className="h-10 w-10 text-stone-300 dark:text-stone-600" aria-hidden />
          <p className="text-sm text-stone-500 dark:text-stone-400">
            No family members match your search and filters.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              onOpen={setDetailsId}
              onEdit={canEdit ? (p) => setForm({ person: p }) : undefined}
              onDelete={canDelete ? handleDelete : undefined}
            />
          ))}
        </div>
      )}

      {detailsId && (
        <PersonDetailsModal
          personId={detailsId}
          onClose={() => setDetailsId(null)}
          onNavigate={setDetailsId}
          editMode={canEdit}
          canDelete={canDelete}
          onEdit={(person) => {
            setDetailsId(null);
            setForm({ person });
          }}
          onDelete={handleDelete}
          onAddRelative={(kind, person) => {
            setDetailsId(null);
            setForm({ link: { kind, targetId: person.id } });
          }}
        />
      )}
      {form && <PersonFormModal {...form} onClose={() => setForm(null)} />}
      {unlockOpen && (
        <UnlockModal onClose={() => setUnlockOpen(false)} onUnlocked={() => setForm({})} />
      )}
    </div>
  );
}
