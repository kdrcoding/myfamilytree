import { useMemo, useState } from 'react';
import { Search, UserRoundPlus } from 'lucide-react';
import type { FamilyPerson, RelationKind } from '../types/family';
import { useFamily } from '../context/FamilyContext';
import { fullName, sortByBirth } from '../utils/family';
import { Modal } from './ui/Modal';
import { PersonFormModal } from './PersonFormModal';

const KIND_LABELS: { kind: RelationKind; label: string }[] = [
  { kind: 'child', label: 'a child of' },
  { kind: 'spouse', label: 'the spouse / partner of' },
  { kind: 'sibling', label: 'a sibling of' },
  { kind: 'parent', label: 'a parent of' },
];

interface JoinFamilyModalProps {
  onClose: () => void;
}

/**
 * Public "Add yourself" flow — no password required. Step 1 asks how the
 * visitor connects to the family; step 2 is the normal person form, which in
 * self-join mode also downloads a join-request file to send to the owner.
 */
export function JoinFamilyModal({ onClose }: JoinFamilyModalProps) {
  const { people, getLabel } = useFamily();
  const [kind, setKind] = useState<RelationKind>('child');
  const [targetId, setTargetId] = useState<string>('');
  const [noConnection, setNoConnection] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => {
    const sorted = [...people].sort(sortByBirth);
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((p) => fullName(p).toLowerCase().includes(q)) : sorted;
  }, [people, query]);

  if (step === 2) {
    return (
      <PersonFormModal
        selfJoin
        link={noConnection || !targetId ? undefined : { kind, targetId }}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal onClose={onClose} labelledBy="join-title" size="md">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <UserRoundPlus className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 id="join-title" className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Add yourself to the family tree
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            No password needed. You'll appear on the tree in this browser right away, and a small
            request file will download for you to send to the family owner — once they import it,
            everyone will see you.
          </p>
        </div>
      </div>

      <fieldset className="mt-4" disabled={noConnection}>
        <legend className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
          How are you related? I am…
        </legend>
        <select
          className="input"
          value={kind}
          onChange={(e) => setKind(e.target.value as RelationKind)}
          aria-label="Relationship type"
        >
          {KIND_LABELS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>

        <div className="mt-3 rounded-xl border border-stone-300 dark:border-stone-600">
          <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2 dark:border-stone-700">
            <Search className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for your relative…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
              aria-label="Search for the person you are related to"
            />
          </div>
          <ul className="max-h-44 overflow-y-auto p-1">
            {candidates.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-stone-400">No matching people.</li>
            )}
            {candidates.map((p: FamilyPerson) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
                  <input
                    type="radio"
                    name="join-target"
                    checked={targetId === p.id}
                    onChange={() => setTargetId(p.id)}
                    className="h-4 w-4 border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="truncate">{fullName(p)}</span>
                  <span className="ml-auto shrink-0 text-xs text-stone-400">{getLabel(p)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </fieldset>

      <label className="mt-3 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
        <input
          type="checkbox"
          checked={noConnection}
          onChange={(e) => setNoConnection(e.target.checked)}
          className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
        />
        I'm not sure how I connect — let the owner place me
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!noConnection && !targetId}
          onClick={() => setStep(2)}
        >
          Continue to my details
        </button>
      </div>
    </Modal>
  );
}
