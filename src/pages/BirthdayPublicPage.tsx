import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Cake, Heart, Loader2, PartyPopper, Sparkles } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  CARD_DESIGNS,
  CARD_PALETTES,
  DESIGN_EMOJI,
  normalizeCardGender,
  type CardDesign,
  type CardGender,
} from '../features/birthday/themes';

type When = 'today' | 'yesterday';

type PublicBirthday = {
  ok: boolean;
  error?: string;
  when?: When;
  design?: CardDesign;
  year?: number;
  person?: {
    id: string;
    name: string;
    gender?: CardGender;
    age: number | null;
    photoUrl: string | null;
    birthMonthDay: string | null;
    wish?: string;
  };
  cheers?: { name: string; username: string | null }[];
};

function isDesign(value: string | null): value is CardDesign {
  return CARD_DESIGNS.includes(value as CardDesign);
}

async function fetchPublicBirthday(personId: string): Promise<PublicBirthday> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon) return { ok: false, error: 'not_configured' };

  const res = await fetch(
    `${base}/functions/v1/birthday-public?personId=${encodeURIComponent(personId)}`,
    {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
    },
  );
  try {
    return (await res.json()) as PublicBirthday;
  } catch {
    return { ok: false, error: 'failed' };
  }
}

function previewPayload(params: URLSearchParams): PublicBirthday {
  if (params.get('when') === 'expired') return { ok: false, error: 'expired' };
  const gender = normalizeCardGender(params.get('gender'));
  const designParam = params.get('design');
  const design: CardDesign = isDesign(designParam) ? designParam : 'balloons';
  const when: When = params.get('when') === 'yesterday' ? 'yesterday' : 'today';
  const name =
    params.get('name') || (gender === 'female' ? 'Aziza' : gender === 'male' ? 'Inom' : 'Oq-Ariq');
  return {
    ok: true,
    when,
    design,
    year: 2026,
    person: {
      id: '_preview',
      name,
      gender,
      age: 28,
      photoUrl: null,
      birthMonthDay: '09-06',
      wish:
        when === 'yesterday'
          ? `Kecha ${name}ning tug‘ilgan kuni edi. Oila hanuz tabassumda.`
          : `Tug‘ilgan kuningiz muborak, ${name}! Bu kun yumshoq, iliq va maxsus o‘tsin.`,
    },
    cheers: when === 'yesterday' ? [{ name: 'Gulhayo', username: null }] : [],
  };
}

/**
 * Password-free birthday celebration page linked from the Telegram group post.
 */
export function BirthdayPublicPage() {
  const { personId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const t = useT();
  const { settings, setLanguage } = useSettings();
  const [data, setData] = useState<PublicBirthday | null>(null);
  const [loading, setLoading] = useState(true);
  const isDevPreview = import.meta.env.DEV && personId === '_preview';

  useEffect(() => {
    if (isDevPreview) {
      setData(previewPayload(searchParams));
      setLoading(false);
      return;
    }

    let cancelled = false;
    let hasPerson = false;
    const load = async (isRefresh: boolean) => {
      try {
        if (!personId || !isSupabaseConfigured) {
          if (!cancelled) setData({ ok: false, error: 'not_found' });
          return;
        }
        const next = await fetchPublicBirthday(personId);
        if (cancelled) return;
        if (next.ok) {
          hasPerson = true;
          setData(next);
        } else if (!isRefresh || !hasPerson) {
          setData(next);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled && (!isRefresh || !hasPerson)) {
          setData({ ok: false, error: 'failed' });
        }
      } finally {
        if (!cancelled && !isRefresh) setLoading(false);
      }
    };

    setLoading(true);
    void load(false);
    const timer = window.setInterval(() => void load(true), 25000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [personId, isDevPreview, searchParams]);

  const person = data?.ok ? data.person : null;
  const cheers = data?.ok ? data.cheers ?? [] : [];
  const when: When = data?.when === 'yesterday' ? 'yesterday' : 'today';
  const gender = normalizeCardGender(person?.gender);
  const design: CardDesign = isDesign(data?.design ?? null) ? data!.design! : 'balloons';
  const palette = CARD_PALETTES[gender];
  const emoji = DESIGN_EMOJI[design];
  const expired = data?.error === 'expired';

  const headline = useMemo(() => {
    if (!person) return '';
    if (when === 'yesterday') {
      if (gender === 'female') return t('bday.yesterdayHer');
      if (gender === 'male') return t('bday.yesterdayHis');
      return t('bday.yesterdayHeadline', { name: person.name });
    }
    return t('bday.headline', { name: person.name });
  }, [person, when, gender, t]);

  useEffect(() => {
    if (person?.name) {
      document.title =
        when === 'yesterday'
          ? `${person.name} · Oq-Ariq`
          : `Tug‘ilgan kun, ${person.name}! · Oq-Ariq`;
    } else {
      document.title = 'Oq-Ariq OILASI';
    }
  }, [person?.name, when]);

  const pageStyle = {
    '--bday-bg-a': palette.bgA,
    '--bday-bg-b': palette.bgB,
    '--bday-bg-c': palette.bgC,
    '--bday-card-a': palette.cardA,
    '--bday-card-b': palette.cardB,
    '--bday-accent': palette.accent,
    '--bday-accent-soft': palette.accentSoft,
    '--bday-ink': palette.ink,
    '--bday-muted': palette.muted,
    '--bday-c0': palette.confetti[0],
    '--bday-c1': palette.confetti[1],
    '--bday-c2': palette.confetti[2],
    '--bday-c3': palette.confetti[3],
  } as CSSProperties;

  return (
    <div
      className={`bday-page relative min-h-dvh overflow-hidden ${when === 'yesterday' ? 'bday-yesterday' : ''}`}
      data-design={design}
      data-gender={gender}
      style={pageStyle}
    >
      <div className="bday-wash pointer-events-none absolute inset-0" />
      <span className="bday-float pointer-events-none absolute left-[7%] top-[16%] text-4xl" aria-hidden>
        {emoji[0]}
      </span>
      <span className="bday-float-slow pointer-events-none absolute right-[8%] top-[20%] text-3xl" aria-hidden>
        {emoji[1]}
      </span>
      <span className="bday-float pointer-events-none absolute left-[12%] bottom-[18%] text-2xl" aria-hidden>
        {emoji[2]}
      </span>
      <span className="bday-float-slow pointer-events-none absolute right-[14%] bottom-[16%] text-3xl" aria-hidden>
        {emoji[3]}
      </span>
      <span className="bday-orb bday-orb-a pointer-events-none absolute -left-16 top-24 h-44 w-44 rounded-full" />
      <span className="bday-orb bday-orb-b pointer-events-none absolute -right-12 bottom-28 h-52 w-52 rounded-full" />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-10 pt-8 sm:pt-12">
        <div className="flex items-start justify-between gap-3">
          <BrandLogo size="md" className="max-w-[14rem]" />
          <select
            className="bday-lang rounded-lg border bg-white/85 px-2 py-1.5 text-xs font-medium shadow-sm backdrop-blur"
            value={settings.language}
            onChange={(e) => setLanguage(e.target.value as typeof settings.language)}
            aria-label="Language"
          >
            <option value="uz">UZ</option>
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>
        </div>

        {loading && !person && (
          <div className="mt-24 flex flex-1 flex-col items-center justify-center gap-3" style={{ color: palette.ink }}>
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="text-sm font-medium">{t('bday.loading')}</p>
          </div>
        )}

        {!loading && !person && (
          <div className="bday-empty mt-20 rounded-3xl border bg-white/85 p-8 text-center backdrop-blur">
            <Cake className="mx-auto h-10 w-10" style={{ color: palette.accentSoft }} aria-hidden />
            <h1 className="mt-4 font-display text-2xl font-semibold" style={{ color: palette.ink }}>
              {expired ? t('bday.expiredTitle') : t('bday.notFoundTitle')}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {expired ? t('bday.expiredBody') : t('bday.notFoundBody')}
            </p>
          </div>
        )}

        {person && (
          <main className="mt-6 flex flex-1 flex-col items-center text-center">
            <p className="bday-kicker inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.28em]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {when === 'yesterday' ? t('bday.yesterdayKicker') : t('bday.kicker')}
            </p>

            <div className="bday-photo relative mt-7">
              <div className="bday-ring absolute -inset-3 rounded-full" />
              <span className="absolute -left-4 -top-3 text-2xl drop-shadow-sm" aria-hidden>
                {emoji[0]}
              </span>
              <span className="absolute -right-3 top-1 text-xl drop-shadow-sm" aria-hidden>
                {emoji[3]}
              </span>
              {person.photoUrl ? (
                <img
                  src={person.photoUrl}
                  alt=""
                  className="relative h-40 w-40 rounded-full object-cover ring-4 ring-white sm:h-48 sm:w-48"
                />
              ) : (
                <div className="bday-fallback relative flex h-40 w-40 items-center justify-center rounded-full text-5xl font-bold text-white ring-4 ring-white sm:h-48 sm:w-48">
                  {person.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-2 -right-3 text-3xl drop-shadow-sm" aria-hidden>
                {emoji[1]}
              </span>
            </div>

            <h1 className="bday-title mt-7 font-display text-3xl font-semibold leading-tight sm:text-4xl">
              {when === 'yesterday' ? t('bday.yesterdayHeadline', { name: person.name }) : headline}
            </h1>
            {when === 'yesterday' && (gender === 'female' || gender === 'male') && (
              <p className="bday-gender-note mt-2 text-sm font-semibold">{headline}</p>
            )}

            {person.age != null && (
              <p className="bday-age mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white">
                <PartyPopper className="h-4 w-4" aria-hidden />
                {when === 'yesterday'
                  ? t('bday.turningYesterday', { age: person.age })
                  : t('bday.turning', { age: person.age })}
              </p>
            )}

            <p className="bday-wish mt-5 max-w-sm text-base leading-relaxed">
              {person.wish || (when === 'yesterday' ? t('bday.yesterdayWish') : t('bday.wish'))}
            </p>

            <p className="bday-emoji mt-6 text-2xl tracking-[0.35em]" aria-hidden>
              {emoji.join(' ')}
            </p>

            <section className="bday-cheers mt-10 w-full rounded-3xl border bg-white/80 p-5 text-left backdrop-blur">
              <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: palette.ink }}>
                <Heart className="h-4 w-4 fill-current" aria-hidden />
                {cheers.length > 0
                  ? t('bday.cheersTitle', { n: cheers.length })
                  : when === 'yesterday'
                    ? t('bday.cheersYesterday')
                    : t('bday.cheersEmptyTitle')}
              </h2>
              {cheers.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {cheers.map((c, i) => (
                    <li key={`${c.name}-${i}`} className="bday-chip rounded-full border px-3 py-1 text-sm">
                      {c.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {when === 'yesterday' ? t('bday.yesterdayWish') : t('bday.cheersEmpty')}
                </p>
              )}
            </section>

            <p className="mt-auto pt-10 text-xs text-stone-500">{t('bday.footer')}</p>
          </main>
        )}
      </div>

      <style>{`
        .bday-wash {
          background:
            radial-gradient(ellipse at top, color-mix(in srgb, var(--bday-c0) 55%, white) 0%, transparent 52%),
            radial-gradient(ellipse at bottom right, color-mix(in srgb, var(--bday-c2) 45%, white) 0%, transparent 46%),
            radial-gradient(ellipse at bottom left, color-mix(in srgb, var(--bday-c3) 40%, white) 0%, transparent 42%),
            linear-gradient(165deg, var(--bday-card-a) 0%, white 48%, var(--bday-card-b) 100%);
        }
        .bday-orb-a { background: color-mix(in srgb, var(--bday-c0) 35%, transparent); filter: blur(8px); }
        .bday-orb-b { background: color-mix(in srgb, var(--bday-c1) 30%, transparent); filter: blur(10px); }
        .bday-kicker { color: var(--bday-muted); }
        .bday-title { color: var(--bday-ink); }
        .bday-gender-note { color: var(--bday-muted); }
        .bday-wish { color: color-mix(in srgb, var(--bday-ink) 78%, #57534e); }
        .bday-age { background: var(--bday-accent); box-shadow: 0 10px 24px color-mix(in srgb, var(--bday-accent) 28%, transparent); }
        .bday-fallback { background: linear-gradient(145deg, var(--bday-bg-b), var(--bday-bg-a)); }
        .bday-ring { background: linear-gradient(135deg, var(--bday-c0), var(--bday-c2), var(--bday-c3)); opacity: 0.55; filter: blur(1px); }
        .bday-lang { border-color: color-mix(in srgb, var(--bday-accent) 35%, #e7e5e4); color: var(--bday-ink); }
        .bday-cheers { border-color: color-mix(in srgb, var(--bday-accent) 22%, #e7e5e4); }
        .bday-chip {
          border-color: color-mix(in srgb, var(--bday-accent) 20%, white);
          background: linear-gradient(135deg, var(--bday-card-a), var(--bday-card-b));
          color: var(--bday-ink);
        }
        .bday-empty { border-color: color-mix(in srgb, var(--bday-accent) 18%, #e7e5e4); }
        .bday-yesterday .bday-wash { filter: saturate(0.82); }
        .bday-yesterday .bday-float, .bday-yesterday .bday-float-slow { opacity: 0.55; }
        .bday-kicker { animation: bday-fade 0.7s ease-out both; }
        .bday-photo { animation: bday-pop 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both; }
        .bday-title { animation: bday-fade 0.8s ease-out 0.18s both; }
        .bday-age { animation: bday-fade 0.8s ease-out 0.28s both; }
        .bday-wish { animation: bday-fade 0.8s ease-out 0.38s both; }
        .bday-emoji { animation: bday-fade 0.8s ease-out 0.48s both; }
        .bday-cheers { animation: bday-fade 0.8s ease-out 0.55s both; }
        .bday-ring { animation: bday-glow 2.8s ease-in-out infinite; }
        .bday-float { animation: bday-bob 4.5s ease-in-out infinite; }
        .bday-float-slow { animation: bday-bob 6.2s ease-in-out 0.8s infinite; }
        @keyframes bday-fade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bday-pop {
          from { opacity: 0; transform: scale(0.84); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bday-glow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.04); }
        }
        @keyframes bday-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bday-kicker, .bday-photo, .bday-title, .bday-age, .bday-wish,
          .bday-emoji, .bday-cheers, .bday-ring, .bday-float, .bday-float-slow {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
