import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLockGate } from './components/AppLockGate';
import { Layout } from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { FamilyProvider } from './context/FamilyContext';
import { PhotoUrlsProvider } from './context/PhotoUrlsContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';

// Pages are loaded on demand so the first paint doesn't ship the heavy tree
// (React Flow), map (Leaflet) and export code up front — a big win on phones.
// Each `.then` adapts our named page export to the default React.lazy wants.
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const TreePage = lazy(() => import('./pages/TreePage').then((m) => ({ default: m.TreePage })));
const MembersPage = lazy(() =>
  import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })),
);
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            {/* The whole site is password-gated: family data is only fetched
                after unlocking with the family or owner password. */}
            <AppLockGate>
              <FamilyProvider>
                <PhotoUrlsProvider>
                  <BrowserRouter basename={import.meta.env.BASE_URL}>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<HomePage />} />
                      <Route path="tree" element={<TreePage />} />
                      <Route path="members" element={<MembersPage />} />
                      <Route path="map" element={<MapPage />} />
                      <Route path="statistics" element={<StatsPage />} />
                      <Route path="about" element={<AboutPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Routes>
                  </BrowserRouter>
                </PhotoUrlsProvider>
              </FamilyProvider>
            </AppLockGate>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
