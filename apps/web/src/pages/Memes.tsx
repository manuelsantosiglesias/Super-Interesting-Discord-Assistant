import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  X, 
  Check, 
  Loader2,
  Edit
} from 'lucide-react';
import { SoundIcon } from '../components/SoundIcon.js';

export const Memes: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'Memes' | 'Standard' | 'Custom'>('all');

  // 1. Cargar lista de iconos y memes
  const { data: iconGallery, isLoading } = useQuery({
    queryKey: ['custom-icons'],
    queryFn: () => apiRequest('/api/icons')
  });

  // Modal y estado para subir nueva imagen
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newIconName, setNewIconName] = useState('');
  const [newIconFile, setNewIconFile] = useState<File | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  const handleUploadIconSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIconFile) return;
    setUploadingIcon(true);
    setIconError(null);

    const formData = new FormData();
    if (newIconName.trim()) formData.append('name', newIconName.trim());
    formData.append('file', newIconFile);

    try {
      await apiRequest('/api/icons', {
        method: 'POST',
        body: formData
      });
      queryClient.invalidateQueries({ queryKey: ['custom-icons'] });
      setShowUploadModal(false);
      setNewIconFile(null);
      setNewIconName('');
    } catch (err: any) {
      setIconError(err.message || 'Error al subir la imagen.');
    } finally {
      setUploadingIcon(false);
    }
  };

  // Mutación: Eliminar icono (Permitido para memes y custom; Prohibido para predeterminados)
  const deleteIconMutation = useMutation({
    mutationFn: (iconId: string) => apiRequest(`/api/icons/${iconId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-icons'] });
      queryClient.invalidateQueries({ queryKey: ['sounds'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (err: any) => {
      alert(err.message || 'No se pudo eliminar el icono.');
    }
  });

  const handleDeleteIcon = (iconId: string, iconName: string, isBuiltin: boolean) => {
    if (isBuiltin) {
      alert('Los iconos predeterminados del sistema no se pueden eliminar.');
      return;
    }
    if (confirm(`¿Estás seguro de que deseas eliminar la imagen "${iconName}"?`)) {
      deleteIconMutation.mutate(iconId);
    }
  };

  // Estado y mutación para editar meme/icono
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIcon, setEditingIcon] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<string>('Memes');

  const updateIconMutation = useMutation({
    mutationFn: ({ id, name, category }: { id: string; name: string; category: string }) =>
      apiRequest(`/api/icons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, category })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-icons'] });
      queryClient.invalidateQueries({ queryKey: ['sounds'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setShowEditModal(false);
      setEditingIcon(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Error al actualizar la imagen.');
    }
  });

  const handleOpenEditModal = (icon: any) => {
    if (icon.isBuiltin || icon.category === 'Standard') {
      alert('Los iconos predeterminados del sistema no se pueden editar.');
      return;
    }
    setEditingIcon(icon);
    setEditName(icon.name);
    setEditCategory(icon.category || 'Memes');
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIcon || !editName.trim()) return;
    updateIconMutation.mutate({
      id: editingIcon.id,
      name: editName.trim(),
      category: editCategory
    });
  };

  const userManageableIcons = iconGallery
    ? iconGallery.filter((icon: any) => !icon.isBuiltin && icon.category !== 'Standard')
    : [];

  const filteredIcons = userManageableIcons.filter((icon: any) => {
    if (activeTab === 'all') return true;
    return icon.category === activeTab;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-darkcard/40 border border-darkborder p-6 rounded-3xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 border border-primary/20 text-primary rounded-2xl">
              <ImageIcon size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Gestión de Memes e Iconos</h2>
              <p className="text-xs text-slate-400 mt-1">
                Sube y administra imágenes para asociarlas como iconos a sonidos, canciones y mesas de colecciones.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="px-5 py-3 bg-primary hover:bg-primaryhover text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Upload size={16} />
          Subir Nueva Imagen
        </button>
      </div>

      {/* Tabs Filtro */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1.5 bg-darkbg border border-darkborder rounded-2xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({userManageableIcons.length})
          </button>
          <button
            onClick={() => setActiveTab('Memes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'Memes'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Memes ({userManageableIcons.filter((i: any) => i.category === 'Memes').length})
          </button>
          <button
            onClick={() => setActiveTab('Custom')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'Custom'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Personalizados ({userManageableIcons.filter((i: any) => i.category === 'Custom').length})
          </button>
        </div>

        <span className="text-xs text-slate-500 font-mono">
          {filteredIcons.length} elemento(s) visible(s)
        </span>
      </div>

      {/* Grid de Iconos */}
      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin text-primary mr-2" />
          Cargando imágenes de la galería...
        </div>
      ) : filteredIcons.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {filteredIcons.map((icon: any) => {
            return (
              <div
                key={icon.id}
                className="group relative flex flex-col items-center justify-between p-4 bg-darkcard/50 border border-darkborder hover:border-primary/60 rounded-3xl transition-all duration-200 shadow-lg hover:shadow-primary/10"
              >
                <div className="my-2 flex items-center justify-center">
                  <SoundIcon src={icon.url} alt={icon.name} size="xl" />
                </div>
                <span className="text-xs font-bold text-white truncate w-full text-center mt-2" title={icon.name}>
                  {icon.name}
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">
                  {icon.category}
                </span>

                {/* Acciones: Editar y Borrar */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(icon)}
                    className="p-1.5 bg-darkbg/90 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-xl border border-darkborder transition-all shadow cursor-pointer"
                    title="Editar meme/icono"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteIcon(icon.id, icon.name, false)}
                    className="p-1.5 bg-darkbg/90 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl border border-darkborder transition-all shadow cursor-pointer"
                    title="Eliminar meme/icono"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-darkcard border border-darkborder p-12 rounded-3xl text-center space-y-3">
          <ImageIcon size={32} className="mx-auto text-slate-500" />
          <h3 className="text-base font-bold text-white">No hay imágenes en esta categoría</h3>
          <p className="text-xs text-slate-400">Prueba a seleccionar otra categoría o sube una nueva imagen.</p>
        </div>
      )}

      {/* Modal: Subir Nueva Imagen de Icono */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-darkcard border border-darkborder rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-darkborder">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload size={20} className="text-primary" />
                Subir Imagen para Icono
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadIconSubmit} className="space-y-4">
              {iconError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                  {iconError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre de la Imagen (Opcional)
                </label>
                <input
                  type="text"
                  value={newIconName}
                  onChange={(e) => setNewIconName(e.target.value)}
                  placeholder="Ej: Meme Risas, Icono Especial..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Archivo de Imagen (PNG, JPG, SVG, WebP)
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/gif, image/webp, image/svg+xml"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setNewIconFile(e.target.files[0]);
                      if (!newIconName) {
                        setNewIconName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                  required
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primaryhover"
                />
              </div>

              {/* Vista previa de miniatura */}
              {newIconFile && (
                <div className="p-3 bg-darkbg border border-darkborder rounded-2xl flex items-center gap-3">
                  <SoundIcon src={URL.createObjectURL(newIconFile)} alt="Vista Previa" size="xl" />
                  <div>
                    <span className="block text-xs font-bold text-white">Vista previa de la miniatura</span>
                    <span className="block text-[11px] text-slate-400">Así es como se verá la imagen en las canciones y colecciones.</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-darkborder">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-darkbg hover:bg-darkborder border border-darkborder rounded-xl text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newIconFile || uploadingIcon}
                  className="px-5 py-2 bg-primary hover:bg-primaryhover disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/10 flex items-center gap-1.5"
                >
                  {uploadingIcon ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {uploadingIcon ? 'Subiendo...' : 'Guardar Imagen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Meme / Icono */}
      {showEditModal && editingIcon && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-darkcard border border-darkborder rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-darkborder">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit size={20} className="text-primary" />
                Editar Imagen / Meme
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="p-3 bg-darkbg border border-darkborder rounded-2xl flex items-center gap-3">
                <SoundIcon src={editingIcon.url} alt={editingIcon.name} size="xl" />
                <div>
                  <span className="block text-xs font-bold text-white">Vista previa actual</span>
                  <span className="block text-[11px] font-mono text-slate-400 truncate max-w-[200px]">{editingIcon.url}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre de la Imagen / Meme
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder="Ej: Gato Meme, Risas..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Categoría de la Imagen
                </label>
                <div className="grid grid-cols-2 gap-2 bg-darkbg border border-darkborder p-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setEditCategory('Memes')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      editCategory === 'Memes'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                        : 'text-slate-400 hover:text-white hover:bg-darkborder/50'
                    }`}
                  >
                    <span>🤡</span> Memes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCategory('Custom')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      editCategory === 'Custom'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                        : 'text-slate-400 hover:text-white hover:bg-darkborder/50'
                    }`}
                  >
                    <span>✨</span> Personalizados
                  </button>
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
                  disabled={!editName.trim() || updateIconMutation.isPending}
                  className="px-5 py-2 bg-primary hover:bg-primaryhover disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/10 flex items-center gap-1.5"
                >
                  {updateIconMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {updateIconMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
