import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { 
  LayoutGrid, 
  Plus, 
  Trash2, 
  Sliders, 
  FolderPlus,
  ArrowRight
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
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('/iconos/sparkles.svg');

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

      {/* Grid de Colecciones */}
      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-slate-400">
          Cargando colecciones...
        </div>
      ) : collections && collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((col: any) => (
            <div 
              key={col.id}
              className="bg-darkcard border border-darkborder hover:border-primary/50 p-6 rounded-2xl shadow-xl flex flex-col justify-between group transition-all duration-200"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-all flex items-center justify-center w-12 h-12">
                    <img src={col.icon || '/iconos/sparkles.svg'} alt={col.name} className="w-6 h-6 object-contain" />
                  </div>
                  <button
                    onClick={() => handleDelete(col.id, col.name)}
                    className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-darkbg transition-all"
                    title="Eliminar colección"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                  {col.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                  {col.description || 'Sin descripción adicional.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-darkborder/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                  <Sliders size={14} className="text-slate-500" />
                  <span>{col.configuredSlotsCount} / {col.totalSlots} botones</span>
                </div>

                <Link
                  to={`/collections/${col.id}`}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-darkbg border border-darkborder hover:border-primary text-xs font-semibold text-white rounded-xl transition-all"
                >
                  <span>Abrir Mesa</span>
                  <ArrowRight size={14} />
                </Link>
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
                  placeholder="Ej: Mesa Principal Stream, Memes de Discord..."
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
    </div>
  );
};
