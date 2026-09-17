import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Search, UserPlus, Users, X } from 'lucide-react';
import type { FamilyPerson, RelationLink } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { useT } from '../i18n/useT';
import { hasFullBirthDate } from '../features/birthday/publicApi';
import { calculateAge, birthYear } from '../utils/dates';
import { distinctCountries } from '../utils/countries';
import { fullName } from '../utils/family';
import { DEFAULT_FILTERS, matchesFilters, matchesSearch } from '../utils/filters';
import type { Filters } from '../utils/filters';
import { FilterPanel } from '../components/FilterPanel';
import { PersonCard } from '../components/PersonCard';
import { PersonDetailsModal } from '../components/PersonDetailsModal';
import { PersonFormModal } from '../components/PersonFormModal';
import { UnlockModal } from '../components/UnlockModal';

type SortKey = 'name' | 'age' | 'birthYear' | 'generation' | 'children';

export function MembersPage() {
  const { people, generations, deletePerson } = useFamily();
  const { canEdit, canDelete, editScope } = useAuth();
  const canAddPeople = canEdit && editScope === 'full';
  const confirm = useConfirm();
  const { toast } = useToast();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const missingOnly = searchParams.get('missing') === '1';
  const editId = searchParams.get('edit');

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(() =>
    missingOnly ? { ...DEFAULT_FILTERS, status: 'living' } : DEFAULT_FILTERS,
  );
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [form, setForm] = useState<{ person?: FamilyPerson; link?: RelationLink } | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);

  useEffect(() => {
    if (!editId || !canEdit) return;
    const person = people.find((p) => p.id === editId);
    if (!person) return;
    setForm({ person });
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
  }, [editId, canEdit, people, searchParams, setSearchParams]);

  const sorts: { key: SortKey; label: string }[] = [
    { key: 'name', label: t('members.sortName') },
    { key: 'age', label: t('members.sortAge') },
    { key: 'birthYear', label: t('members.sortBirth') },
    { key: 'generation', label: t('members.sortGeneration') },
    { key: 'children', label: t('members.sortChildren') },
  ];

  const missingLiving = useMemo(
    () => people.filter((p) => !p.isDeceased && !p.deathDate && !hasFullBirthDate(p.birthDate)),
    [people],
  );

  const visible = useMemo(() => {
    const filtered = people.filter((p) => {
      if (missingOnly) {
        if (p.isDeceased || p.deathDate || hasFullBirthDate(p.birthDate)) return false;
        return matchesSearch(p, query);
      }
      return matchesSearch(p, query) && matchesFilters(p, filters, generations);
    });
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
  }, [people, query, filters, sortKey, generations, missingOnly]);

  const handleDelete = async (person: FamilyPerson) => {
    const proceed = await confirm({
      title: t('delete.title', { name: fullName(person) }),
      message: t('delete.msg'),
      confirmLabel: t('delete.btn'),
      danger: true,
    });
    if (!proceed) return;
    const saved = await deletePerson(person.id);
    if (!saved) return;
    setDetailsId(null);
    toast(t('delete.done', { name: fullName(person) }));
  };

  const clearMissingFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('missing');
    next.delete('edit');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            {missingOnly ? t('members.missingTitle') : t('members.title')}
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {missingOnly
              ? t('members.missingShown', { shown: visible.length, total: missingLiving.length })
              : t('members.shown', { shown: visible.length, total: people.length })}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (canAddPeople ? setForm({}) : setUnlockOpen(true))}
        >
          <UserPlus className="h-4 w-4" aria-hidden /> {t('tree.addPerson')}
        </button>
      </div>

      {missingOnly && (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex min-w-0 items-start gap-2">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{t('members.missingBannerTitle')}</p>
              <p className="mt-0.5 text-sm leading-relaxed opacity-90">{t('members.missingBannerBody')}</p>
            </div>
          </div>
          <button type="button" className="btn-secondary !min-h-9 shrink-0 text-sm" onClick={clearMissingFilter}>
            {t('members.missingShowAll')}
          </button>
        </div>
      )}

      {!missingOnly && missingLiving.length > 0 && (
        <Link
          to="/members?missing=1"
          className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-sm font-medium text-amber-950 transition hover:bg-amber-100/70 dark:border-amber-800/40 dark:bg-amber-950/25 dark:text-amber-100 dark:hover:bg-amber-950/40"
        >
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          {t('members.missingCue', { n: missingLiving.length })}
        </Link>
      )}

      <div className="card mt-5 flex flex-wrap items-end gap-3 p-4 shadow-[0_1px_3px_0_rgb(0_0_0_0.04)] sm:p-5 dark:shadow-[0_1px_3px_0_rgb(0_0_0_0.2)]">
        <label className="relative block w-full sm:w-64">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            {t('members.search')}
          </span>
          <Search
            className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-stone-400"
            aria-hidden
          />
          <input
            type="search"
            className={`input !pl-9 ${query ? '!pr-10' : ''}`}
            placeholder={t('members.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="absolute bottom-1.5 right-1.5 rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              onClick={() => setQuery('')}
              aria-label={t('members.clearSearch')}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </label>
        <label className="block min-w-36 flex-1 sm:flex-none">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            {t('members.sortBy')}
          </span>
          <select
            className="input"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {sorts.map((s) => (
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
          countries={distinctCountries(people)}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 py-20 text-center">
          <div className="rounded-2xl bg-stone-100 p-5 dark:bg-stone-800">
            <Users className="h-10 w-10 text-stone-300 dark:text-stone-600" aria-hidden />
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {missingOnly ? t('members.missingEmpty') : t('members.noMatch')}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((person, i) => (
            <div
              key={person.id}
              className="animate-rise-in"
              style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}
            >
              <PersonCard
                person={person}
                onOpen={setDetailsId}
                onEdit={canEdit ? (p) => setForm({ person: p }) : undefined}
                onDelete={canDelete ? handleDelete : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {detailsId && (
        <PersonDetailsModal
          personId={detailsId}
          onClose={() => setDetailsId(null)}
          onNavigate={setDetailsId}
          editMode={canAddPeople}
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
