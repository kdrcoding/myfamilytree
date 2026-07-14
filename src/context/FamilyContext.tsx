import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import type { FamilyData, FamilyPerson, RelationLink } from '../types/family';
import { FAMILY_DATA_VERSION } from '../types/family';
import { samplePeople } from '../data/sampleFamily';
import defaultFamilyJson from '../data/defaultFamily.json';
import { translate } from '../i18n/translations';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useToast } from './ToastContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { logChange, summarizeFamilyChange } from '../lib/auditLog';
import type { AuditAction } from '../lib/auditLog';
import { autoBackup } from '../lib/backups';
import { diffFamily, fetchFamily, isEmptyDiff, markSeeded, pushDiff } from '../lib/familyDb';
import { validateFamilyData } from '../utils/validation';
import {
  applyRelationLink,
  buildIndex,
  computeBloodline,
  computeGenerations,
  mergeAdditiveEdit,
  normalizePeople,
  relationshipDescriptor,
  removePerson,
  setDivorced,
  setRelationships,
} from '../utils/family';
import type { PersonIndex } from '../utils/family';

/** Family data lives in Supabase; the app is unusable until it has loaded. */
export type FamilyDbStatus = 'unconfigured' | 'loading' | 'error' | 'ready';

interface FamilyContextValue {
  people: FamilyPerson[];
  index: PersonIndex;
  generations: Map<string, number>;
  bloodline: Set<string>;
  getPerson: (id: string) => FamilyPerson | undefined;
  getLabel: (person: FamilyPerson) => string;
  /** Create a person, optionally attached to an existing relative. */
  addPerson: (person: FamilyPerson, link?: RelationLink) => void;
  /** Update fields and replace the person's parent/spouse relationships. */
  updatePerson: (person: FamilyPerson, parentIds: string[], spouseIds: string[]) => void;
  /** Mark or unmark a couple as divorced (they stay linked as ex-spouses). */
  setDivorcedStatus: (aId: string, bId: string, divorced: boolean) => void;
  deletePerson: (id: string) => void;
  replaceAll: (people: FamilyPerson[]) => void;
  /** Explicit setup action: fill the database with the bundled dataset. */
  resetToSample: () => void;
  exportData: () => FamilyData;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

// The bundled dataset. It is ONLY written to the database through the
// explicit "restore default data" action on the Settings page (owner) —
// never automatically, so it can't overwrite real family data.
const DEFAULT_DATA = (() => {
  const result = validateFamilyData(defaultFamilyJson);
  return result.ok && result.data ? normalizePeople(result.data.people) : samplePeople;
})();

export function FamilyProvider({ children }: { children: ReactNode }) {
  // Owner edits are unrestricted; family editors may only ADD information.
  const { canDelete: isOwner } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const language = settings.language;

  const [people, setPeopleState] = useState<FamilyPerson[]>([]);
  const [status, setStatus] = useState<FamilyDbStatus>(
    isSupabaseConfigured ? 'loading' : 'unconfigured',
  );
  // Mutations need the exact previous array to compute a database diff, even
  // when several land in the same render cycle.
  const peopleRef = useRef<FamilyPerson[]>(people);
  // Pushes run one at a time, in mutation order — concurrent multi-step
  // request chains could otherwise land out of order (e.g. a delete
  // completing before the add it depends on).
  const pushQueue = useRef<Promise<unknown>>(Promise.resolve());

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setStatus('loading');
    try {
      const loaded = await fetchFamily();
      peopleRef.current = loaded;
      setPeopleState(loaded);
      setStatus('ready');
      // Every visit keeps the daily database snapshot fresh (no-op when a
      // recent backup already exists).
      autoBackup();
    } catch (error) {
      console.error('Failed to load family data from Supabase:', error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Apply a change locally, then persist exactly that change to Supabase.
   * Resolves with whether the database write succeeded. Saved changes are
   * recorded in the owner-only change log with the given action.
   */
  const mutate = useCallback(
    (
      updater: (current: FamilyPerson[]) => FamilyPerson[],
      action: AuditAction = 'edit',
    ): Promise<boolean> => {
      const prev = peopleRef.current;
      const next = updater(prev);
      if (next === prev) return Promise.resolve(true);
      peopleRef.current = next;
      setPeopleState(next);
      const diff = diffFamily(prev, next);
      if (isEmptyDiff(diff)) return Promise.resolve(true);
      const summary = summarizeFamilyChange(prev, next);
      const pushed = pushQueue.current.then(() =>
        pushDiff(diff).then(() => {
          if (summary) logChange(action, summary);
          return true;
        }),
      );
      pushQueue.current = pushed.catch(() => undefined);
      return pushed.catch((error: unknown) => {
        console.error('Failed to save family data to Supabase:', error);
        toast(translate(language, 'db.saveFailed'), 'error');
        // Roll back the optimistic change so the screen — and the diff for the
        // next edit — reflect what actually reached the database. Without this
        // a failed save (common on a flaky phone connection) keeps showing as
        // saved, and because the next mutation diffs against this un-persisted
        // state the lost change is never re-sent: it silently vanishes on
        // reload. If a later edit already applied on top, a plain revert would
        // clobber it, so re-sync from the server instead.
        if (peopleRef.current === next) {
          peopleRef.current = prev;
          setPeopleState(prev);
        } else {
          void load();
        }
        return false;
      });
    },
    [toast, language, load],
  );

  const index = useMemo(() => buildIndex(people), [people]);
  const generations = useMemo(() => computeGenerations(people), [people]);
  const bloodline = useMemo(() => computeBloodline(people), [people]);

  const value = useMemo<FamilyContextValue>(
    () => ({
      people,
      index,
      generations,
      bloodline,
      getPerson: (id) => index.get(id),
      getLabel: (person) => {
        const rel = relationshipDescriptor(person, generations, bloodline);
        if (rel.marriedIn) return translate(language, 'rel.marriedIn');
        if (rel.generation === 1) return translate(language, 'rel.founder');
        if (rel.generation === 2) return translate(language, 'rel.child');
        if (rel.generation === 3) return translate(language, 'rel.grandchild');
        if (rel.generation === 4) return translate(language, 'rel.greatGrandchild');
        return translate(language, 'rel.genN', { n: rel.generation });
      },
      addPerson: (person, link) => {
        void mutate((current) => {
          let next = [...current, person];
          if (link) next = applyRelationLink(next, person.id, link);
          return next;
        }, 'add');
      },
      updatePerson: (person, parentIds, spouseIds) => {
        void mutate((current) => {
          const existing = current.find((p) => p.id === person.id);
          if (!existing) return current;
          if (!isOwner) {
            // Family editors: fill in missing details only; existing values
            // and relationships stay untouched.
            const merged = mergeAdditiveEdit(existing, person);
            return current.map((p) => (p.id === person.id ? merged : p));
          }
          const replaced = current.map((p) => (p.id === person.id ? person : p));
          return setRelationships(replaced, person.id, parentIds, spouseIds);
        }, 'edit');
      },
      setDivorcedStatus: (aId, bId, divorced) => {
        void mutate((current) => setDivorced(current, aId, bId, divorced), 'divorce');
      },
      deletePerson: (id) => void mutate((current) => removePerson(current, id), 'delete'),
      replaceAll: (newPeople) => void mutate(() => normalizePeople(newPeople), 'import'),
      resetToSample: () => {
        void mutate(() => DEFAULT_DATA, 'reset').then((saved) => {
          if (saved) void markSeeded('default-dataset');
        });
      },
      exportData: () => ({
        version: FAMILY_DATA_VERSION,
        exportedAt: new Date().toISOString(),
        people,
      }),
    }),
    [people, index, generations, bloodline, mutate, isOwner, language],
  );

  if (status !== 'ready') {
    return <FamilyDbGate status={status} language={language} onRetry={() => void load()} />;
  }

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

/** Full-page loading / error / setup screens shown before data is available. */
function FamilyDbGate({
  status,
  language,
  onRetry,
}: {
  status: Exclude<FamilyDbStatus, 'ready'>;
  language: 'uz' | 'en';
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {status === 'loading' ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
          <p role="status" className="text-sm text-stone-600 dark:text-stone-300">
            {translate(language, 'db.loading')}
          </p>
        </>
      ) : (
        <>
          <CloudOff className="h-8 w-8 text-stone-400" aria-hidden />
          <h1 className="text-lg font-semibold">
            {translate(language, status === 'error' ? 'db.errorTitle' : 'db.unconfiguredTitle')}
          </h1>
          <p className="max-w-md text-sm text-stone-600 dark:text-stone-300">
            {translate(language, status === 'error' ? 'db.errorText' : 'db.unconfiguredText')}
          </p>
          {status === 'error' && (
            <button type="button" className="btn-primary" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden /> {translate(language, 'db.retry')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used inside FamilyProvider');
  return ctx;
}
