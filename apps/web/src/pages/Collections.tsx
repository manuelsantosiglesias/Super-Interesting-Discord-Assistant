import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { 
  LayoutGrid, 
  Plus, 
  Trash2, 
  Sliders, 
  FolderPlus,
  Edit
} from 'lucide-react';

const AVAILABLE_ICONS = [
  { id: '/iconos/sparkles.svg', label: 'Destellos' },
  { id: '/iconos/music.svg', label: 'Música' },
  { id: '/iconos/fire.svg', label: 'Fuego' },
  { id: '/iconos/game.svg', label: 'Gaming' },
  { id: '/iconos/zap.svg', label: 'Rayo' },
  { id: '/iconos/bot.svg', label: 'Bot' }
];

export const Collections: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estado para crear colección
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('/iconos/sparkles.svg');

  // Estado para editar colección
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCol, setEditingCol] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState('/iconos/sparkles.svg');

  // 1. Cargar colecciones
  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiRequest('/api/collections')
  });

  // Mutación: Crear colección
  const createMutation = useMutation({
    mutationFn: (body: any) => apiRequest('/api/collections', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setShowCreateModal(false);
      setName('');
      setDescription('');
    },
    onError: (err: any) => {
      alert(`Error al crear la colección: ${err.message}`);
    }
  });

  // Mutación: Editar colección
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiRequest(`/api/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setShowEditModal(false);
      setEditingCol(null);
    },
    onError: (err: any) => {
      alert(`Error al actualizar la colección: ${err.message}`);
    }
  });

  // Mutación: Eliminar colección
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/collections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      icon: selectedIcon
    });
  };

  const handleOpenEditModal = (col: any) => {
    setEditingCol(col);
    setEditName(col.name);
    setEditDescription(col.description || '');
    setEditIcon(col.icon || '/iconos/sparkles.svg');
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCol || !editName.trim()) return;
    updateMutation.mutate({
      id: editingCol.id,
      body: {
        name: editName.trim(),
        description: editDescription.trim() || null,
        icon: editIcon
      }
    });
  };

  const handleDelete = (id: string, colName: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar la colección "${colName}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <LayoutGrid className="text-primary" size={26} />
            Colecciones de Sonidos
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Crea mesas interactivas de reproducción de sonido.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primaryhover text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Nueva Colección
        </button>
      </div>

      {/* Grid de Colecciones estilo Clear Look & Cuadradas */}
      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-slate-400">
          Cargando colecciones...
        </div>
      ) : collections && collections.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((col: any) => (
            <div 
              key={col.id}
              onClick={() => navigate(`/collections/${col.id}`)}
              className="bg-darkcard/40 backdrop-blur-md border border-white/10 hover:border-primary/50 p-6 rounded-3xl shadow-xl hover:shadow-2xl hover:shadow-primary/10 flex flex-col justify-between group transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden cursor-pointer aspect-square"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-all flex items-center justify-center w-12 h-12 border border-primary/20">
                    <img src={col.icon || '/iconos/sparkles.svg'} alt={col.name} className="w-6 h-6 object-contain" />
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(col);
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                      title="Editar colección"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(col.id, col.name);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                      title="Eliminar colección"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                  {col.name}
                </h3>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                  {col.description || 'Sin descripción adicional.'}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                  <Sliders size={14} className="text-primary" />
                  <span>{col.configuredSlotsCount} / {col.totalSlots} botones</span>
                </div>
                <span className="text-xs font-bold text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Entrar &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-darkcard border border-darkborder p-12 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
            <FolderPlus size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No tienes ninguna colección creada</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mt-1">
              Crea tu primera mesa interactiva de reproducción para organizar hasta 20 sonidos de reproducción inmediata.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-primary hover:bg-primaryhover text-white text-sm font-semibold rounded-xl transition-all"
          >
            Crear Mi Primera Colección
          </button>
        </div>
      )}

      {/* Modal: Crear Colección */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-darkcard border border-darkborder rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FolderPlus size={20} className="text-primary" />
              Nueva Colección de Botones
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre de la Colección
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ej: Mesa Principal, Memes de Discord..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Pequeña nota descriptiva sobre los sonidos incluidos..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Icono Distintivo
                </label>
                <div className="grid grid-cols-6 gap-2 bg-darkbg border border-darkborder p-3 rounded-xl">
                  {AVAILABLE_ICONS.map((ico) => (
                    <button
                      key={ico.id}
                      type="button"
                      onClick={() => setSelectedIcon(ico.id)}
                      className={`p-2.5 rounded-lg flex items-center justify-center border transition-all ${
                        selectedIcon === ico.id
                          ? 'bg-primary/20 border-primary shadow-lg shadow-primary/20 scale-105'
                          : 'border-transparent hover:bg-darkborder/50'
                      }`}
                      title={ico.label}
                    >
                      <img src={ico.id} alt={ico.label} className="w-6 h-6 object-contain" />
                    </button>
                  ))}
                </div>
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
                  disabled={!name.trim() || createMutation.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primaryhover disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/10"
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Colección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Colección */}
      {showEditModal && editingCol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-darkcard border border-darkborder rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Edit size={20} className="text-primary" />
              Editar Colección
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre de la Colección
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder="Ej: Mesa Principal, Efectos de Sonido..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  placeholder="Pequeña nota descriptiva..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Icono Distintivo
                </label>
                <div className="grid grid-cols-6 gap-2 bg-darkbg border border-darkborder p-3 rounded-xl">
                  {AVAILABLE_ICONS.map((ico) => (
                    <button
                      key={ico.id}
                      type="button"
                      onClick={() => setEditIcon(ico.id)}
                      className={`p-2.5 rounded-lg flex items-center justify-center border transition-all ${
                        editIcon === ico.id
                          ? 'bg-primary/20 border-primary shadow-lg shadow-primary/20 scale-105'
                          : 'border-transparent hover:bg-darkborder/50'
                      }`}
                      title={ico.label}
                    >
                      <img src={ico.id} alt={ico.label} className="w-6 h-6 object-contain" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-darkborder">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-darkbg hover:bg-darkborder border border-darkborder rounded-xl text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim() || updateMutation.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primaryhover disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/10"
                >
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
