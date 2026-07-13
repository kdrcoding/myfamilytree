import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from './ui/Modal';

interface UnlockModalProps {
  onClose: () => void;
  onUnlocked?: () => void;
}

/** Password prompt that unlocks edit mode as either owner or family editor. */
export function UnlockModal({ onClose, onUnlocked }: UnlockModalProps) {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Enter a password.');
      return;
    }
    setBusy(true);
    const role = await signIn(password);
    setBusy(false);
    if (!role) {
      setError('That password is not correct.');
      return;
    }
    toast(
      role === 'owner'
        ? 'Unlocked as owner — full access, including delete.'
        : 'Unlocked as family editor — you can add people and fill in missing info, but not delete or change existing details.',
    );
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
              Unlock editing
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              Enter the family password to add or edit people. The owner password additionally
              allows deleting.
            </p>
          </div>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Password
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
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
