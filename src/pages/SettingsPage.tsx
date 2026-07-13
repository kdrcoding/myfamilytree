import { useRef, useState } from 'react';
import {
  Database,
  Download,
  Eye,
  KeyRound,
  Languages,
  LogOut,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useDataTransfer } from '../hooks/useDataTransfer';
import { useT } from '../i18n/useT';
import { hashPassword } from '../config/access';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { UnlockModal } from '../components/UnlockModal';

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

      {/* Privacy */}
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
                onClick={async () => setHashResult(hashInput ? await hashPassword(hashInput) : '')}
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
      </section>

      {/* Data management */}
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

      {unlockOpen && <UnlockModal onClose={() => setUnlockOpen(false)} />}
    </div>
  );
}
