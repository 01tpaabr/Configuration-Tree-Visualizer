import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AppShell } from './AppShell';
import { SetupPage } from './pages/SetupPage';
import { ConfigurationTreePage } from './pages/ConfigurationTreePage';
import { QueryPage } from './pages/QueryPage';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/configuration-tree" element={<ConfigurationTreePage />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
