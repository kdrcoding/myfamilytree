import { Link } from 'react-router-dom';
import { TreePine } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <TreePine className="h-12 w-12 text-stone-300 dark:text-stone-600" aria-hidden />
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="max-w-md text-sm text-stone-500 dark:text-stone-400">
        This branch of the site doesn't exist. Maybe it was pruned?
      </p>
      <Link to="/" className="btn-primary">
        Back to the home page
      </Link>
    </div>
  );
}
