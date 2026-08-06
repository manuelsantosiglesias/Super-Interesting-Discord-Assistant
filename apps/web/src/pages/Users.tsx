import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { 
  UserPlus, 
  Key, 
  UserCheck, 
  UserX, 
  Shield, 
  AlertCircle
} from 'lucide-react';

export const Users: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  // Estados de los formularios
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'USER'>('USER');

  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const [error, setError] = useState<string | null>(null);

  // 1. Cargar listado de usuarios
  const { data: usersRes, isLoading } = useQuery({
    queryKey: ['users-list', page],
    queryFn: () => apiRequest(`/api/users?page=${page}&pageSize=10`)
  });

  // Mutación: Crear usuario
  const createUserMutation = useMutation({
    mutationFn: (body: any) => 
      apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setShowCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('USER');
      setError(null);
      alert('Usuario creado con éxito.');
    },
    onError: (err: any) => {
      setError(err.message || 'Error al crear usuario.');
    }
  });

  // Mutación: Restablecer contraseña
  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: any) => 
      apiRequest(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: password })
      }),
    onSuccess: () => {
      setShowResetModal(false);
      setSelectedUserId(null);
      setResetPasswordVal('');
      alert('Contraseña restablecida con éxito. Se obligará al usuario a cambiarla en su primer login.');
    },
    onError: (err: any) => {
      alert(`Error al restablecer contraseña: ${err.message}`);
    }
  });

  // Mutación: Desactivar usuario
  const disableMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/users/${id}/disable`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  // Mutación: Activar usuario
  const enableMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/users/${id}/enable`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    
    createUserMutation.mutate({
      username: newUsername,
      password: newPassword,
      role: newRole
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !resetPasswordVal) return;

    resetPasswordMutation.mutate({
      userId: selectedUserId,
      password: resetPasswordVal
    });
  };

  const handleToggleActive = (id: string, active: boolean) => {
    if (active) {
      if (confirm('¿Estás seguro de que deseas desactivar este usuario? Se cerrarán todas sus sesiones activas de inmediato.')) {
        disableMutation.mutate(id);
      }
    } else {
      enableMutation.mutate(id);
    }
  };

  const handleOpenReset = (id: string) => {
    setSelectedUserId(id);
    setShowResetModal(true);
    setResetPasswordVal('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestión de Usuarios</h2>
          <p className="text-slate-400 text-sm mt-1">Crea nuevos usuarios operadores del panel, activa o desactiva sus cuentas y gestiona contraseñas.</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setError(null); }}
          className="bg-primary hover:bg-primaryhover text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-primary/10 transition-all duration-150 flex items-center gap-2"
        >
          <UserPlus size={16} />
          Nuevo Usuario
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-darkcard border border-darkborder rounded-xl overflow-hidden shadow-lg shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-darkborder bg-darkbg/40 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Usuario</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Último Login</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkborder">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : usersRes?.items && usersRes.items.length > 0 ? (
                usersRes.items.map((u: any) => (
                  <tr key={u.id} className="hover:bg-darkbg/10 text-sm text-slate-200">
                    <td className="p-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        {u.username}
                        {u.mustChangePassword && (
                          <span className="text-[10px] bg-yellow-500/10 text-yellow-500 font-semibold px-2 py-0.5 rounded-full border border-yellow-500/20">
                            Reset Contraseña
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Shield size={14} className={u.role === 'ADMIN' ? 'text-primary' : 'text-slate-500'} />
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Nunca'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        u.isActive
                          ? 'bg-green-500/10 border-green-500/20 text-green-500'
                          : 'bg-red-500/10 border-red-500/20 text-red-500'
                      }`}>
                        {u.isActive ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {/* Activar/Desactivar */}
                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive)}
                          className={`p-2 border rounded-lg transition-all ${
                            u.isActive
                              ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'
                              : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500 hover:text-white'
                          }`}
                          title={u.isActive ? 'Desactivar Cuenta' : 'Activar Cuenta'}
                        >
                          {u.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        
                        {/* Restablecer Contraseña */}
                        <button
                          onClick={() => handleOpenReset(u.id)}
                          className="p-2 bg-darkbg border border-darkborder hover:border-yellow-500 text-slate-300 hover:text-white rounded-lg transition-all"
                          title="Restablecer Contraseña"
                        >
                          <Key size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 text-sm">
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {usersRes?.pagination && usersRes.pagination.totalPages > 1 && (
          <div className="bg-darkbg/25 border-t border-darkborder px-4 py-4 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              Página {usersRes.pagination.page} de {usersRes.pagination.totalPages} ({usersRes.pagination.totalItems} usuarios)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-darkbg border border-darkborder rounded-lg text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, usersRes.pagination.totalPages))}
                disabled={page === usersRes.pagination.totalPages}
                className="px-3 py-1.5 bg-darkbg border border-darkborder rounded-lg text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-darkcard border border-darkborder rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="text-primary" size={20} />
              Crear Nuevo Usuario
            </h3>

            {error && (
              <div className="mb-4 p-4 bg-accentred/15 border border-accentred/35 text-slate-200 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre de Usuario
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  placeholder="operador"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Contraseña Inicial (mínimo 12 caracteres)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  placeholder="••••••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Rol de Usuario
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                >
                  <option value="USER">USER (Gestión de sonidos y Discord)</option>
                  <option value="ADMIN">ADMIN (Acceso total, auditorías y usuarios)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-darkborder">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-darkbg hover:bg-darkborder border border-darkborder rounded-xl text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primaryhover text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/10"
                >
                  {createUserMutation.isPending ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Restablecer Contraseña */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-darkcard border border-darkborder rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Key className="text-yellow-500" size={20} />
              Restablecer Contraseña
            </h3>
            
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nueva Contraseña Temporal (mínimo 12 caracteres)
                </label>
                <input
                  type="password"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  required
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  placeholder="••••••••••••"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-darkborder">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 bg-darkbg hover:bg-darkborder border border-darkborder rounded-xl text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!resetPasswordVal || resetPasswordMutation.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primaryhover text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/10"
                >
                  {resetPasswordMutation.isPending ? 'Restableciendo...' : 'Restablecer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
