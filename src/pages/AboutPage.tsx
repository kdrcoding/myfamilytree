import { Link } from 'react-router-dom';
import { GitBranch, KeyRound, ShieldCheck, TreePine } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">About this family tree</h1>

      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <TreePine className="h-5 w-5 text-emerald-600" aria-hidden /> Purpose
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          This website keeps our family's story in one living place: who we are, where we come from,
          and how every branch connects back to the original couple at the top of the tree. It
          replaces scattered notes, old photo albums and half-remembered dates with something
          everyone in the family can explore from any phone or computer.
        </p>
      </section>

      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <GitBranch className="h-5 w-5 text-emerald-600" aria-hidden /> How the information is
          organized
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          Every person has a card with their name, dates, place, occupation and a short biography.
          Relationships come in two kinds: <em>partner</em> lines connect couples side by side, and{' '}
          <em>parent–child</em> lines drop from a couple to each of their children. Generations are
          numbered from the founding couple (generation 1). The interactive tree lets you collapse
          branches you are not looking at, search for anyone, and filter by generation, country or
          gender.
        </p>
      </section>

      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden /> Privacy considerations
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          Family sites deserve care. The{' '}
          <Link to="/settings" className="text-emerald-700 underline dark:text-emerald-400">
            Settings page
          </Link>{' '}
          has a public privacy mode that hides exact dates, cities, occupations, biographies, photos
          and the ages of minors. We deliberately store no addresses, phone numbers, email addresses
          or documents. If you are in this tree and want something changed or removed, tell the
          family administrator and it will be done.
        </p>
      </section>

      <section className="card mt-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-5 w-5 text-emerald-600" aria-hidden /> How to contribute updates
        </h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          <p>
            Family members with the <strong>family password</strong> can unlock edit mode on the{' '}
            <Link to="/tree" className="text-emerald-700 underline dark:text-emerald-400">
              Family Tree page
            </Link>{' '}
            to add new people (a new baby, a new spouse) and correct details. Deleting people is
            reserved for the owner.
          </p>
          <p>
            Because this site has no server, your edits are saved in <em>your own browser</em>. To
            share them with everyone: make your changes, use <strong>Export</strong> to download the
            family JSON file, and send it to the owner — they import it and republish the site so
            everyone sees the update.
          </p>
        </div>
      </section>
    </div>
  );
}
