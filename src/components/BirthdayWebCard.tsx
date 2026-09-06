import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Heart, PartyPopper, Sparkles } from 'lucide-react';
import { useLanguage, useT } from '../i18n/useT';
import {
  CARD_PALETTES,
  designEmoji,
  normalizeCardGender,
  partyStickers,
  type CardDesign,
  type CardGender,
} from '../features/birthday/themes';
import {
  isVisiblePhotoUrl,
  type BirthdayWhen,
  type PublicBirthday,
} from '../features/birthday/publicApi';
import { webBirthdayWish } from '../features/birthday/pageWishes';
import { prettyLabel } from '../utils/family';

const BIRTHDAY_CARD_CSS = `
  .bday-web .bday-wash {
    background:
      radial-gradient(ellipse at top, color-mix(in srgb, var(--bday-c0) 55%, white) 0%, transparent 52%),
      radial-gradient(ellipse at bottom right, color-mix(in srgb, var(--bday-c2) 45%, white) 0%, transparent 46%),
      radial-gradient(ellipse at bottom left, color-mix(in srgb, var(--bday-c3) 40%, white) 0%, transparent 42%),
      linear-gradient(165deg, var(--bday-card-a) 0%, white 48%, var(--bday-card-b) 100%);
  }
  .bday-web .bday-orb-a { background: color-mix(in srgb, var(--bday-c0) 35%, transparent); filter: blur(8px); }
  .bday-web .bday-orb-b { background: color-mix(in srgb, var(--bday-c1) 30%, transparent); filter: blur(10px); }
  .bday-web .bday-stage { border-color: color-mix(in srgb, var(--bday-accent) 22%, #e7e5e4); }
  .bday-web .bday-from { background: color-mix(in srgb, var(--bday-accent) 14%, white); color: var(--bday-ink); }
  .bday-web .bday-kicker { color: var(--bday-muted); }
  .bday-web .bday-title { color: var(--bday-ink); }
  .bday-web .bday-who {
    color: var(--bday-ink);
    background: color-mix(in srgb, var(--bday-accent) 10%, white);
    border-color: color-mix(in srgb, var(--bday-accent) 22%, #e7e5e4);
  }
  .bday-web .bday-gender-note { color: var(--bday-muted); }
  .bday-web .bday-wish { color: color-mix(in srgb, var(--bday-ink) 78%, #57534e); }
  .bday-web .bday-age { background: var(--bday-accent); box-shadow: 0 10px 24px color-mix(in srgb, var(--bday-accent) 28%, transparent); }
  .bday-web .bday-fallback { background: linear-gradient(145deg, var(--bday-bg-b), var(--bday-bg-a)); }
  .bday-web .bday-ring { background: linear-gradient(135deg, var(--bday-c0), var(--bday-c2), var(--bday-c3)); opacity: 0.55; filter: blur(1px); }
  .bday-web .bday-cheers { border-color: color-mix(in srgb, var(--bday-accent) 22%, #e7e5e4); }
  .bday-web .bday-chip {
    border-color: color-mix(in srgb, var(--bday-accent) 20%, white);
    background: linear-gradient(135deg, var(--bday-card-a), var(--bday-card-b));
    color: var(--bday-ink);
  }
  .bday-web.bday-yesterday .bday-wash { filter: saturate(0.82); }
  .bday-web.bday-yesterday .bday-float, .bday-web.bday-yesterday .bday-float-slow { opacity: 0.55; }
  .bday-web .bday-kicker { animation: bday-fade 0.7s ease-out both; }
  .bday-web .bday-photo { animation: bday-pop 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both; }
  .bday-web .bday-title { animation: bday-fade 0.8s ease-out 0.18s both; }
  .bday-web .bday-who { animation: bday-fade 0.8s ease-out 0.22s both; }
  .bday-web .bday-age { animation: bday-fade 0.8s ease-out 0.28s both; }
  .bday-web .bday-wish { animation: bday-fade 0.8s ease-out 0.38s both; }
  .bday-web .bday-emoji { animation: bday-fade 0.8s ease-out 0.48s both; }
  .bday-web .bday-cheers { animation: bday-fade 0.8s ease-out 0.55s both; }
  .bday-web .bday-ring { animation: bday-glow 2.8s ease-in-out infinite; }
  .bday-web .bday-float { animation: bday-bob 4.5s ease-in-out infinite; }
  .bday-web .bday-float-slow { animation: bday-bob 6.2s ease-in-out 0.8s infinite; }
  .bday-web .bday-wiggle { animation: bday-wiggle 3.4s ease-in-out infinite; }
  .bday-web .bday-confetti span { animation: bday-fall linear infinite; }
  @keyframes bday-fade {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes bday-pop {
    from { transform: scale(0.84); }
    to { transform: scale(1); }
  }
  @keyframes bday-glow {
    0%, 100% { opacity: 0.45; transform: scale(1); }
    50% { opacity: 0.9; transform: scale(1.04); }
  }
  @keyframes bday-bob {
    0%, 100% { transform: translateY(0) rotate(-6deg); }
    50% { transform: translateY(-16px) rotate(8deg); }
  }
  @keyframes bday-wiggle {
    0%, 100% { transform: rotate(-8deg) scale(1); }
    50% { transform: rotate(10deg) scale(1.08); }
  }
  @keyframes bday-fall {
    0% { transform: translateY(-12%) rotate(0deg); opacity: 0; }
    12% { opacity: 1; }
    100% { transform: translateY(118%) rotate(220deg); opacity: 0.15; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bday-web .bday-kicker, .bday-web .bday-photo, .bday-web .bday-title, .bday-web .bday-who, .bday-web .bday-age, .bday-web .bday-wish,
    .bday-web .bday-emoji, .bday-web .bday-cheers, .bday-web .bday-ring, .bday-web .bday-float, .bday-web .bday-float-slow,
    .bday-web .bday-wiggle, .bday-web .bday-confetti span {
      animation: none !important;
    }
  }
`;

function paletteStyle(gender: CardGender): CSSProperties {
  const palette = CARD_PALETTES[gender];
  return {
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
}

type CelebrationPerson = NonNullable<PublicBirthday['person']>;

interface BirthdayWebCardProps {
  person: CelebrationPerson;
  when?: BirthdayWhen;
  design: CardDesign;
  cheers?: { name: string; username: string | null }[];
  compact?: boolean;
  /** Full-viewport celebration (public /bday page). */
  fillPage?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}

function Bunting({ colors }: { colors: [string, string, string, string] }) {
  const flags = Array.from({ length: 11 }, (_, i) => colors[i % colors.length]!);
  return (
    <svg className="mx-auto mb-3 h-8 w-full max-w-sm" viewBox="0 0 330 36" aria-hidden>
      <path d="M4 6 H326" stroke={colors[0]} strokeWidth="2" fill="none" />
      {flags.map((fill, i) => {
        const x = 8 + i * 29;
        return <path key={i} d={`M${x} 8 L${x + 13} 30 L${x + 26} 8 Z`} fill={fill} opacity="0.92" />;
      })}
    </svg>
  );
}

/**
 * Shared web celebration (photo, wish, cheers) used on /bday/:id and Home.
 * This is not the Telegram PNG card.
 */
export function BirthdayWebCard({
  person,
  when = 'today',
  design,
  cheers = [],
  compact = false,
  fillPage = false,
  header,
  footer,
}: BirthdayWebCardProps) {
  const t = useT();
  const language = useLanguage();
  const [photoFailed, setPhotoFailed] = useState(false);
  const gender = normalizeCardGender(person.gender);
  const emoji = designEmoji(design, gender);
  const stickers = partyStickers(gender);
  const palette = CARD_PALETTES[gender];
  const photoSrc =
    isVisiblePhotoUrl(person.photoUrl) && !photoFailed ? person.photoUrl : null;

  useEffect(() => {
    setPhotoFailed(false);
  }, [person.photoUrl]);

  const shownName = prettyLabel(person.name);
  const whoLine = person.whoLine ? prettyLabel(person.whoLine) : null;
  const headline = useMemo(() => {
    if (when === 'yesterday') {
      if (gender === 'female') return t('bday.yesterdayHer');
      if (gender === 'male') return t('bday.yesterdayHis');
      return t('bday.yesterdayHeadline', { name: shownName });
    }
    return t('bday.headline', { name: shownName });
  }, [shownName, when, gender, t]);

  const photoSize = compact
    ? 'h-32 w-32 sm:h-40 sm:w-40'
    : 'h-44 w-44 sm:h-56 sm:w-56';

  return (
    <div
      className={`bday-web relative overflow-hidden ${when === 'yesterday' ? 'bday-yesterday' : ''} ${
        fillPage ? 'min-h-dvh' : ''
      } ${compact ? 'rounded-[1.75rem] border border-white/40 shadow-lg' : ''}`}
      data-design={design}
      data-gender={gender}
      style={paletteStyle(gender)}
    >
      <div className="bday-wash pointer-events-none absolute inset-0" />
      {!compact && (
      <div className="bday-confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {stickers.map((sticker, i) => (
          <span
            key={`fall-${sticker}-${i}`}
            className="absolute"
            style={{
              left: `${6 + ((i * 17) % 88)}%`,
              top: `-${8 + (i % 5)}%`,
              fontSize: 18 + (i % 5) * 4,
              animationDuration: `${3.6 + (i % 6) * 0.45}s`,
              animationDelay: `${(i % 8) * 0.28}s`,
            }}
          >
            {sticker}
          </span>
        ))}
      </div>
      )}
      <span className="bday-float pointer-events-none absolute left-[6%] top-[14%] text-4xl" aria-hidden>
        {stickers[0]}
      </span>
      <span className="bday-float-slow pointer-events-none absolute right-[7%] top-[18%] text-4xl" aria-hidden>
        {stickers[1]}
      </span>
      {!compact && (
        <>
          <span className="bday-wiggle pointer-events-none absolute left-[10%] top-[38%] text-3xl" aria-hidden>
            {stickers[2]}
          </span>
          <span className="bday-float pointer-events-none absolute right-[9%] top-[40%] text-3xl" aria-hidden>
            {stickers[3]}
          </span>
          <span className="bday-float-slow pointer-events-none absolute left-[8%] bottom-[20%] text-3xl" aria-hidden>
            {stickers[4]}
          </span>
          <span className="bday-wiggle pointer-events-none absolute right-[11%] bottom-[18%] text-3xl" aria-hidden>
            {stickers[5]}
          </span>
          <span className="bday-float pointer-events-none absolute left-[18%] top-[8%] text-2xl" aria-hidden>
            {stickers[6]}
          </span>
          <span className="bday-float-slow pointer-events-none absolute right-[20%] top-[10%] text-2xl" aria-hidden>
            {stickers[7]}
          </span>
          <span className="bday-orb bday-orb-a pointer-events-none absolute -left-16 top-24 h-44 w-44 rounded-full" />
          <span className="bday-orb bday-orb-b pointer-events-none absolute -right-12 bottom-28 h-52 w-52 rounded-full" />
        </>
      )}

      <div
        className={`relative z-10 flex flex-col items-center text-center ${
          fillPage ? 'mx-auto min-h-dvh max-w-lg px-5 pb-10 pt-8 sm:pt-12' : compact ? 'px-4 py-6 sm:px-6' : ''
        }`}
      >
        {header}
        <article
          className={`bday-stage relative z-10 w-full rounded-[2rem] border bg-white/90 shadow-lg backdrop-blur-md ${
            compact ? 'px-4 py-6 sm:px-6' : 'px-5 py-8 sm:px-8'
          } ${header ? 'mt-6' : ''}`}
        >
          <Bunting colors={palette.confetti} />
          <p className="bday-kicker inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {when === 'yesterday' ? t('bday.yesterdayKicker') : t('bday.kicker')}
          </p>

          <div className="bday-photo relative mx-auto mt-6">
            <div className="bday-ring pointer-events-none absolute -inset-3 z-0 rounded-full" />
            <span className="bday-wiggle pointer-events-none absolute -left-5 -top-4 z-20 text-3xl drop-shadow-sm" aria-hidden>
              {emoji[0]}
            </span>
            <span className="bday-float pointer-events-none absolute -right-4 top-0 z-20 text-2xl drop-shadow-sm" aria-hidden>
              {emoji[3]}
            </span>
            <span className="bday-float-slow pointer-events-none absolute -left-6 top-1/2 z-20 text-2xl drop-shadow-sm" aria-hidden>
              🥳
            </span>
            <span className="bday-wiggle pointer-events-none absolute -right-6 top-[42%] z-20 text-2xl drop-shadow-sm" aria-hidden>
              🎉
            </span>
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={shownName}
                referrerPolicy="no-referrer"
                onError={() => setPhotoFailed(true)}
                className={`relative z-10 rounded-full object-cover ring-4 ring-white ${photoSize}`}
              />
            ) : (
              <div
                className={`bday-fallback relative z-10 flex items-center justify-center rounded-full text-5xl font-bold text-white ring-4 ring-white ${photoSize}`}
              >
                {shownName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="bday-float pointer-events-none absolute -bottom-1 -right-4 z-20 text-3xl drop-shadow-sm" aria-hidden>
              {emoji[1]}
            </span>
            <span className="bday-wiggle pointer-events-none absolute -bottom-2 -left-3 z-20 text-2xl drop-shadow-sm" aria-hidden>
              🎂
            </span>
          </div>

          <h1
            className={`bday-title mt-7 font-display font-semibold leading-tight ${
              compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
            }`}
          >
            {when === 'yesterday' ? t('bday.yesterdayHeadline', { name: shownName }) : headline}
          </h1>
          {whoLine && (
            <p className="bday-who mt-3 inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-medium tracking-tight">
              {whoLine}
            </p>
          )}
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

          <p className={`bday-wish mx-auto mt-5 max-w-sm leading-relaxed ${compact ? 'text-sm' : 'text-base'}`}>
            {language === 'uz'
              ? webBirthdayWish(shownName, person.age ?? null, when)
              : when === 'yesterday'
                ? t('bday.yesterdayWish')
                : t('bday.wish')}
          </p>

          <p className="bday-emoji mt-6 text-2xl tracking-[0.28em]" aria-hidden>
            {stickers.slice(0, 6).join(' ')}
          </p>

          <section className="bday-cheers mt-8 w-full rounded-3xl border p-5 text-left">
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
                    {prettyLabel(c.name)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {when === 'yesterday' ? t('bday.yesterdayWish') : t('bday.cheersEmpty')}
              </p>
            )}
          </section>
        </article>
        {footer}
      </div>
      <style>{BIRTHDAY_CARD_CSS}</style>
    </div>
  );
}
