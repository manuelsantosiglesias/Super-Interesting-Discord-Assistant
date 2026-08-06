import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { 
  ArrowLeft, 
  Plus, 
  Settings2, 
  Play, 
  Trash2, 
  Image as ImageIcon,
  Check,
  Music,
  Zap,
  Edit
} from 'lucide-react';

interface SlotData {
  slotIndex: number;
  itemId: string | null;
  soundId: string | null;
  soundDisplayName: string | null;
  soundCommandName: string | null;
  soundDurationMs: number | null;
  soundIsActive: boolean;
  customLabel: string | null;
  customImageUrl: string | null;
  colorTheme: 'emerald' | 'cyan' | 'pink' | 'gold' | 'red' | 'violet';
}

const themeStyles = {
  emerald: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30 hover:border-emerald-400 hover:shadow-emerald-500/30',
  cyan: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30 hover:border-cyan-400 hover:shadow-cyan-500/30',
  pink: 'border-pink-500/40 text-pink-400 bg-pink-950/30 hover:border-pink-400 hover:shadow-pink-500/30',
  gold: 'border-amber-500/40 text-amber-400 bg-amber-950/30 hover:border-amber-400 hover:shadow-amber-500/30',
  red: 'border-rose-500/40 text-rose-400 bg-rose-950/30 hover:border-rose-400 hover:shadow-rose-500/30',
  violet: 'border-violet-500/40 text-violet-400 bg-violet-950/30 hover:border-violet-400 hover:shadow-violet-500/30'
};

export const CollectionsDeck: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [activeTriggerIndex, setActiveTriggerIndex] = useState<number | null>(null);

  // Form states del slot seleccionado
  const [slotSoundId, setSlotSoundId] = useState<string>('');
  const [slotLabel, setSlotLabel] = useState<string>('');
  const [slotImageUrl, setSlotImageUrl] = useState<string>('');
  const [slotColorTheme, setSlotColorTheme] = useState<'emerald' | 'cyan' | 'pink' | 'gold' | 'red' | 'violet'>('emerald');

  // 1. Cargar detalles de la colección y sus 20 slots
  const { data: collection, isLoading } = useQuery({
    queryKey: ['collection-detail', id],
    queryFn: () => apiRequest(`/api/collections/${id}`),
    enabled: !!id
  });

  // 2. Cargar todos los sonidos disponibles para el selector del modal de edición
  const { data: soundsData } = useQuery({
    queryKey: ['all-sounds-selector'],
    queryFn: () => apiRequest('/api/sounds?pageSize=500&sort=displayName&direction=asc'),
    enabled: selectedSlotIndex !== null
  });

  // Mutación: Guardar slot
  const saveSlotMutation = useMutation({
    mutationFn: ({ slotIndex, body }: { slotIndex: number; body: any }) => 
      apiRequest(`/api/collections/${id}/slots/${slotIndex}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-detail', id] });
      setSelectedSlotIndex(null);
    },
    onError: (err: any) => {
      alert(`Error al guardar el botón: ${err.message}`);
    }
  });

  // Mutación: Vaciar slot
  const clearSlotMutation = useMutation({
    mutationFn: (slotIndex: number) => 
      apiRequest(`/api/collections/${id}/slots/${slotIndex}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-detail', id] });
      setSelectedSlotIndex(null);
    }
  });

  const handleOpenSlotModal = (slot: SlotData) => {
    setSelectedSlotIndex(slot.slotIndex);
    setSlotSoundId(slot.soundId || '');
    setSlotLabel(slot.customLabel || '');
    setSlotImageUrl(slot.customImageUrl || '');
    setSlotColorTheme(slot.colorTheme || 'emerald');
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSlotIndex === null) return;
    saveSlotMutation.mutate({
      slotIndex: selectedSlotIndex,
      body: {
        soundId: slotSoundId || null,
        customLabel: slotLabel.trim() || null,
        customImageUrl: slotImageUrl.trim() || null,
        colorTheme: slotColorTheme
      }
    });
  };

  const handleClearSlot = () => {
    if (selectedSlotIndex === null) return;
    if (confirm('¿Vaciar este botón de la mesa?')) {
      clearSlotMutation.mutate(selectedSlotIndex);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar los 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSlotImageUrl(String(event.target.result));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSlotClick = async (slot: SlotData) => {
    if (isEditMode) {
      handleOpenSlotModal(slot);
      return;
    }

    if (!slot.soundId || !slot.soundIsActive) {
      // Si está vacío en modo vivo, abrir modal de edición directamente
      handleOpenSlotModal(slot);
      return;
    }

    // Ejecutar reproducción rápida silenciosa
    try {
      setActiveTriggerIndex(slot.slotIndex);
      await apiRequest(`/api/sounds/${slot.soundId}/quick-play`, { method: 'POST' });
    } catch (err: any) {
      console.error('Error al reproducir desde mesa:', err);
    } finally {
      setTimeout(() => setActiveTriggerIndex(null), 400);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center text-slate-400">
        Cargando Mesa de Botones...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-darkcard border border-darkborder p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/collections')}
            className="p-2 text-slate-400 hover:text-white hover:bg-darkbg rounded-xl transition-all"
            title="Volver a Colecciones"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {collection?.name}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold">
                20 Botones (4x5)
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{collection?.description || 'Mesa virtual estilo Elgato Stream Deck.'}</p>
          </div>
        </div>

        {/* Toggle Mode Switch */}
        <div className="flex items-center gap-3 bg-darkbg border border-darkborder p-1.5 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setIsEditMode(false)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              !isEditMode 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap size={14} />
            Modo En Vivo
          </button>
          <button
            onClick={() => setIsEditMode(true)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              isEditMode 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings2 size={14} />
            Modo Configurar
          </button>
        </div>
      </div>

      {/* Stream Deck Surface Container */}
      <div className="bg-gradient-to-b from-slate-900 via-darkcard to-darkbg border-2 border-darkborder p-6 sm:p-8 rounded-3xl shadow-2xl shadow-black/80 relative overflow-hidden">
        {/* Decorative Deck Bezel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-darkborder/60">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-md shadow-emerald-500/50"></div>
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest">
              STREAM DECK INTERACTIVO (CUADRÍCULA 4x5 - 20 BOTONES)
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-400 font-semibold uppercase">
            {isEditMode ? '⚙️ Modo Edición: haz clic en cualquier tecla para configurar' : '⚡ Modo Reproducción: clic directo para sonar en Discord'}
          </span>
        </div>

        {/* Matrix Grid: Estricta Cuadrícula 4 Filas x 5 Columnas = 20 Botones */}
        <div 
          className="w-full max-w-4xl mx-auto"
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', 
            gap: '16px' 
          }}
        >
          {collection?.slots?.map((slot: SlotData) => {
            const hasSound = Boolean(slot.soundId);
            const isTriggered = activeTriggerIndex === slot.slotIndex;
            const themeClass = hasSound ? themeStyles[slot.colorTheme] || themeStyles.emerald : 'border-darkborder/60 text-slate-600 hover:border-slate-500 bg-darkbg/40';

            return (
              <div
                key={slot.slotIndex}
                className={`group relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-between p-2.5 transition-all duration-150 shadow-xl overflow-hidden select-none cursor-pointer ${themeClass} ${
                  isTriggered ? 'ring-4 ring-white scale-95 shadow-2xl' : 'hover:scale-[1.02]'
                } ${isEditMode ? 'ring-2 ring-primary/40' : ''}`}
                onClick={() => handleSlotClick(slot)}
              >
                {/* Background Image if set */}
                {slot.customImageUrl ? (
                  <div className="absolute inset-0 z-0">
                    <img 
                      src={slot.customImageUrl} 
                      alt="" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                  </div>
                ) : null}

                {/* Top Status & Edit Icon */}
                <div className="w-full flex justify-between items-center z-10">
                  <span className="text-[10px] font-mono text-slate-400 font-bold opacity-70">#{slot.slotIndex + 1}</span>
                  
                  <div className="flex items-center gap-1">
                    {/* Direct Edit Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSlotModal(slot);
                      }}
                      className="p-1 rounded-md bg-darkbg/80 hover:bg-primary hover:text-white text-slate-400 opacity-0 group-hover:opacity-100 transition-all shadow-md"
                      title="Editar este botón"
                    >
                      <Edit size={12} />
                    </button>

                    {isEditMode ? (
                      <Settings2 size={12} className="text-primary opacity-90 animate-spin-slow" />
                    ) : hasSound ? (
                      <Play size={12} className="opacity-80 group-hover:scale-125 transition-transform text-white" />
                    ) : null}
                  </div>
                </div>

                {/* Center Content / Icon */}
                <div className="my-auto z-10 flex flex-col items-center justify-center">
                  {!hasSound ? (
                    <div className="w-8 h-8 rounded-full border border-dashed border-slate-600 flex items-center justify-center text-slate-500 group-hover:border-primary group-hover:text-primary transition-all">
                      <Plus size={16} />
                    </div>
                  ) : !slot.customImageUrl ? (
                    <div className="w-10 h-10 rounded-xl bg-darkbg/60 border border-white/10 flex items-center justify-center shadow-inner">
                      <Music size={20} />
                    </div>
                  ) : null}
                </div>

                {/* Bottom Label */}
                <div className="w-full z-10 text-center">
                  <p className="text-[11px] font-bold text-white truncate drop-shadow-md">
                    {slot.customLabel || slot.soundDisplayName || (isEditMode ? '+ Añadir' : 'Vacío')}
                  </p>
                </div>

                {/* Active Sound Wave Glow animation on trigger */}
                {isTriggered && (
                  <div className="absolute inset-0 z-20 bg-primary/40 backdrop-blur-xs flex items-center justify-center animate-ping"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Configurar Slot / Botón */}
      {selectedSlotIndex !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-darkcard border border-darkborder rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Settings2 size={20} className="text-primary" />
              Configurar Botón #{selectedSlotIndex + 1}
            </h3>
            <p className="text-xs text-slate-400 mb-6">Asigna un sonido, nombre personalizado, imagen y color LED.</p>

            <form onSubmit={handleSaveSlot} className="space-y-5">
              {/* Selector de Sonido */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Sonido Asignado
                </label>
                <select
                  value={slotSoundId}
                  onChange={(e) => setSlotSoundId(e.target.value)}
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                >
                  <option value="">-- Sin sonido (Botón vacío) --</option>
                  {soundsData?.items?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} ({s.commandName}) - {(s.durationMs / 1000).toFixed(1)}s
                    </option>
                  ))}
                </select>
              </div>

              {/* Etiqueta Personalizada */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Etiqueta del Botón (Texto visible)
                </label>
                <input
                  type="text"
                  value={slotLabel}
                  onChange={(e) => setSlotLabel(e.target.value)}
                  placeholder="Ej: Risa Malvada, Boom, Aplausos..."
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              {/* Imagen del Botón */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Imagen de Fondo del Botón
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={slotImageUrl}
                    onChange={(e) => setSlotImageUrl(e.target.value)}
                    placeholder="URL de imagen https://..."
                    className="flex-1 bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                  />
                  <label className="px-3.5 py-2.5 bg-darkbg border border-darkborder hover:border-primary text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 shrink-0">
                    <ImageIcon size={16} />
                    <span>Subir</span>
                    <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                  </label>
                </div>
                {slotImageUrl && (
                  <div className="flex items-center gap-3 mt-2">
                    <img src={slotImageUrl} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-darkborder" />
                    <button
                      type="button"
                      onClick={() => setSlotImageUrl('')}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Quitar imagen
                    </button>
                  </div>
                )}
              </div>

              {/* Tema de Color LED */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Color Retroiluminación LED
                </label>
                <div className="flex flex-wrap gap-3">
                  {(['emerald', 'cyan', 'pink', 'gold', 'red', 'violet'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSlotColorTheme(t)}
                      className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all ${
                        t === 'emerald' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                        t === 'cyan' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' :
                        t === 'pink' ? 'bg-pink-500/20 border-pink-500 text-pink-400' :
                        t === 'gold' ? 'bg-amber-500/20 border-amber-500 text-amber-400' :
                        t === 'red' ? 'bg-rose-500/20 border-rose-500 text-rose-400' :
                        'bg-violet-500/20 border-violet-500 text-violet-400'
                      } ${slotColorTheme === t ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
                    >
                      {slotColorTheme === t && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-5 border-t border-darkborder">
                <button
                  type="button"
                  onClick={handleClearSlot}
                  className="px-3.5 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  Vaciar Botón
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSlotIndex(null)}
                    className="px-4 py-2 bg-darkbg hover:bg-darkborder border border-darkborder rounded-xl text-slate-300 hover:text-white text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saveSlotMutation.isPending}
                    className="px-4 py-2 bg-primary hover:bg-primaryhover text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/10"
                  >
                    {saveSlotMutation.isPending ? 'Guardando...' : 'Guardar Botón'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
