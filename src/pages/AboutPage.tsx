import { KeyRound, ShieldCheck, TreePine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/useT';

export function AboutPage() {
  const t = useT();

  const steps = [
    {
      title: t('about.howStep1Title'),
      text: t('about.howStep1Text'),
    },
    {
      title: t('about.howStep2Title'),
      text: t('about.howStep2Text'),
    },
    {
      title: t('about.howStep3Title'),
      text: t('about.howStep3Text'),
    },
    {
      title: t('about.howStep4Title'),
      text: t('about.howStep4Text'),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
        {t('about.title')}
      </h1>

      <section className="card mt-6 overflow-hidden p-6 shadow-[0_1px_3px_0_rgb(0_0_0_0.04)] dark:shadow-[0_1px_3px_0_rgb(0_0_0_0.2)]">
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">{t('about.howTitle')}</h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t('about.howIntro')}</p>
        <ol className="mt-4 space-y-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                {t('about.howStep', { n: i + 1 })}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-stone-900 dark:text-stone-100">{step.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5">
          <Link to="/tree" className="btn-primary inline-flex items-center gap-2">
            <TreePine className="h-4 w-4" aria-hidden /> {t('about.howOpenTree')}
          </Link>
        </div>
      </section>

      <section className="card mt-4 overflow-hidden p-6 shadow-[0_1px_3px_0_rgb(0_0_0_0.04)] dark:shadow-[0_1px_3px_0_rgb(0_0_0_0.2)]">
        <h2 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100">
          <TreePine className="h-5 w-5 text-emerald-600" aria-hidden /> {t('about.purposeTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {t('about.purposeText')}
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

      <section className="card mt-4 overflow-hidden p-6 shadow-[0_1px_3px_0_rgb(0_0_0_0.04)] dark:shadow-[0_1px_3px_0_rgb(0_0_0_0.2)]">
        <h2 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100">
          <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden /> {t('about.privacyTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {t('about.privacyText')}
        </p>
      </section>
    </div>
  );
}
