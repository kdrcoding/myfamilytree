import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Languages, Loader2, LogOut, Menu, Moon, Sun, TreePine, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useSettings } from '../context/SettingsContext';
import { languageCodeLabel, nextLanguage } from '../types/family';
import { useT } from '../i18n/useT';
import { MadeByKadir } from './MadeByKadir';
import { BottomNav } from './BottomNav';
import { WelcomeTour } from './WelcomeTour';
import { NotificationsBell } from './NotificationsBell';

export function Layout() {
  const { settings, toggleTheme, setLanguage } = useSettings();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const t = useT();
  const isTreePage = location.pathname === '/tree';

  useEffect(() => {
    setMenuOpen(false);
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

  const navItems = [
    { to: '/', label: t('nav.home'), easy: true },
    { to: '/tree', label: t('nav.tree'), easy: true },
    { to: '/members', label: t('nav.members'), easy: true },
    { to: '/related', label: t('nav.related'), easy: true },
    { to: '/timeline', label: t('nav.timeline'), easy: true },
    { to: '/map', label: t('nav.map'), easy: false },
    { to: '/statistics', label: t('nav.stats'), easy: false },
    { to: '/about', label: t('nav.about'), easy: false },
    { to: '/settings', label: t('nav.settings'), easy: true },
  ].filter((item) => !settings.easyMode || item.easy);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-4 py-3.5 text-base font-semibold transition-colors lg:rounded-lg lg:px-3 lg:py-2 lg:text-sm lg:font-medium ${
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
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <NavLink
            to="/"
            className="flex min-w-0 items-center gap-2"
            onClick={() => setMenuOpen(false)}
          >
            <span className="shrink-0 rounded-xl bg-emerald-700 p-1.5 text-emerald-50">
              <TreePine className="h-5 w-5" aria-hidden />
            </span>
            <span className="truncate text-base font-bold tracking-tight sm:text-lg">
              {t('site.title')}
            </span>
          </NavLink>

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label={t('nav.mainNav')}>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/'}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1 lg:ml-2">
            <NotificationsBell />
            <button
              type="button"
              onClick={cycleLanguage}
              className="icon-btn !min-h-11 !min-w-11 !w-auto gap-1 px-2.5 text-sm font-bold"
              title={langTitle}
              aria-label={langTitle}
            >
              <Languages className="h-5 w-5" aria-hidden />
              {languageCodeLabel(settings.language)}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn !min-h-11 !min-w-11"
              aria-label={settings.theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}
            >
              {settings.theme === 'dark' ? (
                <Sun className="h-5 w-5" aria-hidden />
              ) : (
                <Moon className="h-5 w-5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="icon-btn !min-h-11 !min-w-11"
              title={t('nav.signOut')}
              aria-label={t('nav.signOut')}
            >
              <LogOut className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn !min-h-11 !gap-1.5 !px-3 text-sm font-bold lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t('nav.menuClose') : t('nav.menuOpen')}
            >
              {menuOpen ? (
                <X className="h-6 w-6" aria-hidden />
              ) : (
                <Menu className="h-6 w-6" aria-hidden />
              )}
              <span className="pr-0.5">{menuOpen ? t('nav.menuCloseShort') : t('nav.menu')}</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            className="animate-fade-in border-t border-stone-200 bg-white px-3 py-3 lg:hidden dark:border-stone-800 dark:bg-stone-950"
            aria-label={t('nav.mobileNav')}
          >
            <ul className="flex flex-col gap-1.5">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `block w-full rounded-2xl px-4 py-4 text-lg font-semibold transition-colors ${
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

      {menuOpen && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-stone-900/20 lg:hidden"
        />
      )}

      <main
        id="main"
        className={`flex flex-1 flex-col ${isTreePage ? 'pb-16 lg:pb-0' : 'pb-20 lg:pb-0'}`}
      >
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" aria-hidden />
              <span className="sr-only">{t('db.loading')}</span>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {!isTreePage && (
        <footer className="mb-16 border-t border-stone-200 py-6 text-center text-xs text-stone-500 lg:mb-0 dark:border-stone-800 dark:text-stone-400">
          <p>{t('footer.note')}</p>
          <div className="mt-3">
            <MadeByKadir />
          </div>
        </footer>
      )}

      <BottomNav />
      <WelcomeTour />
    </div>
  );
}
