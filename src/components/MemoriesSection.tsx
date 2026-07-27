import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import type { FamilyPerson } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { usePhotoUrl } from '../context/PhotoUrlsContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { usePrivacy } from '../hooks/usePrivacy';
import { useLanguage, useT } from '../i18n/useT';
import { addMemory, deleteMemory, listMemories } from '../lib/memories';
import type { FamilyMemory } from '../lib/memories';
import { logChange } from '../lib/auditLog';
import { downscalePhoto } from '../utils/image';
import { formatDate, isValidDateString } from '../utils/dates';
import { fullName } from '../utils/family';

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

function MemoryThumb({ memory, onOpen }: { memory: FamilyMemory; onOpen: () => void }) {
  const url = usePhotoUrl(memory.photo);
  const t = useT();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square overflow-hidden rounded-xl bg-stone-100 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:bg-stone-800"
      aria-label={memory.title || t('memories.openPhoto')}
    >
      {url ? (
        <img src={url} alt={memory.title || ''} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="flex h-full items-center justify-center text-stone-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </span>
      )}
    </button>
  );
}

interface MemoriesSectionProps {
  person: FamilyPerson;
}

/**
 * Photo memories gallery on a person's details panel. Family editors can add;
 * only the owner can delete (matches RLS).
 */
export function MemoriesSection({ person }: MemoriesSectionProps) {
  const t = useT();
  const language = useLanguage();
  const privacy = usePrivacy();
  const { canEdit, canDelete } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [memories, setMemories] = useState<FamilyMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<FamilyMemory | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCaption, setDraftCaption] = useState('');
  const [draftTakenOn, setDraftTakenOn] = useState('');
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    listMemories(person.id).then(
      (rows) => {
        setMemories(rows);
        setUnavailable(false);
        setLoading(false);
      },
      (error: unknown) => {
        console.error('Failed to load memories:', error);
        setUnavailable(true);
        setLoading(false);
      },
    );
  };

  useEffect(refresh, [person.id]);

  if (!privacy.showPhoto()) return null;

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
      toast(t('memories.notImage'), 'error');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast(t('form.photoTooBig'), 'error');
      return;
    }
    try {
      const dataUrl = await downscalePhoto(file);
      setPendingDataUrl(dataUrl);
    } catch (error) {
      console.error(error);
      toast(t('memories.photoReadFail'), 'error');
    }
  };

  const savePending = async () => {
    if (!pendingDataUrl || busy) return;
    if (draftTakenOn && !isValidDateString(draftTakenOn)) {
      toast(t('val.dateFormat'), 'error');
      return;
    }
    setBusy(true);
    try {
      await addMemory({
        personId: person.id,
        dataUrl: pendingDataUrl,
        title: draftTitle,
        caption: draftCaption,
        takenOn: draftTakenOn,
      });
      logChange('edit', {
        updated: [
          {
            name: fullName(person),
            fields: ['memories'],
          },
        ],
      });
      setPendingDataUrl(null);
      setDraftTitle('');
      setDraftCaption('');
      setDraftTakenOn('');
      toast(t('memories.added'), 'success');
      refresh();
    } catch (error) {
      console.error(error);
      const detail =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : '';
      // Common: table missing (upgrade SQL not run) or not signed in to Supabase.
      if (/relation .*family_memories.* does not exist|Could not find the table/i.test(detail)) {
        toast(t('memories.setupNeeded'), 'error');
        setUnavailable(true);
      } else if (/JWT|not authenticated|permission|row-level security|RLS/i.test(detail)) {
        toast(t('memories.authFailed'), 'error');
      } else {
        toast(detail ? `${t('memories.addFailed')} (${detail})` : t('memories.addFailed'), 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memory: FamilyMemory) => {
    const ok = await confirm({
      title: t('memories.deleteTitle'),
      message: t('memories.deleteMsg'),
      confirmLabel: t('person.delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMemory(memory);
      logChange('edit', {
        updated: [
          {
            name: fullName(person),
            fields: ['memories'],
          },
        ],
      });
      setViewer(null);
      toast(t('memories.deleted'));
      refresh();
    } catch (error) {
      console.error(error);
      toast(t('memories.deleteFailed'), 'error');
    }
  };

  return (
    <div className="mt-4 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/60">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden /> {t('memories.title')}
        </h3>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/*"
              className="sr-only"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn-secondary !px-2.5 !py-1 text-xs"
              onClick={() => fileRef.current?.click()}
              disabled={busy || unavailable}
              title={unavailable ? t('memories.setupNeeded') : undefined}
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden /> {t('memories.add')}
            </button>
          </>
        )}
        {!canEdit && (
          <p className="text-xs text-stone-400">{t('memories.unlockToAdd')}</p>
        )}
      </div>

      {unavailable && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{t('memories.setupNeeded')}</p>
      )}

      {loading && !unavailable && (
        <p className="mt-3 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('memories.loading')}
        </p>
      )}

      {!loading && !unavailable && memories.length === 0 && !pendingDataUrl && (
        <p className="mt-2 text-sm text-stone-400">{t('memories.empty')}</p>
      )}

      {!loading && memories.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {memories.map((m) => (
            <MemoryThumb key={m.id} memory={m} onOpen={() => setViewer(m)} />
          ))}
        </div>
      )}

      {pendingDataUrl && (
        <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-stone-900">
          <img
            src={pendingDataUrl}
            alt=""
            className="mx-auto max-h-40 rounded-lg object-contain"
          />
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
            {t('memories.fieldTitle')}
            <input
              className="input mt-1"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={80}
            />
          </label>
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
            {t('memories.fieldCaption')}
            <textarea
              className="input mt-1 min-h-[4rem]"
              value={draftCaption}
              onChange={(e) => setDraftCaption(e.target.value)}
              maxLength={400}
            />
          </label>
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-300">
            {t('memories.fieldTakenOn')}
            <input
              className="input mt-1"
              placeholder={t('form.datePlaceholder')}
              value={draftTakenOn}
              onChange={(e) => setDraftTakenOn(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPendingDataUrl(null)}
              disabled={busy}
            >
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={() => void savePending()} disabled={busy}>
              {busy ? t('memories.saving') : t('memories.save')}
            </button>
          </div>
        </div>
      )}

      {viewer && (
        <MemoryViewer
          memory={viewer}
          language={language}
          canDelete={canDelete}
          onClose={() => setViewer(null)}
          onDelete={() => void remove(viewer)}
        />
      )}
    </div>
  );
}

function MemoryViewer({
  memory,
  language,
  canDelete,
  onClose,
  onDelete,
}: {
  memory: FamilyMemory;
  language: 'en' | 'uz' | 'ru';
  canDelete: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const url = usePhotoUrl(memory.photo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={memory.title || t('memories.openPhoto')}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4 dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="icon-btn absolute right-3 top-3"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        {url ? (
          <img src={url} alt={memory.title || ''} className="mx-auto max-h-[60vh] rounded-xl object-contain" />
        ) : (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" aria-hidden />
          </div>
        )}
        <div className="mt-3 space-y-1 pr-10">
          {memory.title && (
            <p className="font-semibold text-stone-900 dark:text-stone-100">{memory.title}</p>
          )}
          {memory.taken_on && (
            <p className="text-sm text-stone-500">{formatDate(memory.taken_on, language)}</p>
          )}
          {memory.caption && (
            <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">{memory.caption}</p>
          )}
        </div>
        {canDelete && (
          <button type="button" className="btn-danger mt-4" onClick={onDelete}>
            <Trash2 className="h-4 w-4" aria-hidden /> {t('person.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
