import { useState } from 'react';
import { ChevronDown, FilterX, SlidersHorizontal } from 'lucide-react';
import type { Filters } from '../utils/filters';
import { DEFAULT_FILTERS, hasActiveFilters } from '../utils/filters';
import type { Gender } from '../types/family';
import { useLanguage, useT } from '../i18n/useT';
import { countryLabel } from '../utils/countries';

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  generationCount: number;
  countries: string[];
  compact?: boolean;
}

export function FilterPanel({
  filters,
  onChange,
  generationCount,
  countries,
  compact,
}: FilterPanelProps) {
  const t = useT();
  const language = useLanguage();
  // On phones the four dropdowns would fill the whole screen, so they hide
  // behind one small "Filters" button until needed. Desktop shows them inline.
  const [open, setOpen] = useState(false);
  const selectClass = compact ? 'input sm:!w-auto sm:!py-1.5 sm:!text-xs' : 'input';
  const active = hasActiveFilters(filters);
  const activeCount = [
    filters.gender !== 'all',
    filters.status !== 'all',
    filters.generation !== 'all',
    filters.country !== 'all',
  ].filter(Boolean).length;

  return (
    <div className={`flex flex-wrap items-end gap-2 ${compact ? '' : 'sm:gap-3'}`}>
      <button
        type="button"
        className="btn-secondary !text-xs sm:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        {t('filters.title')}
        {activeCount > 0 && (
          <span className="rounded-full bg-emerald-700 px-1.5 text-[11px] font-bold text-white dark:bg-emerald-600">
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        className={`${open ? 'grid' : 'hidden'} w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:flex-wrap ${compact ? '' : 'sm:gap-3'}`}
      >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
          {t('filters.gender')}
        </span>
        <select
          className={selectClass}
          value={filters.gender}
          onChange={(e) => onChange({ ...filters, gender: e.target.value as Gender | 'all' })}
        >
          <option value="all">{t('filters.all')}</option>
          <option value="female">{t('filters.female')}</option>
          <option value="male">{t('filters.male')}</option>
          <option value="unspecified">{t('filters.unspecified')}</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
          {t('filters.status')}
        </span>
        <select
          className={selectClass}
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value as Filters['status'] })}
        >
          <option value="all">{t('filters.all')}</option>
          <option value="living">{t('filters.living')}</option>
          <option value="deceased">{t('filters.deceased')}</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
          {t('filters.generation')}
        </span>
        <select
          className={selectClass}
          value={String(filters.generation)}
          onChange={(e) =>
            onChange({
              ...filters,
              generation: e.target.value === 'all' ? 'all' : Number(e.target.value),
            })
          }
        >
          <option value="all">{t('filters.all')}</option>
          {Array.from({ length: generationCount }, (_, i) => i + 1).map((gen) => (
            <option key={gen} value={gen}>
              {t('filters.generationN', { n: gen })}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
          {t('filters.country')}
        </span>
        <select
          className={selectClass}
          value={filters.country}
          onChange={(e) => onChange({ ...filters, country: e.target.value })}
        >
          <option value="all">{t('filters.all')}</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {countryLabel(country, language)}
            </option>
          ))}
        </select>
      </label>
        {active && (
          <button
            type="button"
            className="btn-secondary col-span-2 !py-1.5 !text-xs"
            onClick={() => onChange(DEFAULT_FILTERS)}
          >
            <FilterX className="h-3.5 w-3.5" aria-hidden />
            {t('filters.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
