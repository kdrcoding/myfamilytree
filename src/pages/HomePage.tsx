import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Network, ShieldCheck, UserRoundPlus, Users } from 'lucide-react';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { useFamily } from '../context/FamilyContext';
import { useLanguage, useT } from '../i18n/useT';
import { computeStats } from '../utils/stats';
import { findFounders, fullName } from '../utils/family';
import { formatDate } from '../utils/dates';
import { usePrivacy } from '../hooks/usePrivacy';
import { Avatar } from '../components/Avatar';

export function HomePage() {
  const { people } = useFamily();
  const privacy = usePrivacy();
  const t = useT();
  const language = useLanguage();
  const [joinOpen, setJoinOpen] = useState(false);
  const stats = useMemo(() => computeStats(people), [people]);
  const founders = useMemo(() => findFounders(people).slice(0, 2), [people]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      {/* Hero */}
      <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-stone-900 px-6 py-16 text-emerald-50 shadow-xl sm:px-12 sm:py-20">
        <Network
          className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rotate-12 text-emerald-700/30"
          aria-hidden
        />
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
          {t('home.kicker')}
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          {t('home.title')}
        </h1>
        <p className="mt-4 max-w-2xl text-emerald-100/90">
          {t('home.intro', { countries: Math.max(stats.countries.length, 1) })}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/tree"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-emerald-900 shadow transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-white"
          >
            {t('home.explore')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/members"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 px-5 py-3 font-semibold text-emerald-50 transition-colors hover:bg-emerald-800/60 focus-visible:ring-2 focus-visible:ring-white"
          >
            <Users className="h-4 w-4" aria-hidden />
            {t('home.browse')}
          </Link>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 px-5 py-3 font-semibold text-emerald-50 transition-colors hover:bg-emerald-800/60 focus-visible:ring-2 focus-visible:ring-white"
          >
            <UserRoundPlus className="h-4 w-4" aria-hidden />
            {t('home.addSelf')}
          </button>
        </div>
      </section>

      {/* Summary stats */}
      <section aria-label="Family summary" className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('home.statMembers'), value: stats.total },
          { label: t('home.statGenerations'), value: stats.generations },
          { label: t('home.statLiving'), value: stats.living },
          { label: t('home.statCountries'), value: stats.countries.length },
        ].map((item) => (
          <div key={item.label} className="card p-5 text-center">
            <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {item.value}
            </p>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{item.label}</p>
          </div>
        ))}
      </section>

      {/* Founding couple */}
      {founders.length > 0 && (
        <section className="card mt-8 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Heart className="h-5 w-5 text-rose-500" aria-hidden />
            {t('home.foundersTitle')}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {founders.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4 dark:bg-stone-800/60"
              >
                <Avatar person={person} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 dark:text-stone-100">
                    {fullName(person)}
                  </p>
                  {privacy.showBirthDate() && person.birthDate && (
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {t('home.born', { date: formatDate(person.birthDate, language) })}
                      {person.country
                        ? ` · ${privacy.showCity() && person.city ? person.city + ', ' : ''}${person.country}`
                        : ''}
                    </p>
                  )}
                  {privacy.showOccupation() && person.occupation && (
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {person.occupation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Privacy notice */}
      <section className="mb-10 mt-8 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          <strong>{t('home.privacyStrong')}</strong> {t('home.privacyBefore')}
          <Link to="/settings" className="underline">
            {t('home.settingsLink')}
          </Link>
          {t('home.privacyAfter')}
        </p>
      </section>

      {joinOpen && <JoinFamilyModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
