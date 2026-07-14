import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLockGate } from './components/AppLockGate';
import { Layout } from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { FamilyProvider } from './context/FamilyContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { MapPage } from './pages/MapPage';
import { MembersPage } from './pages/MembersPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { TreePage } from './pages/TreePage';

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
              </FamilyProvider>
            </AppLockGate>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
