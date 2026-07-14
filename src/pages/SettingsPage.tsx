import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Database,
  Download,
  Eye,
  KeyRound,
  Languages,
  LogOut,
  Moon,
  Pencil,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useDataTransfer } from '../hooks/useDataTransfer';
import { useLanguage, useT } from '../i18n/useT';
import type { TKey } from '../i18n/translations';
import { AUTH_EMAILS, hashPassword } from '../config/access';
import { listAuditLog } from '../lib/auditLog';
import type { AuditEntry } from '../lib/auditLog';
import { downloadBackup, forceBackup, listBackups } from '../lib/backups';
import type { BackupMeta } from '../lib/backups';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { UnlockModal } from '../components/UnlockModal';

/** Translated label for a changed field in the change log. */
const FIELD_LABEL_KEYS: Record<string, TKey> = {
  firstName: 'form.firstName',
  lastName: 'form.lastName',
  nickname: 'form.nickname',
  gender: 'form.gender',
  birthDate: 'form.birthDate',
  deathDate: 'form.deathDate',
  isDeceased: 'badge.deceased',
  photo: 'form.photo',
  city: 'form.city',
  country: 'form.country',
  occupation: 'form.occupation',
  biography: 'form.bio',
  parents: 'form.parents',
  spouses: 'form.spouses',
  children: 'person.children',
  divorced: 'person.divorced',
};

const ACTION_LABEL_KEYS: Record<string, TKey> = {
  add: 'log.add',
  edit: 'log.edit',
  delete: 'log.delete',
  divorce: 'log.divorce',
  import: 'log.import',
  reset: 'log.reset',
};

/** Owner-only card: who changed what and when. */
function ChangeLogCard() {
  const t = useT();
  const language = useLanguage();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    listAuditLog().then(setEntries, (error: unknown) => {
      console.error('Failed to load the change log:', error);
      setUnavailable(true);
    });
  }, []);

  const fieldLabel = (field: string) =>
    FIELD_LABEL_KEYS[field] ? t(FIELD_LABEL_KEYS[field]) : field;

  return (
    <section className="card mt-4 p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <ScrollText className="h-5 w-5 text-emerald-600" aria-hidden /> {t('settings.logTitle')}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t('settings.logIntro')}</p>
      {unavailable && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {t('settings.setupNeeded')}
        </p>
      )}
      {!unavailable &&
      entries.length === 0 ? (
        <p className="mt-3 text-sm text-stone-400">{t('settings.logEmpty')}</p>
      ) : unavailable ? null : (
        <ul className="mt-3 divide-y divide-stone-100 text-sm dark:divide-stone-800">
          {entries.map((entry) => (
            <li key={entry.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-stone-800 dark:text-stone-200">
                  {ACTION_LABEL_KEYS[entry.action] ? t(ACTION_LABEL_KEYS[entry.action]) : entry.action}
                </span>
                <span
                  className={`badge ${
                    entry.actor === AUTH_EMAILS.owner
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                  }`}
                >
                  {entry.actor === AUTH_EMAILS.owner ? t('log.actorOwner') : t('log.actorFamily')}
                </span>
                <span className="ml-auto text-xs text-stone-400">
                  {new Date(entry.at).toLocaleString(language === 'uz' ? 'uz-UZ' : 'en-GB')}
                </span>
              </div>
              <div className="mt-1 space-y-0.5 text-stone-600 dark:text-stone-300">
                {entry.details.added && (
                  <p className="flex items-start gap-1.5">
                    <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>{entry.details.added.join(', ')}</span>
                  </p>
                )}
                {entry.details.deleted && (
                  <p className="flex items-start gap-1.5">
                    <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
                    <span>{entry.details.deleted.join(', ')}</span>
                  </p>
                )}
                {entry.details.updated?.map((u, i) => (
                  <p key={i} className="flex items-start gap-1.5">
                    <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                    <span>
                      {u.name}
                      <span className="text-stone-400"> — {u.fields.map(fieldLabel).join(', ')}</span>
                    </span>
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Owner-only card: shows the automatic database snapshots. */
function BackupsCard() {
  const t = useT();
  const language = useLanguage();
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = () => {
    listBackups().then(
      (rows) => {
        setBackups(rows);
        setUnavailable(false);
      },
      (error: unknown) => {
        console.error('Failed to list backups:', error);
        setUnavailable(true);
      },
    );
  };
  useEffect(refresh, []);

  const takeNow = async () => {
    setBusy(true);
    try {
      await forceBackup();
      toast(t('settings.backupTaken'));
      refresh();
    } catch (error) {
      console.error('Backup failed:', error);
      toast(t('settings.backupFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card mt-4 p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Archive className="h-5 w-5 text-emerald-600" aria-hidden /> {t('settings.backupsTitle')}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {t('settings.backupsIntro')}
      </p>
      {unavailable && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {t('settings.setupNeeded')}
        </p>
      )}
      <div className="mt-3">
        <button type="button" className="btn-secondary" onClick={() => void takeNow()} disabled={busy}>
          <Archive className="h-4 w-4" aria-hidden /> {t('settings.backupNow')}
        </button>
      </div>
      {!unavailable &&
      backups.length === 0 ? (
        <p className="mt-3 text-sm text-stone-400">{t('settings.backupsEmpty')}</p>
      ) : unavailable ? null : (
        <ul className="mt-3 divide-y divide-stone-100 text-sm dark:divide-stone-800">
          {backups.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block font-medium text-stone-800 dark:text-stone-200">
                  {new Date(b.taken_at).toLocaleString(language === 'uz' ? 'uz-UZ' : 'en-GB')}
                </span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">
                  {t('settings.backupCounts', { m: b.member_count, r: b.relationship_count })}
                </span>
              </span>
              <button
                type="button"
                className="btn-secondary !px-2.5 !py-1.5 !text-xs"
                onClick={() => {
                  downloadBackup(b.id).catch((error: unknown) => {
                    console.error('Backup download failed:', error);
                    toast(t('settings.backupFailed'), 'error');
                  });
                }}
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> {t('settings.backupDownload')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SettingsPage() {
  const { settings, setTheme, setLanguage, setPrivacy } = useSettings();
  const { role, canEdit, canDelete, signOut } = useAuth();
  const { exportJson, importFromFile, resetSample } = useDataTransfer();
  const t = useT();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [hashInput, setHashInput] = useState('');
  const [hashResult, setHashResult] = useState('');

  const privacy = settings.privacy;
  const roleLabel =
    role === 'owner'
      ? t('settings.roleOwner')
      : role === 'editor'
        ? t('settings.roleEditor')
        : t('settings.roleViewer');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>

      {/* Language */}
      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Languages className="h-5 w-5 text-emerald-600" aria-hidden /> {t('settings.language')}
        </h2>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={settings.language === 'uz' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setLanguage('uz')}
            aria-pressed={settings.language === 'uz'}
          >
            O'zbekcha
          </button>
          <button
            type="button"
            className={settings.language === 'en' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setLanguage('en')}
            aria-pressed={settings.language === 'en'}
          >
            English
          </button>
        </div>
      </section>

      {/* Theme */}
      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sun className="h-5 w-5 text-emerald-600" aria-hidden /> {t('settings.theme')}
        </h2>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={settings.theme === 'light' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTheme('light')}
            aria-pressed={settings.theme === 'light'}
          >
            <Sun className="h-4 w-4" aria-hidden /> {t('settings.light')}
          </button>
          <button
            type="button"
            className={settings.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTheme('dark')}
            aria-pressed={settings.theme === 'dark'}
          >
            <Moon className="h-4 w-4" aria-hidden /> {t('settings.dark')}
          </button>
        </div>
      </section>

      {/* Privacy — owner-only: controls what the whole family's data hides publicly. */}
      {canDelete && (
      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />{' '}
          {t('settings.privacyTitle')}
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {t('settings.privacyIntro')}
        </p>
        <div className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
          <ToggleSwitch
            label={t('settings.enable')}
            description={t('settings.enableDesc')}
            checked={privacy.enabled}
            onChange={(enabled) => setPrivacy({ enabled })}
          />
          <ToggleSwitch
            label={t('settings.hideBirth')}
            checked={privacy.hideBirthDates}
            disabled={!privacy.enabled}
            onChange={(hideBirthDates) => setPrivacy({ hideBirthDates })}
          />
          <ToggleSwitch
            label={t('settings.hideDeath')}
            checked={privacy.hideDeathDates}
            disabled={!privacy.enabled}
            onChange={(hideDeathDates) => setPrivacy({ hideDeathDates })}
          />
          <ToggleSwitch
            label={t('settings.hideMinor')}
            description={t('settings.hideMinorDesc')}
            checked={privacy.hideMinorAges}
            disabled={!privacy.enabled}
            onChange={(hideMinorAges) => setPrivacy({ hideMinorAges })}
          />
          <ToggleSwitch
            label={t('settings.hideCities')}
            description={t('settings.hideCitiesDesc')}
            checked={privacy.hideCities}
            disabled={!privacy.enabled}
            onChange={(hideCities) => setPrivacy({ hideCities })}
          />
          <ToggleSwitch
            label={t('settings.hideOcc')}
            checked={privacy.hideOccupations}
            disabled={!privacy.enabled}
            onChange={(hideOccupations) => setPrivacy({ hideOccupations })}
          />
          <ToggleSwitch
            label={t('settings.hideBio')}
            checked={privacy.hideBiographies}
            disabled={!privacy.enabled}
            onChange={(hideBiographies) => setPrivacy({ hideBiographies })}
          />
          <ToggleSwitch
            label={t('settings.hidePhotos')}
            description={t('settings.hidePhotosDesc')}
            checked={privacy.hidePhotos}
            disabled={!privacy.enabled}
            onChange={(hidePhotos) => setPrivacy({ hidePhotos })}
          />
        </div>
      </section>
      )}

      {/* Access */}
      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-5 w-5 text-emerald-600" aria-hidden /> {t('settings.accessTitle')}
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {t('settings.accessIntro')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="badge border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Eye className="h-3 w-3" aria-hidden />
            {t('settings.currentRole', { role: roleLabel })}
          </span>
          {canEdit ? (
            <button type="button" className="btn-secondary" onClick={signOut}>
              <LogOut className="h-4 w-4" aria-hidden /> {t('settings.signOut')}
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setUnlockOpen(true)}>
              <KeyRound className="h-4 w-4" aria-hidden /> {t('settings.unlock')}
            </button>
          )}
        </div>
        {canDelete && (
        <details className="mt-4 rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800/60">
          <summary className="cursor-pointer font-medium text-stone-700 dark:text-stone-300">
            {t('settings.howChange')}
          </summary>
          <div className="mt-2 space-y-2 text-stone-600 dark:text-stone-400">
            <p>{t('settings.howChangeText')}</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                className="input !w-64"
                placeholder={t('settings.newPassword')}
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                aria-label={t('settings.newPassword')}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    setHashResult(hashInput ? await hashPassword(hashInput) : '');
                  } catch (error) {
                    console.error('Hashing failed (needs a secure context):', error);
                  }
                }}
              >
                {t('settings.genHash')}
              </button>
            </div>
            {hashResult && (
              <code className="block break-all rounded-lg bg-stone-200 p-2 text-xs dark:bg-stone-700">
                {hashResult}
              </code>
            )}
            <p className="text-xs">{t('settings.hashNote')}</p>
          </div>
        </details>
        )}
      </section>

      {/* Data management — owner-only: export/import/restore act on the whole dataset. */}
      {canDelete && (
      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Database className="h-5 w-5 text-emerald-600" aria-hidden /> {t('settings.dataTitle')}
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t('settings.dataIntro')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={exportJson}>
            <Download className="h-4 w-4" aria-hidden /> {t('settings.exportBackup')}
          </button>
          {canEdit && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFromFile(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" aria-hidden /> {t('settings.importBackup')}
              </button>
            </>
          )}
          {canDelete && (
            <button type="button" className="btn-danger" onClick={resetSample}>
              <RotateCcw className="h-4 w-4" aria-hidden /> {t('settings.restore')}
            </button>
          )}
        </div>
        {!canEdit && <p className="mt-2 text-xs text-stone-400">{t('settings.unlockNote')}</p>}
      </section>
      )}

      {canDelete && <ChangeLogCard />}
      {canDelete && <BackupsCard />}

      {unlockOpen && <UnlockModal onClose={() => setUnlockOpen(false)} />}
    </div>
  );
}
