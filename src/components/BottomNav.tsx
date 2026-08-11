import { NavLink } from 'react-router-dom';
import { Home, Settings, TreePine, Users } from 'lucide-react';
import { useT } from '../i18n/useT';

/** Four clear tabs — Settings is the gear icon. */
const TABS = [
  { to: '/', labelKey: 'nav.home' as const, icon: Home, end: true, iconOnly: false },
  { to: '/tree', labelKey: 'nav.tree' as const, icon: TreePine, end: false, iconOnly: false },
  { to: '/members', labelKey: 'nav.members' as const, icon: Users, end: false, iconOnly: false },
  { to: '/settings', labelKey: 'nav.settings' as const, icon: Settings, end: false, iconOnly: true },
];

/**
 * Fixed bottom tabs on phones — the main way older relatives move around.
 * Hidden from lg up (desktop keeps the top nav).
 */
export function BottomNav() {
  const t = useT();

  return (
    <nav
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      aria-label={t('nav.bottomNav')}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 pt-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                aria-label={tab.iconOnly ? t(tab.labelKey) : undefined}
                title={tab.iconOnly ? t(tab.labelKey) : undefined}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-center transition-colors ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                      : 'text-stone-600 hover:bg-stone-100/70 dark:text-stone-300 dark:hover:bg-stone-900'
                  }`
                }
              >
                <Icon className={tab.iconOnly ? 'h-7 w-7' : 'h-6 w-6'} aria-hidden />
                {!tab.iconOnly && (
                  <span className="max-w-full truncate text-xs font-bold leading-tight">
                    {t(tab.labelKey)}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
