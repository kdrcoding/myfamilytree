import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Languages, Menu, Moon, Sun, TreePine, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';

export function Layout() {
  const { settings, toggleTheme, setLanguage } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const t = useT();
  const isTreePage = location.pathname === '/tree';

  const navItems = [
    { to: '/', label: t('nav.home') },
    { to: '/tree', label: t('nav.tree') },
    { to: '/members', label: t('nav.members') },
    { to: '/statistics', label: t('nav.stats') },
    { to: '/about', label: t('nav.about') },
    { to: '/settings', label: t('nav.settings') },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100'
    }`;

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[90] focus:rounded-lg focus:bg-emerald-700 focus:px-3 focus:py-2 focus:text-white"
      >
        {t('nav.skip')}
      </a>
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/85 backdrop-blur dark:border-stone-800 dark:bg-stone-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="rounded-xl bg-emerald-700 p-1.5 text-emerald-50">
              <TreePine className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight">{t('site.title')}</span>
          </NavLink>

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/'}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-2">
            <button
              type="button"
              onClick={() => setLanguage(settings.language === 'uz' ? 'en' : 'uz')}
              className="icon-btn !w-auto gap-1 px-2 text-xs font-bold"
              title={settings.language === 'uz' ? 'Switch to English' : "O'zbekchaga o'tish"}
              aria-label={settings.language === 'uz' ? 'Switch to English' : "O'zbekchaga o'tish"}
            >
              <Languages className="h-4 w-4" aria-hidden />
              {settings.language === 'uz' ? 'EN' : 'UZ'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn"
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
              className="icon-btn lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t('nav.menuClose') : t('nav.menuOpen')}
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            className="border-t border-stone-200 bg-white px-4 py-3 lg:hidden dark:border-stone-800 dark:bg-stone-950"
            aria-label="Mobile navigation"
          >
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={linkClass}
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

      <main id="main" className="flex flex-1 flex-col">
        <Outlet />
      </main>

      {!isTreePage && (
        <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
          <p>{t('footer.note')}</p>
        </footer>
      )}
    </div>
  );
}
