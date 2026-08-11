/** Rotating group birthday captions (Oq-Ariq) — warm & cute. */

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

export function birthdayWishCaption(name: string, age: number | null): string {
  const withAge =
    age != null
      ? [
          `🎂 Happy birthday, ${name}! ✨ Turning ${age} today — may this year hug you with love, laughter, and family.`,
          `🎉 Cake time! ${name} is ${age} today. Wishing you health, joy, and the sweetest year yet 💚`,
          `💚 Happy birthday ${name}! The Oq-Ariq family is cheering for your ${ordinalAge(age)}. You are so loved.`,
          `🌟 ${name}, happy ${ordinalAge(age)}! May your day sparkle as brightly as you do for all of us ✨`,
          `🥳 Big birthday hugs to ${name} on turning ${age}! Grateful for every smile you share 🎈`,
          `🎁 ${name} turns ${age} today! Sending cake, hugs, and all our love from Oq-Ariq OILASI 🎂`,
        ]
      : [];

  const noAge = [
    `🎂 Happy birthday, ${name}! Wishing you a soft, sunny day full of family love 💚`,
    `🎉 Celebrating ${name} today — may joy and peace follow you all year ✨`,
    `💚 Happy birthday ${name}! The Oq-Ariq OILASI family is cheering for you 🎈`,
    `🌟 ${name}, today is your day. You mean so much to this family 🥰`,
  ];

  const pool = withAge.length ? withAge : noAge;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Short line for the public web page (cute, personal). */
export function birthdayPageWish(name: string, age: number | null): string {
  const lines =
    age != null
      ? [
          `${name}, turning ${age} looks wonderful on you. The whole family is smiling with you today.`,
          `Happy ${ordinalAge(age)}, ${name}! May your year be gentle, bright, and full of good people.`,
          `Dear ${name} — ${age} candles, countless hugs. We love celebrating you.`,
        ]
      : [
          `${name}, today the family gathers around you with love.`,
          `Happy birthday, ${name}! May this day feel soft, warm, and special.`,
        ];
  // Stable pick from name so the page doesn't jump on refresh.
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % 997;
  return lines[hash % lines.length]!;
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
