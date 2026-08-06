import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext.js';
import { DashboardLayout } from './layouts/DashboardLayout.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Sounds } from './pages/Sounds.js';
import { SoundsNew } from './pages/SoundsNew.js';
import { SoundsEdit } from './pages/SoundsEdit.js';
import { DiscordConfig } from './pages/DiscordConfig.js';
import { Users } from './pages/Users.js';
import { Audit } from './pages/Audit.js';
import { Settings } from './pages/Settings.js';
import { Collections } from './pages/Collections.js';
import { CollectionsDeck } from './pages/CollectionsDeck.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<Login />} />

            {/* Rutas Privadas Protegidas */}
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sounds" element={<Sounds />} />
              <Route path="/sounds/new" element={<SoundsNew />} />
              <Route path="/sounds/:id" element={<SoundsEdit />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/collections/:id" element={<CollectionsDeck />} />
              <Route path="/discord" element={<DiscordConfig />} />
              <Route path="/users" element={<Users />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Redirección por defecto */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
