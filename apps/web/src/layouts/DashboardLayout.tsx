import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Sidebar } from '../components/Sidebar.js';

export const DashboardLayout: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-darkbg text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-medium">Cargando aplicación...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isSettingsPage = window.location.pathname === '/settings';
  if (user.mustChangePassword && !isSettingsPage) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="flex bg-darkbg min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-x-hidden">
        {user.mustChangePassword && (
          <div className="mb-6 p-4 bg-accentred/15 border border-accentred/35 text-slate-200 rounded-lg text-sm">
            <strong>¡Atención requerida!</strong> Debes actualizar tu contraseña por seguridad antes de continuar utilizando el asistente.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
};
