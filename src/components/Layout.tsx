import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import { MadeByKadir } from './MadeByKadir';
import { BottomNav } from './BottomNav';
import { PageSkeleton } from './PageSkeleton';
import { WelcomeTour } from './WelcomeTour';
import { BrandLogo } from './BrandLogo';
import { LanguageMenuButton } from './LanguageSelect';

export function Layout() {
  const { settings, toggleTheme } = useSettings();
  const { role, signOut } = useAuth();
  const confirm = useConfirm();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const t = useT();
  const isTreePage = location.pathname === '/tree';
  const isSettingsPage = location.pathname === '/settings';
  const easy = role !== 'owner' && Boolean(settings.easyMode);
  const isDark = settings.theme === 'dark';

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const handleSignOut = async () => {
    const proceed = await confirm({
      title: t('nav.signOutConfirmTitle'),
      message: t('nav.signOutConfirmMsg'),
      confirmLabel: t('nav.signOut'),
    });
    if (proceed) signOut();
  };

  const primaryNav = [
    { to: '/', label: t('nav.home') },
    { to: '/tree', label: t('nav.tree') },
    { to: '/members', label: t('nav.members') },
  ];

  const moreNav = [
    { to: '/related', label: t('nav.related'), easy: true },
    { to: '/timeline', label: t('nav.timeline'), easy: true },
    { to: '/map', label: t('nav.map'), easy: false },
    { to: '/statistics', label: t('nav.stats'), easy: false },
    { to: '/about', label: t('nav.about'), easy: true },
  ].filter((item) => !easy || item.easy);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
        : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-900 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-100'
    }`;

  return (
    <div className="app-shell flex min-h-dvh flex-col text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[90] focus:rounded-lg focus:bg-emerald-700 focus:px-3 focus:py-2 focus:text-white"
      >
        {t('nav.skip')}
      </a>
      <header className="app-header sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
          <NavLink
            to="/"
            className="flex min-w-0 items-center gap-2"
            onClick={() => setMoreOpen(false)}
          >
            <BrandLogo size="sm" />
          </NavLink>

          <nav className="ml-auto hidden items-center gap-0.5 lg:flex" aria-label={t('nav.mainNav')}>
            {primaryNav.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/'}>
                {item.label}
              </NavLink>
            ))}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `inline-flex items-center justify-center rounded-lg p-2 transition-colors ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'text-stone-700 hover:bg-stone-100/80 dark:text-stone-200 dark:hover:bg-stone-800'
                }`
              }
              aria-label={t('nav.settings')}
              title={t('nav.settings')}
            >
              <Settings className="h-5 w-5" aria-hidden />
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-0.5 lg:ml-3">
            {!isSettingsPage && <LanguageMenuButton />}

            <button
              type="button"
              className="icon-btn !min-h-10 !min-w-10"
              onClick={toggleTheme}
              aria-label={isDark ? t('nav.themeLight') : t('nav.themeDark')}
              title={isDark ? t('nav.themeLight') : t('nav.themeDark')}
            >
              {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
            </button>

            {/* One compact menu: extra pages + sign out (replaces More + ⋮). */}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                className={`icon-btn !min-h-10 !min-w-10 ${
                  moreOpen ? 'bg-stone-100 dark:bg-stone-800' : ''
                }`}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-label={t('nav.more')}
                title={t('nav.more')}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <ChevronDown className={`h-5 w-5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {moreOpen && (
                <ul
                  role="menu"
                  className="absolute right-0 z-50 mt-1 min-w-[12rem] overflow-hidden rounded-2xl border border-stone-200/90 bg-white py-1 shadow-xl dark:border-stone-700 dark:bg-stone-900"
                >
                  {moreNav.map((item) => (
                    <li key={item.to} role="none">
                      <NavLink
                        role="menuitem"
                        to={item.to}
                        className={({ isActive }) =>
                          `block px-4 py-2.5 text-sm font-semibold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                              : 'text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800'
                          }`
                        }
                        onClick={() => setMoreOpen(false)}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                  <li role="none" className="lg:hidden">
                    <NavLink
                      role="menuitem"
                      to="/settings"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm font-semibold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                            : 'text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800'
                        }`
                      }
                      onClick={() => setMoreOpen(false)}
                    >
                      <Settings className="h-4 w-4" aria-hidden />
                      {t('nav.settings')}
                    </NavLink>
                  </li>
                  <li role="none" className="my-1 border-t border-stone-200 dark:border-stone-700" />
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      onClick={() => {
                        setMoreOpen(false);
                        void handleSignOut();
                      }}
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      {t('nav.signOut')}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      <div
        id="main"
        tabIndex={-1}
        className={`flex min-h-0 flex-1 flex-col outline-none pb-[var(--bottom-nav-h)] lg:pb-0 ${
          isTreePage ? 'overflow-hidden' : ''
        }`}
      >
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
        {!isTreePage && (
          <footer className="mt-auto hidden border-t border-stone-200/80 px-4 py-6 sm:block dark:border-stone-800">
            <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p className="text-center text-xs text-stone-500 dark:text-stone-400 sm:text-left">
                {t('footer.note')}
              </p>
              <MadeByKadir />
            </div>
          </footer>
        )}
      </div>

      <BottomNav />
      <WelcomeTour />
    </div>
  );
}
