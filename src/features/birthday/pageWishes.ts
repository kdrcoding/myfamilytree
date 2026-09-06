/** Uzbek celebration wishes for the web page (stable per name + age). */

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

function fill(template: string, name: string, age: number | null): string {
  return template.replaceAll('{name}', name).replaceAll('{age}', age == null ? '' : String(age));
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

export function webBirthdayWish(
  name: string,
  age: number | null,
  when: 'today' | 'yesterday' = 'today',
): string {
  if (when === 'yesterday') {
    return fill(stablePick(UZ_YESTERDAY, `${name}:yest:${age ?? 'x'}`), name, age);
  }
  const key: AgeBand | 'none' = age == null ? 'none' : ageBand(age);
  return fill(stablePick(UZ_PAGE[key], `${name}:${age ?? 'x'}`), name, age);
}
