import { useRef, useState } from 'react';
import {
  Database,
  Download,
  Eye,
  KeyRound,
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
import { hashPassword } from '../config/access';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { UnlockModal } from '../components/UnlockModal';

export function SettingsPage() {
  const { settings, setTheme, setPrivacy } = useSettings();
  const { role, canEdit, canDelete, signOut } = useAuth();
  const { exportJson, importFromFile, resetSample } = useDataTransfer();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [hashInput, setHashInput] = useState('');
  const [hashResult, setHashResult] = useState('');

  const privacy = settings.privacy;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Theme */}
      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sun className="h-5 w-5 text-emerald-600" aria-hidden /> Theme
        </h2>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={settings.theme === 'light' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTheme('light')}
            aria-pressed={settings.theme === 'light'}
          >
            <Sun className="h-4 w-4" aria-hidden /> Light
          </button>
          <button
            type="button"
            className={settings.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTheme('dark')}
            aria-pressed={settings.theme === 'dark'}
          >
            <Moon className="h-4 w-4" aria-hidden /> Dark
          </button>
        </div>
      </section>

      {/* Privacy */}
      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden /> Public privacy mode
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          A public family website should not expose sensitive personal information. Turn on privacy
          mode before sharing the site beyond the family, then choose what to hide.
        </p>
        <div className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
          <ToggleSwitch
            label="Enable privacy mode"
            description="Master switch — the options below only apply while this is on."
            checked={privacy.enabled}
            onChange={(enabled) => setPrivacy({ enabled })}
          />
          <ToggleSwitch
            label="Hide exact birth dates"
            checked={privacy.hideBirthDates}
            disabled={!privacy.enabled}
            onChange={(hideBirthDates) => setPrivacy({ hideBirthDates })}
          />
          <ToggleSwitch
            label="Hide exact death dates"
            checked={privacy.hideDeathDates}
            disabled={!privacy.enabled}
            onChange={(hideDeathDates) => setPrivacy({ hideDeathDates })}
          />
          <ToggleSwitch
            label="Hide ages of minors"
            description="People under 18 will not show a calculated age."
            checked={privacy.hideMinorAges}
            disabled={!privacy.enabled}
            onChange={(hideMinorAges) => setPrivacy({ hideMinorAges })}
          />
          <ToggleSwitch
            label="Hide cities"
            description="Countries stay visible."
            checked={privacy.hideCities}
            disabled={!privacy.enabled}
            onChange={(hideCities) => setPrivacy({ hideCities })}
          />
          <ToggleSwitch
            label="Hide occupations"
            checked={privacy.hideOccupations}
            disabled={!privacy.enabled}
            onChange={(hideOccupations) => setPrivacy({ hideOccupations })}
          />
          <ToggleSwitch
            label="Hide biographies"
            checked={privacy.hideBiographies}
            disabled={!privacy.enabled}
            onChange={(hideBiographies) => setPrivacy({ hideBiographies })}
          />
          <ToggleSwitch
            label="Hide profile photos"
            description="Initials avatars are shown instead."
            checked={privacy.hidePhotos}
            disabled={!privacy.enabled}
            onChange={(hidePhotos) => setPrivacy({ hidePhotos })}
          />
        </div>
      </section>

      {/* Access */}
      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-5 w-5 text-emerald-600" aria-hidden /> Editing access
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Two passwords protect editing: the <strong>owner</strong> password (add, edit and delete)
          and the <strong>family editor</strong> password (add and edit only — safe to share with
          relatives who help maintain the tree).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="badge border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Eye className="h-3 w-3" aria-hidden />
            Current role:{' '}
            {role === 'owner' ? 'Owner' : role === 'editor' ? 'Family editor' : 'Viewer'}
          </span>
          {canEdit ? (
            <button type="button" className="btn-secondary" onClick={signOut}>
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setUnlockOpen(true)}>
              <KeyRound className="h-4 w-4" aria-hidden /> Unlock editing
            </button>
          )}
        </div>
        <details className="mt-4 rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800/60">
          <summary className="cursor-pointer font-medium text-stone-700 dark:text-stone-300">
            How to change the passwords
          </summary>
          <div className="mt-2 space-y-2 text-stone-600 dark:text-stone-400">
            <p>
              Passwords are stored as SHA-256 hashes in <code>src/config/access.ts</code>. Type a
              new password below to get its hash, paste it into that file and redeploy the site.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                className="input !w-64"
                placeholder="New password"
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                aria-label="Password to hash"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => setHashResult(hashInput ? await hashPassword(hashInput) : '')}
              >
                Generate hash
              </button>
            </div>
            {hashResult && (
              <code className="block break-all rounded-lg bg-stone-200 p-2 text-xs dark:bg-stone-700">
                {hashResult}
              </code>
            )}
            <p className="text-xs">
              Note: as a static website with no server, this lock prevents accidental and casual
              changes but is not bank-grade security. Anyone's edits are saved only in their own
              browser until the owner republishes the data.
            </p>
          </div>
        </details>
      </section>

      {/* Data management */}
      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Database className="h-5 w-5 text-emerald-600" aria-hidden /> Data management
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          The family data lives in this browser's LocalStorage. Export a JSON backup regularly —
          especially before importing or resetting.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={exportJson}>
            <Download className="h-4 w-4" aria-hidden /> Export backup
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
                <Upload className="h-4 w-4" aria-hidden /> Import backup
              </button>
            </>
          )}
          {canDelete && (
            <button type="button" className="btn-danger" onClick={resetSample}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Restore website data
            </button>
          )}
        </div>
        {!canEdit && (
          <p className="mt-2 text-xs text-stone-400">
            Unlock editing to import data; resetting is owner-only.
          </p>
        )}
      </section>

      {unlockOpen && <UnlockModal onClose={() => setUnlockOpen(false)} />}
    </div>
  );
}
