import {
  corsHeaders,
  createServiceClient,
  displayName,
  jsonResponse,
  telegramApi,
  type FamilyMemberRow,
} from '../_shared/telegram.ts';
import { birthdayPageUrl } from '../_shared/wishes.ts';

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };
type TgChat = { id: number; type: string; title?: string };
type TgMessage = {
  text?: string;
  chat: TgChat;
  from?: TgUser;
};
type TgUpdate = {
  message?: TgMessage;
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

async function sendText(chatId: number | string, text: string) {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  });
}

function tgDisplayName(user: TgUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return parts || user.username || `User ${user.id}`;
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
    const update = (await req.json()) as TgUpdate;
    const db = createServiceClient();

    const member = update.my_chat_member;
    if (member?.chat && (member.chat.type === 'group' || member.chat.type === 'supergroup')) {
      const status = member.new_chat_member.status;
      if (status === 'member' || status === 'administrator') {
        // Only bind when no group is set yet, or the bot rejoined the same
        // saved group — prevents hijacking birthday posts to another chat.
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
          await sendText(
            member.chat.id,
            'Oq-Ariq birthday bot is ready for this group. Birthdays will be posted at the hour set in Settings.',
          );
        } else {
          await sendText(
            member.chat.id,
            'This bot is already linked to another family group. Clear the group in Settings, then add me again — or run /setgroup only after clearing.',
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

    const startMatch = /^\/start(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
    if (startMatch) {
      const payload = (startMatch[1] || '').trim();

      // cheer_<personId>_<year> — save Telegram name, send public page link (no DMs on birthday).
      const cheerMatch = /^cheer_(.+)_(\d{4})$/.exec(payload);
      if (cheerMatch) {
        const personId = cheerMatch[1];
        const year = Number(cheerMatch[2]);
        const people = await db.rest<FamilyMemberRow[]>('family_members', {
          query: {
            select: 'id,first_name,last_name,nickname,birth_date,death_date,is_deceased,photo',
            id: `eq.${personId}`,
          },
        });
        const person = people[0];
        if (!person) {
          await sendText(chatId, 'That birthday page was not found.');
          return jsonResponse({ ok: true });
        }

        const display = tgDisplayName(msg.from);
        try {
          await db.rest('telegram_birthday_cheers', {
            method: 'POST',
            query: { on_conflict: 'person_id,year,telegram_user_id' },
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
              person_id: person.id,
              year,
              telegram_user_id: userId,
              display_name: display,
              username: msg.from.username || null,
            }),
          });
        } catch (err) {
          console.error('cheer save failed', err);
          await sendText(
            chatId,
            'Almost! Ask the owner to run the birthday cheers SQL migration, then tap again.',
          );
          return jsonResponse({ ok: false, error: 'cheers_table' });
        }

        const page = birthdayPageUrl(person.id);
        await sendText(
          chatId,
          `Thanks, <b>${escapeHtml(display)}</b>! 💛 Your name is on ${escapeHtml(displayName(person))}'s birthday page.\n\nOpen it (no password): ${page}`,
        );
        return jsonResponse({ ok: true, cheer: person.id });
      }

      if (!payload) {
        await sendText(
          chatId,
          'Welcome to <b>Oq-Ariq OILASI</b> birthday wishes!\n\nWhen someone has a birthday, tap <b>I\'m celebrating</b> in the family group — we save your Telegram name on their page.',
        );
        return jsonResponse({ ok: true });
      }

      await sendText(chatId, 'Unknown link. Open a birthday post in the family group and tap the buttons there.');
      return jsonResponse({ ok: true });
    }

    if (/^\/help/i.test(text)) {
      await sendText(
        chatId,
        'Oq-Ariq birthday bot\n• Posts wishes in the family group only (no private DMs)\n• Tap “I\'m celebrating” to leave your name\n• Open the birthday page link — no password needed',
      );
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
          await sendText(
            chatId,
            'Already linked to another group. In the website Settings → Telegram birthdays, clear the group first, then run /setgroup here.',
          );
        } else {
          await db.rest('telegram_settings', {
            method: 'PATCH',
            query: { id: 'eq.1' },
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ group_chat_id: incoming, enabled: true }),
          });
          await sendText(chatId, 'Saved this group for birthday posts.');
        }
      }
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
