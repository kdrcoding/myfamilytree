import { useEffect, useState } from 'react';
import { Heart, HeartCrack, Pencil } from 'lucide-react';
import type { FamilyPerson } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, useT } from '../i18n/useT';
import { formatDate, formatMonthDay, isValidDateString } from '../utils/dates';
import {
  fullName,
  isDivorced,
  marriageDateOf,
  marriageNoteOf,
  marriagePlaceOf,
  withMarriageDate,
  withMarriageNote,
  withMarriagePlace,
} from '../utils/family';
import { getCoupleAnniversary } from '../utils/anniversaries';
import { Avatar } from './Avatar';
import { DateField } from './DateField';
import { Modal } from './ui/Modal';

interface CoupleAnniversaryModalProps {
  a: FamilyPerson;
  b: FamilyPerson;
  onClose: () => void;
  onOpenPerson: (id: string) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Tap wedding rings on the tree → see anniversary, and (if you can edit)
 * fill in wedding date, place, and a short note with a few taps.
 */
export function CoupleAnniversaryModal({ a, b, onClose, onOpenPerson }: CoupleAnniversaryModalProps) {
  const t = useT();
  const language = useLanguage();
  const { canEdit, canDelete } = useAuth();
  const { updatePerson, setDivorcedStatus, getPerson } = useFamily();
  const { toast } = useToast();
  const confirm = useConfirm();

  // Prefer live records from the index (modal props may be a snapshot).
  const liveA = getPerson(a.id) ?? a;
  const liveB = getPerson(b.id) ?? b;

  const marriedOn = marriageDateOf(liveA, liveB);
  const place = marriagePlaceOf(liveA, liveB);
  const note = marriageNoteOf(liveA, liveB);
  const divorced = isDivorced(liveA, liveB);
  const anniversary = getCoupleAnniversary(liveA, liveB);

  const [editing, setEditing] = useState(() => canEdit && !marriedOn);
  const [dateDraft, setDateDraft] = useState(marriedOn ?? '');
  const [placeDraft, setPlaceDraft] = useState(place ?? '');
  const [noteDraft, setNoteDraft] = useState(note ?? '');
  const [dateError, setDateError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDateDraft(marriedOn ?? '');
    setPlaceDraft(place ?? '');
    setNoteDraft(note ?? '');
  }, [marriedOn, place, note, liveA.id, liveB.id]);

  const whenLabel =
    anniversary == null
      ? null
      : anniversary.isToday
        ? t('home.bdayToday')
        : anniversary.daysUntil === 1
          ? t('home.bdayTomorrow')
          : t('home.bdayInDays', { n: anniversary.daysUntil });

  const nextDateLabel = anniversary
    ? formatDate(
        `${anniversary.occurrenceYear}-${pad2(anniversary.month)}-${pad2(anniversary.day)}`,
        language,
      )
    : null;

  const yearsLabel =
    anniversary?.years == null
      ? null
      : anniversary.years === 1
        ? anniversary.isToday
          ? t('home.annivYearOneToday')
          : t('home.annivYearOne')
        : anniversary.isToday
          ? t('home.annivYearsToday', { n: anniversary.years })
          : t('home.annivYears', { n: anniversary.years });

  const save = async () => {
    const trimmedDate = dateDraft.trim();
    if (trimmedDate && !isValidDateString(trimmedDate)) {
      setDateError(t('couple.invalidDate'));
      return;
    }
    setDateError('');
    setSaving(true);
    try {
      let next = withMarriageDate(liveA, liveB.id, trimmedDate);
      next = withMarriagePlace(next, liveB.id, placeDraft);
      next = withMarriageNote(next, liveB.id, noteDraft);
      await Promise.resolve(updatePerson(next, next.parentIds, next.spouseIds));
      toast(t('couple.saved'));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="couple-title" size="sm">
      <div className="flex flex-col items-center text-center">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            divorced
              ? 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
              : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300'
          }`}
        >
          {divorced ? (
            <HeartCrack className="h-6 w-6" aria-hidden />
          ) : (
            <Heart className="h-6 w-6" aria-hidden />
          )}
        </span>
        <h2 id="couple-title" className="mt-3 text-lg font-bold text-stone-900 dark:text-stone-50">
          {t('couple.title')}
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t('couple.subtitle')}</p>
        {divorced && (
          <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-400">
            {t('couple.divorced')}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60"
          onClick={() => {
            onClose();
            onOpenPerson(liveA.id);
          }}
        >
          <Avatar person={liveA} size="lg" />
          <span className="line-clamp-2 text-sm font-semibold text-stone-800 dark:text-stone-100">
            {fullName(liveA)}
          </span>
        </button>
        <span
          aria-hidden
          className={`relative inline-flex h-4 w-8 shrink-0 items-center justify-center ${
            divorced ? 'opacity-50' : ''
          }`}
        >
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-rose-400 dark:bg-rose-500" />
          <span className="relative z-[1] flex -space-x-1">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-rose-500 bg-transparent dark:border-rose-400" />
            <span className="inline-block h-3 w-3 rounded-full border-2 border-rose-500 bg-transparent dark:border-rose-400" />
          </span>
        </span>
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60"
          onClick={() => {
            onClose();
            onOpenPerson(liveB.id);
          }}
        >
          <Avatar person={liveB} size="lg" />
          <span className="line-clamp-2 text-sm font-semibold text-stone-800 dark:text-stone-100">
            {fullName(liveB)}
          </span>
        </button>
      </div>

      {editing && canEdit ? (
        <div className="mt-5 space-y-4 text-left">
          <DateField
            label={t('couple.marriedOn')}
            value={dateDraft}
            onChange={(v) => {
              setDateDraft(v);
              setDateError('');
            }}
            error={dateError}
            hint={t('couple.dateHint')}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
              {t('couple.place')}
            </span>
            <input
              type="text"
              className="input"
              value={placeDraft}
              maxLength={120}
              placeholder={t('couple.placePlaceholder')}
              onChange={(e) => setPlaceDraft(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
              {t('couple.notes')}
            </span>
            <textarea
              className="input min-h-[4.5rem] resize-y"
              value={noteDraft}
              maxLength={500}
              placeholder={t('couple.notesPlaceholder')}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn-primary flex-1 !min-h-11"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? t('memories.saving') : t('form.save')}
            </button>
            <button
              type="button"
              className="btn-secondary flex-1 !min-h-11"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setDateDraft(marriedOn ?? '');
                setPlaceDraft(place ?? '');
                setNoteDraft(note ?? '');
                setDateError('');
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-5 space-y-3 rounded-2xl bg-stone-50 p-4 text-left dark:bg-stone-800/50">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {t('couple.marriedOn')}
            </dt>
            <dd className="mt-0.5 text-base font-semibold text-stone-900 dark:text-stone-100">
              {marriedOn ? formatDate(marriedOn, language) : t('couple.noDate')}
            </dd>
            {marriedOn && !divorced && anniversary && (
              <dd className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                {t('couple.weddingDay', {
                  day: formatMonthDay(anniversary.month, anniversary.day, language),
                })}
              </dd>
            )}
          </div>
          {(place || note) && (
            <>
              {place && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {t('couple.place')}
                  </dt>
                  <dd className="mt-0.5 text-base font-medium text-stone-900 dark:text-stone-100">
                    {place}
                  </dd>
                </div>
              )}
              {note && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {t('couple.notes')}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-stone-700 dark:text-stone-200">
                    {note}
                  </dd>
                </div>
              )}
            </>
          )}
          {anniversary && !divorced && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                {t('couple.nextAnniversary')}
              </dt>
              <dd className="mt-0.5 text-base font-semibold text-stone-900 dark:text-stone-100">
                {whenLabel}
                {nextDateLabel && (
                  <span className="mt-0.5 block text-sm font-medium text-stone-600 dark:text-stone-300">
                    {nextDateLabel}
                  </span>
                )}
                {yearsLabel && (
                  <span className="mt-1 block text-sm font-semibold text-rose-700 dark:text-rose-300">
                    {yearsLabel}
                  </span>
                )}
              </dd>
            </div>
          )}
          {!marriedOn && !canEdit && (
            <p className="text-sm text-stone-500 dark:text-stone-400">{t('couple.addDateHint')}</p>
          )}
        </dl>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {canEdit && !editing && (
          <button
            type="button"
            className="btn-primary w-full !min-h-11 inline-flex items-center justify-center gap-2"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            {marriedOn || place || note ? t('couple.editDetails') : t('couple.addDetails')}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="btn-secondary w-full !min-h-11"
            onClick={() => {
              void (async () => {
                const proceed = await confirm({
                  title: divorced ? t('couple.remarryConfirmTitle') : t('couple.divorceConfirmTitle'),
                  message: divorced ? t('couple.remarryConfirmMsg') : t('couple.divorceConfirmMsg'),
                  confirmLabel: divorced
                    ? t('couple.markMarried')
                    : t('couple.divorceConfirmBtn'),
                  danger: !divorced,
                });
                if (!proceed) return;
                setDivorcedStatus(liveA.id, liveB.id, !divorced);
                toast(divorced ? t('couple.markedMarried') : t('couple.markedDivorced'));
              })();
            }}
          >
            {divorced ? t('couple.markMarried') : t('couple.markDivorced')}
          </button>
        )}
        <button type="button" className="btn-secondary w-full !min-h-11" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}
