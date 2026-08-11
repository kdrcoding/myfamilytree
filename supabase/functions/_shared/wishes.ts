/** Rotating group birthday captions (Oq-Ariq). */

export function birthdayWishCaption(name: string, age: number | null): string {
  const withAge =
    age != null
      ? [
          `🎂 Happy birthday, ${name}! Turning ${age} today — may this year bring love, laughter, and family close by.`,
          `🎉 ${name} is ${age} today! Wishing you health, joy, and all the cake you can eat.`,
          `💚 Happy birthday ${name}! The Oq-Ariq family celebrates you at ${age}. So proud to have you.`,
          `🌟 ${name}, happy ${age}th! May your day shine as brightly as you do for all of us.`,
          `🥳 Big love to ${name} on turning ${age}! Grateful for every memory we share.`,
        ]
      : [];

  const noAge = [
    `🎂 Happy birthday, ${name}! Wishing you a beautiful day filled with family love.`,
    `🎉 Celebrating ${name} today — may joy and peace follow you all year.`,
    `💚 Happy birthday ${name}! The Oq-Ariq OILASI family is cheering for you.`,
    `🌟 ${name}, today is your day. You mean so much to this family.`,
  ];

  const pool = withAge.length ? withAge : noAge;
  return pool[Math.floor(Math.random() * pool.length)]!;
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
