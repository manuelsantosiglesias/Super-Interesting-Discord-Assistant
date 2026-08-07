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

const themeConfig: Record<string, { hex: string; name: string }> = {
  cyan: { hex: '#06b6d4', name: 'Cian' },
  emerald: { hex: '#10b981', name: 'Esmeralda' },
  pink: { hex: '#ec4899', name: 'Rosa' },
  gold: { hex: '#f59e0b', name: 'Dorado' },
  red: { hex: '#f43f5e', name: 'Rojo' },
  violet: { hex: '#8b5cf6', name: 'Violeta' },
  blue: { hex: '#3b82f6', name: 'Azul' },
  orange: { hex: '#f97316', name: 'Naranja' }
};

export const Collections: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estado para crear colección
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('/iconos/sparkles.svg');
  const [selectedTheme, setSelectedTheme] = useState('cyan');

  // Estado para editar colección
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCol, setEditingCol] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState('/iconos/sparkles.svg');
  const [editTheme, setEditTheme] = useState('cyan');

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
      icon: selectedIcon,
      colorTheme: selectedTheme
    });
  };

  const handleOpenEditModal = (col: any) => {
    setEditingCol(col);
    setEditName(col.name);
    setEditDescription(col.description || '');
    setEditIcon(col.icon || '/iconos/sparkles.svg');
    setEditTheme(col.colorTheme || 'cyan');
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
        icon: editIcon,
        colorTheme: editTheme
      }
    });
  };

  const handleDelete = (id: string, colName: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar la colección "${colName}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const systemCollections = collections ? collections.filter((c: any) => c.isSystem) : [];
  const userCollections = collections ? collections.filter((c: any) => !c.isSystem) : [];

  const renderCard = (col: any) => {
    const themeKey = col.colorTheme && themeConfig[col.colorTheme] ? col.colorTheme : 'cyan';
    const theme = themeConfig[themeKey];
    const hex = theme.hex;

    return (
      <div 
        key={col.id}
        onClick={() => navigate(`/collections/${col.id}`)}
        className="w-full h-[256px] max-w-[256px] bg-darkcard/30 backdrop-blur-md border rounded-3xl p-5 shadow-xl hover:shadow-2xl flex flex-col justify-between group transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden cursor-pointer neon-card-breathe"
        style={{
          '--card-glow-dim': `${hex}25`,
          '--card-glow-bright': `${hex}70`,
          '--card-border-dim': `${hex}45`,
          '--card-border-bright': `${hex}bb`
        } as React.CSSProperties}
      >
        {/* Header de la Tarjeta con Botones de Acción */}
        <div className="flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
          {col.isSystem ? (
            <span 
              className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border"
              style={{ backgroundColor: `${hex}18`, borderColor: `${hex}50`, color: hex }}
            >
              Predeterminada
            </span>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditModal(col);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="Editar colección"
              >
                <Edit size={15} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(col.id, col.name);
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                title="Eliminar colección"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Centro: Icono Grande Destacado y Textos */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-2 text-center">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center p-3 mb-2 transition-transform group-hover:scale-110 duration-300 border"
            style={{
              backgroundColor: `${hex}18`,
              borderColor: `${hex}60`,
              boxShadow: `0 0 16px ${hex}40`
            }}
          >
            <img src={col.icon || '/iconos/sparkles.svg'} alt={col.name} className="w-9 h-9 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          </div>

          <h3 className="text-base font-bold text-white group-hover:scale-105 transition-transform line-clamp-1">
            {col.name}
          </h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 px-2 leading-relaxed">
            {col.description || 'Sin descripción adicional.'}
          </p>
        </div>

        {/* Footer: Slots e Indicador Entrar */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Sliders size={13} style={{ color: hex }} />
            <span>{col.configuredSlotsCount} / {col.totalSlots}</span>
          </div>
          <span className="text-xs font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1" style={{ color: hex }}>
            Entrar &rarr;
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes neonBreatheSlowCard {
          0%, 100% {
            box-shadow: 0 0 12px var(--card-glow-dim), inset 0 0 8px var(--card-glow-dim);
            border-color: var(--card-border-dim);
          }
          50% {
            box-shadow: 0 0 22px var(--card-glow-bright), 0 0 35px var(--card-glow-bright), inset 0 0 15px var(--card-glow-bright);
            border-color: var(--card-border-bright);
          }
        }

        .neon-card-breathe {
          animation: neonBreatheSlowCard 20s ease-in-out infinite;
        }
      `}</style>

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

      {/* Grid de Colecciones estilo Clear Look & Neon Cuadradas */}
      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-slate-400">
          Cargando colecciones...
        </div>
      ) : collections && collections.length > 0 ? (
        <div className="space-y-8">
          {/* Fila 1: Colecciones Predeterminadas del Sistema */}
          {systemCollections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Colecciones Predeterminadas del Sistema
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,256px))] gap-6 justify-start">
                {systemCollections.map(renderCard)}
              </div>
            </div>
          )}

          {/* Fila 2+: Colecciones Creadas por los Usuarios */}
          <div className="space-y-3 pt-6 border-t border-white/10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Mis Colecciones Personalizadas
            </h3>
            {userCollections.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,256px))] gap-6 justify-start">
                {userCollections.map(renderCard)}
              </div>
            ) : (
              <div className="bg-darkcard/30 border border-white/5 p-8 rounded-2xl text-center">
                <p className="text-slate-400 text-xs">
                  Aún no has creado colecciones personalizadas. ¡Crea una nueva con el botón de arriba!
                </p>
              </div>
            )}
          </div>
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
                  rows={2}
                  placeholder="Pequeña nota descriptiva sobre los sonidos incluidos..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Color Neón de la Tarjeta
                </label>
                <div className="flex items-center justify-between bg-darkbg border border-darkborder p-3 rounded-xl">
                  {Object.entries(themeConfig).map(([themeKey, t]) => (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setSelectedTheme(themeKey)}
                      className={`w-7 h-7 rounded-full transition-all border-2 ${
                        selectedTheme === themeKey ? 'scale-125 border-white shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: t.hex }}
                      title={t.name}
                    />
                  ))}
                </div>
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
                      className={`p-2 rounded-lg flex items-center justify-center border transition-all ${
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
                  rows={2}
                  placeholder="Pequeña nota descriptiva..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Color Neón de la Tarjeta
                </label>
                <div className="flex items-center justify-between bg-darkbg border border-darkborder p-3 rounded-xl">
                  {Object.entries(themeConfig).map(([themeKey, t]) => (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setEditTheme(themeKey)}
                      className={`w-7 h-7 rounded-full transition-all border-2 ${
                        editTheme === themeKey ? 'scale-125 border-white shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: t.hex }}
                      title={t.name}
                    />
                  ))}
                </div>
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
                      className={`p-2 rounded-lg flex items-center justify-center border transition-all ${
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
