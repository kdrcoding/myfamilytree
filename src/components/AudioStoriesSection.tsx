import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, Trash2 } from 'lucide-react';
import type { FamilyPerson } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { usePhotoUrl } from '../context/PhotoUrlsContext';
import { useToast } from '../context/ToastContext';
import { useT } from '../i18n/useT';
import {
  addAudioStory,
  deleteAudioStory,
  listAudioStories,
  type AudioStory,
} from '../lib/audioStories';

const MAX_SECONDS = 90;

function StoryRow({
  story,
  canDelete,
  onDeleted,
}: {
  story: AudioStory;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const url = usePhotoUrl(story.audio);
  const t = useT();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    const ok = await confirm({
      title: t('audio.deleteTitle'),
      message: t('audio.deleteMsg'),
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteAudioStory(story);
      toast(t('audio.deleted'), 'success');
      onDeleted();
    } catch (error) {
      console.error(error);
      toast(t('audio.deleteFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-900/60">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
            {story.title?.trim() || t('audio.untitled')}
          </p>
          {story.caption?.trim() && (
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{story.caption}</p>
          )}
          {typeof story.duration_sec === 'number' && story.duration_sec > 0 && (
            <p className="mt-0.5 text-xs text-stone-400">{t('audio.seconds', { n: story.duration_sec })}</p>
          )}
        </div>
        {canDelete && (
          <button
            type="button"
            className="icon-btn !h-9 !w-9 shrink-0"
            onClick={() => void remove()}
            disabled={busy}
            aria-label={t('audio.delete')}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {url ? (
        <audio className="mt-2 w-full" controls preload="metadata" src={url}>
          <track kind="captions" />
        </audio>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-xs text-stone-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {t('audio.loading')}
        </p>
      )}
    </li>
  );
}

/**
 * Voice notes ("family stories") on a person — easier than typing for elders.
 */
export function AudioStoriesSection({ person }: { person: FamilyPerson }) {
  const t = useT();
  const { canEdit, canDelete } = useAuth();
  const { toast } = useToast();

  const [stories, setStories] = useState<AudioStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const refresh = () => {
    setLoading(true);
    listAudioStories(person.id).then(
      (rows) => {
        setStories(rows);
        setUnavailable(false);
        setLoading(false);
      },
      (error: unknown) => {
        console.error(error);
        setUnavailable(true);
        setLoading(false);
      },
    );
  };

  useEffect(refresh, [person.id]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRef.current?.stop();
    },
    [],
  );

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!canEdit || busy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast(t('audio.unsupported'), 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        void saveRecording(blob, durationSec, recorder.mimeType.includes('mp4') ? 'mp4' : 'webm');
      };
      mediaRef.current = recorder;
      startedAtRef.current = Date.now();
      setSeconds(0);
      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch (error) {
      console.error(error);
      toast(t('audio.micDenied'), 'error');
    }
  };

  const saveRecording = async (blob: Blob, durationSec: number, ext: string) => {
    setBusy(true);
    try {
      await addAudioStory({
        personId: person.id,
        blob,
        title: title.trim() || undefined,
        durationSec,
        ext,
      });
      setTitle('');
      toast(t('audio.added'), 'success');
      refresh();
    } catch (error) {
      console.error(error);
      toast(t('audio.addFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-700">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100">{t('audio.title')}</h3>
        {canEdit && !recording && (
          <button
            type="button"
            className="btn-secondary !py-1.5 !text-xs"
            onClick={() => void startRecording()}
            disabled={busy}
          >
            <Mic className="h-3.5 w-3.5" aria-hidden />
            {t('audio.record')}
          </button>
        )}
        {recording && (
          <button type="button" className="btn-primary !py-1.5 !text-xs" onClick={stopRecording}>
            <Square className="h-3.5 w-3.5" aria-hidden />
            {t('audio.stop')} ({seconds}s)
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t('audio.intro')}</p>

      {canEdit && (
        <label className="mt-3 block text-xs font-medium text-stone-600 dark:text-stone-300">
          {t('audio.fieldTitle')}
          <input
            className="input mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            disabled={recording || busy}
            placeholder={t('audio.titlePlaceholder')}
          />
        </label>
      )}

      {unavailable && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {t('audio.setupNeeded')}
        </p>
      )}

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-stone-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {t('audio.loading')}
        </p>
      ) : stories.length === 0 && !unavailable ? (
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">{t('audio.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {stories.map((story) => (
            <StoryRow
              key={story.id}
              story={story}
              canDelete={canDelete}
              onDeleted={refresh}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
