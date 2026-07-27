import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Languages, Loader2, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useSettings } from '../context/SettingsContext';
import { languageCodeLabel, nextLanguage } from '../types/family';
import { useT } from '../i18n/useT';
import { MadeByKadir } from './MadeByKadir';
import { BottomNav } from './BottomNav';
import { WelcomeTour } from './WelcomeTour';
import { NotificationsBell } from './NotificationsBell';
import { OverflowMenu } from './OverflowMenu';
import { BrandLogo } from './BrandLogo';

export function Layout() {
  const { settings, toggleTheme, setLanguage } = useSettings();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const t = useT();
  const isTreePage = location.pathname === '/tree';
  const easy = Boolean(settings.easyMode);

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    const proceed = await confirm({
      title: t('nav.signOutConfirmTitle'),
      message: t('nav.signOutConfirmMsg'),
      confirmLabel: t('nav.signOut'),
    });
    if (proceed) signOut();
  };

  const cycleLanguage = () => setLanguage(nextLanguage(settings.language));

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
    { to: '/about', label: t('nav.about'), easy: false },
  ].filter((item) => !easy || item.easy);

  const mobileNav = [...primaryNav, ...moreNav];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-100'
    }`;

  const langTitle =
    settings.language === 'uz'
      ? 'Switch to English'
      : settings.language === 'en'
        ? 'Переключить на русский'
        : "O'zbekchaga o'tish";

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
              <div className="relative">
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

          <div className="ml-auto flex items-center gap-0.5 lg:ml-2">
            <NotificationsBell />
            <OverflowMenu
              label={t('nav.more')}
              items={[
                {
                  id: 'lang',
                  label: `${t('nav.language')}: ${languageCodeLabel(settings.language)}`,
                  icon: <Languages className="h-4 w-4" aria-hidden />,
                  onClick: cycleLanguage,
                },
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
            <button
              type="button"
              className="icon-btn !min-h-11 !gap-1 !px-2.5 text-sm font-bold lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t('nav.menuClose') : t('nav.menuOpen')}
            >
              {menuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
              <span className="hidden sm:inline sm:pr-0.5">
                {menuOpen ? t('nav.menuCloseShort') : t('nav.menu')}
              </span>
            </button>
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
            <p className="sr-only">{langTitle}</p>
          </nav>
        )}
      </header>

      <div
        id="main"
        tabIndex={-1}
        className={`flex flex-1 flex-col outline-none ${isTreePage ? 'pb-16 lg:pb-0' : 'pb-20 lg:pb-0'}`}
      >
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center gap-2 p-10 text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {t('db.loading')}
            </div>
          }
        >
          <Outlet />
        </Suspense>
        {!isTreePage && (
          <footer className="mt-auto border-t border-stone-200 px-4 py-6 dark:border-stone-800">
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
