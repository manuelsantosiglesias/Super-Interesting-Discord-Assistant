import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';

export const Login: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay usuario autenticado, redirigir a dashboard
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-darkbg p-4">
      <div className="w-full max-w-md bg-darkcard border border-darkborder rounded-2xl p-8 shadow-xl shadow-black/30">
        
        {/* Title */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center font-bold text-white text-xl mx-auto mb-4 shadow-lg shadow-primary/25">
            SD
          </div>
          <h2 className="text-2xl font-bold text-white">¡Te damos la bienvenida!</h2>
          <p className="text-sm text-slate-400 mt-1.5">Inicia sesión para gestionar los sonidos del asistente</p>
        </div>

        {/* Error Callout */}
        {error && (
          <div className="mb-5 p-4 bg-accentred/15 border border-accentred/35 text-slate-200 text-sm rounded-xl">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Nombre de Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-darkbg border border-darkborder focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-150"
              placeholder="admin"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-darkbg border border-darkborder focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-150"
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primaryhover text-white text-sm font-semibold py-3.5 rounded-xl shadow-lg shadow-primary/15 hover:shadow-primary/25 transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Entrando...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
