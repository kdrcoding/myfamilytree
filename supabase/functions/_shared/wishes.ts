/** Rotating group birthday captions — Uzbek-first for the family group. */

export type TgLang = 'uz' | 'en' | 'ru';

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

function stablePick<T>(pool: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  return pool[hash % pool.length]!;
}

const UZ_NONE = [
  `🎂 Tug‘ilgan kuningiz muborak, {name}! Oq-Ariq OILASI sizni yaxshi ko‘radi 💚`,
  `🎉 Bugun {name}ning kuni — quvonch, tinchlik va oila muhabbati hamroh bo‘lsin ✨`,
  `💚 {name}, bugun sizniki. Bu oilada sizning o‘rningiz katta 🥰`,
  `🎈 {name}, tug‘ilgan kuningiz muborak! Uyingiz kulgi va mehrga to‘lsin 🎂`,
  `🌟 Bugun {name} uchun bayram. Oq-Ariq oilasi sizni quchoqlaydi 🤗`,
  `🎁 Tug‘ilgan kuningiz muborak, {name}! Har bir daqiqa shirin o‘tsin 🍰`,
  `🥳 {name}, bugun butun oila siz uchun yig‘ildi. Muborak bo‘lsin! 💚`,
  `✨ {name}ning kuni keldi! Sevinch, salomatlik va omad yoningizda bo‘lsin 🌼`,
  `🎂 {name}, sizni nishonlash — oilamizning baxti. Tug‘ilgan kuningiz muborak! 🎉`,
  `💚 Aziz {name}, bugun sizga atalgan kun. Ko‘p yillar, ko‘p quvonch! 🙌`,
  `🎊 {name}, dasturxon yozildi, qalblar ochiq — tug‘ilgan kuningiz muborak! 🎂`,
  `💛 {name}, kulgingiz bizning bayramimiz. Muborak bo‘lsin, aziz inson! 🥳`,
  `🌈 Bugun {name} uchun nurli kun. Oq-Ariq oilasi siz bilan sevinadi 💚`,
  `🥂 {name}, yurakdan tabriklaymiz! Sog‘liq, omad va oila muhabbati ✨`,
];

const EN_NONE = [
  `🎂 Happy birthday, {name}! Wishing you a soft, sunny day full of family love 💚`,
  `🎉 Celebrating {name} today — may joy and peace follow you all year ✨`,
  `💚 Happy birthday {name}! The Oq-Ariq OILASI family is cheering for you 🎈`,
];

const RU_NONE = [
  `🎂 С днём рождения, {name}! Семья Oq-Ariq OILASI тебя любит 💚`,
  `🎉 Сегодня день {name} — пусть радость и покой будут рядом ✨`,
  `💚 {name}, сегодня твой день. Ты очень много значишь для этой семьи 🥰`,
];

const UZ_BAND: Record<AgeBand, string[]> = {
  child: [
    `🎂 Tug‘ilgan kuningiz muborak, {name}! Bugun {age} yosh — shirinlik, kulgi va oila quchog‘i bo‘lsin 🎈`,
    `🎉 {name} bugun {age} yoshda! Katta bo‘lib bor, qiziquvchan qol — oilangiz seni yaxshi ko‘radi 💚`,
    `🌟 {name}, {age} yoshga to‘lding! Oq-Ariq oilasi o‘z yulduzini nishonlayapti ✨`,
    `🎈 {name}, {age} yosh muborak! Tortdan bir bo‘lak, quchoqdan mingta 🤗`,
    `🧁 Bugun {name} {age} yoshda! O‘ynab-kulib o‘s, bolajon — oila yoningda 💚`,
    `🎁 {name}ning {age} yoshi muborak! Rang-barang kun, shirin tushlar 🌈`,
    `🥳 {name}, tabriklaymiz! {age} sham — {age} ta orzu amalga oshsin ✨`,
    `🌼 {name}, sen oilamizning kichik baxtisan. {age} yoshing muborak! 🎂`,
  ],
  teen: [
    `🎂 Tug‘ilgan kuningiz muborak, {name}! {age} yosh senga yarashadi — ishonch, do‘stlar va quvonch tilaymiz 💚`,
    `🎉 {name} bugun {age} yoshda! Yorqin yashashda davom et — oila sening bilan faxrlanadi 🌟`,
    `🥳 {name}, {age} yoshing muborak! Katta orzular qil — orqangda oilangiz bor 🎈`,
    `💪 {name}, {age} yosh — yangi kuch, yangi g‘ayrat. Oldinga, yurak bilan! ✨`,
    `🌟 Tabriklaymiz, {name}! {age} yoshda ham o‘zing bo‘l, yorqin bo‘l 💚`,
    `🎵 {name}ning {age} yoshi muborak! Do‘stlar, musiqa va yaxshi kunlar tilaymiz 🎉`,
    `🙌 {name}, sen o‘sayapsan — oila sening har qadamingda. Muborak {age}! 🎂`,
    `✨ {name}, {age} yosh senga yarashgan. Bu yil senga omad keltirsin 🍀`,
  ],
  young: [
    `🎂 Tug‘ilgan kuningiz muborak, {name}! {age} yosh — yangi eshiklar, kulgi va chiroyli sahifalar ochilsin ✨`,
    `🎉 {name} bugun {age} yoshda! Energiya, muhabbat va hayajonli bir yil tilaymiz 💚`,
    `🌟 {name}, {age} yoshga to‘lding! Oq-Ariq oilasi har bir sarguzashtingda yoningda 🎈`,
    `🚀 {name}, {age} yosh — orzularing katta, yo‘ling ochiq bo‘lsin 💚`,
    `💃 Tug‘ilgan kuning muborak, {name}! {age} yoshda hayot shirinroq o‘tsin 🎂`,
    `🌈 {name}ning {age} yoshi muborak! Yangi ishlar, yangi quvonchlar ✨`,
    `🤗 {name}, oila sening bilan faxrlanadi. {age} yosh — omad va mehr! 🎁`,
    `🌞 {name}, bugun sen porlayapsan. {age} yoshing muborak bo‘lsin 🥳`,
  ],
  adult: [
    `🎂 Tug‘ilgan kuningiz muborak, {name}! {age} yosh — kuching, mehribonliging va uyga olib kelgan nuring uchun minnatdormiz 💚`,
    `🎉 {name} bugun {age} yoshda! Bu yil to‘la, tinch va sevikli o‘tsin ✨`,
    `🥳 {name}, {age} yoshing muborak! Sen bu oilani har kuni isitib turasan 🎁`,
    `🌿 {name}, {age} yosh — sog‘liq, osoyishtalik va oila baxti tilaymiz 💚`,
    `🙌 Tabriklaymiz, {name}! {age} yoshda ham suyanchimizsan 🎂`,
    `💚 {name}ning {age} yoshi muborak! Mehnating, mehring qadrlanadi ✨`,
    `🏡 {name}, uyingiz tinch, yuragingiz yosh bo‘lsin. {age} yosh muborak! 🎈`,
    `🌟 {name}, sen oilaning nurisan. Tug‘ilgan kuning muborak — {age}! 🥳`,
  ],
  midlife: [
    `🎂 Tug‘ilgan kuningiz muborak, {name}! {age} yoshda ham yosh ko‘rinasiz — tabassuming oilani yoritadi ✨`,
    `🎉 {name} bugun {age} yoshda! Yurak yosh qolsa, yosh shunchaki raqam 💚`,
    `💚 {name}, {age} yosh senga yarashadi. Oila uchun qilgan mehring, haziling va g‘amxo‘rliging uchun rahmat 🎂`,
    `🌸 {name}, {age} yosh — donolik va yosh tabassum yonma-yon ✨`,
    `🙌 Tug‘ilgan kuningiz muborak, {name}! Sizdan o‘rganamiz, sizni sevamiz 💚`,
    `🎁 {name}ning {age} yoshi muborak! Hali ko‘p bahorlar, ko‘p bayramlar 🌼`,
    `🌞 {name}, nuringiz so‘nmadi. {age} sham — {age} ta minnatdorchilik 🎂`,
    `🤗 Aziz {name}, oila sizning atrofingizda. Muborak {age} yosh! 🥳`,
  ],
  elder: [
    `🎂 Tug‘ilgan kuningiz muborak, {name}! {age} yoshda ham yuraging yosh — nuring oilamizning xazinasi ✨`,
    `🎉 {name} bugun {age} yoshda! Sog‘liq, tinchlik va yumshoq quvonch yoningda bo‘lsin 💚`,
    `💚 Aziz {name}, {age} sham va hanuz yosh yurak. Oq-Ariq oilasi sizni e’zozlaydi 🎂`,
    `🙏 {name}, siz — naslimizning barakasi. {age} yoshingiz muborak bo‘lsin 🌸`,
    `🌿 Tug‘ilgan kuningiz muborak, {name}! Uzoq umr, sokin kunlar, sevikli nabiralar 💚`,
    `✨ {name}ning {age} yoshi muborak! Duoyingiz oilani asraydi 🤲`,
    `🏡 Aziz {name}, uyingizga nur, qalbingizga osoyishtalik. {age} yosh muborak! 🎂`,
    `🌟 {name}, sizni ko‘rishning o‘zi bayram. Tug‘ilgan kuningiz muborak — {age}! 💚`,
  ],
};

const EN_BAND: Record<AgeBand, string[]> = {
  child: [
    `🎂 Happy birthday, {name}! Turning {age} — may your day be full of cake, giggles, and family hugs 🎈`,
    `🎉 Cake time! {name} is {age} today. Grow bright, stay curious, and know this family loves you 💚`,
  ],
  teen: [
    `🎂 Happy birthday, {name}! {age} looks great on you — may this year bring confidence, friends, and joy 💚`,
    `🎉 {name} turns {age} today! Keep shining — this family is so proud of you 🌟`,
  ],
  young: [
    `🎂 Happy birthday, {name}! Turning {age} — may this year open doors, laughter, and beautiful new chapters ✨`,
    `🎉 {name} is {age} today! Wishing you energy, love, and a year that feels exciting 💚`,
  ],
  adult: [
    `🎂 Happy birthday, {name}! Turning {age} — grateful for your strength, kindness, and the light you bring home 💚`,
    `🎉 {name} is {age} today! May this year feel full, peaceful, and deeply loved ✨`,
  ],
  midlife: [
    `🎂 Happy birthday, {name}! Turning {age} and still looking so young — your smile keeps this family glowing ✨`,
    `💚 {name}, {age} looks wonderful on you. Thank you for the love, jokes, and care you pour into this family 🎂`,
  ],
  elder: [
    `🎂 Happy birthday, {name}! Turning {age} and still so young at heart — your light is our family’s treasure ✨`,
    `💚 Dear {name}, {age} candles and a heart that still feels young. The Oq-Ariq family bows in love and thanks 🎂`,
  ],
};

const RU_BAND: Record<AgeBand, string[]> = {
  child: [
    `🎂 С днём рождения, {name}! Сегодня {age} — пусть будет торт, смех и объятия семьи 🎈`,
    `🎉 {name} сегодня {age}! Расти ярким — эта семья тебя любит 💚`,
  ],
  teen: [
    `🎂 С днём рождения, {name}! {age} тебе очень идёт — уверенности, друзей и радости 💚`,
    `🎉 {name} сегодня {age}! Свети дальше — семья тобой гордится 🌟`,
  ],
  young: [
    `🎂 С днём рождения, {name}! {age} лет — пусть откроются двери, смех и новые главы ✨`,
    `🎉 {name} сегодня {age}! Энергии, любви и волнующего года 💚`,
  ],
  adult: [
    `🎂 С днём рождения, {name}! {age} — спасибо за силу, доброту и свет, который ты несёшь домой 💚`,
    `🎉 {name} сегодня {age}! Пусть год будет полным, спокойным и любимым ✨`,
  ],
  midlife: [
    `🎂 С днём рождения, {name}! {age} и всё ещё так молодо выглядишь — твоя улыбка светит семье ✨`,
    `💚 {name}, {age} тебе очень идёт. Спасибо за любовь, шутки и заботу 🎂`,
  ],
  elder: [
    `🎂 С днём рождения, {name}! {age} и сердце всё ещё молодо — ты сокровище этой семьи ✨`,
    `💚 Дорогой {name}, {age} свечей и молодое сердце. Семья Oq-Ariq тебя чтит 🎂`,
  ],
};

function fill(template: string, name: string, age: number | null): string {
  return template.replaceAll('{name}', name).replaceAll('{age}', age == null ? '' : String(age));
}

/** Telegram group caption — Uzbek by default. Seed keeps retries identical. */
export function birthdayWishCaption(
  name: string,
  age: number | null,
  lang: TgLang = 'uz',
  seed = `${name}:${age ?? 'x'}`,
): string {
  const choose = <T>(pool: T[]) => stablePick(pool, seed);
  if (age == null) {
    const pool = lang === 'en' ? EN_NONE : lang === 'ru' ? RU_NONE : UZ_NONE;
    return fill(choose(pool), name, age);
  }
  const band = lang === 'en' ? EN_BAND : lang === 'ru' ? RU_BAND : UZ_BAND;
  return fill(choose(band[ageBand(age)]), name, age);
}

const UZ_PAGE: Record<AgeBand | 'none', string[]> = {
  none: [
    `{name}, bugun oila atrofingizda. Tug‘ilgan kuningiz muborak!`,
    `Tug‘ilgan kuningiz muborak, {name}! Bu kun yumshoq, iliq va maxsus o‘tsin.`,
    `{name}, bugun sizniki. Quvonch uyga to‘lsin.`,
    `Oq-Ariq OILASI {name}ni nishonlaydi — muborak bo‘lsin!`,
    `{name}, sizni yaxshi ko‘ramiz. Tug‘ilgan kuningiz muborak!`,
    `Bugun bayram: {name} uchun tabassum, tort va mehr.`,
    `{name}, kulgingiz oilani yoritadi. Tug‘ilgan kuningiz muborak bo‘lsin!`,
    `Bugun {name} uchun bayram dasturxoni yozildi — sevinch, salomatlik, omad!`,
    `{name}, sizning kuningiz! Oq-Ariq oilasi sizni quchoqlaydi.`,
    `Yurakdan tabriklaymiz, {name}! Uyingizga nur, qalbingizga tinchlik.`,
    `{name}, har bir daqiqangiz shirin o‘tsin. Muborak bo‘lsin!`,
    `Oila siz bilan faxrlanadi, {name}. Tug‘ilgan kuningiz qutlug‘ bo‘lsin!`,
  ],
  child: [
    `{name}, {age} yosh — katta sarguzasht. Butun oila siz bilan kulmoqda.`,
    `{name}, {age} yoshga to‘lding! O‘yin, mehribonlik va shirin syurprizlar tilaymiz.`,
    `{name}, bolajon, {age} yoshing muborak! Katta bo‘lib, yaxshi odam bo‘lib o‘s.`,
    `Bugun {name} {age} yoshda — shirinlik va quchoq kuni!`,
    `{name}, sen oilaning kichik yulduzisan. {age} yosh muborak.`,
    `{age} sham, {name} — har biri bir orzu. Kulib o‘s!`,
    `{name}, tortdan bir bo‘lak, oiladan mingta quchoq! {age} yoshing muborak.`,
    `Bolajon {name}, {age} yoshda ham porla. O‘yinchoqlar, kulgi, mehr!`,
    `{name}ning {age} yoshi muborak! Rang-barang kun, shirin tushlar bo‘lsin.`,
    `Tabriklaymiz, {name}! {age} sham — {age} ta kichik baxt.`,
    `{name}, sen oilamizning kichik baxtisan. {age} yosh qutlug‘!`,
    `Bugun {name} uchun bayram: shirinlik, o‘yin va katta oila quchog‘i.`,
  ],
  teen: [
    `{name}, {age} yosh senga yarashadi. O‘zing bo‘lgan ajoyib inson sifatida o‘sishda davom et.`,
    `{name}, {age} yoshing muborak! Bu yil erkinroq, mehribonroq va yaxshi do‘stlar bilan o‘tsin.`,
    `{name}, {age} yosh — ishonching oshsin, yo‘ling yorug‘ bo‘lsin.`,
    `Oila {name} bilan faxrlanadi. {age} yosh muborak!`,
    `{name}, oldinga yur. {age} yosh — yangi sahifa.`,
    `Tabriklaymiz, {name}! {age} yoshda ham o‘zing bo‘l.`,
    `{name}, {age} yosh — orzularing katta, oila yoningda. Muborak!`,
    `Yorqin yashashda davom et, {name}! {age} yoshing qutlug‘ bo‘lsin.`,
    `{name}ning {age} yoshi muborak! Do‘stlar, kulgi va yaxshi kunlar tilaymiz.`,
    `{name}, sen o‘sayapsan — oila har qadamingda. Muborak {age}!`,
    `Ishonch, g‘ayrat, mehr — {name}, {age} yoshing muborak bo‘lsin!`,
    `{name}, bu yil senga omad keltirsin. {age} yosh senga yarashgan!`,
  ],
  young: [
    `{name}, {age} yosh senga yarashadi. Bu bob dadil va quvnoq bo‘lsin.`,
    `{name}, {age} yoshing muborak! Yangi orzular, yumshoq kunlar va ko‘taradigan odamlar.`,
    `{name}, {age} yosh — eshiklar ochilsin, omad yoningda bo‘lsin.`,
    `Bugun {name} porlayapti. {age} yosh muborak, sevikli inson!`,
    `{name}, oila sening har bir qadamingda. {age} yosh — quvonch!`,
    `{age} yosh, {name} — yangi sarguzashtlar boshlansin.`,
    `{name}, {age} yoshda hayot shirinroq o‘tsin. Tug‘ilgan kuning muborak!`,
    `Yangi ishlar, yangi quvonchlar — {name}ning {age} yoshi muborak!`,
    `{name}, oila sening bilan faxrlanadi. {age} yosh — omad va mehr!`,
    `Bugun sen porlayapsan, {name}. {age} yoshing muborak bo‘lsin!`,
    `{name}, yo‘ling ochiq, yuraging yosh. {age} yosh qutlug‘!`,
    `Sevinch, salomatlik, muhabbat — {name}, {age} yoshing muborak!`,
  ],
  adult: [
    `{name}, {age} yosh senga yarashadi. Butun oila bugun siz bilan tabassum qilmoqda.`,
    `{name}, {age} yoshing muborak! Yilingiz yorug‘, yumshoq va yaxshi odamlar bilan to‘lsin.`,
    `{name}, sen uyga nur olib kelasiz. {age} yosh muborak.`,
    `Rahmat, {name}, mehring uchun. {age} yosh — sog‘liq va tinchlik.`,
    `{name}, oilaning suyanchisi. Tug‘ilgan kuning muborak — {age}!`,
    `{age} yosh, {name} — hali ko‘p yaxshi kunlar oldinda.`,
    `{name}, kuching va mehribonliging uchun minnatdormiz. {age} yosh qutlug‘!`,
    `Uyingiz tinch, yuragingiz yosh bo‘lsin, {name}. {age} yosh muborak!`,
    `{name}, sen oilaning nurisan. Tug‘ilgan kuning muborak — {age}!`,
    `Mehnating, mehring qadrlanadi, {name}. {age} yoshing muborak bo‘lsin.`,
    `{name}, bugun butun dasturxon siz uchun. {age} yosh — baxt va osoyishtalik!`,
    `Tabriklaymiz, {name}! {age} yoshda ham suyanchimizsan. Muborak!`,
  ],
  midlife: [
    `{name}, {age} yoshda ham yosh — nuringiz so‘nmadi. Sizni nishonlash baxt.`,
    `Aziz {name} — {age} sham, son-sanoqsiz quchoq va hanuz bahordek yurak.`,
    `{name}, donoligingiz va tabassumingiz oilani isitadi. {age} yosh muborak.`,
    `Tug‘ilgan kuningiz muborak, {name}! {age} yosh — hali bahor.`,
    `{name}, sizdan o‘rganamiz. {age} yoshingiz qutlug‘ bo‘lsin.`,
    `{age} yosh, {name} — mehr, hazil va yosh ko‘zlar.`,
    `{name}, {age} yosh senga yarashadi. Oila uchun qilgan mehring uchun rahmat.`,
    `Hali ko‘p bahorlar, ko‘p bayramlar, {name}! {age} yoshing muborak.`,
    `{name}, nuringiz so‘nmadi. {age} sham — {age} ta minnatdorchilik.`,
    `Aziz {name}, oila sizning atrofingizda. Muborak {age} yosh!`,
    `{name}, yurak yosh qolsa, yosh shunchaki raqam. {age} yosh qutlug‘!`,
    `Tabassumingiz oilani yoritadi, {name}. Tug‘ilgan kuningiz muborak — {age}!`,
  ],
  elder: [
    `{name}, {age} yoshda ham ruhi yosh — siz bu oilaning barakasi.`,
    `Aziz {name} — o‘n yillik muhabbat, va ko‘zingizdagi yosh nur hech ketmadi.`,
    `{name}, duoyingiz bizni asraydi. {age} yosh muborak, aziz inson.`,
    `Tug‘ilgan kuningiz muborak, {name}! Uzoq umr, sokin kunlar.`,
    `{name}, naslimizning faxri. {age} sham — {age} ta minnatdorchilik.`,
    `Aziz {name}, sizni ko‘rishning o‘zi bayram. {age} yosh qutlug‘ bo‘lsin.`,
    `{name}, {age} yoshda ham yuraging yosh — nuring oilamizning xazinasi.`,
    `Sog‘liq, tinchlik va yumshoq quvonch yoningizda bo‘lsin, {name}. {age} yosh muborak!`,
    `Aziz {name}, {age} sham va hanuz yosh yurak. Oq-Ariq oilasi sizni e’zozlaydi.`,
    `{name}, siz — naslimizning barakasi. {age} yoshingiz muborak bo‘lsin.`,
    `Uzoq umr, sokin kunlar, sevikli nabiralar, {name}! Tug‘ilgan kuningiz muborak.`,
    `{name}, duoyingiz oilani asraydi. {age} yosh qutlug‘ bo‘lsin, aziz inson.`,
  ],
};

const UZ_YESTERDAY = [
  `Kecha {name}ning tug‘ilgan kuni edi. Oila hanuz tabassumda — kechikkan tilak ham tilak.`,
  `{name}, kecha bayramingiz edi. Bugun ham sizni o‘ylaymiz va yaxshi ko‘ramiz.`,
  `Kecha {name} nishonlandi. Tilaklar hali ham yoningizda.`,
  `{name}, kechikkan bo‘lsa-da, tilak chin yurakdan: tug‘ilgan kuningiz muborak!`,
  `Kecha {name} uchun bayram edi. Bugun ham oila sizni quchoqlaydi.`,
  `{name}, kechagi sevinch hali yurakda. Sog‘liq va tinchlik tilaymiz.`,
];

/** Short line for the public web page (stable per name+age). */
export function birthdayPageWish(name: string, age: number | null, lang: TgLang = 'uz'): string {
  if (lang !== 'uz') {
    // Page chrome is translated in the app; keep a stable English/Russian line here.
    if (age == null) {
      return lang === 'ru'
        ? stablePick(
            [`${name}, сегодня семья рядом с тобой.`, `С днём рождения, ${name}!`],
            name,
          )
        : stablePick(
            [
              `${name}, today the family gathers around you with love.`,
              `Happy birthday, ${name}! May this day feel soft, warm, and special.`,
            ],
            name,
          );
    }
  }
  const key: AgeBand | 'none' = age == null ? 'none' : ageBand(age);
  return fill(stablePick(UZ_PAGE[key], `${name}:${age ?? 'x'}`), name, age);
}

export function birthdayYesterdayWish(name: string, age: number | null): string {
  return fill(stablePick(UZ_YESTERDAY, `${name}:yest:${age ?? 'x'}`), name, age);
}

export function publicAppUrl(): string {
  return (Deno.env.get('PUBLIC_APP_URL') || 'https://myfamilytree-smoky.vercel.app').replace(
    /\/$/,
    '',
  );
}

export function birthdayPageUrl(personId: string): string {
  return `${publicAppUrl()}/bday/${encodeURIComponent(personId)}`;
}

export function cheerCallbackData(personId: string, year: number): string {
  return `cheer_${personId}_${year}`;
}

export function parseCheerCallback(data: string): { personId: string; year: number } | null {
  const m = /^cheer_(.+)_(\d{4})$/.exec(data.trim());
  if (!m) return null;
  return { personId: m[1], year: Number(m[2]) };
}

/** Kadir’s Telegram — so relatives can reach him from the group post. */
export const KADIR_TELEGRAM = {
  handle: '@imkadi',
  url: 'https://t.me/imkadi',
} as const;

export function kadirContactLine(): string {
  return `💬 Savol / tilak: Kadir ${KADIR_TELEGRAM.handle}`;
}

/** Closing lines so the group sees Kadir, not a nameless bot. */
export function kadirFromBlock(): string {
  return `— Kadir · ${KADIR_TELEGRAM.handle}\n${KADIR_TELEGRAM.url}`;
}

export function birthdayCaption(
  name: string,
  age: number | null,
  pageUrl: string,
  seed = `${name}:${age ?? 'x'}`,
  whoLine?: string | null,
): string {
  const wish = birthdayWishCaption(name, age, 'uz', seed);
  const lines = [
    `🎉 Kadir nishonlamoqda`,
    `Kadir: tug‘ilgan kuningiz muborak, ${name}!`,
  ];
  if (whoLine?.trim()) lines.push(whoLine.trim());
  lines.push('', wish, '', `🔗 Bayram sahifasi (parol yo‘q):`, pageUrl, '', kadirFromBlock());
  return lines.join('\n');
}

export const TG_BUTTONS = {
  openPage: '🎉 Bayram sahifasi',
  celebrate: '💛 Men nishonlayman',
  kadir: '💬 @imkadi',
} as const;

export function groupReadyText(): string {
  return 'Oq-Ariq tug‘ilgan kun boti shu guruhga ulandi. Tilaklar Sozlamalardagi soatda yuboriladi.';
}

export function groupAlreadyLinkedText(): string {
  return 'Bu bot boshqa oila guruhiga ulangan. Avval Sozlamalarda guruhni uzing, keyin meni qayta qo‘shing — yoki /setgroup ni uzgandan keyin yuboring.';
}

export function groupSavedText(): string {
  return 'Shu guruh tug‘ilgan kun xabarlari uchun saqlandi.';
}

export function groupClearFirstText(): string {
  return 'Allaqachon boshqa guruhga ulangan. Sayt → Sozlamalar → Telegram tug‘ilgan kunlar’da guruhni uzing, keyin shu yerda /setgroup yuboring.';
}

export function cheerThanksText(display: string, honoree: string, page: string): string {
  return `Rahmat, <b>${display}</b>! 💛 Ismingiz ${honoree}ning bayram sahifasida.\n\nOchish (parol yo‘q): ${page}`;
}

export function cheerAnnounceText(display: string, honoree: string): string {
  return `💛 <b>${display}</b> — ${honoree}ning tug‘ilgan kunini nishonlamoqda!`;
}

export function cheerNotFoundText(): string {
  return 'Bu bayram sahifasi topilmadi.';
}

export function botWelcomeText(): string {
  return 'Xush kelibsiz — <b>Oq-Ariq OILASI</b> tug‘ilgan kun tilaklari!\n\nKimningdir kuni bo‘lsa, guruhdagi <b>Men nishonlayman</b> tugmasini bosing. Ismingiz uning sahifasida qoladi.\n\nSavol / tilak: Kadir @imkadi\nhttps://t.me/imkadi';
}

export function botHelpText(): string {
  return 'Oq-Ariq tug‘ilgan kun boti\n• Tilaklar faqat oila guruhida (shaxsiy xabar yo‘q)\n• “Men nishonlayman” — ismingiz sahifada qoladi\n• Bayram sahifasi havolasi — parol kerak emas\n• Savol / tilak: Kadir @imkadi\nhttps://t.me/imkadi';
}

export function unknownStartText(): string {
  return 'Noma’lum havola. Oila guruhidagi tug‘ilgan kun xabaridagi tugmalardan foydalaning.';
}
