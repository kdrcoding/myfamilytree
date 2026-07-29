import { GitBranch, KeyRound, ShieldCheck, TreePine } from 'lucide-react';
import { useT } from '../i18n/useT';

export function AboutPage() {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">{t('about.title')}</h1>

      <section className="card mt-6 overflow-hidden p-6 shadow-[0_1px_3px_0_rgb(0_0_0_0.04)] dark:shadow-[0_1px_3px_0_rgb(0_0_0_0.2)]">
        <h2 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100">
          <TreePine className="h-5 w-5 text-emerald-600" aria-hidden /> {t('about.purposeTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {t('about.purposeText')}
        </p>
      </section>

      <section className="card mt-4 overflow-hidden p-6 shadow-[0_1px_3px_0_rgb(0_0_0_0.04)] dark:shadow-[0_1px_3px_0_rgb(0_0_0_0.2)]">
        <h2 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100">
          <GitBranch className="h-5 w-5 text-emerald-600" aria-hidden /> {t('about.orgTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {t('about.orgText')}
        </p>
      </section>

      <section className="card mt-4 overflow-hidden p-6 shadow-[0_1px_3px_0_rgb(0_0_0_0.04)] dark:shadow-[0_1px_3px_0_rgb(0_0_0_0.2)]">
        <h2 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100">
          <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden /> {t('about.privacyTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {t('about.privacyText')}
        </p>
      </section>

      <section className="card mt-4 overflow-hidden p-6 shadow-[0_1px_3px_0_rgb(0_0_0_0.04)] dark:shadow-[0_1px_3px_0_rgb(0_0_0_0.2)]">
        <h2 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100">
          <KeyRound className="h-5 w-5 text-emerald-600" aria-hidden /> {t('about.contributeTitle')}
        </h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          <p>{t('about.contributeText1')}</p>
          <p>{t('about.contributeText2')}</p>
        </div>
      </section>
    </div>
  );
}
