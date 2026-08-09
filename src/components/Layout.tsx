import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import { MadeByKadir } from './MadeByKadir';
import { BottomNav } from './BottomNav';
import { PageSkeleton } from './PageSkeleton';
import { WelcomeTour } from './WelcomeTour';
import { OverflowMenu } from './OverflowMenu';
import { BrandLogo } from './BrandLogo';
import { LanguageMenuButton } from './LanguageSelect';

export function Layout() {
  const { settings, toggleTheme } = useSettings();
  const { role, signOut } = useAuth();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const t = useT();
  const isTreePage = location.pathname === '/tree';
  const isSettingsPage = location.pathname === '/settings';
  // Keep the shared family experience simple. The owner always gets the
  // complete navigation and administrative surface.
  const easy = role !== 'owner' && Boolean(settings.easyMode);

  useEffect(() => {
    setMenuOpen(false);
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

  // Primary destinations — keep the top bar short and clear.
  const primaryNav = [
    { to: '/', label: t('nav.home') },
    { to: '/tree', label: t('nav.tree') },
    { to: '/members', label: t('nav.members') },
    { to: '/settings', label: t('nav.settings') },
  ];

  // Extra pages live under More / the phone menu.
  const moreNav = [
    { to: '/related', label: t('nav.related'), easy: true },
    { to: '/timeline', label: t('nav.timeline'), easy: true },
    { to: '/map', label: t('nav.map'), easy: false },
    { to: '/statistics', label: t('nav.stats'), easy: false },
    { to: '/about', label: t('nav.about'), easy: true },
  ].filter((item) => !easy || item.easy);

  // Phone hamburger: secondary pages only (bottom tabs cover Home/Tree/Members/Settings).
  const mobileNav = moreNav;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-100'
    }`;

  return (
    <div className="flex min-h-dvh flex-col bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[90] focus:rounded-lg focus:bg-emerald-700 focus:px-3 focus:py-2 focus:text-white"
      >
        {t('nav.skip')}
      </a>
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/85 backdrop-blur dark:border-stone-800 dark:bg-stone-950/85">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
          <NavLink
            to="/"
            className="flex min-w-0 items-center gap-2"
            onClick={() => setMenuOpen(false)}
          >
            <BrandLogo size="sm" />
          </NavLink>

          <nav className="ml-auto hidden items-center gap-0.5 lg:flex" aria-label={t('nav.mainNav')}>
            {primaryNav.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/'}>
                {item.label}
              </NavLink>
            ))}
            {moreNav.length > 0 && (
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  className={linkClass({ isActive: moreOpen })}
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  {t('nav.more')}
                  <ChevronDown className="ml-0.5 inline h-4 w-4" aria-hidden />
                </button>
                {moreOpen && (
                  <ul className="absolute right-0 z-50 mt-1 min-w-[11rem] overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-xl dark:border-stone-700 dark:bg-stone-900">
                    {moreNav.map((item) => (
                      <li key={item.to}>
                        <NavLink
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
                  </ul>
                )}
              </div>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-0.5 lg:ml-4">
            {/* Language lives on Settings when that page is open — avoid two pickers. */}
            {!isSettingsPage && <LanguageMenuButton />}
            {/* Desktop chrome — phone uses bottom tabs + Settings for these. */}
            <div className="hidden lg:contents">
              {!isSettingsPage && (
                <OverflowMenu
                  label={t('nav.more')}
                  items={[
                    {
                      id: 'theme',
                      label: settings.theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark'),
                      icon:
                        settings.theme === 'dark' ? (
                          <Sun className="h-4 w-4" aria-hidden />
                        ) : (
                          <Moon className="h-4 w-4" aria-hidden />
                        ),
                      onClick: toggleTheme,
                    },
                    {
                      id: 'signout',
                      label: t('nav.signOut'),
                      icon: <LogOut className="h-4 w-4" aria-hidden />,
                      onClick: () => void handleSignOut(),
                      danger: true,
                    },
                  ]}
                />
              )}
            </div>
            {moreNav.length > 0 && (
              <button
                type="button"
                className="icon-btn !min-h-11 !min-w-11 lg:hidden"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? t('nav.menuClose') : t('nav.menuOpen')}
              >
                {menuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
              </button>
            )}
          </div>
        </div>

        {menuOpen && (
          <nav
            className="animate-fade-in border-t border-stone-200 bg-white px-3 py-3 lg:hidden dark:border-stone-800 dark:bg-stone-950"
            aria-label={t('nav.mobileNav')}
          >
            <ul className="flex flex-col gap-1">
              {mobileNav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `block w-full rounded-2xl px-4 py-3.5 text-lg font-semibold transition-colors ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'bg-stone-50 text-stone-800 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800'
                      }`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
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
          <footer className="mt-auto hidden border-t border-stone-200 px-4 py-6 sm:block dark:border-stone-800">
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
