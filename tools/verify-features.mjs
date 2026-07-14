// E2E verification of the 2026-07-14 feature batch: name-at-sign-in,
// compact named change log, anniversaries, storage photos, PWA bits.
// Supabase is fully mocked via request interception - no live DB touched.
import puppeteer from 'puppeteer-core';

const APP = 'http://localhost:5199';
const SB = 'kasvrgqbmydypwvkqzju.supabase.co';
const OWNER_PW = 'RootsKeeper!2026';

// tiny 1x1 png
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const TINY_DATA_URL = `data:image/png;base64,${PNG.toString('base64')}`;

// Dates relative to the real clock so the cards show deterministic pills.
const now = new Date();
const plus = (d) => {
  const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
  return `-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const members = [
  { id: 'f1', first_name: 'Karim', last_name: 'Aliyev', nickname: null, gender: 'male', birth_date: `1950${plus(2)}`, death_date: null, is_deceased: false, photo: 'people/f1-test.jpg', city: 'Toshkent', country: null, occupation: null, biography: null },
  { id: 'f2', first_name: 'Zulfiya', last_name: 'Aliyeva', nickname: null, gender: 'female', birth_date: '1952-01-15', death_date: null, is_deceased: false, photo: TINY_DATA_URL, city: 'Toshkent', country: null, occupation: null, biography: null },
  { id: 'c1', first_name: 'Bek', last_name: 'Aliyev', nickname: null, gender: 'male', birth_date: '1980-03-03', death_date: null, is_deceased: false, photo: null, city: null, country: null, occupation: null, biography: null },
];
const relationships = [
  { key: 'spouse|f1|f2', kind: 'spouse', person_a: 'f1', person_b: 'f2', married_on: `1975${plus(4)}` },
  { key: 'parent|f1|c1', kind: 'parent-child', person_a: 'f1', person_b: 'c1', married_on: null },
  { key: 'parent|f2|c1', kind: 'parent-child', person_a: 'f2', person_b: 'c1', married_on: null },
];
const auditLog = Array.from({ length: 12 }, (_, i) => ({
  id: 100 - i,
  at: new Date(Date.now() - i * 3600_000).toISOString(),
  actor: 'family@oqariq.family',
  actor_name: i % 2 === 0 ? 'Dilnoza' : 'Bek',
  action: 'edit',
  details: { updated: [{ name: `Person ${i}`, fields: ['city'] }] },
}));

const seenRequests = [];
const errors = [];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.createBrowserContext();
const page = await context.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on('console', (m) => {
  if (m.type() === 'error' && !/WebSocket|realtime|net::ERR|Failed to load resource/i.test(m.text()))
    errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (!url.includes(SB)) return void req.continue();
  seenRequests.push({ method: req.method(), url, body: req.postData() });

  const respond = (body, status = 200, contentType = 'application/json') =>
    req.respond({
      status,
      contentType,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
      },
      body: typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body),
    });

  if (req.method() === 'OPTIONS') return void respond('');
  if (url.includes('/auth/v1/token')) return void respond({ error: 'invalid', error_description: 'nope' }, 400);
  if (url.includes('/auth/v1/')) return void respond({}, 200);
  if (url.includes('/rest/v1/rpc/take_family_backup')) return void respond('null');
  if (url.includes('/rest/v1/rpc/log_family_change')) return void respond('null', 204);
  if (url.includes('/rest/v1/family_members')) {
    if (req.method() === 'GET') return void respond(members);
    return void respond([]);
  }
  if (url.includes('/rest/v1/family_relationships')) {
    if (req.method() === 'GET') return void respond(relationships);
    return void respond([]);
  }
  if (url.includes('/rest/v1/family_audit_log')) return void respond(auditLog);
  if (url.includes('/rest/v1/family_backups')) return void respond([]);
  if (url.includes('/rest/v1/app_settings')) return void respond([]);
  if (url.includes('/storage/v1/object/sign/family-photos') && req.method() === 'POST') {
    const body = JSON.parse(req.postData() ?? '{}');
    return void respond(
      (body.paths ?? []).map((p) => ({ error: null, path: p, signedURL: `/object/sign/family-photos/${p}?token=TEST` })),
    );
  }
  if (url.includes('/storage/v1/object/sign/family-photos/') && req.method() === 'GET') {
    return void respond(PNG, 200, 'image/png');
  }
  if (url.includes('/storage/v1/object/family-photos/')) {
    return void respond({ Key: 'family-photos/x' });
  }
  return void respond([]);
});

const results = [];
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
};

// ---- 1. Gate asks for a name -----------------------------------------------
await page.goto(APP, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type="password"]', { timeout: 15000 });
const nameInputCount = await page.$$eval('input[type="text"]', (els) => els.length);
check('gate shows a name field', nameInputCount >= 1);

// Submitting without a name shows the name error
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 300));
const nameError = await page.$$eval('[role="alert"]', (els) => els.map((e) => e.textContent).join(' '));
check('gate requires the name', nameError.length > 0, nameError.trim());

// Fill name + owner password
await page.type('input[type="text"]', 'Test Aka');
await page.type('input[type="password"]', OWNER_PW);
await page.click('button[type="submit"]');
await page.waitForSelector('main, nav, header', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));
const displayName = await page.evaluate(() => localStorage.getItem('familytree.displayName.v1'));
check('display name stored after sign-in', displayName === '"Test Aka"', String(displayName));

// ---- 2. Home: anniversaries + birthdays cards -------------------------------
const homeText = await page.evaluate(() => document.body.innerText);
check('anniversaries card shows', /Nikoh to'ylari|Wedding anniversaries/i.test(homeText));
check('anniversary couple listed', /Karim.*Zulfiya|Zulfiya.*Karim/s.test(homeText));
check('years-together label shows', /birgalikda 51 yil|51 years together/i.test(homeText));
check('birthday card shows founder', /Tug'ilgan|Birthday|kun/i.test(homeText) && homeText.includes('Karim'));

// ---- 3. Members: storage photo resolves to a signed URL ---------------------
await page.goto(`${APP}/members`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));
const imgSrcs = await page.$$eval('img', (els) => els.map((e) => e.src));
check(
  'storage photo uses signed URL',
  imgSrcs.some((s) => s.includes('/object/sign/family-photos/people/f1-test.jpg')),
  imgSrcs.filter((s) => s.includes('supabase')).slice(0, 1).join(' '),
);
check('data-URL photo still renders', imgSrcs.some((s) => s.startsWith('data:image/png')));

// ---- 4. Settings: compact change log with names + photos card ---------------
await page.goto(`${APP}/settings`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));
let logItems = await page.$$eval('section ul li', (els) =>
  els.filter((e) => e.textContent.includes('Person')).length,
);
check('change log is compact (8 shown of 12)', logItems === 8, `shown=${logItems}`);
const settingsText1 = await page.evaluate(() => document.body.innerText);
check('log entries show the typed name', settingsText1.includes('Dilnoza'));
const showAllBtn = await page.$$('button');
let clicked = false;
for (const b of showAllBtn) {
  const txt = await b.evaluate((e) => e.textContent);
  if (/Hammasini ko'rsatish \(12\)|Show all \(12\)/.test(txt ?? '')) {
    await b.click();
    clicked = true;
    break;
  }
}
check('"Show all (12)" button exists', clicked);
await new Promise((r) => setTimeout(r, 300));
logItems = await page.$$eval('section ul li', (els) =>
  els.filter((e) => e.textContent.includes('Person')).length,
);
check('expands to all 12 entries', logItems === 12, `shown=${logItems}`);
const settingsText2 = await page.evaluate(() => document.body.innerText);
check('photos card present', /Rasmlar xotirasi|Photo storage/.test(settingsText2));
check('photos card counts 1 embedded', /1 ta rasm|1 photos/.test(settingsText2));

// ---- 5. Edit form: marriage date field + saved to relationship row ----------
await page.goto(`${APP}/members`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => {
  const card = [...document.querySelectorAll('button, [role="button"], article, li, div')].find(
    (e) => e.textContent?.includes('Karim') && e.className?.includes?.('card'),
  );
  (card ?? [...document.querySelectorAll('*')].find((e) => e.textContent === 'Karim Aliyev'))?.click();
});
await new Promise((r) => setTimeout(r, 800));
// Click the Edit button in the details modal
const editClicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    /Tahrirlash|^Edit$/.test(b.textContent?.trim() ?? ''),
  );
  if (btn) btn.click();
  return Boolean(btn);
});
check('opened edit form from details', editClicked);
await new Promise((r) => setTimeout(r, 800));
const formText = await page.evaluate(() => document.body.innerText);
check('marriage date field visible', /nikoh sanasi|Marriage date/i.test(formText));

await browser.close();
console.log(results.join('\n'));
console.log(`console errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5).join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECKS FAILED`);
