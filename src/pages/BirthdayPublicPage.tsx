import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Cake, Heart, Loader2, PartyPopper } from 'lucide-react';
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
    setLoading(true);
    void (async () => {
      try {
        if (!personId || !isSupabaseConfigured) {
          if (!cancelled) setData({ ok: false, error: 'not_found' });
          return;
        }
        const next = await fetchPublicBirthday(personId);
        if (!cancelled) setData(next);
      } catch (error) {
        console.error(error);
        if (!cancelled) setData({ ok: false, error: 'failed' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  const person = data?.ok ? data.person : null;
  const cheers = data?.ok ? data.cheers ?? [] : [];

  return (
    <div className="bday-page relative min-h-dvh overflow-hidden text-stone-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#a7f3d0_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_#fde68a_0%,_transparent_45%),linear-gradient(165deg,_#ecfdf5_0%,_#fff7ed_48%,_#f0fdf4_100%)]" />
      <div className="pointer-events-none absolute -left-16 top-24 h-40 w-40 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-20 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl" />

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

        {loading && (
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

        {!loading && person && (
          <main className="mt-8 flex flex-1 flex-col items-center text-center">
            <p className="bday-kicker text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700/90">
              {t('bday.kicker')}
            </p>

            <div className="bday-photo relative mt-6">
              <span className="absolute -left-3 -top-2 text-2xl" aria-hidden>
                🎉
              </span>
              <span className="absolute -right-2 top-0 text-xl" aria-hidden>
                ✨
              </span>
              {person.photoUrl ? (
                <img
                  src={person.photoUrl}
                  alt=""
                  className="h-36 w-36 rounded-full object-cover shadow-lg ring-4 ring-white sm:h-44 sm:w-44"
                />
              ) : (
                <div className="flex h-36 w-36 items-center justify-center rounded-full bg-emerald-700 text-4xl font-bold text-white shadow-lg ring-4 ring-white sm:h-44 sm:w-44">
                  {person.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1 -right-2 text-2xl" aria-hidden>
                🎂
              </span>
            </div>

            <h1 className="bday-title mt-6 font-display text-3xl font-semibold leading-tight text-emerald-950 sm:text-4xl">
              {t('bday.headline', { name: person.name })}
            </h1>

            {person.age != null && (
              <p className="bday-age mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-800 px-4 py-1.5 text-sm font-semibold text-emerald-50 shadow-sm">
                <PartyPopper className="h-4 w-4" aria-hidden />
                {t('bday.turning', { age: person.age })}
              </p>
            )}

            <p className="bday-wish mt-5 max-w-sm text-base leading-relaxed text-stone-700">
              {t('bday.wish')}
            </p>

            <p className="mt-6 text-2xl tracking-widest" aria-hidden>
              🎈 💚 🎁 🌟 🥳
            </p>

            {cheers.length > 0 && (
              <section className="bday-cheers mt-10 w-full rounded-3xl border border-emerald-200/70 bg-white/75 p-5 text-left shadow-sm backdrop-blur">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <Heart className="h-4 w-4 text-rose-500" aria-hidden />
                  {t('bday.cheersTitle', { n: cheers.length })}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {cheers.map((c, i) => (
                    <li
                      key={`${c.name}-${i}`}
                      className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm text-emerald-900"
                    >
                      {c.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-auto pt-10 text-xs text-stone-500">{t('bday.footer')}</p>
          </main>
        )}
      </div>

      <style>{`
        .bday-kicker { animation: bday-fade 0.7s ease-out both; }
        .bday-photo { animation: bday-pop 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
        .bday-title { animation: bday-fade 0.8s ease-out 0.2s both; }
        .bday-age { animation: bday-fade 0.8s ease-out 0.32s both; }
        .bday-wish { animation: bday-fade 0.8s ease-out 0.42s both; }
        .bday-cheers { animation: bday-fade 0.8s ease-out 0.55s both; }
        @keyframes bday-fade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bday-pop {
          from { opacity: 0; transform: scale(0.86); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
