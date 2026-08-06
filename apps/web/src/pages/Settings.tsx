import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import { KeyRound, AlertTriangle } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const changePasswordMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    onSuccess: async () => {
      alert('Tu contraseña ha sido cambiada correctamente. Por seguridad, debes iniciar sesión nuevamente.');
      await logout();
      navigate('/login');
    },
    onError: (err: any) => {
      setError(err.message || 'Error al cambiar la contraseña.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Por favor completa todos los campos.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (newPassword.length < 12) {
      setError('La nueva contraseña debe tener al menos 12 caracteres.');
      return;
    }

    setError(null);
    changePasswordMutation.mutate({
      currentPassword,
      newPassword
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración</h2>
        <p className="text-slate-400 text-sm mt-1">Gestiona las opciones de seguridad de tu cuenta.</p>
      </div>

      {/* Password Change Card */}
      <div className="bg-darkcard border border-darkborder p-6 rounded-2xl shadow-xl shadow-black/25">
        <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
          <KeyRound className="text-primary" size={18} />
          Cambiar Contraseña
        </h3>

        {user?.mustChangePassword && (
          <div className="mb-6 p-4 bg-yellow-500/15 border border-yellow-500/35 text-slate-200 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0 text-yellow-500" />
            <span>Debes cambiar la contraseña temporal restablecida antes de poder usar otras funciones de la app.</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-accentred/15 border border-accentred/35 text-slate-200 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Contraseña Actual
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Nueva Contraseña (mínimo 12 caracteres)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Confirmar Nueva Contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
              placeholder="••••••••••••"
            />
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-darkborder">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="px-5 py-2.5 bg-primary hover:bg-primaryhover text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/10 transition-all"
            >
              {changePasswordMutation.isPending ? 'Guardando...' : 'Cambiar Contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
