import { Link } from 'react-router-dom';
import { TreePine } from 'lucide-react';
import { useT } from '../i18n/useT';

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
      <div className="rounded-2xl bg-stone-100 p-4 dark:bg-stone-800">
        <TreePine className="h-12 w-12 text-stone-300 dark:text-stone-600" aria-hidden />
      </div>
      <div>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-50">{t('notfound.title')}</h1>
        <p className="mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">{t('notfound.text')}</p>
      </div>
      <Link to="/" className="btn-primary">
        {t('notfound.back')}
      </Link>
    </div>
  );
}
