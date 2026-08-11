import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLockGate } from './components/AppLockGate';
import { Layout } from './components/Layout';
import { PageSkeleton } from './components/PageSkeleton';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { FamilyProvider } from './context/FamilyContext';
import { PhotoUrlsProvider } from './context/PhotoUrlsContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const TreePage = lazy(() => import('./pages/TreePage').then((m) => ({ default: m.TreePage })));
const MembersPage = lazy(() =>
  import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })),
);
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const TimelinePage = lazy(() =>
  import('./pages/TimelinePage').then((m) => ({ default: m.TimelinePage })),
);
const RelatedPage = lazy(() =>
  import('./pages/RelatedPage').then((m) => ({ default: m.RelatedPage })),
);
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const BirthdayPublicPage = lazy(() =>
  import('./pages/BirthdayPublicPage').then((m) => ({ default: m.BirthdayPublicPage })),
);

function LockedApp() {
  return (
    <AppLockGate>
      <FamilyProvider>
        <PhotoUrlsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="tree" element={<TreePage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="map" element={<MapPage />} />
              <Route path="timeline" element={<TimelinePage />} />
              <Route path="related" element={<RelatedPage />} />
              <Route path="statistics" element={<StatsPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </PhotoUrlsProvider>
      </FamilyProvider>
    </AppLockGate>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  {/* Public celebration page — no family password */}
                  <Route path="bday/:personId" element={<BirthdayPublicPage />} />
                  <Route path="*" element={<LockedApp />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
