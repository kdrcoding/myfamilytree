import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { translate } from '../i18n/translations';
import type { Language } from '../i18n/translations';
import { loadJson } from '../utils/storage';
import { STORAGE_KEYS } from '../utils/storage';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Class components can't use hooks, so read the saved language directly. */
function savedLanguage(): Language {
  const settings = loadJson<{ language?: string }>(STORAGE_KEYS.settings);
  return settings?.language === 'en' ? 'en' : 'uz';
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in family tree app:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const lang = savedLanguage();
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 p-6 text-center dark:bg-stone-950">
        <span className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/40 dark:text-red-300">
          <AlertTriangle className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          {translate(lang, 'error.title')}
        </h1>
        <p className="max-w-md text-sm text-stone-600 dark:text-stone-400">
          {translate(lang, 'error.text')}
        </p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          {translate(lang, 'error.reload')}
        </button>
      </div>
    );
  }
}
