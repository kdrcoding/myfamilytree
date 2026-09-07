import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Cake, Loader2, Trees } from 'lucide-react';
import { BirthdayWebCard } from '../components/BirthdayWebCard';
import { BrandLogo } from '../components/BrandLogo';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import { prettyLabel } from '../utils/family';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  CARD_DESIGNS,
  birthdayPalette,
  designEmoji,
  normalizeCardGender,
  type CardDesign,
  type CardGender,
} from '../features/birthday/themes';
import {
  fetchPublicBirthday,
  isCardDesign,
  type BirthdayWhen,
  type PublicBirthday,
} from '../features/birthday/publicApi';
import { clearBirthdayPass, markBirthdayPass } from '../lib/birthdayPass';

function isDesign(value: string | null): value is CardDesign {
  return CARD_DESIGNS.includes(value as CardDesign);
}

function previewPortraitUrl(gender: CardGender): string {
  const fill = gender === 'female' ? '#fb7185' : gender === 'male' ? '#3b82f6' : '#34d399';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="120" fill="${fill}"/><circle cx="120" cy="92" r="44" fill="#fff7ed"/><ellipse cx="120" cy="210" rx="78" ry="70" fill="#fff7ed"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function previewPayload(params: URLSearchParams): PublicBirthday {
  if (params.get('when') === 'expired') return { ok: false, error: 'expired' };
  const gender = normalizeCardGender(params.get('gender'));
  const designParam = params.get('design');
  const design: CardDesign = isDesign(designParam) ? designParam : 'balloons';
  const when: BirthdayWhen = params.get('when') === 'yesterday' ? 'yesterday' : 'today';
  const name =
    params.get('name') ||
    (gender === 'female' ? 'Aziza' : gender === 'male' ? 'Ином Эсонмирзаев' : 'Oq-Ariq');
  return {
    ok: true,
    when,
    design,
    year: 2026,
    person: {
      id: '_preview',
      name,
      gender,
      age: gender === 'male' ? 35 : 28,
      photoUrl: params.get('photo') === 'none' ? null : previewPortraitUrl(gender),
      birthMonthDay: '09-06',
      wish:
        when === 'yesterday'
          ? `Kecha ${name}ning tug‘ilgan kuni edi. Oila hanuz tabassumda.`
          : `Tug‘ilgan kuningiz muborak, ${name}! Bu kun yumshoq, iliq va maxsus o‘tsin.`,
      whoLine: gender === 'male' ? 'Feruzaning eri' : gender === 'female' ? 'Inomning xotini' : null,
    },
    cheers: when === 'yesterday' ? [{ name: 'Gulhayo', username: null }] : [],
  };
}

function PageActions({ accent, open }: { accent: string; open: boolean }) {
  const t = useT();
  return (
    <div className="relative z-10 mt-8 w-full space-y-3">
      <Link
        to={open ? '/tree?from=bday' : '/tree'}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold text-white shadow-md"
        style={{ background: accent }}
      >
        <Trees className="h-5 w-5" aria-hidden />
        {t('bday.seeTree')}
      </Link>
      <p className="text-center text-xs leading-relaxed text-stone-500">
        {open ? t('bday.seeTreeHint') : t('bday.seeTreeHintClosed')}
      </p>
    </div>
  );
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
  const [retryKey, setRetryKey] = useState(0);
  const isDevPreview = import.meta.env.DEV && personId === '_preview';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    return () => {
      root.classList.toggle('dark', settings.theme === 'dark');
    };
  }, [settings.theme]);

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
        } else if (next.error === 'expired' || !isRefresh || !hasPerson) {
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
  }, [personId, isDevPreview, searchParams, retryKey]);

  useEffect(() => {
    if (!data) return;
    if (data.ok) {
      markBirthdayPass(isDevPreview ? '_preview' : personId);
      return;
    }
    if (data.error === 'expired' || data.error === 'not_found') {
      clearBirthdayPass();
    }
  }, [data, personId, isDevPreview]);

  const person = data?.ok ? data.person : null;
  const cheers = data?.ok ? data.cheers ?? [] : [];
  const when: BirthdayWhen = data?.when === 'yesterday' ? 'yesterday' : 'today';
  const gender = normalizeCardGender(person?.gender);
  const design: CardDesign = isCardDesign(data?.design) ? data.design : 'balloons';
  const palette = birthdayPalette(gender);
  const emoji = designEmoji(design, gender);
  const expired = data?.error === 'expired';
  const failed = data?.error === 'failed' || data?.error === 'not_configured';

  useEffect(() => {
    const previous = document.title;
    if (person?.name) {
      const shown = prettyLabel(person.name);
      document.title =
        when === 'yesterday'
          ? t('bday.yesterdayHeadline', { name: shown })
          : t('bday.headline', { name: shown });
    } else {
      document.title = 'Oq-Ariq OILASI';
    }
    return () => {
      document.title = previous || 'Oq-Ariq OILASI';
    };
  }, [person?.name, when, t]);

  const langHeader = (
    <div className="flex w-full items-start justify-between gap-3">
      <BrandLogo size="md" className="max-w-[14rem]" />
      <select
        className="rounded-lg border bg-white/85 px-2 py-1.5 text-xs font-medium shadow-sm backdrop-blur"
        style={{
          borderColor: `color-mix(in srgb, ${palette.accent} 35%, #e7e5e4)`,
          color: palette.ink,
        }}
        value={settings.language}
        onChange={(e) => setLanguage(e.target.value as typeof settings.language)}
        aria-label={t('nav.language')}
      >
        <option value="uz">UZ</option>
        <option value="en">EN</option>
        <option value="ru">RU</option>
      </select>
    </div>
  );

  if (person) {
    return (
      <BirthdayWebCard
        person={person}
        when={when}
        design={design}
        cheers={cheers}
        fillPage
        header={langHeader}
        footer={
          <>
            <PageActions accent={palette.accent} open />
            <p className="mt-auto pt-10 text-xs text-stone-500">{t('bday.footer')}</p>
          </>
        }
      />
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-10 pt-8 sm:pt-12">
        {langHeader}

        {loading && (
          <div className="mt-24 flex flex-1 flex-col items-center justify-center gap-3" style={{ color: palette.ink }}>
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="text-sm font-medium">{t('bday.loading')}</p>
          </div>
        )}

        {!loading && (
          <div className="mt-20 rounded-3xl border bg-white/85 p-8 text-center backdrop-blur">
            <Cake className="mx-auto h-10 w-10" style={{ color: palette.accentSoft }} aria-hidden />
            <h1 className="mt-4 font-display text-2xl font-semibold" style={{ color: palette.ink }}>
              {expired
                ? t('bday.expiredTitle')
                : failed
                  ? t('bday.failedTitle')
                  : t('bday.notFoundTitle')}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {expired
                ? t('bday.expiredBody')
                : failed
                  ? t('bday.failedBody')
                  : t('bday.notFoundBody')}
            </p>
            {failed && (
              <button
                type="button"
                className="btn-primary mt-5 inline-flex min-h-11 items-center justify-center"
                onClick={() => {
                  setLoading(true);
                  setRetryKey((n) => n + 1);
                }}
              >
                {t('bday.retry')}
              </button>
            )}
            <PageActions accent={palette.accent} open={false} />
          </div>
        )}
      </div>
      <span className="pointer-events-none absolute left-[8%] top-[22%] text-3xl opacity-40" aria-hidden>
        {emoji[0]}
      </span>
    </div>
  );
}
