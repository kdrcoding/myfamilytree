import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Cake, Heart, Loader2, PartyPopper, Sparkles } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import { isSupabaseConfigured } from '../lib/supabase';

type PublicBirthday = {
  ok: boolean;
  error?: string;
  year?: number;
  person?: {
    id: string;
    name: string;
    age: number | null;
    photoUrl: string | null;
    birthMonthDay: string | null;
    wish?: string;
  };
  cheers?: { name: string; username: string | null }[];
};

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
  if (!res.ok) {
    try {
      return (await res.json()) as PublicBirthday;
    } catch {
      return { ok: false, error: 'failed' };
    }
  }
  return (await res.json()) as PublicBirthday;
}

/**
 * Password-free birthday celebration page linked from the Telegram group post.
 */
export function BirthdayPublicPage() {
  const { personId = '' } = useParams();
  const t = useT();
  const { settings, setLanguage } = useSettings();
  const [data, setData] = useState<PublicBirthday | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [personId]);

  const person = data?.ok ? data.person : null;
  const cheers = data?.ok ? data.cheers ?? [] : [];

  useEffect(() => {
    if (person?.name) {
      document.title = `Happy birthday, ${person.name}! · Oq-Ariq`;
    } else {
      document.title = 'Oq-Ariq OILASI';
    }
  }, [person?.name]);

  return (
    <div className="bday-page relative min-h-dvh overflow-hidden text-stone-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#a7f3d0_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_right,_#fde68a_0%,_transparent_42%),radial-gradient(ellipse_at_bottom_left,_#fbcfe8_0%,_transparent_40%),linear-gradient(165deg,_#ecfdf5_0%,_#fffbeb_45%,_#f0fdf4_100%)]" />

      {/* Floating balloons */}
      <span className="bday-float pointer-events-none absolute left-[8%] top-[18%] text-3xl opacity-80" aria-hidden>
        🎈
      </span>
      <span
        className="bday-float-slow pointer-events-none absolute right-[10%] top-[22%] text-2xl opacity-70"
        aria-hidden
      >
        🎈
      </span>
      <span className="bday-float pointer-events-none absolute left-[14%] bottom-[22%] text-xl opacity-60" aria-hidden>
        ✨
      </span>
      <span
        className="bday-float-slow pointer-events-none absolute right-[16%] bottom-[18%] text-2xl opacity-70"
        aria-hidden
      >
        🎁
      </span>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-10 pt-8 sm:pt-12">
        <div className="flex items-start justify-between gap-3">
          <BrandLogo size="md" className="max-w-[14rem]" />
          <select
            className="rounded-lg border border-emerald-200/80 bg-white/80 px-2 py-1.5 text-xs font-medium text-stone-700 shadow-sm backdrop-blur"
            value={settings.language}
            onChange={(e) => setLanguage(e.target.value as typeof settings.language)}
            aria-label="Language"
          >
            <option value="en">EN</option>
            <option value="uz">UZ</option>
            <option value="ru">RU</option>
          </select>
        </div>

        {loading && !person && (
          <div className="mt-24 flex flex-1 flex-col items-center justify-center gap-3 text-emerald-800">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="text-sm font-medium">{t('bday.loading')}</p>
          </div>
        )}

        {!loading && !person && (
          <div className="mt-20 rounded-3xl border border-stone-200/80 bg-white/80 p-8 text-center shadow-sm backdrop-blur">
            <Cake className="mx-auto h-10 w-10 text-stone-400" aria-hidden />
            <h1 className="mt-4 font-display text-2xl font-semibold text-stone-800">
              {t('bday.notFoundTitle')}
            </h1>
            <p className="mt-2 text-sm text-stone-600">{t('bday.notFoundBody')}</p>
          </div>
        )}

        {person && (
          <main className="mt-6 flex flex-1 flex-col items-center text-center">
            <p className="bday-kicker inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700/90">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t('bday.kicker')}
            </p>

            <div className="bday-photo relative mt-7">
              <div className="bday-ring absolute -inset-3 rounded-full bg-gradient-to-br from-emerald-300/50 via-amber-200/40 to-rose-200/50 blur-[1px]" />
              <span className="absolute -left-4 -top-3 text-2xl drop-shadow-sm" aria-hidden>
                🎉
              </span>
              <span className="absolute -right-3 top-1 text-xl drop-shadow-sm" aria-hidden>
                ✨
              </span>
              {person.photoUrl ? (
                <img
                  src={person.photoUrl}
                  alt=""
                  className="relative h-40 w-40 rounded-full object-cover shadow-xl ring-4 ring-white sm:h-48 sm:w-48"
                />
              ) : (
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-5xl font-bold text-white shadow-xl ring-4 ring-white sm:h-48 sm:w-48">
                  {person.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-2 -right-3 text-3xl drop-shadow-sm" aria-hidden>
                🎂
              </span>
            </div>

            <h1 className="bday-title mt-7 font-display text-3xl font-semibold leading-tight text-emerald-950 sm:text-4xl">
              {t('bday.headline', { name: person.name })}
            </h1>

            {person.age != null && (
              <p className="bday-age mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-800 px-4 py-1.5 text-sm font-semibold text-emerald-50 shadow-md shadow-emerald-900/15">
                <PartyPopper className="h-4 w-4" aria-hidden />
                {t('bday.turning', { age: person.age })}
              </p>
            )}

            <p className="bday-wish mt-5 max-w-sm text-base leading-relaxed text-stone-700">
              {person.wish || t('bday.wish')}
            </p>

            <p className="bday-emoji mt-6 text-2xl tracking-[0.35em]" aria-hidden>
              🎈💚🎁🌟🥳
            </p>

            <section className="bday-cheers mt-10 w-full rounded-3xl border border-emerald-200/70 bg-white/80 p-5 text-left shadow-sm backdrop-blur">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Heart className="h-4 w-4 fill-rose-400 text-rose-500" aria-hidden />
                {cheers.length > 0
                  ? t('bday.cheersTitle', { n: cheers.length })
                  : t('bday.cheersEmptyTitle')}
              </h2>
              {cheers.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {cheers.map((c, i) => (
                    <li
                      key={`${c.name}-${i}`}
                      className="rounded-full border border-rose-100 bg-gradient-to-br from-rose-50 to-emerald-50 px-3 py-1 text-sm text-emerald-950"
                    >
                      {c.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{t('bday.cheersEmpty')}</p>
              )}
            </section>

            <p className="mt-auto pt-10 text-xs text-stone-500">{t('bday.footer')}</p>
          </main>
        )}
      </div>

      <style>{`
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
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.04); }
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
