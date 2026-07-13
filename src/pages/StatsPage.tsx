import { useMemo } from 'react';
import {
  Baby,
  Cake,
  Earth,
  Flower2,
  HeartPulse,
  Layers,
  MapPin,
  Sigma,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useFamily } from '../context/FamilyContext';
import { computeStats } from '../utils/stats';
import { fullName } from '../utils/family';

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xl font-bold text-stone-900 dark:text-stone-100">
          {value}
        </p>
        {hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
      </div>
    </div>
  );
}

const BAR_COLORS = ['bg-emerald-500', 'bg-sky-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500'];

function BarChart({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
      <ul className="mt-4 space-y-3">
        {data.map((item, i) => (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-stone-700 dark:text-stone-300">{item.label}</span>
              <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {item.count}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
              <div
                role="img"
                aria-label={`${item.label}: ${item.count}`}
                className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatsPage() {
  const { people } = useFamily();
  const stats = useMemo(() => computeStats(people), [people]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Family statistics</h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Calculated live from the current family data — every edit updates these numbers.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Sigma className="h-5 w-5" aria-hidden />}
          label="Total members"
          value={stats.total}
        />
        <StatCard
          icon={<HeartPulse className="h-5 w-5" aria-hidden />}
          label="Living"
          value={stats.living}
        />
        <StatCard
          icon={<Flower2 className="h-5 w-5" aria-hidden />}
          label="Deceased"
          value={stats.deceased}
        />
        <StatCard
          icon={<Layers className="h-5 w-5" aria-hidden />}
          label="Generations"
          value={stats.generations}
        />
        <StatCard
          icon={<Earth className="h-5 w-5" aria-hidden />}
          label="Countries"
          value={stats.countries.length}
          hint={stats.countries.slice(0, 4).join(', ')}
        />
        <StatCard
          icon={<MapPin className="h-5 w-5" aria-hidden />}
          label="Cities"
          value={stats.cities.length}
        />
        <StatCard
          icon={<Cake className="h-5 w-5" aria-hidden />}
          label="Oldest living"
          value={stats.oldestLiving ? `${stats.oldestLiving.age} yrs` : '—'}
          hint={stats.oldestLiving ? fullName(stats.oldestLiving.person) : 'No data'}
        />
        <StatCard
          icon={<Baby className="h-5 w-5" aria-hidden />}
          label="Youngest living"
          value={stats.youngestLiving ? `${stats.youngestLiving.age} yrs` : '—'}
          hint={stats.youngestLiving ? fullName(stats.youngestLiving.person) : 'No data'}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
          label="Average age (living)"
          value={stats.averageAge !== null ? `${stats.averageAge} yrs` : '—'}
          hint={stats.averageAge === null ? 'Needs more birth dates' : undefined}
        />
        <StatCard
          icon={<Users className="h-5 w-5" aria-hidden />}
          label="Most children"
          value={stats.mostChildren ? stats.mostChildren.count : '—'}
          hint={stats.mostChildren ? fullName(stats.mostChildren.person) : undefined}
        />
        <StatCard
          icon={<Users className="h-5 w-5" aria-hidden />}
          label="Most descendants"
          value={stats.mostDescendants ? stats.mostDescendants.count : '—'}
          hint={stats.mostDescendants ? fullName(stats.mostDescendants.person) : undefined}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BarChart title="Gender" data={stats.genderSplit} />
        <BarChart
          title="People per generation"
          data={stats.perGeneration.map((g) => ({
            label: `Generation ${g.generation}`,
            count: g.count,
          }))}
        />
        <BarChart
          title="People per country"
          data={stats.perCountry.map((c) => ({ label: c.country, count: c.count }))}
        />
      </div>
    </div>
  );
}
