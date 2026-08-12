/** Rotating group birthday captions (Oq-Ariq) — warm, age-aware. */

export function ordinalAge(age: number): string {
  const v = age % 100;
  if (v >= 11 && v <= 13) return `${age}th`;
  switch (age % 10) {
    case 1:
      return `${age}st`;
    case 2:
      return `${age}nd`;
    case 3:
      return `${age}rd`;
    default:
      return `${age}th`;
  }
}

type AgeBand = 'child' | 'teen' | 'young' | 'adult' | 'midlife' | 'elder';

function ageBand(age: number): AgeBand {
  if (age <= 12) return 'child';
  if (age <= 17) return 'teen';
  if (age <= 29) return 'young';
  if (age <= 49) return 'adult';
  if (age <= 64) return 'midlife';
  return 'elder';
}

function pick<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function stablePick<T>(pool: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  return pool[hash % pool.length]!;
}

/** Telegram group caption — age-targeted tone. */
export function birthdayWishCaption(name: string, age: number | null): string {
  if (age == null) {
    return pick([
      `🎂 Happy birthday, ${name}! Wishing you a soft, sunny day full of family love 💚`,
      `🎉 Celebrating ${name} today — may joy and peace follow you all year ✨`,
      `💚 Happy birthday ${name}! The Oq-Ariq OILASI family is cheering for you 🎈`,
      `🌟 ${name}, today is your day. You mean so much to this family 🥰`,
    ]);
  }

  const nth = ordinalAge(age);
  const byBand: Record<AgeBand, string[]> = {
    child: [
      `🎂 Happy birthday, ${name}! Turning ${age} — may your day be full of cake, giggles, and family hugs 🎈`,
      `🎉 Cake time! ${name} is ${age} today. Grow bright, stay curious, and know this family loves you 💚`,
      `🌟 Happy ${nth}, ${name}! The Oq-Ariq family is cheering for our little star ✨`,
    ],
    teen: [
      `🎂 Happy birthday, ${name}! ${age} looks great on you — may this year bring confidence, friends, and joy 💚`,
      `🎉 ${name} turns ${age} today! Keep shining — this family is so proud of you 🌟`,
      `🥳 Big birthday hugs to ${name} on your ${nth}! Dream big; we’ve got your back 🎈`,
    ],
    young: [
      `🎂 Happy birthday, ${name}! Turning ${age} — may this year open doors, laughter, and beautiful new chapters ✨`,
      `🎉 ${name} is ${age} today! Wishing you energy, love, and a year that feels exciting 💚`,
      `🌟 Happy ${nth}, ${name}! The Oq-Ariq family is cheering for every adventure ahead 🎈`,
    ],
    adult: [
      `🎂 Happy birthday, ${name}! Turning ${age} — grateful for your strength, kindness, and the light you bring home 💚`,
      `🎉 ${name} is ${age} today! May this year feel full, peaceful, and deeply loved ✨`,
      `🥳 Big birthday hugs to ${name} on your ${nth}! You make this family warmer every day 🎁`,
    ],
    midlife: [
      `🎂 Happy birthday, ${name}! Turning ${age} and somehow still looking so young — your smile keeps this family glowing ✨`,
      `🎉 ${name} is ${age} today! Age is just a number when your heart stays this young 💚`,
      `🌟 Happy ${nth}, ${name}! Wisdom, beauty, and that forever-young spark — we celebrate all of you 🎈`,
      `💚 ${name}, ${age} looks wonderful on you. Thank you for the love, jokes, and care you pour into this family 🎂`,
    ],
    elder: [
      `🎂 Happy birthday, ${name}! Turning ${age} and still so young at heart — your light is our family’s treasure ✨`,
      `🎉 ${name} is ${age} today! May health, peace, and soft joy surround you. You still shine like spring 💚`,
      `🌟 Happy ${nth}, ${name}! Years of love, and that young smile never left — we cherish you endlessly 🎈`,
      `💚 Dear ${name}, ${age} candles and a heart that still feels young. The Oq-Ariq family bows in love and thanks 🎂`,
    ],
  };

  return pick(byBand[ageBand(age)]);
}

/** Short line for the public web page (stable per name+age so it doesn’t jump). */
export function birthdayPageWish(name: string, age: number | null): string {
  if (age == null) {
    return stablePick(
      [
        `${name}, today the family gathers around you with love.`,
        `Happy birthday, ${name}! May this day feel soft, warm, and special.`,
      ],
      name,
    );
  }

  const nth = ordinalAge(age);
  const byBand: Record<AgeBand, string[]> = {
    child: [
      `${name}, turning ${age} is a big adventure — this whole family is smiling with you.`,
      `Happy ${nth}, ${name}! May your year be full of play, kindness, and sweet surprises.`,
    ],
    teen: [
      `${name}, ${age} looks bright on you. Keep growing into the wonderful person you already are.`,
      `Happy ${nth}, ${name}! May this year feel freer, kinder, and full of good friends.`,
    ],
    young: [
      `${name}, turning ${age} looks wonderful on you. May this chapter be bold and joyful.`,
      `Happy ${nth}, ${name}! New dreams, soft days, and people who lift you up.`,
    ],
    adult: [
      `${name}, turning ${age} looks wonderful on you. The whole family is smiling with you today.`,
      `Happy ${nth}, ${name}! May your year be gentle, bright, and full of good people.`,
    ],
    midlife: [
      `${name}, ${age} and still so young — your glow hasn’t faded one bit. We love celebrating you.`,
      `Happy ${nth}, ${name}! Age brought wisdom; your smile kept the youth. What a gift you are.`,
      `Dear ${name} — ${age} candles, countless hugs, and a heart that still feels spring-young.`,
    ],
    elder: [
      `${name}, turning ${age} and still young in spirit — you are this family’s living blessing.`,
      `Happy ${nth}, ${name}! May peace, health, and soft joy wrap around you every day.`,
      `Dear ${name} — decades of love, and that young light in your eyes never left.`,
    ],
  };

  return stablePick(byBand[ageBand(age)], `${name}:${age}`);
}

export function publicAppUrl(): string {
  return (Deno.env.get('PUBLIC_APP_URL') || 'https://myfamilytree-kdr6.vercel.app').replace(
    /\/$/,
    '',
  );
}

export function birthdayPageUrl(personId: string): string {
  return `${publicAppUrl()}/bday/${encodeURIComponent(personId)}`;
}
