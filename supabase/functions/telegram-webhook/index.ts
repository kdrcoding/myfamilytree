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
  claimCallbackData,
  clearDmState,
  findCallbackData,
  getDmState,
  isBotOwner,
  linkPerson,
  loadAllMembers,
  loadRels,
  loadSettings,
  parseClaimCallback,
  parseFindCallback,
  parseWishStart,
  peopleBirthdaySoon,
  peopleWithBirthdayToday,
  personCardText,
  relativeButtons,
  saveAndDeliverWish,
  searchPeople,
  sendText,
  setDmState,
  tgDisplayName,
  treeBrowseHelp,
  wishStartPayload,
  escapeHtml,
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
        const person = await loadPerson(db, claimId);
        if (!person) {
          await telegramApi('answerCallbackQuery', {
            callback_query_id: callback.id,
            text: 'Topilmadi',
            show_alert: true,
          });
          return jsonResponse({ ok: true });
        }
        const chatId = callback.message?.chat.id ?? callback.from.id;
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
        const chatId = callback.message?.chat.id ?? callback.from.id;
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

    // Pending DM wizard (wish text)
    if (isPrivate) {
      const dm = await getDmState(db, userId);
      if (dm?.state === 'wish_await_text' && !text.startsWith('/')) {
        const personId = typeof dm.payload.personId === 'string' ? dm.payload.personId : '';
        const year = typeof dm.payload.year === 'number' ? dm.payload.year : Number(dm.payload.year);
        const person = personId ? await loadPerson(db, personId) : null;
        if (!person || !Number.isFinite(year)) {
          await clearDmState(db, userId);
          await sendText(chatId, 'Sessiya eskirgan. Qayta: /wish');
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
              : `✅ Tilak saqlandi va guruhga yozildi.\n(Shaxsiy DM yo‘q — u hali botni <code>/men</code> bilan ulamagan yoki bloklagan. Hammasi joyida!)`,
          );
        } catch (err) {
          console.error(err);
          await sendText(chatId, 'Tilak saqlanmadi. Birozdan keyin qayta urinib ko‘ring.');
        }
        return jsonResponse({ ok: true });
      }
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
          await sendText(
            chatId,
            'Deyarli! Egadan birthday cheers SQL migratsiyasini so‘rang, keyin qayta bosing.',
          );
          return jsonResponse({ ok: false, error: 'cheers_table' });
        }

        if (cheerResult === 'existing') {
          await sendText(chatId, cheerAlreadyText());
          return jsonResponse({ ok: true, cheer: person.id, already: true });
        }

        const page = birthdayPageUrl(person.id);
        await sendText(
          chatId,
          cheerThanksText(escapeHtml(display), escapeHtml(displayName(person)), page),
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

      if (!payload || /^wish$/i.test(payload)) {
        if (/^wish$/i.test(payload)) {
          // Deep-link from group “Tilak yozish” without a person — same as /wish
          const settings = await loadSettings(db);
          const members = await loadAllMembers(db);
          const today = peopleWithBirthdayToday(members, settings.timezone);
          const localYear = localParts(settings.timezone).year;
          if (today.length === 1) {
            await beginWish(db, chatId, msg.from, today[0]!.person, localYear);
            return jsonResponse({ ok: true });
          }
          if (today.length > 1) {
            const keyboard = today.map((row) => [
              {
                text: displayName(row.person).slice(0, 40),
                callback_data: wishStartPayload(row.person.id, localYear),
              },
            ]);
            await sendText(chatId, 'Kimga tilak?', {
              reply_markup: { inline_keyboard: keyboard },
            });
            return jsonResponse({ ok: true });
          }
          await sendText(
            chatId,
            'Hozir ochiq bayram yo‘q. Ism bilan: <code>/wish Sobirjon</code>',
          );
          return jsonResponse({ ok: true });
        }
        await sendText(chatId, botWelcomeText());
        return jsonResponse({ ok: true });
      }

      await sendText(chatId, unknownStartText());
      return jsonResponse({ ok: true });
    }

    if (/^\/(cancel|bekor)(?:@\w+)?$/i.test(text)) {
      await clearDmState(db, userId);
      await sendText(chatId, 'Bekor qilindi.');
      return jsonResponse({ ok: true });
    }

    if (/^\/help(?:@\w+)?$/i.test(text)) {
      await sendText(chatId, botHelpText());
      return jsonResponse({ ok: true });
    }

    if (/^\/status(?:@\w+)?$/i.test(text)) {
      await handleStatus(db, chatId, userId);
      return jsonResponse({ ok: true });
    }

    if (/^\/test(?:@\w+)?$/i.test(text)) {
      if (!isPrivate) {
        await sendText(chatId, 'Sinovni botga shaxsiy yozing.');
        return jsonResponse({ ok: true });
      }
      await handleOwnerTest(db, chatId, userId);
      return jsonResponse({ ok: true });
    }

    if (/^\/(today|bugun)(?:@\w+)?$/i.test(text)) {
      const settings = await loadSettings(db);
      const members = await loadAllMembers(db);
      const today = peopleWithBirthdayToday(members, settings.timezone);
      if (today.length === 0) {
        await sendText(chatId, 'Bugun tug‘ilgan kun yo‘q 🎈');
        return jsonResponse({ ok: true });
      }
      const lines = ['🎂 <b>Bugun</b>', ''];
      const keyboard: { text: string; callback_data: string }[][] = [];
      for (const row of today) {
        const label = displayName(row.person);
        lines.push(
          `• <b>${escapeHtml(label)}</b>${row.age != null ? ` — ${row.age} yosh` : ''}`,
        );
        const wishData = wishStartPayload(row.person.id, localParts(settings.timezone).year);
        if (wishData.length <= 64) {
          keyboard.push([{ text: `✍️ ${label.slice(0, 24)}`, callback_data: wishData }]);
        }
      }
      await sendText(chatId, lines.join('\n'), {
        reply_markup: keyboard.length ? { inline_keyboard: keyboard } : undefined,
      });
      return jsonResponse({ ok: true });
    }

    if (/^\/(week|hafta)(?:@\w+)?$/i.test(text)) {
      const settings = await loadSettings(db);
      const members = await loadAllMembers(db);
      const week = peopleBirthdaySoon(members, settings.timezone, 7);
      if (week.length === 0) {
        await sendText(chatId, 'Yaqin 7 kunda tug‘ilgan kun yo‘q.');
        return jsonResponse({ ok: true });
      }
      const lines = ['📅 <b>7 kun ichida</b>', ''];
      for (const row of week) {
        const when =
          row.days === 0 ? 'bugun' : row.days === 1 ? 'ertaga' : `${row.days} kun`;
        lines.push(
          `• <b>${escapeHtml(displayName(row.person))}</b> — ${when}${row.age != null ? ` · ${row.age}` : ''}`,
        );
      }
      await sendText(chatId, lines.join('\n'));
      return jsonResponse({ ok: true });
    }

    if (/^\/(tree|daraxt)(?:@\w+)?$/i.test(text)) {
      await sendText(chatId, treeBrowseHelp(), {
        reply_markup: {
          inline_keyboard: [
            [{ text: TG_BUTTONS.openTree, url: `${publicAppUrl().replace(/\/$/, '')}/tree` }],
          ],
        },
      });
      return jsonResponse({ ok: true });
    }

    const findMatch = /^\/(?:find|kim|qidir)(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
    if (findMatch) {
      const q = (findMatch[1] || '').trim();
      if (q.length < 2) {
        await sendText(chatId, 'Masalan: <code>/find Aziza</code>');
        return jsonResponse({ ok: true });
      }
      const settings = await loadSettings(db);
      const members = await loadAllMembers(db);
      const rels = await loadRels(db);
      const hits = searchPeople(members, q, 6);
      if (hits.length === 0) {
        await sendText(chatId, `“${escapeHtml(q)}” topilmadi.`);
        return jsonResponse({ ok: true });
      }
      if (hits.length === 1) {
        const person = hits[0]!;
        const keyboard = relativeButtons(person, members, rels);
        await sendText(chatId, personCardText(person, members, rels, settings.timezone), {
          reply_markup: keyboard.length ? { inline_keyboard: keyboard } : undefined,
        });
        return jsonResponse({ ok: true });
      }
      const keyboard = hits.map((p) => [
        { text: displayName(p).slice(0, 40), callback_data: findCallbackData(p.id) },
      ]);
      await sendText(chatId, `Bir nechta topildi — tanlang:`, {
        reply_markup: { inline_keyboard: keyboard },
      });
      return jsonResponse({ ok: true });
    }

    const menMatch = /^\/(?:men|iam|menman)(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
    if (menMatch) {
      if (!isPrivate) {
        await sendText(chatId, 'O‘zingizni ulash uchun botga shaxsiy yozing: /men Ism');
        return jsonResponse({ ok: true });
      }
      const q = (menMatch[1] || '').trim();
      if (q.length < 2) {
        await sendText(
          chatId,
          'O‘zingizni ulang — tilaklar shaxsiy keladi.\nMasalan: <code>/men Sobirjon</code>',
        );
        return jsonResponse({ ok: true });
      }
      const members = await loadAllMembers(db);
      const hits = searchPeople(members, q, 6);
      if (hits.length === 0) {
        await sendText(chatId, `“${escapeHtml(q)}” topilmadi. To‘liqroq yozing.`);
        return jsonResponse({ ok: true });
      }
      const keyboard = hits.map((p) => [
        {
          text: `✅ Men — ${displayName(p).slice(0, 28)}`,
          callback_data: claimCallbackData(p.id),
        },
      ]);
      await sendText(chatId, 'Qaysi biri siz?', {
        reply_markup: { inline_keyboard: keyboard },
      });
      return jsonResponse({ ok: true });
    }

    const wishMatch = /^\/(?:wish|tilak)(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
    if (wishMatch) {
      if (!isPrivate) {
        const settings = await loadSettings(db);
        const bot = settings.bot_username?.replace(/^@/, '');
        await sendText(
          chatId,
          bot
            ? `Tilak yozish uchun botga shaxsiy yozing: https://t.me/${bot}?start=wish`
            : 'Tilak yozish uchun botga shaxsiy /wish yozing.',
        );
        return jsonResponse({ ok: true });
      }
      const settings = await loadSettings(db);
      const members = await loadAllMembers(db);
      const q = (wishMatch[1] || '').trim();
      const localYear = new Date().getFullYear();

      if (q.length >= 2) {
        const hits = searchPeople(members, q, 6);
        if (hits.length === 0) {
          await sendText(chatId, `“${escapeHtml(q)}” topilmadi.`);
          return jsonResponse({ ok: true });
        }
        if (hits.length === 1) {
          await beginWish(db, chatId, msg.from, hits[0]!, localYear);
          return jsonResponse({ ok: true });
        }
        const keyboard = hits.map((p) => [
          {
            text: displayName(p).slice(0, 40),
            callback_data: wishStartPayload(p.id, localYear),
          },
        ]);
        await sendText(chatId, 'Kimga tilak?', {
          reply_markup: { inline_keyboard: keyboard },
        });
        return jsonResponse({ ok: true });
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
          'Hozir ochiq bayram yo‘q. Ism bilan yozing: <code>/wish Sobirjon</code>',
        );
        return jsonResponse({ ok: true });
      }
      if (pool.length === 1) {
        await beginWish(db, chatId, msg.from, pool[0]!, localYear);
        return jsonResponse({ ok: true });
      }
      const keyboard = pool.slice(0, 8).map((p) => [
        {
          text: displayName(p).slice(0, 40),
          callback_data: wishStartPayload(p.id, localYear),
        },
      ]);
      await sendText(chatId, 'Kimga tilak yozasiz?', {
        reply_markup: { inline_keyboard: keyboard },
      });
      return jsonResponse({ ok: true });
    }

    // Plain name search in private chat (tree browse without slash)
    if (isPrivate && !text.startsWith('/') && text.length >= 2 && text.length <= 40) {
      const settings = await loadSettings(db);
      const members = await loadAllMembers(db);
      const hits = searchPeople(members, text, 5);
      if (hits.length === 1) {
        const rels = await loadRels(db);
        const person = hits[0]!;
        const keyboard = [
          ...relativeButtons(person, members, rels),
          [
            {
              text: '✍️ Tilak yozish',
              callback_data: wishStartPayload(person.id, localParts(settings.timezone).year),
            },
          ],
        ];
        await sendText(chatId, personCardText(person, members, rels, settings.timezone), {
          reply_markup: { inline_keyboard: keyboard },
        });
        return jsonResponse({ ok: true });
      }
      if (hits.length > 1) {
        const keyboard = hits.map((p) => [
          { text: displayName(p).slice(0, 40), callback_data: findCallbackData(p.id) },
        ]);
        await sendText(chatId, 'Bir nechta odam — tanlang:', {
          reply_markup: { inline_keyboard: keyboard },
        });
        return jsonResponse({ ok: true });
      }
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
