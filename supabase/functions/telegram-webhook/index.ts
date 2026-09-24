import {
  corsHeaders,
  createServiceClient,
  displayName,
  ensureCallbackWebhook,
  jsonResponse,
  localParts,
  telegramApi,
  type FamilyMemberRow,
} from '../_shared/telegram.ts';
import {
  birthdayPageUrl,
  botHelpText,
  botWelcomeText,
  cheerAnnounceText,
  cheerAlreadyText,
  cheerNotFoundText,
  cheerThanksText,
  parseCheerCallback,
  publicAppUrl,
  TG_BUTTONS,
  unknownStartText,
} from '../_shared/wishes.ts';
import {
  askFamilyPassword,
  claimCallbackData,
  clearDmState,
  findCallbackData,
  getDmState,
  isBotOwner,
  isBotUnlocked,
  linkPerson,
  loadAllMembers,
  loadRels,
  loadSettings,
  lockBot,
  adminMenuKeyboard,
  mainMenuKeyboard,
  parseClaimCallback,
  parseFindCallback,
  parseMenuAction,
  parseWishStart,
  peopleBirthdaySoon,
  peopleWithBirthdayToday,
  personCardText,
  pickLabel,
  relativeButtons,
  saveAndDeliverWish,
  searchPeople,
  sendAdminMenu,
  sendMenu,
  sendText,
  setDmState,
  tgDisplayName,
  treeBrowseHelp,
  unlockBot,
  verifyFamilyPassword,
  wishStartPayload,
  escapeHtml,
  type MenuAction,
  type TgUser,
} from '../_shared/botChat.ts';

type TgChat = { id: number; type: string; title?: string };
type TgMessage = {
  message_id?: number;
  text?: string;
  chat: TgChat;
  from?: TgUser;
};
type TgUpdate = {
  message?: TgMessage;
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    message?: TgMessage;
  };
  my_chat_member?: {
    chat: TgChat;
    new_chat_member: { status: string; user: { is_bot?: boolean; username?: string } };
  };
};

function verifySecret(req: Request): boolean {
  const expected = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  if (!expected) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not set — rejecting webhook');
    return false;
  }
  const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return got === expected;
}

async function saveCheer(
  db: ReturnType<typeof createServiceClient>,
  person: FamilyMemberRow,
  year: number,
  user: TgUser,
): Promise<'inserted' | 'existing'> {
  const existing = await db.rest<{ telegram_user_id: number }[]>('telegram_birthday_cheers', {
    query: {
      select: 'telegram_user_id',
      person_id: `eq.${person.id}`,
      year: `eq.${year}`,
      telegram_user_id: `eq.${user.id}`,
      limit: '1',
    },
  });
  if (Array.isArray(existing) && existing.length > 0) return 'existing';

  await db.rest('telegram_birthday_cheers', {
    method: 'POST',
    query: { on_conflict: 'person_id,year,telegram_user_id' },
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      person_id: person.id,
      year,
      telegram_user_id: user.id,
      display_name: tgDisplayName(user),
      username: user.username || null,
      source: 'telegram',
    }),
  });
  return 'inserted';
}

async function loadPerson(
  db: ReturnType<typeof createServiceClient>,
  personId: string,
): Promise<FamilyMemberRow | null> {
  const people = await db.rest<FamilyMemberRow[]>('family_members', {
    query: {
      select: 'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
      id: `eq.${personId}`,
    },
  });
  return people[0] ?? null;
}

async function beginWish(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
  user: TgUser,
  person: FamilyMemberRow,
  year: number,
): Promise<void> {
  await setDmState(db, user.id, 'wish_await_text', {
    personId: person.id,
    year,
  });
  await sendText(
    chatId,
    [
      `✍️ <b>${escapeHtml(displayName(person))}</b> uchun tilakingizni yozing.`,
      '',
      'Keyingi xabaringiz tilak bo‘ladi (2–500 belgi).',
      'Bekor: <code>/cancel</code>',
    ].join('\n'),
  );
}

async function handleOwnerTest(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
  userId: number,
): Promise<void> {
  if (!isBotOwner(userId)) {
    await sendText(chatId, 'Bu buyruq faqat egaga. Settings’da TELEGRAM_OWNER_IDS qo‘shilgan bo‘lishi kerak.');
    return;
  }
  const cron = Deno.env.get('TELEGRAM_CRON_SECRET');
  const base = Deno.env.get('SUPABASE_URL');
  if (!cron || !base) {
    await sendText(chatId, 'Server sozlamasi yetishmayapti (CRON secret).');
    return;
  }
  await sendText(chatId, 'Sinov yuborilmoqda…');
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/birthday-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cron,
      },
      body: JSON.stringify({ force: true }),
    });
    const text = await res.text();
    let parsed: { ok?: boolean; count?: number; skipped?: string; error?: string } = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      /* ignore */
    }
    if (!res.ok || parsed.ok === false) {
      await sendText(chatId, `Sinov xato: ${escapeHtml(parsed.error || text.slice(0, 200) || String(res.status))}`);
      return;
    }
    if (parsed.skipped) {
      await sendText(chatId, `Sinov o‘tkazildi, lekin skip: <code>${escapeHtml(parsed.skipped)}</code>`);
      return;
    }
    await sendText(chatId, `OK — guruhga yuborildi (count: ${parsed.count ?? '?'}).`);
  } catch (err) {
    console.error(err);
    await sendText(chatId, 'Sinov chaqiruvi muvaffaqiyatsiz.');
  }
}

async function handleStatus(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
  userId: number,
): Promise<void> {
  const settings = await loadSettings(db);
  const members = await loadAllMembers(db);
  const today = peopleWithBirthdayToday(members, settings.timezone);
  const week = peopleBirthdaySoon(members, settings.timezone, 7);
  const lines = [
    '<b>Bot holati</b>',
    `Yoqilgan: ${settings.enabled ? 'ha' : 'yo‘q'}`,
    `Vaqt mintaqasi: ${escapeHtml(settings.timezone)}`,
    `Yuborish soati: ${settings.send_hour}:00`,
    `Guruh: ${settings.group_chat_id ? 'ulangan' : 'yo‘q'}`,
    `Bugun: ${today.length}`,
    `7 kun ichida: ${week.length}`,
  ];
  if (isBotOwner(userId)) {
    lines.push(
      '',
      `<b>Egaga</b>`,
      `Oxirgi OK: ${settings.last_ok_at ? escapeHtml(settings.last_ok_at) : '—'}`,
      `Oxirgi ish: ${settings.last_run_at ? escapeHtml(settings.last_run_at) : '—'}`,
      `Natija: ${settings.last_run_ok == null ? '—' : settings.last_run_ok ? 'OK' : 'xato'}`,
    );
    if (settings.last_run_error) {
      lines.push(`Xato: ${escapeHtml(settings.last_run_error.slice(0, 180))}`);
    }
  }
  await sendText(chatId, lines.join('\n'));
}

async function handleToday(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
): Promise<void> {
  const settings = await loadSettings(db);
  const members = await loadAllMembers(db);
  const today = peopleWithBirthdayToday(members, settings.timezone);
  if (today.length === 0) {
    await sendText(chatId, 'Bugun tug‘ilgan kun yo‘q 🎈');
    return;
  }
  const lines = ['🎂 <b>Bugun</b>', ''];
  const keyboard: { text: string; callback_data: string }[][] = [];
  const year = localParts(settings.timezone).year;
  for (const row of today) {
    const label = displayName(row.person);
    lines.push(`• <b>${escapeHtml(label)}</b>${row.age != null ? ` — ${row.age} yosh` : ''}`);
    const wishData = wishStartPayload(row.person.id, year);
    if (wishData.length <= 64) {
      keyboard.push([{ text: `✍️ ${label.slice(0, 24)}`, callback_data: wishData }]);
    }
  }
  await sendText(chatId, lines.join('\n'), {
    reply_markup: keyboard.length ? { inline_keyboard: keyboard } : undefined,
  });
}

async function handleWeek(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
): Promise<void> {
  const settings = await loadSettings(db);
  const members = await loadAllMembers(db);
  const week = peopleBirthdaySoon(members, settings.timezone, 7);
  if (week.length === 0) {
    await sendText(chatId, 'Yaqin 7 kunda tug‘ilgan kun yo‘q.');
    return;
  }
  const lines = ['📅 <b>7 kun ichida</b>', ''];
  for (const row of week) {
    const when = row.days === 0 ? 'bugun' : row.days === 1 ? 'ertaga' : `${row.days} kun`;
    lines.push(
      `• <b>${escapeHtml(displayName(row.person))}</b> — ${when}${row.age != null ? ` · ${row.age}` : ''}`,
    );
  }
  await sendText(chatId, lines.join('\n'));
}

async function handleWishFlow(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
  user: TgUser,
  nameQuery = '',
): Promise<void> {
  const settings = await loadSettings(db);
  const members = await loadAllMembers(db);
  const q = nameQuery.trim();
  const localYear = localParts(settings.timezone).year;

  if (q.length >= 2) {
    const hits = searchPeople(members, q, 6);
    if (hits.length === 0) {
      await sendText(chatId, `“${escapeHtml(q)}” topilmadi.`);
      return;
    }
    if (hits.length === 1) {
      await beginWish(db, chatId, user, hits[0]!, localYear);
      return;
    }
    const keyboard = hits.map((p) => [
      { text: displayName(p).slice(0, 40), callback_data: wishStartPayload(p.id, localYear) },
    ]);
    await sendText(chatId, 'Kimga tilak?', { reply_markup: { inline_keyboard: keyboard } });
    return;
  }

  const today = peopleWithBirthdayToday(members, settings.timezone);
  const soon = peopleBirthdaySoon(members, settings.timezone, 3);
  const pool = [...today.map((t) => t.person)];
  for (const s of soon) {
    if (!pool.some((p) => p.id === s.person.id)) pool.push(s.person);
  }
  if (pool.length === 0) {
    await sendText(
      chatId,
      'Hozir ochiq bayram yo‘q.\nIsm yozing yoki 🔎 Topish → keyin tilak.',
    );
    return;
  }
  if (pool.length === 1) {
    await beginWish(db, chatId, user, pool[0]!, localYear);
    return;
  }
  const keyboard = pool.slice(0, 8).map((p) => [
    { text: displayName(p).slice(0, 40), callback_data: wishStartPayload(p.id, localYear) },
  ]);
  await sendText(chatId, 'Kimga tilak yozasiz?', {
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function handleFindQuery(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
  query: string,
): Promise<void> {
  const q = query.trim();
  if (q.length < 2) {
    await sendText(chatId, 'Masalan: <b>Kadir</b> yoki <b>Kadir Ravshanov</b>');
    return;
  }
  const settings = await loadSettings(db);
  const members = await loadAllMembers(db);
  const rels = await loadRels(db);
  const hits = searchPeople(members, q, 6);
  if (hits.length === 0) {
    await sendText(
      chatId,
      `“${escapeHtml(q)}” topilmadi.\nFaqat ism yoki familiya bilan urinib ko‘ring.`,
    );
    return;
  }
  if (hits.length === 1) {
    const person = hits[0]!;
    const keyboard = [
      ...relativeButtons(person, members, rels),
      [
        {
          text: '✍️ Tilak',
          callback_data: wishStartPayload(person.id, localParts(settings.timezone).year),
        },
      ],
    ];
    await sendText(chatId, personCardText(person, members, rels, settings.timezone), {
      reply_markup: keyboard.length ? { inline_keyboard: keyboard } : undefined,
    });
    return;
  }
  const keyboard = hits.map((p) => [
    { text: pickLabel(p), callback_data: findCallbackData(p.id) },
  ]);
  await sendText(chatId, `“${escapeHtml(q)}” — o‘xshashlar. Qaysi biri?`, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function handleMeQuery(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
  query: string,
): Promise<void> {
  const q = query.trim();
  if (q.length < 2) {
    await sendText(
      chatId,
      'O‘zingizni ulang — tilaklar shaxsiy keladi.\nIsm yozing: <b>Kadir</b> yoki <b>Kadir Ravshanov</b>',
    );
    return;
  }
  const members = await loadAllMembers(db);
  const hits = searchPeople(members, q, 6);
  if (hits.length === 0) {
    await sendText(
      chatId,
      `“${escapeHtml(q)}” topilmadi.\nFaqat ism yoki familiya yozing — o‘xshashlarni ko‘rsataman.`,
    );
    return;
  }
  // Always ask them to tap who they are (even if one match) — clear + safe.
  const keyboard = hits.map((p) => [
    {
      text: `✅ Men — ${pickLabel(p).slice(0, 28)}`,
      callback_data: claimCallbackData(p.id),
    },
  ]);
  await sendText(
    chatId,
    hits.length === 1
      ? `Topildi — shu sizmisiz?\nBosing:`
      : `“${escapeHtml(q)}” — o‘xshash odamlar.\n<b>Qaysi biri siz?</b> Bosing:`,
    { reply_markup: { inline_keyboard: keyboard } },
  );
}

async function runMenuAction(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
  user: TgUser,
  action: MenuAction,
): Promise<void> {
  switch (action) {
    case 'today':
      await handleToday(db, chatId);
      return;
    case 'week':
      await handleWeek(db, chatId);
      return;
    case 'wish':
      await handleWishFlow(db, chatId, user);
      return;
    case 'find':
      await setDmState(db, user.id, 'find_await_name', {});
      await sendText(chatId, '🔎 Kimni qidiramiz?\nIsm yozing:');
      return;
    case 'tree':
      await sendText(chatId, treeBrowseHelp(), {
        reply_markup: {
          inline_keyboard: [
            [{ text: TG_BUTTONS.openTree, url: `${publicAppUrl().replace(/\/$/, '')}/tree` }],
          ],
        },
      });
      return;
    case 'me':
      await setDmState(db, user.id, 'claim_await_name', {});
      await sendText(chatId, '👤 O‘zingizni ulang.\nIsmingizni yozing:');
      return;
    case 'help':
      await sendText(chatId, botHelpText(), {
        reply_markup: {
          inline_keyboard: [
            [{ text: TG_BUTTONS.openTree, url: `${publicAppUrl().replace(/\/$/, '')}/tree` }],
            [{ text: '📊 Holat', callback_data: 'menu_status' }],
          ],
        },
      });
      return;
    case 'status':
      await handleStatus(db, chatId, user.id);
      if (isBotOwner(user.id)) {
        await sendText(chatId, '⚙️ Admin ochiq.', { reply_markup: adminMenuKeyboard() });
      }
      return;
    case 'test':
      if (!isBotOwner(user.id)) {
        await sendText(chatId, 'Bu faqat admin uchun.');
        return;
      }
      await handleOwnerTest(db, chatId, user.id);
      await sendText(chatId, '⚙️ Admin ochiq.', { reply_markup: adminMenuKeyboard() });
      return;
    case 'admin':
      if (!isBotOwner(user.id)) {
        await sendText(chatId, 'Bu faqat admin uchun.');
        return;
      }
      await sendAdminMenu(chatId);
      return;
    case 'back':
      await sendMenu(chatId, user.id, '◀️ Asosiy menyu');
      return;
    case 'lock':
      if (isBotOwner(user.id)) {
        await sendText(chatId, 'Siz egasiz — parol shart emas. Menyu ochiq qoladi.', {
          reply_markup: mainMenuKeyboard(true),
        });
        return;
      }
      await lockBot(db, user.id);
      await clearDmState(db, user.id);
      await sendText(
        chatId,
        '🔒 Chiqildi. Qayta kirish uchun oila parolini yuboring.',
        { reply_markup: { remove_keyboard: true } },
      );
      return;
  }
}

async function tryUnlockWithPassword(
  db: ReturnType<typeof createServiceClient>,
  chatId: number,
  user: TgUser,
  passwordCandidate: string,
): Promise<boolean> {
  if (!(await verifyFamilyPassword(passwordCandidate))) {
    await sendText(chatId, '❌ Parol noto‘g‘ri. Saytdagi oila parolini yuboring.');
    return false;
  }
  await unlockBot(db, user.id);
  const dm = await getDmState(db, user.id);
  const pending =
    dm?.state === 'auth_pending_wish' && typeof dm.payload.personId === 'string'
      ? {
          personId: dm.payload.personId as string,
          year: Number(dm.payload.year),
        }
      : null;
  await clearDmState(db, user.id);
  await sendMenu(chatId, user.id, '✅ Parol to‘g‘ri — menyu ochildi. Pastdagi tugmalarni bosing.');
  if (pending && Number.isFinite(pending.year)) {
    const person = await loadPerson(db, pending.personId);
    if (person) await beginWish(db, chatId, user, person, pending.year);
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'POST only' }, 405);
  }
  if (!verifySecret(req)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  try {
    await ensureCallbackWebhook();
    const update = (await req.json()) as TgUpdate;
    const db = createServiceClient();

    const callback = update.callback_query;
    if (callback?.data && callback.from) {
      const data = callback.data.trim();

      if (data === 'menu_status') {
        const chatId = callback.message?.chat.id ?? callback.from.id;
        if (
          (callback.message?.chat.type === 'private' || !callback.message) &&
          !(await isBotUnlocked(db, callback.from.id))
        ) {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Avval oila parolini yuboring',
            show_alert: true,
          });
          await askFamilyPassword(chatId);
          return jsonResponse({ ok: true });
        }
        await telegramApi('answerCallbackQuery', { callback_query_id: callback.id });
        await handleStatus(db, chatId, callback.from.id);
        return jsonResponse({ ok: true });
      }

      // Cheer (existing)
      const cheerParsed = parseCheerCallback(data);
      if (cheerParsed) {
        const person = await loadPerson(db, cheerParsed.personId);
        if (!person) {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: cheerNotFoundText(),
            show_alert: true,
          });
          return jsonResponse({ ok: true });
        }

        let cheerResult: 'inserted' | 'existing' = 'inserted';
        try {
          cheerResult = await saveCheer(db, person, cheerParsed.year, callback.from);
        } catch (err) {
          console.error('cheer save failed', err);
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Avval sozlamalarni tekshiring, keyin qayta bosing.',
            show_alert: true,
          });
          return jsonResponse({ ok: false, error: 'cheers_table' });
        }

        const display = tgDisplayName(callback.from);
        if (cheerResult === 'existing') {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: cheerAlreadyText(),
            show_alert: false,
          });
          return jsonResponse({ ok: true, cheer: person.id, already: true });
        }

        await telegramApi('answerCallbackQuery', {
          callback_query_id: callback.id,
          text: 'Rahmat! 💛',
        });

        const groupChatId = callback.message?.chat.id;
        if (groupChatId) {
          try {
            await sendText(
              groupChatId,
              cheerAnnounceText(escapeHtml(display), escapeHtml(displayName(person))),
              callback.message?.message_id
                ? { reply_to_message_id: callback.message.message_id }
                : {},
            );
          } catch (err) {
            console.error('cheer announce failed', err);
          }
        }
        return jsonResponse({ ok: true, cheer: person.id });
      }

      // Claim identity
      const claimId = parseClaimCallback(data);
      if (claimId) {
        const chatId = callback.message?.chat.id ?? callback.from.id;
        if (
          (callback.message?.chat.type === 'private' || !callback.message) &&
          !(await isBotUnlocked(db, callback.from.id))
        ) {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Avval oila parolini yuboring',
            show_alert: true,
          });
          await askFamilyPassword(chatId);
          return jsonResponse({ ok: true });
        }
        const person = await loadPerson(db, claimId);
        if (!person) {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Topilmadi',
            show_alert: true,
          });
          return jsonResponse({ ok: true });
        }
        try {
          await linkPerson(db, person.id, callback.from, chatId);
          await clearDmState(db, callback.from.id);
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Ulandi ✅',
          });
          await sendText(
            chatId,
            `✅ Endi siz <b>${escapeHtml(displayName(person))}</b> sifatida ulandingiz.\nTug‘ilgan kuningizda tilaklar shaxsiy xabar bilan kelishi mumkin.`,
            { reply_markup: mainMenuKeyboard(isBotOwner(callback.from.id)) },
          );
        } catch (err) {
          console.error('claim link failed', err);
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Ulanmadi — qayta urinib ko‘ring',
            show_alert: true,
          });
        }
        return jsonResponse({ ok: true });
      }

      // Find / browse tree
      const findId = parseFindCallback(data);
      if (findId) {
        const chatId = callback.message?.chat.id ?? callback.from.id;
        if (
          (callback.message?.chat.type === 'private' || !callback.message) &&
          !(await isBotUnlocked(db, callback.from.id))
        ) {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Avval oila parolini yuboring',
            show_alert: true,
          });
          await askFamilyPassword(chatId);
          return jsonResponse({ ok: true });
        }
        const person = await loadPerson(db, findId);
        if (!person) {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Topilmadi',
            show_alert: true,
          });
          return jsonResponse({ ok: true });
        }
        const settings = await loadSettings(db);
        const members = await loadAllMembers(db);
        const rels = await loadRels(db);
        await telegramApi('answerCallbackQuery', { callback_query_id: callback.id });
        const keyboard = relativeButtons(person, members, rels);
        await sendText(chatId, personCardText(person, members, rels, settings.timezone), {
          reply_markup: keyboard.length
            ? { inline_keyboard: keyboard }
            : {
                inline_keyboard: [
                  [{ text: TG_BUTTONS.openTree, url: `${publicAppUrl().replace(/\/$/, '')}/tree` }],
                ],
              },
        });
        return jsonResponse({ ok: true });
      }

      // Wish pick from list
      const wishPick = parseWishStart(data);
      if (wishPick) {
        const person = await loadPerson(db, wishPick.personId);
        if (!person) {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Topilmadi',
            show_alert: true,
          });
          return jsonResponse({ ok: true });
        }
        const chatId = callback.message?.chat.id ?? callback.from.id;
        // In groups: send deep-link to DM
        if (callback.message?.chat.type === 'group' || callback.message?.chat.type === 'supergroup') {
          const settings = await loadSettings(db);
          const bot = settings.bot_username?.replace(/^@/, '');
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: bot ? 'Botga yozing — tilakni shaxsiy yuboring' : 'Botga /wish yozing',
            show_alert: false,
            ...(bot
              ? { url: `https://t.me/${bot}?start=${wishStartPayload(person.id, wishPick.year)}` }
              : {}),
          });
          return jsonResponse({ ok: true });
        }
        if (!(await isBotUnlocked(db, callback.from.id))) {
          await setDmState(db, callback.from.id, 'auth_pending_wish', {
            personId: person.id,
            year: wishPick.year,
          });
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Avval oila parolini yuboring',
            show_alert: true,
          });
          await askFamilyPassword(chatId);
          return jsonResponse({ ok: true });
        }
        await telegramApi('answerCallbackQuery', { callback_query_id: callback.id });
        await beginWish(db, chatId, callback.from, person, wishPick.year);
        return jsonResponse({ ok: true });
      }

      await telegramApi('answerCallbackQuery', {
        callback_query_id: callback.id,
        text: unknownStartText(),
        show_alert: true,
      });
      return jsonResponse({ ok: true });
    }

    const member = update.my_chat_member;
    if (member?.chat && (member.chat.type === 'group' || member.chat.type === 'supergroup')) {
      const status = member.new_chat_member.status;
      if (status === 'member' || status === 'administrator') {
        const settings = await loadSettings(db);
        const current = settings.group_chat_id ?? null;
        const incoming = String(member.chat.id);
        if (!current || current === incoming) {
          await db.rest('telegram_settings', {
            method: 'PATCH',
            query: { id: 'eq.1' },
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              group_chat_id: incoming,
              enabled: true,
            }),
          });
          await sendText(member.chat.id, 'Oq-Ariq tug‘ilgan kun boti shu guruhga ulandi. Tilaklar Sozlamalardagi soatda yuboriladi.');
        } else {
          await sendText(
            member.chat.id,
            'Bu bot boshqa oila guruhiga ulangan. Avval Sozlamalarda guruhni uzing, keyin meni qayta qo‘shing.',
          );
        }
      }
      return jsonResponse({ ok: true });
    }

    const msg = update.message;
    if (!msg?.text || !msg.from) {
      return jsonResponse({ ok: true, ignored: true });
    }

    const text = msg.text.trim();
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isPrivate = msg.chat.type === 'private';

    // ——— Private chat: password gate (owner skips) ———
    if (isPrivate) {
      let unlocked = await isBotUnlocked(db, userId);

      const startEarly = /^\/start(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
      if (!unlocked && startEarly) {
        const payload = (startEarly[1] || '').trim();
        const cheer = parseCheerCallback(payload);
        if (cheer) {
          // One-shot cheer from group button — allowed without unlock
          const person = await loadPerson(db, cheer.personId);
          if (!person) {
            await sendText(chatId, cheerNotFoundText());
            return jsonResponse({ ok: true });
          }
          const display = tgDisplayName(msg.from);
          let cheerResult: 'inserted' | 'existing' = 'inserted';
          try {
            cheerResult = await saveCheer(db, person, cheer.year, msg.from);
          } catch (err) {
            console.error('cheer save failed', err);
            await sendText(chatId, 'Deyarli! Egadan birthday cheers SQL migratsiyasini so‘rang.');
            return jsonResponse({ ok: false, error: 'cheers_table' });
          }
          if (cheerResult === 'existing') {
            await sendText(chatId, cheerAlreadyText());
          } else {
            const page = birthdayPageUrl(person.id);
            await sendText(
              chatId,
              cheerThanksText(escapeHtml(display), escapeHtml(displayName(person)), page),
            );
            try {
              const settings = await loadSettings(db);
              if (settings.group_chat_id) {
                await sendText(
                  settings.group_chat_id,
                  cheerAnnounceText(escapeHtml(display), escapeHtml(displayName(person))),
                );
              }
            } catch (err) {
              console.error('cheer group announce failed', err);
            }
          }
          await askFamilyPassword(chatId);
          return jsonResponse({ ok: true, cheer: person.id });
        }

        const wish = parseWishStart(payload);
        if (wish || /^wish$/i.test(payload)) {
          if (wish) {
            await setDmState(db, userId, 'auth_pending_wish', {
              personId: wish.personId,
              year: wish.year,
            });
          }
          await askFamilyPassword(chatId);
          return jsonResponse({ ok: true });
        }

        await askFamilyPassword(chatId);
        return jsonResponse({ ok: true });
      }

      if (!unlocked) {
        // Any non-command text is treated as password attempt
        if (!text.startsWith('/')) {
          await tryUnlockWithPassword(db, chatId, msg.from, text);
          return jsonResponse({ ok: true });
        }
        // Locked users cannot use commands (except we already handled /start)
        await askFamilyPassword(chatId);
        return jsonResponse({ ok: true });
      }

      // Unlocked: wizards + menu buttons
      const menuAction = parseMenuAction(text);
      const dm = await getDmState(db, userId);

      if (menuAction) {
        await clearDmState(db, userId);
        await runMenuAction(db, chatId, msg.from, menuAction);
        return jsonResponse({ ok: true });
      }

      if (dm?.state === 'wish_await_text' && !text.startsWith('/')) {
        const personId = typeof dm.payload.personId === 'string' ? dm.payload.personId : '';
        const year = typeof dm.payload.year === 'number' ? dm.payload.year : Number(dm.payload.year);
        const person = personId ? await loadPerson(db, personId) : null;
        if (!person || !Number.isFinite(year)) {
          await clearDmState(db, userId);
          await sendText(chatId, 'Sessiya eskirgan. Qayta: ✍️ Tilak');
          return jsonResponse({ ok: true });
        }
        if (text.trim().length < 2) {
          await sendText(chatId, 'Tilak juda qisqa — kamida 2 belgi.');
          return jsonResponse({ ok: true });
        }
        const settings = await loadSettings(db);
        try {
          const { deliveredDm } = await saveAndDeliverWish({
            db,
            person,
            year,
            from: msg.from,
            message: text,
            groupChatId: settings.group_chat_id,
          });
          await clearDmState(db, userId);
          await sendText(
            chatId,
            deliveredDm
              ? `✅ Tilak yuborildi — <b>${escapeHtml(displayName(person))}</b> shaxsiy xabar oldi (va guruhga ham).`
              : `✅ Tilak saqlandi va guruhga yozildi.\n(Shaxsiy DM yo‘q — u hali «👤 Bu men» bilan ulanmagan. Hammasi joyida!)`,
            { reply_markup: mainMenuKeyboard(isBotOwner(userId)) },
          );
        } catch (err) {
          console.error(err);
          await sendText(chatId, 'Tilak saqlanmadi. Birozdan keyin qayta urinib ko‘ring.');
        }
        return jsonResponse({ ok: true });
      }

      if (dm?.state === 'find_await_name' && !text.startsWith('/')) {
        await clearDmState(db, userId);
        await handleFindQuery(db, chatId, text);
        return jsonResponse({ ok: true });
      }

      if (dm?.state === 'claim_await_name' && !text.startsWith('/')) {
        await clearDmState(db, userId);
        await handleMeQuery(db, chatId, text);
        return jsonResponse({ ok: true });
      }

      const startMatch = /^\/start(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
      if (startMatch) {
        const payload = (startMatch[1] || '').trim();
        const cheer = parseCheerCallback(payload);
        if (cheer) {
          const person = await loadPerson(db, cheer.personId);
          if (!person) {
            await sendText(chatId, cheerNotFoundText());
            return jsonResponse({ ok: true });
          }
          const display = tgDisplayName(msg.from);
          let cheerResult: 'inserted' | 'existing' = 'inserted';
          try {
            cheerResult = await saveCheer(db, person, cheer.year, msg.from);
          } catch (err) {
            console.error('cheer save failed', err);
            await sendText(chatId, 'Deyarli! Egadan birthday cheers SQL migratsiyasini so‘rang.');
            return jsonResponse({ ok: false, error: 'cheers_table' });
          }
          if (cheerResult === 'existing') {
            await sendText(chatId, cheerAlreadyText(), {
              reply_markup: mainMenuKeyboard(isBotOwner(userId)),
            });
            return jsonResponse({ ok: true, cheer: person.id, already: true });
          }
          const page = birthdayPageUrl(person.id);
          await sendText(
            chatId,
            cheerThanksText(escapeHtml(display), escapeHtml(displayName(person)), page),
            { reply_markup: mainMenuKeyboard(isBotOwner(userId)) },
          );
          try {
            const settings = await loadSettings(db);
            if (settings.group_chat_id && String(settings.group_chat_id) !== String(chatId)) {
              await sendText(
                settings.group_chat_id,
                cheerAnnounceText(escapeHtml(display), escapeHtml(displayName(person))),
              );
            }
          } catch (err) {
            console.error('cheer group announce failed', err);
          }
          return jsonResponse({ ok: true, cheer: person.id });
        }

        const wish = parseWishStart(payload);
        if (wish) {
          const person = await loadPerson(db, wish.personId);
          if (!person) {
            await sendText(chatId, cheerNotFoundText());
            return jsonResponse({ ok: true });
          }
          await beginWish(db, chatId, msg.from, person, wish.year);
          return jsonResponse({ ok: true });
        }

        if (/^wish$/i.test(payload)) {
          await handleWishFlow(db, chatId, msg.from);
          return jsonResponse({ ok: true });
        }

        await sendMenu(chatId, userId, botWelcomeText());
        return jsonResponse({ ok: true });
      }

      if (/^\/(cancel|bekor)(?:@\w+)?$/i.test(text)) {
        await clearDmState(db, userId);
        await sendText(chatId, 'Bekor qilindi.', {
          reply_markup: mainMenuKeyboard(isBotOwner(userId)),
        });
        return jsonResponse({ ok: true });
      }

      if (/^\/help(?:@\w+)?$/i.test(text)) {
        await runMenuAction(db, chatId, msg.from, 'help');
        return jsonResponse({ ok: true });
      }
      if (/^\/status(?:@\w+)?$/i.test(text)) {
        await runMenuAction(db, chatId, msg.from, 'status');
        return jsonResponse({ ok: true });
      }
      if (/^\/test(?:@\w+)?$/i.test(text)) {
        await runMenuAction(db, chatId, msg.from, 'test');
        return jsonResponse({ ok: true });
      }
      if (/^\/(today|bugun)(?:@\w+)?$/i.test(text)) {
        await runMenuAction(db, chatId, msg.from, 'today');
        return jsonResponse({ ok: true });
      }
      if (/^\/(week|hafta)(?:@\w+)?$/i.test(text)) {
        await runMenuAction(db, chatId, msg.from, 'week');
        return jsonResponse({ ok: true });
      }
      if (/^\/(tree|daraxt)(?:@\w+)?$/i.test(text)) {
        await runMenuAction(db, chatId, msg.from, 'tree');
        return jsonResponse({ ok: true });
      }

      const findMatch = /^\/(?:find|kim|qidir)(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
      if (findMatch) {
        const q = (findMatch[1] || '').trim();
        if (q.length < 2) {
          await runMenuAction(db, chatId, msg.from, 'find');
          return jsonResponse({ ok: true });
        }
        await handleFindQuery(db, chatId, q);
        return jsonResponse({ ok: true });
      }

      const menMatch = /^\/(?:men|iam|menman)(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
      if (menMatch) {
        const q = (menMatch[1] || '').trim();
        if (q.length < 2) {
          await runMenuAction(db, chatId, msg.from, 'me');
          return jsonResponse({ ok: true });
        }
        await handleMeQuery(db, chatId, q);
        return jsonResponse({ ok: true });
      }

      const wishMatch = /^\/(?:wish|tilak)(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
      if (wishMatch) {
        await handleWishFlow(db, chatId, msg.from, wishMatch[1] || '');
        return jsonResponse({ ok: true });
      }

      // Plain name search
      if (!text.startsWith('/') && text.length >= 2 && text.length <= 40) {
        await handleFindQuery(db, chatId, text);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: true, userId });
    }

    // ——— Group / other chats (no password; no reply keyboard required) ———
    const startMatch = /^\/start(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
    if (startMatch) {
      await sendText(chatId, botWelcomeText());
      return jsonResponse({ ok: true });
    }

    if (/^\/help(?:@\w+)?$/i.test(text)) {
      await sendText(chatId, botHelpText());
      return jsonResponse({ ok: true });
    }

    if (/^\/(today|bugun)(?:@\w+)?$/i.test(text)) {
      await handleToday(db, chatId);
      return jsonResponse({ ok: true });
    }

    if (/^\/(week|hafta)(?:@\w+)?$/i.test(text)) {
      await handleWeek(db, chatId);
      return jsonResponse({ ok: true });
    }

    if (/^\/status(?:@\w+)?$/i.test(text)) {
      await handleStatus(db, chatId, userId);
      return jsonResponse({ ok: true });
    }

    // Menu button taps in group (if someone has the keyboard)
    const groupMenu = parseMenuAction(text);
    if (groupMenu && groupMenu !== 'lock' && groupMenu !== 'test' && groupMenu !== 'wish' && groupMenu !== 'me' && groupMenu !== 'find') {
      await runMenuAction(db, chatId, msg.from, groupMenu);
      return jsonResponse({ ok: true });
    }
    if (groupMenu === 'wish' || groupMenu === 'me' || groupMenu === 'find') {
      const settings = await loadSettings(db);
      const bot = settings.bot_username?.replace(/^@/, '');
      await sendText(
        chatId,
        bot
          ? `Buni botga shaxsiy yozing: https://t.me/${bot}`
          : 'Buni botga shaxsiy chatda oching.',
      );
      return jsonResponse({ ok: true });
    }

    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      if (/^\/setgroup(?:@\w+)?$/i.test(text)) {
        const settings = await loadSettings(db);
        const current = settings.group_chat_id ?? null;
        const incoming = String(chatId);
        if (current && current !== incoming) {
          await sendText(
            chatId,
            'Allaqachon boshqa guruhga ulangan. Sayt → Sozlamalar’da guruhni uzing, keyin /setgroup.',
          );
        } else {
          await db.rest('telegram_settings', {
            method: 'PATCH',
            query: { id: 'eq.1' },
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ group_chat_id: incoming, enabled: true }),
          });
          await sendText(chatId, 'Shu guruh tug‘ilgan kun xabarlari uchun saqlandi.');
        }
      }
    }

    return jsonResponse({ ok: true, userId });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
