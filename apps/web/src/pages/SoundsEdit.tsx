import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { ArrowLeft, Check, AlertCircle, Download, Loader2, Image as ImageIcon } from 'lucide-react';
import { SoundIcon } from '../components/SoundIcon.js';
import { IconPickerModal } from '../components/IconPickerModal.js';

export const SoundsEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState('');
  const [commandName, setCommandName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isActive, setIsActive] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // Estados de validación del comando
  const [commandAvailable, setCommandAvailable] = useState<boolean | null>(null);
  const [checkingCommand, setCheckingCommand] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Cargar datos del sonido
  const { data: sound, isLoading } = useQuery({
    queryKey: ['sound-detail', id],
    queryFn: () => apiRequest(`/api/sounds/${id}`),
    enabled: !!id
  });

  // Rellenar estados locales una vez cargados los datos
  useEffect(() => {
    if (sound) {
      setDisplayName(sound.displayName);
      setCommandName(sound.commandName);
      setDescription(sound.description || '');
      setIconUrl(sound.iconUrl || null);
      setVolume(sound.volume);
      setIsActive(sound.isActive);
    }
  }, [sound]);

  // Validar disponibilidad de comando en tiempo real (debounced)
  useEffect(() => {
    if (!sound || !commandName || commandName === sound.commandName) {
      setCommandAvailable(null); // No validar si es igual al comando actual
      return;
    }

    const normalized = commandName.trim().toLowerCase();
    if (normalized.length < 2 || normalized.length > 64 || !/^[a-z0-9\-_]+$/.test(normalized)) {
      setCommandAvailable(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingCommand(true);
      try {
        const res = await apiRequest(`/api/sounds/commands/check?name=${normalized}`);
        setCommandAvailable(res.available);
      } catch {
        setCommandAvailable(false);
      } finally {
        setCheckingCommand(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [commandName, sound]);

  // Mutación: Guardar cambios
  const updateMutation = useMutation({
    mutationFn: (body: any) => apiRequest(`/api/sounds/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sounds'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      navigate('/sounds');
    },
    onError: (err: any) => {
      setError(err.message || 'Error al guardar los cambios.');
    }
  });

  const handleDownloadSound = async () => {
    if (!id) return;
    try {
      setIsDownloading(true);
      const audioUrl = `/api/sounds/${id}/audio`;
      const response = await fetch(audioUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al descargar el archivo.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const downloadName = sound?.originalFilename || sound?.displayName || `sound-${id}.ogg`;
      a.download = downloadName.includes('.') ? downloadName : `${downloadName}.ogg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Error al descargar el sonido: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !commandName || commandAvailable === false) {
      setError('Por favor completa los campos correctamente.');
      return;
    }

    updateMutation.mutate({
      displayName,
      commandName: commandName.trim().toLowerCase(),
      description: description || null,
      iconUrl,
      volume,
      isActive
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center text-slate-400">
        Cargando detalles del sonido...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/sounds')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold"
      >
        <ArrowLeft size={16} />
        Volver a la lista
      </button>

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Editar Sonido</h2>
          <p className="text-slate-400 text-sm mt-1">Modifica los detalles, volumen o estado del sonido.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadSound}
          disabled={isDownloading}
          className="p-2.5 bg-darkbg border border-darkborder hover:border-emerald-500 text-slate-300 hover:text-emerald-400 rounded-xl transition-all disabled:opacity-50 shrink-0"
          title="Descargar Sonido"
        >
          {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
        </button>
      </div>

      {/* Form Card */}
      <div className="bg-darkcard border border-darkborder p-6 rounded-2xl shadow-xl shadow-black/25">
        {error && (
          <div className="mb-6 p-4 bg-accentred/15 border border-accentred/35 text-slate-200 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Display Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Nombre Visible
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              placeholder="Ej: Aplausos"
            />
          </div>

          {/* Command Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              Nombre del Comando
              <span className="text-[10px] text-slate-500 normal-case">Sin espacios ni barras, ej: aplausos</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={commandName}
                onChange={(e) => setCommandName(e.target.value.replace(/\s+/g, '-'))}
                required
                className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                placeholder="aplausos"
              />
              <div className="absolute right-4 top-3 flex items-center gap-1">
                {checkingCommand && (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}
                {!checkingCommand && commandAvailable === true && (
                  <span className="text-[10px] text-green-500 font-semibold flex items-center gap-0.5">
                    <Check size={12} /> Disponible
                  </span>
                )}
                {!checkingCommand && commandAvailable === false && (
                  <span className="text-[10px] text-accentred font-semibold flex items-center gap-0.5">
                    <AlertCircle size={12} /> No disponible o inválido
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Descripción (Opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all resize-none"
              placeholder="Descripción del sonido..."
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Icono de la Canción / Sonido
            </label>
            <div className="flex items-center gap-3 p-3 bg-darkbg border border-darkborder rounded-2xl">
              <SoundIcon src={iconUrl} alt={displayName || 'Icono'} size="lg" />
              <div className="flex-1">
                <span className="block text-xs font-semibold text-white">
                  {iconUrl ? 'Icono Personalizado Seleccionado' : 'Icono por Defecto (/iconos/music.svg)'}
                </span>
                <span className="block text-[11px] text-slate-400">
                  Puedes elegir un meme o icono estándar para mostrar en la lista y en colecciones.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowIconPicker(true)}
                className="px-4 py-2 bg-primary/20 border border-primary/40 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <ImageIcon size={14} />
                {iconUrl ? 'Cambiar Icono' : 'Elegir Icono'}
              </button>
            </div>
          </div>

          {/* Volume Slider */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              Multiplicador de Volumen
              <span className="text-sm font-semibold text-white">{volume.toFixed(2)}x</span>
            </label>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-darkbg border border-darkborder rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
              <span>Silenciado (0.0x)</span>
              <span>Normal (1.0x)</span>
              <span>Doble (2.0x)</span>
            </div>
          </div>

          {/* Active status */}
          <div className="flex items-center gap-3 bg-darkbg/35 border border-darkborder p-4 rounded-xl">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-primary bg-darkbg border-darkborder focus:ring-primary rounded cursor-pointer"
            />
            <label htmlFor="isActive" className="text-sm font-semibold text-white cursor-pointer select-none">
              Sonido Habilitado (Activo)
              <p className="text-xs font-normal text-slate-400 mt-0.5">Los sonidos inactivos no pueden reproducirse en Discord por nadie.</p>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-darkborder pt-6">
            <button
              type="button"
              onClick={() => navigate('/sounds')}
              className="px-5 py-2.5 bg-darkbg hover:bg-darkborder border border-darkborder text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!displayName || !commandName || commandAvailable === false || updateMutation.isPending}
              className="px-5 py-2.5 bg-primary hover:bg-primaryhover disabled:opacity-40 text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/10 transition-all"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

        </form>
      </div>

      <IconPickerModal
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelectIcon={(selected) => {
          setIconUrl(selected);
          setShowIconPicker(false);
        }}
        currentIconUrl={iconUrl}
        soundName={displayName || 'Editar Sonido'}
      />
    </div>
  );
};
