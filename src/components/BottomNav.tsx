import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Settings, TreePine, Users } from 'lucide-react';
import { useT } from '../i18n/useT';

/** Four clear tabs with labels — Settings included for older relatives. */
const TABS = [
  { to: '/', labelKey: 'nav.home' as const, icon: Home, end: true },
  { to: '/tree', labelKey: 'nav.tree' as const, icon: TreePine, end: false },
  { to: '/members', labelKey: 'nav.members' as const, icon: Users, end: false },
  { to: '/settings', labelKey: 'nav.settings' as const, icon: Settings, end: false },
];

/**
 * Fixed bottom tabs on phones — the main way older relatives move around.
 * Hidden from lg up (desktop keeps the top nav).
 */
export function BottomNav() {
  const t = useT();
  const location = useLocation();
  const trackRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  const activeIndex = TABS.findIndex((tab) =>
    tab.end
      ? location.pathname === tab.to
      : location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`),
  );

  const updatePill = useCallback(() => {
    const idx = activeIndex >= 0 ? activeIndex : 0;
    const el = itemRefs.current[idx];
    const track = trackRef.current;
    if (!el || !track) return;
    const trackBox = track.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setPill({
      left: box.left - trackBox.left,
      width: box.width,
      ready: true,
    });
  }, [activeIndex]);

  useLayoutEffect(() => {
    updatePill();
  }, [location.pathname, updatePill]);

  useEffect(() => {
    const onResize = () => updatePill();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updatePill]);

  return (
    <nav
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      aria-label={t('nav.bottomNav')}
    >
      <ul
        ref={trackRef}
        className="bottom-nav-track relative mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 pt-1"
      >
        {pill.ready && (
          <span
            className="bottom-nav-pill"
            style={{ left: pill.left, width: pill.width }}
            aria-hidden
          />
        )}
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          return (
            <li
              key={tab.to}
              ref={(node) => {
                itemRefs.current[i] = node;
              }}
            >
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-center transition-[color,transform] duration-250 ease-out ${
                    isActive
                      ? 'text-teal-800 dark:text-teal-200 [&_svg]:scale-110'
                      : 'text-stone-600 hover:text-teal-800 dark:text-stone-300 dark:hover:text-teal-200'
                  }`
                }
              >
                <Icon className="h-6 w-6 transition-transform duration-250 ease-out" aria-hidden />
                <span className="max-w-full truncate text-xs font-bold leading-tight">
                  {t(tab.labelKey)}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
