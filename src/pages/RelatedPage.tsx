import { useMemo, useState } from 'react';
import { GitBranch, Link2 } from 'lucide-react';
import type { FamilyPerson } from '../types/family';
import { useFamily } from '../context/FamilyContext';
import { useLanguage, useT } from '../i18n/useT';
import { fullName } from '../utils/family';
import { describeKinship, gendered } from '../utils/kinship';
import type { Kinship } from '../utils/kinship';
import { PersonSearch } from '../components/PersonSearch';
import { Avatar } from '../components/Avatar';

function explainKinship(
  kinship: Kinship,
  a: FamilyPerson,
  b: FamilyPerson,
  t: ReturnType<typeof useT>,
): string {
  const nameA = fullName(a);
  const nameB = fullName(b);
  const g = a.gender;

  switch (kinship.kind) {
    case 'self':
      return t('related.self', { name: nameA });
    case 'spouse':
      return t('related.spouse', {
        a: nameA,
        b: nameB,
        role: gendered(g, t('related.husband'), t('related.wife'), t('related.partner')),
      });
    case 'parent':
      return t('related.parent', {
        a: nameA,
        b: nameB,
        role: gendered(g, t('related.father'), t('related.mother'), t('related.parentRole')),
      });
    case 'child':
      return t('related.child', {
        a: nameA,
        b: nameB,
        role: gendered(g, t('related.son'), t('related.daughter'), t('related.childRole')),
      });
    case 'grandparent': {
      if (kinship.generations === 2) {
        return t('related.grandparent', {
          a: nameA,
          b: nameB,
          role: gendered(
            g,
            t('related.grandfather'),
            t('related.grandmother'),
            t('related.grandparentRole'),
          ),
        });
      }
      return t('related.ancestor', { a: nameA, b: nameB, n: kinship.generations });
    }
    case 'grandchild': {
      if (kinship.generations === 2) {
        return t('related.grandchild', {
          a: nameA,
          b: nameB,
          role: gendered(
            g,
            t('related.grandson'),
            t('related.granddaughter'),
            t('related.grandchildRole'),
          ),
        });
      }
      return t('related.descendant', { a: nameA, b: nameB, n: kinship.generations });
    }
    case 'sibling':
      return t('related.sibling', {
        a: nameA,
        b: nameB,
        role: gendered(g, t('related.brother'), t('related.sister'), t('related.siblingRole')),
      });
    case 'uncle':
      return t('related.uncle', {
        a: nameA,
        b: nameB,
        role: gendered(g, t('related.uncleRole'), t('related.auntRole'), t('related.uncleAunt')),
      });
    case 'nephew':
      return t('related.nephew', {
        a: nameA,
        b: nameB,
        role: gendered(g, t('related.nephewRole'), t('related.nieceRole'), t('related.nibling')),
      });
    case 'cousin': {
      if (kinship.removal === 0) {
        return t('related.cousin', {
          a: nameA,
          b: nameB,
          degree: kinship.degree,
        });
      }
      return t('related.cousinRemoved', {
        a: nameA,
        b: nameB,
        degree: kinship.degree,
        removal: kinship.removal,
      });
    }
    case 'inlaw':
      return kinship.role === 'relative-of-spouse'
        ? t('related.inlawViaSpouse', { a: nameA, b: nameB, via: kinship.viaName })
        : t('related.inlawSpouseOf', { a: nameA, b: nameB, via: kinship.viaName });
    case 'unrelated':
      return t('related.unrelated', { a: nameA, b: nameB });
  }
}

export function RelatedPage() {
  const { people } = useFamily();
  const t = useT();
  useLanguage(); // keep language reactivity if labels change
  const [personA, setPersonA] = useState<FamilyPerson | null>(null);
  const [personB, setPersonB] = useState<FamilyPerson | null>(null);

  const result = useMemo(() => {
    if (!personA || !personB) return null;
    const kinship = describeKinship(personA.id, personB.id, people);
    return {
      kinship,
      sentence: explainKinship(kinship, personA, personB, t),
    };
  }, [personA, personB, people, t]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          {t('related.kicker')}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <GitBranch className="h-8 w-8 text-emerald-600" aria-hidden />
          {t('related.title')}
        </h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">{t('related.intro')}</p>
      </header>

      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <p className="mb-2 text-base font-semibold text-stone-800 dark:text-stone-200">
            {t('related.pickFirst')}
          </p>
          {personA ? (
            <SelectedPerson person={personA} onClear={() => setPersonA(null)} clearLabel={t('related.change')} />
          ) : (
            <PersonSearch large onPick={setPersonA} excludeIds={personB ? [personB.id] : []} />
          )}
        </div>

        <div className="flex justify-center">
          <Link2 className="h-6 w-6 text-stone-300" aria-hidden />
        </div>

        <div>
          <p className="mb-2 text-base font-semibold text-stone-800 dark:text-stone-200">
            {t('related.pickSecond')}
          </p>
          {personB ? (
            <SelectedPerson person={personB} onClear={() => setPersonB(null)} clearLabel={t('related.change')} />
          ) : (
            <PersonSearch large onPick={setPersonB} excludeIds={personA ? [personA.id] : []} />
          )}
        </div>
      </section>

      {result && (
        <section
          className="card mt-6 p-6 text-center"
          aria-live="polite"
        >
          <div className="flex justify-center -space-x-2">
            {personA && <Avatar person={personA} size="lg" />}
            {personB && <Avatar person={personB} size="lg" />}
          </div>
          <p className="mt-4 text-xl font-bold leading-snug text-stone-900 dark:text-stone-100 sm:text-2xl">
            {result.sentence}
          </p>
        </section>
      )}
    </div>
  );
}

function SelectedPerson({
  person,
  onClear,
  clearLabel,
}: {
  person: FamilyPerson;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
      <Avatar person={person} size="md" />
      <p className="min-w-0 flex-1 truncate text-lg font-semibold">{fullName(person)}</p>
      <button type="button" className="btn-secondary !px-3" onClick={onClear}>
        {clearLabel}
      </button>
    </div>
  );
}
