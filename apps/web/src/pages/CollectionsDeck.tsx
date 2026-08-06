import React, { useState, useEffect, useRef } from 'react';
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
  Edit,
  SlidersHorizontal,
  Volume2,
  X
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
  colorTheme: 'emerald' | 'cyan' | 'pink' | 'gold' | 'red' | 'violet' | 'blue' | 'orange';
}

const themeConfig = {
  cyan: {
    padBg: 'bg-gradient-to-b from-[#0b2133] via-[#071724] to-[#040d14]',
    badgeBg: 'bg-cyan-500/25 border-cyan-400 text-cyan-300',
    colorHex: '#06b6d4'
  },
  emerald: {
    padBg: 'bg-gradient-to-b from-[#08291f] via-[#051c15] to-[#03100b]',
    badgeBg: 'bg-emerald-500/25 border-emerald-400 text-emerald-300',
    colorHex: '#10b981'
  },
  pink: {
    padBg: 'bg-gradient-to-b from-[#2e0e26] via-[#20091a] to-[#12040f]',
    badgeBg: 'bg-pink-500/25 border-pink-400 text-pink-300',
    colorHex: '#ec4899'
  },
  gold: {
    padBg: 'bg-gradient-to-b from-[#2b210c] via-[#1f1708] to-[#120d03]',
    badgeBg: 'bg-amber-500/25 border-amber-400 text-amber-300',
    colorHex: '#f59e0b'
  },
  red: {
    padBg: 'bg-gradient-to-b from-[#300a14] via-[#21060d] to-[#120307]',
    badgeBg: 'bg-rose-500/25 border-rose-400 text-rose-300',
    colorHex: '#f43f5e'
  },
  violet: {
    padBg: 'bg-gradient-to-b from-[#200e36] via-[#150924] to-[#0c0414]',
    badgeBg: 'bg-violet-500/25 border-violet-400 text-violet-300',
    colorHex: '#8b5cf6'
  },
  blue: {
    padBg: 'bg-gradient-to-b from-[#0e1d38] via-[#081226] to-[#040917]',
    badgeBg: 'bg-blue-500/25 border-blue-400 text-blue-300',
    colorHex: '#3b82f6'
  },
  orange: {
    padBg: 'bg-gradient-to-b from-[#30190b] via-[#211107] to-[#120803]',
    badgeBg: 'bg-orange-500/25 border-orange-400 text-orange-300',
    colorHex: '#f97316'
  }
};

const equalizerThemeColors = {
  cyan: { topCap: 'bg-cyan-200 shadow-[0_0_8px_#06b6d4]', bar: 'bg-gradient-to-t from-cyan-950 via-cyan-500 to-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.7)]', badge: 'bg-cyan-950/90 border-cyan-500/60 text-cyan-400', pill: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400' },
  emerald: { topCap: 'bg-emerald-200 shadow-[0_0_8px_#10b981]', bar: 'bg-gradient-to-t from-emerald-950 via-emerald-500 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.7)]', badge: 'bg-emerald-950/90 border-emerald-500/60 text-emerald-400', pill: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' },
  pink: { topCap: 'bg-pink-200 shadow-[0_0_8px_#ec4899]', bar: 'bg-gradient-to-t from-pink-950 via-pink-500 to-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.7)]', badge: 'bg-pink-950/90 border-pink-500/60 text-pink-400', pill: 'bg-pink-500/15 border-pink-500/40 text-pink-400' },
  gold: { topCap: 'bg-amber-200 shadow-[0_0_8px_#f59e0b]', bar: 'bg-gradient-to-t from-amber-950 via-amber-500 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.7)]', badge: 'bg-amber-950/90 border-amber-500/60 text-amber-400', pill: 'bg-amber-500/15 border-amber-500/40 text-amber-400' },
  red: { topCap: 'bg-rose-200 shadow-[0_0_8px_#f43f5e]', bar: 'bg-gradient-to-t from-rose-950 via-rose-500 to-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.7)]', badge: 'bg-rose-950/90 border-rose-500/60 text-rose-400', pill: 'bg-rose-500/15 border-rose-500/40 text-rose-400' },
  violet: { topCap: 'bg-violet-200 shadow-[0_0_8px_#8b5cf6]', bar: 'bg-gradient-to-t from-violet-950 via-violet-500 to-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.7)]', badge: 'bg-violet-950/90 border-violet-500/60 text-violet-400', pill: 'bg-violet-500/15 border-violet-500/40 text-violet-400' },
  blue: { topCap: 'bg-blue-200 shadow-[0_0_8px_#3b82f6]', bar: 'bg-gradient-to-t from-blue-950 via-blue-500 to-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.7)]', badge: 'bg-blue-950/90 border-blue-500/60 text-blue-400', pill: 'bg-blue-500/15 border-blue-500/40 text-blue-400' },
  orange: { topCap: 'bg-orange-200 shadow-[0_0_8px_#f97316]', bar: 'bg-gradient-to-t from-orange-950 via-orange-500 to-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.7)]', badge: 'bg-orange-950/90 border-orange-500/60 text-orange-400', pill: 'bg-orange-500/15 border-orange-500/40 text-orange-400' }
};

// Componente Visualizador del Ecualizador Master Out
const MasterOutVisualizer: React.FC<{ isPlaying: boolean; activeSoundName: string | null; activeColorTheme?: 'emerald' | 'cyan' | 'pink' | 'gold' | 'red' | 'violet' | 'blue' | 'orange' }> = ({ isPlaying, activeSoundName, activeColorTheme = 'cyan' }) => {
  const [heights, setHeights] = useState<number[]>(Array.from({ length: 40 }, () => 20));
  const activeColor = isPlaying ? (equalizerThemeColors[activeColorTheme] || equalizerThemeColors.cyan) : equalizerThemeColors.cyan;

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setHeights(Array.from({ length: 40 }, () => Math.floor(Math.random() * 80) + 20));
      }, 70);
    } else {
      interval = setInterval(() => {
        setHeights(Array.from({ length: 40 }, (_, i) => Math.floor(Math.sin(Date.now() / 350 + i * 0.45) * 14) + 24));
      }, 140);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="bg-[#05070a] border border-[#1b2333] rounded-2xl p-3.5 relative overflow-hidden shadow-inner w-full">
      {/* Visualizer Top Bar */}
      <div className="flex items-center justify-between mb-2.5 z-10 relative">
        <div className="flex items-center gap-2">
          <span className={`border text-[9px] font-mono px-2.5 py-0.5 rounded-md font-bold tracking-widest uppercase shadow-sm ${activeColor.badge}`}>
            REPRODUCCIÓN
          </span>
          {isPlaying && (
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 border rounded-md ${activeColor.pill}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider">REPRODUCIENDO</span>
            </div>
          )}
        </div>

        <div className="text-right">
          <span className="text-[10px] font-mono text-cyan-300 font-semibold truncate max-w-[180px] block">
            {activeSoundName ? `🎵 ${activeSoundName}` : 'EN ESPERA'}
          </span>
        </div>
      </div>

      {/* Audio Spectrum Equalizer Bars Container */}
      <div className="h-12 flex items-end justify-between gap-[2px] px-1 overflow-hidden relative">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-15">
          <div className="border-b border-cyan-400"></div>
          <div className="border-b border-cyan-400"></div>
        </div>

        {heights.map((h, idx) => (
          <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full">
            {/* Top Cap */}
            <div 
              className={`w-full h-0.5 rounded-xs mb-0.5 transition-all duration-75 ${
                isPlaying ? activeColor.topCap : 'bg-cyan-700/60'
              }`}
            ></div>

            {/* Main Bar */}
            <div 
              className={`w-full rounded-t-xs transition-all duration-100 ${
                isPlaying 
                  ? activeColor.bar 
                  : 'bg-gradient-to-t from-cyan-950/40 via-cyan-900/40 to-cyan-800/50'
              }`}
              style={{ height: `${h}%` }}
            ></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CollectionsDeck: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [playingSlotIndex, setPlayingSlotIndex] = useState<number | null>(null);
  const [activeSoundName, setActiveSoundName] = useState<string | null>(null);
  const [activeColorTheme, setActiveColorTheme] = useState<'emerald' | 'cyan' | 'pink' | 'gold' | 'red' | 'violet' | 'blue' | 'orange'>('cyan');

  // Form states del slot seleccionado
  const [slotSoundId, setSlotSoundId] = useState<string>('');
  const [slotLabel, setSlotLabel] = useState<string>('');
  const [slotImageUrl, setSlotImageUrl] = useState<string>('');
  const [slotColorTheme, setSlotColorTheme] = useState<'emerald' | 'cyan' | 'pink' | 'gold' | 'red' | 'violet' | 'blue' | 'orange'>('cyan');

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
    setSlotColorTheme(slot.colorTheme || 'cyan');
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
      handleOpenSlotModal(slot);
      return;
    }

    // Disparar reproducción rápida con respuesta visual inmediata
    const displayName = slot.customLabel || slot.soundDisplayName || 'Sonido';
    try {
      setPlayingSlotIndex(slot.slotIndex);
      setActiveSoundName(displayName);
      setActiveColorTheme(slot.colorTheme || 'cyan');

      await apiRequest(`/api/sounds/${slot.soundId}/quick-play`, { method: 'POST' });
    } catch (err: any) {
      console.error('Error al reproducir desde mesa:', err);
    } finally {
      const duration = slot.soundDurationMs || 2500;
      setTimeout(() => {
        setPlayingSlotIndex((current) => (current === slot.slotIndex ? null : current));
        setActiveSoundName(null);
      }, Math.min(duration, 4000));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center text-slate-400 font-mono text-sm">
        Cargando Consola Pro Soundboard...
      </div>
    );
  }

  return (
    <div className="min-h-[82vh] flex flex-col items-center justify-center space-y-5 px-2 py-4">
      {/* Keyframe Animations for Slow Neon Breathe & Fast Strobe Ignition */}
      <style>{`
        @keyframes neonBreatheSlow {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 4px var(--neon-color)); }
          50% { filter: brightness(1.35) drop-shadow(0 0 14px var(--neon-color)); }
        }
        @keyframes neonStrobeFast {
          0%, 100% { filter: brightness(1.8) drop-shadow(0 0 24px var(--neon-color)); transform: scale(1.03); }
          50% { filter: brightness(0.85) drop-shadow(0 0 6px var(--neon-color)); transform: scale(0.97); }
        }
      `}</style>

      {/* Navigation Bar (Centrada arriba de la mesa) */}
      <div className="w-full max-w-[520px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/collections')}
            className="p-2 bg-[#121622] border border-[#202738] hover:border-cyan-500 text-slate-300 hover:text-white rounded-xl transition-all shadow-md"
            title="Volver a Colecciones"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {collection?.name}
            </h2>
            <p className="text-xs text-slate-400">{collection?.description || 'Mesa interactiva de sonidos'}</p>
          </div>
        </div>
      </div>

      {/* Hardware Chassis Frame Container (Centrado 100% de forma impecable) */}
      <div 
        className="bg-gradient-to-b from-[#141824] via-[#0d1018] to-[#07090e] border border-[#232b3d] p-5 sm:p-6 rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(6,182,212,0.12)] flex flex-col items-center relative overflow-hidden"
        style={{ width: 'fit-content' }}
      >
        {/* Top Metallic Bevel Light */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

        {/* Top Section: Master Out Equalizer Visualizer Screen */}
        <div className="w-full mb-5">
          <MasterOutVisualizer 
            isPlaying={playingSlotIndex !== null} 
            activeSoundName={activeSoundName} 
            activeColorTheme={activeColorTheme}
          />
        </div>

        {/* Console Header Bar */}
        <div className="w-full flex items-center justify-between gap-4 mb-7 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#06b6d4] animate-pulse"></span>
            <span className="text-xs font-mono font-extrabold text-slate-200 tracking-widest uppercase">
              POLLOPERAS MESA DE MEZCLAS
            </span>
          </div>

          {/* Mode Switch Buttons Pill (Con más espacio vertical y horizontal) */}
          <div className="bg-[#05070a] border border-[#1b2333] p-1.5 rounded-2xl flex gap-2 shadow-inner">
            <button
              onClick={() => setIsEditMode(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                !isEditMode 
                  ? 'bg-cyan-950 border border-cyan-500/80 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap size={14} className={!isEditMode ? 'text-cyan-400' : ''} />
              Reproducción
            </button>

            <button
              onClick={() => setIsEditMode(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isEditMode 
                  ? 'bg-primary border border-primary text-white shadow-md shadow-primary/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal size={14} />
              Configuración
            </button>
          </div>
        </div>

        {/* Matrix Grid: 5 Columnas x 4 Filas de Teclas Ampliadas (94px x 94px) */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(5, 94px)', 
            gridTemplateRows: 'repeat(4, 94px)', 
            gap: '12px',
            justifyContent: 'center' 
          }}
        >
          {collection?.slots?.map((slot: SlotData) => {
            const hasSound = Boolean(slot.soundId);
            const isPlayingThis = playingSlotIndex === slot.slotIndex;
            const currentTheme = themeConfig[slot.colorTheme] || themeConfig.cyan;

            return (
              <div
                key={slot.slotIndex}
                onClick={() => handleSlotClick(slot)}
                style={{ 
                  width: '94px', 
                  height: '94px',
                  borderColor: hasSound ? currentTheme.colorHex : '#1e2536',
                  ['--neon-color' as any]: currentTheme.colorHex,
                  animation: isPlayingThis 
                    ? 'neonStrobeFast 0.35s ease-in-out infinite' 
                    : hasSound 
                      ? 'neonBreatheSlow 3s ease-in-out infinite' 
                      : 'none',
                  boxShadow: isPlayingThis 
                    ? `0 0 28px ${currentTheme.colorHex}, inset 0 0 15px ${currentTheme.colorHex}` 
                    : hasSound 
                      ? `0 0 12px ${currentTheme.colorHex}55` 
                      : 'none'
                }}
                className={`group relative rounded-2xl border-2 flex flex-col justify-between p-2 transition-all duration-150 overflow-hidden select-none cursor-pointer active:scale-95 ${
                  hasSound ? currentTheme.padBg : 'bg-[#090b10] hover:border-slate-500'
                } ${isEditMode ? 'ring-2 ring-primary/80' : ''} before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/15 before:to-transparent before:rounded-t-2xl pointer-events-auto`}
              >
                {/* Background Cover Image if configured */}
                {slot.customImageUrl ? (
                  <div className="absolute inset-0 z-0">
                    <img 
                      src={slot.customImageUrl} 
                      alt="" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20"></div>
                  </div>
                ) : null}

                {/* Top Row: Pad Number & Indicators */}
                <div className="w-full flex justify-between items-center z-10 leading-none">
                  <span className="text-[10px] font-mono text-slate-400 font-extrabold drop-shadow">
                    #{slot.slotIndex + 1}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Botón directo de edición en cada pad */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSlotModal(slot);
                      }}
                      className="p-0.5 rounded bg-darkbg/90 hover:bg-cyan-500 hover:text-white text-slate-300 opacity-0 group-hover:opacity-100 transition-all shadow"
                      title="Configurar pad"
                    >
                      <Edit size={10} />
                    </button>

                    {isPlayingThis ? (
                      <Volume2 size={12} className="text-white animate-bounce" />
                    ) : hasSound ? (
                      <Play size={9} style={{ color: currentTheme.colorHex }} className="transition-colors" />
                    ) : null}
                  </div>
                </div>

                {/* Center Content: Icon Badge Matching the Theme Color (Con suficiente espacio) */}
                <div className="my-auto z-10 flex items-center justify-center w-full">
                  {!hasSound ? (
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-600 text-slate-500 flex items-center justify-center group-hover:border-cyan-400 group-hover:text-cyan-400 transition-all">
                      <Plus size={16} />
                    </div>
                  ) : !slot.customImageUrl ? (
                    <div 
                      style={{ 
                        borderColor: currentTheme.colorHex,
                        backgroundColor: `${currentTheme.colorHex}25`,
                        boxShadow: `0 0 10px ${currentTheme.colorHex}55`
                      }}
                      className={`w-11.5 h-11.5 p-1 rounded-xl flex items-center justify-center border-2 transition-all ${
                        isPlayingThis ? 'bg-white text-black border-white shadow-[0_0_22px_#ffffff] scale-105' : ''
                      }`}
                    >
                      <Music size={22} style={{ color: isPlayingThis ? '#000000' : currentTheme.colorHex }} />
                    </div>
                  ) : null}
                </div>

                {/* Bottom Label (2 líneas ajustadas con ellipsis ...) */}
                <div className="w-full z-10 text-center leading-tight min-h-[26px] flex items-center justify-center">
                  <p 
                    className="text-[9.5px] leading-[1.18] font-bold text-white text-center line-clamp-2 break-words px-0.5 drop-shadow-md"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={slot.customLabel || slot.soundDisplayName || (isEditMode ? '+ Asignar' : 'Vacío')}
                  >
                    {slot.customLabel || slot.soundDisplayName || (isEditMode ? '+ Asignar' : 'Vacío')}
                  </p>
                </div>

                {/* Ripple Animation overlay when triggering audio */}
                {isPlayingThis && (
                  <div className="absolute inset-0 z-20 bg-white/20 backdrop-blur-xs flex items-center justify-center animate-ping pointer-events-none"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Studio Config / Editar Pad (100% OPACO CON ESTILOS INLINE DE CORRECCIÓN) */}
      {selectedSlotIndex !== null && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 z-[99999]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div 
            className="rounded-3xl w-full max-w-lg p-6 sm:p-8 relative text-white text-left overflow-y-auto max-h-[90vh]"
            style={{ 
              backgroundColor: '#12151e', 
              border: '2px solid #2b3245',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
              opacity: 1
            }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-[#242b3d]">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings2 size={20} className="text-cyan-400" />
                  Configurar Pad #{selectedSlotIndex + 1}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Asigna el sonido, etiqueta, imagen y color del pad.</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSlotIndex(null)}
                className="p-2 bg-[#1c2232] border border-[#2e374d] hover:border-cyan-500 text-slate-300 hover:text-white rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-5">
              {/* Selector de Sonido */}
              <div>
                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  Sonido Asignado
                </label>
                <select
                  value={slotSoundId}
                  onChange={(e) => setSlotSoundId(e.target.value)}
                  style={{ backgroundColor: '#0b0d13', color: '#ffffff', borderColor: '#282f42' }}
                  className="w-full border focus:border-cyan-500 rounded-xl px-4 py-3 text-sm outline-none cursor-pointer"
                >
                  <option value="" style={{ backgroundColor: '#12151e', color: '#ffffff' }}>-- Sin sonido (Pad vacío) --</option>
                  {soundsData?.items?.map((s: any) => (
                    <option key={s.id} value={s.id} style={{ backgroundColor: '#12151e', color: '#ffffff' }}>
                      {s.displayName} ({s.commandName}) - {(s.durationMs / 1000).toFixed(1)}s
                    </option>
                  ))}
                </select>
              </div>

              {/* Etiqueta Personalizada */}
              <div>
                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  Etiqueta del Pad (Texto visible)
                </label>
                <input
                  type="text"
                  value={slotLabel}
                  onChange={(e) => setSlotLabel(e.target.value)}
                  placeholder="Ej: autista, baronbaron, Risa..."
                  style={{ backgroundColor: '#0b0d13', color: '#ffffff', borderColor: '#282f42' }}
                  className="w-full border focus:border-cyan-500 rounded-xl px-4 py-3 text-sm placeholder-slate-500 outline-none transition-all"
                />
              </div>

              {/* Imagen del Botón */}
              <div>
                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  Imagen de Fondo del Pad
                </label>
                <div className="flex gap-2.5 mb-2">
                  <input
                    type="text"
                    value={slotImageUrl}
                    onChange={(e) => setSlotImageUrl(e.target.value)}
                    placeholder="URL de imagen https://..."
                    style={{ backgroundColor: '#0b0d13', color: '#ffffff', borderColor: '#282f42' }}
                    className="flex-1 border focus:border-cyan-500 rounded-xl px-4 py-3 text-sm placeholder-slate-500 outline-none transition-all"
                  />
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    onChange={handleImageFileChange} 
                    style={{ display: 'none' }} 
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ backgroundColor: '#1c2232', color: '#ffffff', borderColor: '#2e374d' }}
                    className="px-4 py-3 border hover:border-cyan-500 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-2 shrink-0 transition-all"
                  >
                    <ImageIcon size={16} />
                    <span>Subir Archivo</span>
                  </button>
                </div>
                {slotImageUrl && (
                  <div className="flex items-center gap-3 mt-3 p-2 bg-[#0b0d13] border border-[#282f42] rounded-xl">
                    <img src={slotImageUrl} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-[#2e374d]" />
                    <span className="text-xs text-slate-300 truncate flex-1">Imagen configurada</span>
                    <button
                      type="button"
                      onClick={() => setSlotImageUrl('')}
                      className="text-xs text-rose-400 hover:underline font-semibold"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              {/* Tema de Color LED (8 Colores Vivos y Brillantes) */}
              <div>
                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  Color Retroiluminación LED (8 Colores)
                </label>
                <div className="flex flex-wrap gap-3">
                  {(['cyan', 'emerald', 'pink', 'gold', 'red', 'violet', 'blue', 'orange'] as const).map((t) => {
                    const theme = themeConfig[t];
                    const isSelected = slotColorTheme === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSlotColorTheme(t)}
                        style={{
                          backgroundColor: theme.colorHex,
                          borderColor: '#ffffff',
                          boxShadow: isSelected ? `0 0 16px ${theme.colorHex}` : 'none'
                        }}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-black font-black transition-all ${
                          isSelected ? 'ring-4 ring-white scale-110 shadow-lg' : 'opacity-85 hover:opacity-100 hover:scale-105'
                        }`}
                        title={t}
                      >
                        {isSelected && <Check size={20} className="text-black drop-shadow-md stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-[#242b3d]">
                <button
                  type="button"
                  onClick={handleClearSlot}
                  className="px-4 py-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Trash2 size={14} />
                  Vaciar Pad
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSlotIndex(null)}
                    style={{ backgroundColor: '#1c2232', color: '#ffffff', borderColor: '#2e374d' }}
                    className="px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saveSlotMutation.isPending}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/25 transition-all"
                  >
                    {saveSlotMutation.isPending ? 'Guardando...' : 'Guardar Pad'}
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
