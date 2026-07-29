import { useEffect, useMemo, useState } from 'react';
import { Cake, Camera, Flower2, Gem, Heart, Loader2 } from 'lucide-react';
import { useFamily } from '../context/FamilyContext';
import { usePrivacy } from '../hooks/usePrivacy';
import { useLanguage, useT } from '../i18n/useT';
import { listDatedMemories } from '../lib/memories';
import type { FamilyMemory } from '../lib/memories';
import { buildTimeline, groupTimelineByYear } from '../utils/timeline';
import type { TimelineEvent } from '../utils/timeline';
import { formatDate } from '../utils/dates';
import { usePhotoUrl } from '../context/PhotoUrlsContext';
import { Avatar } from '../components/Avatar';

function MemoryThumb({ memory }: { memory: FamilyMemory }) {
  const url = usePhotoUrl(memory.photo);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={memory.title || ''}
      className="mt-2 h-28 w-full rounded-xl object-cover sm:h-36"
      loading="lazy"
    />
  );
}

function EventIcon({ kind }: { kind: TimelineEvent['kind'] }) {
  const className = 'h-4 w-4';
  switch (kind) {
    case 'birth':
      return <Cake className={`${className} text-rose-500`} aria-hidden />;
    case 'death':
      return <Flower2 className={`${className} text-stone-500`} aria-hidden />;
    case 'marriage':
      return <Heart className={`${className} text-pink-500`} aria-hidden />;
    case 'memory':
      return <Camera className={`${className} text-emerald-600`} aria-hidden />;
  }
}

export function TimelinePage() {
  const { people, getPerson } = useFamily();
  const privacy = usePrivacy();
  const t = useT();
  const language = useLanguage();
  const [memories, setMemories] = useState<FamilyMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(true);

  useEffect(() => {
    listDatedMemories().then(
      (rows) => {
        setMemories(rows);
        setLoadingMemories(false);
      },
      () => setLoadingMemories(false),
    );
  }, []);

  const events = useMemo(() => {
    const raw = buildTimeline(people, privacy.showPhoto() ? memories : []);
    return raw.filter((event) => {
      if (event.kind === 'birth' && !privacy.showBirthDate()) return false;
      if (event.kind === 'death' && !privacy.showDeathDate()) return false;
      return true;
    });
  }, [people, memories, privacy]);

  const groups = useMemo(() => groupTimelineByYear(events), [events]);

  const labelFor = (event: TimelineEvent): string => {
    switch (event.kind) {
      case 'birth':
        return t('timeline.born', { name: event.labelNames[0] });
      case 'death':
        return t('timeline.died', { name: event.labelNames[0] });
      case 'marriage':
        return t('timeline.married', {
          a: event.labelNames[0],
          b: event.labelNames[1] ?? '',
        });
      case 'memory':
        return event.memory?.title
          ? t('timeline.memoryTitled', {
              name: event.labelNames[0],
              title: event.memory.title,
            })
          : t('timeline.memory', { name: event.labelNames[0] });
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          {t('timeline.kicker')}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
          {t('timeline.title')}
        </h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">{t('timeline.intro')}</p>
      </header>

      {loadingMemories && (
        <p className="mb-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('timeline.loading')}
        </p>
      )}

      {groups.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800">
            <Gem className="h-6 w-6 text-stone-300" aria-hidden />
          </div>
          <p className="text-sm">{t('timeline.empty')}</p>
        </div>
      ) : (
        <ol className="relative space-y-8 border-l-2 border-emerald-200 pl-6 dark:border-emerald-900">
          {groups.map(({ year, events: yearEvents }) => (
            <li key={year}>
              <h2 className="sticky top-16 z-10 -ml-[1.65rem] mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3.5 py-1 text-sm font-bold text-white shadow-md shadow-emerald-900/20">
                {year}
              </h2>
              <ul className="space-y-3">
                {yearEvents.map((event) => {
                  const person = getPerson(event.personIds[0]);
                  return (
                    <li key={event.id} className="card relative p-4 transition-shadow hover:shadow-md">
                      <span className="absolute -left-[1.9rem] top-5 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-emerald-300 dark:bg-stone-950 dark:ring-emerald-800">
                        <EventIcon kind={event.kind} />
                      </span>
                      <div className="flex items-start gap-3">
                        {person && <Avatar person={person} size="sm" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-stone-900 dark:text-stone-100">
                            {labelFor(event)}
                          </p>
                          <p className="text-sm text-stone-500">
                            {formatDate(event.date, language)}
                          </p>
                          {event.kind === 'memory' && event.memory?.caption && (
                            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                              {event.memory.caption}
                            </p>
                          )}
                          {event.kind === 'memory' && event.memory && privacy.showPhoto() && (
                            <MemoryThumb memory={event.memory} />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
