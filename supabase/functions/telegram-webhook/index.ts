import {
  corsHeaders,
  createServiceClient,
  displayName,
  ensureCallbackWebhook,
  jsonResponse,
  telegramApi,
  type FamilyMemberRow,
} from '../_shared/telegram.ts';
import {
  birthdayPageUrl,
  botHelpText,
  botWelcomeText,
  cheerAnnounceText,
  cheerNotFoundText,
  cheerThanksText,
  groupAlreadyLinkedText,
  groupClearFirstText,
  groupReadyText,
  groupSavedText,
  parseCheerCallback,
  unknownStartText,
} from '../_shared/wishes.ts';

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };
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

async function sendText(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
) {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

function tgDisplayName(user: TgUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return parts || user.username || `User ${user.id}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function saveCheer(
  db: ReturnType<typeof createServiceClient>,
  person: FamilyMemberRow,
  year: number,
  user: TgUser,
): Promise<void> {
  await db.rest('telegram_birthday_cheers', {
    method: 'POST',
    query: { on_conflict: 'person_id,year,telegram_user_id' },
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      person_id: person.id,
      year,
      telegram_user_id: user.id,
      display_name: tgDisplayName(user),
      username: user.username || null,
    }),
  });
}

async function loadPerson(
  db: ReturnType<typeof createServiceClient>,
  personId: string,
): Promise<FamilyMemberRow | null> {
  const people = await db.rest<FamilyMemberRow[]>('family_members', {
    query: {
      select: 'id,first_name,last_name,nickname,birth_date,death_date,is_deceased,photo',
      id: `eq.${personId}`,
    },
  });
  return people[0] ?? null;
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
      const parsed = parseCheerCallback(callback.data);
      if (!parsed) {
        await telegramApi('answerCallbackQuery', {
          callback_query_id: callback.id,
          text: unknownStartText(),
          show_alert: true,
        });
        return jsonResponse({ ok: true });
      }

      const person = await loadPerson(db, parsed.personId);
      if (!person) {
        await telegramApi('answerCallbackQuery', {
          callback_query_id: callback.id,
          text: cheerNotFoundText(),
          show_alert: true,
        });
        return jsonResponse({ ok: true });
      }

      try {
        await saveCheer(db, person, parsed.year, callback.from);
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
      await telegramApi('answerCallbackQuery', {
        callback_query_id: callback.id,
        text: 'Rahmat! 💛',
      });

      const groupChatId = callback.message?.chat.id;
      if (groupChatId) {
        await sendText(
          groupChatId,
          cheerAnnounceText(escapeHtml(display), escapeHtml(displayName(person))),
          callback.message?.message_id
            ? { reply_to_message_id: callback.message.message_id }
            : {},
        );
      }

      return jsonResponse({ ok: true, cheer: person.id });
    }

    const member = update.my_chat_member;
    if (member?.chat && (member.chat.type === 'group' || member.chat.type === 'supergroup')) {
      const status = member.new_chat_member.status;
      if (status === 'member' || status === 'administrator') {
        const settingsRows = await db.rest<{ group_chat_id: string | null }[]>('telegram_settings', {
          query: { select: 'group_chat_id', id: 'eq.1' },
        });
        const current = settingsRows[0]?.group_chat_id ?? null;
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
          await sendText(member.chat.id, groupReadyText());
        } else {
          await sendText(member.chat.id, groupAlreadyLinkedText());
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
        try {
          await saveCheer(db, person, cheer.year, msg.from);
        } catch (err) {
          console.error('cheer save failed', err);
          await sendText(
            chatId,
            'Deyarli! Egadan birthday cheers SQL migratsiyasini so‘rang, keyin qayta bosing.',
          );
          return jsonResponse({ ok: false, error: 'cheers_table' });
        }

        const page = birthdayPageUrl(person.id);
        await sendText(
          chatId,
          cheerThanksText(escapeHtml(display), escapeHtml(displayName(person)), page),
        );
        return jsonResponse({ ok: true, cheer: person.id });
      }

      if (!payload) {
        await sendText(chatId, botWelcomeText());
        return jsonResponse({ ok: true });
      }

      await sendText(chatId, unknownStartText());
      return jsonResponse({ ok: true });
    }

    if (/^\/help/i.test(text)) {
      await sendText(chatId, botHelpText());
      return jsonResponse({ ok: true });
    }

    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      if (/^\/setgroup/i.test(text)) {
        const settingsRows = await db.rest<{ group_chat_id: string | null }[]>('telegram_settings', {
          query: { select: 'group_chat_id', id: 'eq.1' },
        });
        const current = settingsRows[0]?.group_chat_id ?? null;
        const incoming = String(chatId);
        if (current && current !== incoming) {
          await sendText(chatId, groupClearFirstText());
        } else {
          await db.rest('telegram_settings', {
            method: 'PATCH',
            query: { id: 'eq.1' },
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ group_chat_id: incoming, enabled: true }),
          });
          await sendText(chatId, groupSavedText());
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
