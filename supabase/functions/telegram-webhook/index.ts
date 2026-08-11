import {
  corsHeaders,
  createServiceClient,
  displayName,
  jsonResponse,
  telegramApi,
  type FamilyMemberRow,
} from '../_shared/telegram.ts';

type TgUser = { id: number; first_name?: string; username?: string };
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
  if (!expected) return true; // allow if not configured (local)
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

    // Bot added / removed from a group → store group id when promoted/member.
    const member = update.my_chat_member;
    if (member?.chat && (member.chat.type === 'group' || member.chat.type === 'supergroup')) {
      const status = member.new_chat_member.status;
      if (status === 'member' || status === 'administrator') {
        await db.rest('telegram_settings', {
          method: 'PATCH',
          query: { id: 'eq.1' },
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            group_chat_id: String(member.chat.id),
            enabled: true,
          }),
        });
        await sendText(
          member.chat.id,
          'Oq-Ariq birthday bot is ready for this group. Birthdays will be posted at the hour set in Settings.',
        );
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

    // Deep link: /start link_<token> or /start <token>
    const startMatch = /^\/start(?:@\w+)?(?:\s+(.+))?$/i.exec(text);
    if (startMatch) {
      const payload = (startMatch[1] || '').trim();
      const token = payload.startsWith('link_') ? payload.slice(5) : payload;

      if (!token) {
        await sendText(
          chatId,
          'Welcome to <b>Oq-Ariq OILASI</b> birthday wishes!\n\nOpen your personal invite link from the family tree Settings to connect your account, or ask the owner to send you one.',
        );
        return jsonResponse({ ok: true });
      }

      const tokens = await db.rest<
        { token: string; person_id: string; expires_at: string; used_at: string | null }[]
      >('telegram_link_tokens', {
        query: { select: '*', token: `eq.${token}` },
      });
      const row = tokens[0];
      if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
        await sendText(chatId, 'That invite link is invalid or expired. Ask the owner for a new one.');
        return jsonResponse({ ok: true });
      }

      const people = await db.rest<FamilyMemberRow[]>('family_members', {
        query: {
          select: 'id,first_name,last_name,nickname,birth_date,death_date,is_deceased,photo',
          id: `eq.${row.person_id}`,
        },
      });
      const person = people[0];
      if (!person) {
        await sendText(chatId, 'That family member was not found.');
        return jsonResponse({ ok: true });
      }

      await db.rest('telegram_person_links', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          person_id: person.id,
          telegram_user_id: userId,
          chat_id: chatId,
          display_name: msg.from.first_name || msg.from.username || null,
        }),
      });
      await db.rest('telegram_link_tokens', {
        method: 'PATCH',
        query: { token: `eq.${token}` },
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      });

      await sendText(
        chatId,
        `Linked! You are connected as <b>${displayName(person)}</b>.\nOn your birthday you will get a private wish here, and the family group will celebrate too.`,
      );
      return jsonResponse({ ok: true, linked: person.id });
    }

    if (/^\/help/i.test(text)) {
      await sendText(
        chatId,
        'Oq-Ariq birthday bot\n• Add me to the family group\n• Open your invite link from Settings to get a DM on your birthday',
      );
      return jsonResponse({ ok: true });
    }

    // Capture group id if someone @mentions or writes in group after add.
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      if (/^\/setgroup/i.test(text)) {
        await db.rest('telegram_settings', {
          method: 'PATCH',
          query: { id: 'eq.1' },
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ group_chat_id: String(chatId), enabled: true }),
        });
        await sendText(chatId, 'Saved this group for birthday posts.');
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
