import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { FamilyData, FamilyPerson, RelationLink } from '../types/family';
import { FAMILY_DATA_VERSION } from '../types/family';
import { samplePeople } from '../data/sampleFamily';
import defaultFamilyJson from '../data/defaultFamily.json';
import { translate } from '../i18n/translations';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
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
  setRelationships,
} from '../utils/family';
import type { PersonIndex } from '../utils/family';

interface FamilyContextValue {
  people: FamilyPerson[];
  index: PersonIndex;
  generations: Map<string, number>;
  bloodline: Set<string>;
  /** True when the deployed site ships newer data than this browser has seen. */
  datasetUpdateAvailable: boolean;
  /** Replace this browser's data with the website's built-in data. */
  adoptSiteData: () => void;
  /** Keep the local version and stop offering the update. */
  dismissSiteData: () => void;
  getPerson: (id: string) => FamilyPerson | undefined;
  getLabel: (person: FamilyPerson) => string;
  /** Create a person, optionally attached to an existing relative. */
  addPerson: (person: FamilyPerson, link?: RelationLink) => void;
  /** Update fields and replace the person's parent/spouse relationships. */
  updatePerson: (person: FamilyPerson, parentIds: string[], spouseIds: string[]) => void;
  deletePerson: (id: string) => void;
  replaceAll: (people: FamilyPerson[]) => void;
  resetToSample: () => void;
  exportData: () => FamilyData;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

function isStoredData(value: unknown): value is FamilyData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === 'number' && Array.isArray(v.people);
}

// The website's built-in family data. `tools\use-my-data.bat` replaces
// src/data/defaultFamily.json with the owner's exported family, so this is
// what every new visitor sees. Falls back to the fictional sample if the
// JSON file is ever invalid.
const DEFAULT_DATA = (() => {
  const result = validateFamilyData(defaultFamilyJson);
  return result.ok && result.data ? normalizePeople(result.data.people) : samplePeople;
})();
const DEFAULT_STAMP = (defaultFamilyJson as { exportedAt?: string }).exportedAt ?? 'initial';
const DATASET_ACK_KEY = 'familytree.datasetAck.v1';

export function FamilyProvider({ children }: { children: ReactNode }) {
  // Owner edits are unrestricted; family editors may only ADD information.
  const { canDelete: isOwner } = useAuth();
  const { settings } = useSettings();
  const language = settings.language;
  const [data, setData] = usePersistentState<FamilyData>(
    STORAGE_KEYS.data,
    { version: FAMILY_DATA_VERSION, people: DEFAULT_DATA },
    isStoredData,
  );

  // Detect returning visitors whose saved copy predates the currently
  // published dataset, so they can pull in the owner's latest updates.
  const [datasetUpdateAvailable, setDatasetUpdateAvailable] = useState<boolean>(() => {
    const hadSavedData = loadJson<FamilyData>(STORAGE_KEYS.data, isStoredData) !== null;
    if (!hadSavedData) {
      saveJson(DATASET_ACK_KEY, DEFAULT_STAMP);
      return false;
    }
    const acknowledged = loadJson<string>(
      DATASET_ACK_KEY,
      (v): v is string => typeof v === 'string',
    );
    return acknowledged !== DEFAULT_STAMP;
  });

  const people = data.people;
  const setPeople = useCallback(
    (updater: (current: FamilyPerson[]) => FamilyPerson[]) => {
      setData((current) => ({ version: FAMILY_DATA_VERSION, people: updater(current.people) }));
    },
    [setData],
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
        setPeople((current) => {
          let next = [...current, person];
          if (link) next = applyRelationLink(next, person.id, link);
          return next;
        });
      },
      updatePerson: (person, parentIds, spouseIds) => {
        setPeople((current) => {
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
        });
      },
      deletePerson: (id) => setPeople((current) => removePerson(current, id)),
      replaceAll: (newPeople) => setPeople(() => normalizePeople(newPeople)),
      resetToSample: () => setPeople(() => DEFAULT_DATA),
      datasetUpdateAvailable,
      adoptSiteData: () => {
        setPeople(() => DEFAULT_DATA);
        saveJson(DATASET_ACK_KEY, DEFAULT_STAMP);
        setDatasetUpdateAvailable(false);
      },
      dismissSiteData: () => {
        saveJson(DATASET_ACK_KEY, DEFAULT_STAMP);
        setDatasetUpdateAvailable(false);
      },
      exportData: () => ({
        version: FAMILY_DATA_VERSION,
        exportedAt: new Date().toISOString(),
        people,
      }),
    }),
    [people, index, generations, bloodline, setPeople, isOwner, datasetUpdateAvailable, language],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used inside FamilyProvider');
  return ctx;
}
