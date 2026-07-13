import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useT } from '../i18n/useT';
import { Modal } from './ui/Modal';

interface UnlockModalProps {
  onClose: () => void;
  onUnlocked?: () => void;
}

/** Password prompt that unlocks edit mode as either owner or family editor. */
export function UnlockModal({ onClose, onUnlocked }: UnlockModalProps) {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError(t('unlock.enter'));
      return;
    }
    setBusy(true);
    const role = await signIn(password);
    setBusy(false);
    if (!role) {
      setError(t('unlock.wrong'));
      return;
    }
    toast(role === 'owner' ? t('unlock.ownerToast') : t('unlock.editorToast'));
    onUnlocked?.();
    onClose();
  };

  return (
    <Modal onClose={onClose} labelledBy="unlock-title" size="sm">
      <form onSubmit={submit}>
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2
              id="unlock-title"
              className="text-lg font-semibold text-stone-900 dark:text-stone-100"
            >
              {t('unlock.title')}
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{t('unlock.intro')}</p>
          </div>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            {t('unlock.password')}
          </span>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            autoComplete="current-password"
            autoFocus
          />
          {error && (
            <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? t('unlock.checking') : t('unlock.btn')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
