import { FilterX } from 'lucide-react';
import type { Filters } from '../utils/filters';
import { DEFAULT_FILTERS, hasActiveFilters } from '../utils/filters';
import type { Gender } from '../types/family';
import { useT } from '../i18n/useT';

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
  const selectClass = compact ? 'input !w-auto !py-1.5 !text-xs' : 'input';
  const active = hasActiveFilters(filters);

  return (
    <div className={`flex flex-wrap items-end gap-2 ${compact ? '' : 'sm:gap-3'}`}>
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
              {country}
            </option>
          ))}
        </select>
      </label>
      {active && (
        <button
          type="button"
          className="btn-secondary !py-1.5 !text-xs"
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          <FilterX className="h-3.5 w-3.5" aria-hidden />
          {t('filters.clear')}
        </button>
      )}
    </div>
  );
}
