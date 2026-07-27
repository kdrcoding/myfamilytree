import type { FamilyPerson } from '../types/family';
import { getUpcomingBirthdays } from './birthdays';
import { fullName } from './family';
import { countPendingJoinRequests } from '../lib/joinRequests';
import { listRecentAudioStories } from '../lib/audioStories';
import { supabase } from '../lib/supabase';
import { loadJson, saveJson, STORAGE_KEYS } from './storage';

export type FamilyNoticeKind = 'birthday' | 'join' | 'memory' | 'audio';

export interface FamilyNotice {
  id: string;
  kind: FamilyNoticeKind;
  title: string;
  body: string;
  href?: string;
  /** ISO date for dedupe of browser pushes */
  dayKey?: string;
}

export function inviteUrl(): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const path = `${import.meta.env.BASE_URL || '/'}`.replace(/\/?$/, '/');
  return `${base}${path}?invite=1`;
}

/** Build in-app notification items for the bell. */
export async function collectFamilyNotices(
  people: FamilyPerson[],
  labels: {
    birthdayTomorrow: (name: string) => string;
    birthdayToday: (name: string) => string;
    joinPending: (n: number) => string;
    joinPendingBody: string;
    memoryRecent: (title: string) => string;
    audioRecent: (title: string) => string;
  },
  opts: { isOwner: boolean },
): Promise<FamilyNotice[]> {
  const notices: FamilyNotice[] = [];
  const upcoming = getUpcomingBirthdays(people).filter((b) => b.daysUntil <= 1);

  for (const b of upcoming) {
    const name = fullName(b.person);
    notices.push({
      id: `bday-${b.person.id}-${b.daysUntil}`,
      kind: 'birthday',
      title: b.isToday ? labels.birthdayToday(name) : labels.birthdayTomorrow(name),
      body: name,
      href: `/tree?person=${encodeURIComponent(b.person.id)}`,
      dayKey: new Date().toISOString().slice(0, 10),
    });
  }

  if (opts.isOwner) {
    try {
      const n = await countPendingJoinRequests();
      if (n > 0) {
        notices.push({
          id: `join-${n}`,
          kind: 'join',
          title: labels.joinPending(n),
          body: labels.joinPendingBody,
          href: '/settings',
        });
      }
    } catch {
      /* table may not exist yet */
    }
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from('family_memories')
        .select('id, title, person_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const row of data ?? []) {
        const created = new Date(row.created_at as string).getTime();
        if (created < weekAgo) continue;
        const title = (row.title as string)?.trim() || 'Photo';
        notices.push({
          id: `mem-${row.id}`,
          kind: 'memory',
          title: labels.memoryRecent(title),
          body: title,
          href: row.person_id ? `/tree?person=${encodeURIComponent(row.person_id as string)}` : '/timeline',
        });
      }
    } catch {
      /* optional */
    }

    try {
      const stories = await listRecentAudioStories(5);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const story of stories) {
        if (new Date(story.created_at).getTime() < weekAgo) continue;
        const title = story.title?.trim() || 'Story';
        notices.push({
          id: `aud-${story.id}`,
          kind: 'audio',
          title: labels.audioRecent(title),
          body: title,
          href: `/tree?person=${encodeURIComponent(story.person_id)}`,
        });
      }
    } catch {
      /* optional */
    }
  }

  return notices;
}

/** Fire browser notifications for birthday items (at most once per day). */
export function maybePushBrowserNotices(
  notices: FamilyNotice[],
  enabled: boolean,
): void {
  if (!enabled || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const today = new Date().toISOString().slice(0, 10);
  const pushed =
    loadJson<string[]>(STORAGE_KEYS.browserNotifyPushed, (v): v is string[] => Array.isArray(v)) ??
    [];
  const next = [...pushed];

  for (const notice of notices) {
    if (notice.kind !== 'birthday') continue;
    const key = `${notice.id}:${today}`;
    if (next.includes(key)) continue;
    try {
      new Notification(notice.title, { body: notice.body, tag: notice.id });
      next.push(key);
    } catch {
      /* ignore */
    }
  }

  // Keep the log short.
  saveJson(STORAGE_KEYS.browserNotifyPushed, next.slice(-40));
}

export function telegramShareUrl(text: string): string {
  return `https://t.me/share/url?text=${encodeURIComponent(text)}`;
}

export function mailtoDigest(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
