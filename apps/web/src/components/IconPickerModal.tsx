import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { X, Check, Image as ImageIcon, Trash2 } from 'lucide-react';
import { SoundIcon } from './SoundIcon.js';

export interface SoundIconOption {
  id: string;
  name: string;
  url?: string;
  category: 'Standard' | 'Memes' | 'Custom' | string;
  isBuiltin?: boolean;
}

export const PRESET_SOUND_ICONS: SoundIconOption[] = [
  // SVG Estándar
  { id: '/iconos/music.svg', name: 'Música', url: '/iconos/music.svg', category: 'Standard', isBuiltin: true },
  { id: '/iconos/sparkles.svg', name: 'Destellos', url: '/iconos/sparkles.svg', category: 'Standard', isBuiltin: true },
  { id: '/iconos/fire.svg', name: 'Fuego', url: '/iconos/fire.svg', category: 'Standard', isBuiltin: true },
  { id: '/iconos/game.svg', name: 'Juegos', url: '/iconos/game.svg', category: 'Standard', isBuiltin: true },
  { id: '/iconos/zap.svg', name: 'Rayo', url: '/iconos/zap.svg', category: 'Standard', isBuiltin: true },
  { id: '/iconos/bot.svg', name: 'Bot', url: '/iconos/bot.svg', category: 'Standard', isBuiltin: true },
  { id: '/iconos/star.svg', name: 'Estrella', url: '/iconos/star.svg', category: 'Standard', isBuiltin: true },
  { id: '/iconos/clock.svg', name: 'Reloj', url: '/iconos/clock.svg', category: 'Standard', isBuiltin: true },

  // Memes de la carpeta /memes/
  { id: '/memes/gato.jpg', name: 'Gato Meme', url: '/memes/gato.jpg', category: 'Memes', isBuiltin: false },
  { id: '/memes/smile.jpg', name: 'Smile Meme', url: '/memes/smile.jpg', category: 'Memes', isBuiltin: false },
  { id: '/memes/kevin.png', name: 'Kevin', url: '/memes/kevin.png', category: 'Memes', isBuiltin: false },
  { id: '/memes/luis.png', name: 'Luis', url: '/memes/luis.png', category: 'Memes', isBuiltin: false },
  { id: '/memes/xocas.jpg', name: 'Xocas', url: '/memes/xocas.jpg', category: 'Memes', isBuiltin: false },
  { id: '/memes/rage-quit-meme-4.jpg', name: 'Rage Quit', url: '/memes/rage-quit-meme-4.jpg', category: 'Memes', isBuiltin: false },
  { id: '/memes/streamer.png', name: 'Streamer', url: '/memes/streamer.png', category: 'Memes', isBuiltin: false },
  { id: '/memes/online-streamer-silhouette-icon-vector.jpg', name: 'Streamer Silhouette', url: '/memes/online-streamer-silhouette-icon-vector.jpg', category: 'Memes', isBuiltin: false },
  { id: '/memes/download.jpg', name: 'Download', url: '/memes/download.jpg', category: 'Memes', isBuiltin: false },
  { id: '/memes/music.jpg', name: 'Música Retro', url: '/memes/music.jpg', category: 'Memes', isBuiltin: false },
  { id: '/memes/74z7dh.png', name: 'Meme 74z7dh', url: '/memes/74z7dh.png', category: 'Memes', isBuiltin: false }
];

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconUrl: string | null) => void;
  currentIconUrl?: string | null;
  soundName?: string;
  isSaving?: boolean;
}

export const IconPickerModal: React.FC<IconPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectIcon,
  currentIconUrl,
  soundName,
  isSaving = false
}) => {
  const [selected, setSelected] = useState<string | null>(currentIconUrl || null);
  const [activeTab, setActiveTab] = useState<'all' | 'Memes' | 'Standard' | 'Custom'>('all');

  const { data: remoteIcons } = useQuery({
    queryKey: ['custom-icons'],
    queryFn: () => apiRequest('/api/icons'),
    enabled: isOpen
  });

  const availableIcons: SoundIconOption[] = remoteIcons && remoteIcons.length > 0
    ? remoteIcons.map((i: any) => ({
        id: i.url,
        name: i.name,
        url: i.url,
        category: i.category || (i.isBuiltin ? 'Standard' : 'Memes'),
        isBuiltin: Boolean(i.isBuiltin)
      }))
    : PRESET_SOUND_ICONS;

  React.useEffect(() => {
    if (isOpen) {
      setSelected(currentIconUrl || null);
    }
  }, [isOpen, currentIconUrl]);

  if (!isOpen) return null;

  const filteredIcons = availableIcons.filter(
    (icon) => activeTab === 'all' || icon.category === activeTab
  );

  const handleSave = () => {
    onSelectIcon(selected);
  };

  const handleResetDefault = () => {
    setSelected(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-darkcard border border-darkborder rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-darkborder flex items-center justify-between bg-darkbg/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Seleccionar Icono</h3>
              <p className="text-xs text-slate-400">
                {soundName ? `Asociar icono a "${soundName}"` : 'Elige una imagen o icono para el sonido'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-darkborder rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs de Categorías Dinámicas */}
        <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-darkbg border border-darkborder rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({availableIcons.length})
            </button>
            <button
              onClick={() => setActiveTab('Memes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'Memes'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Memes ({availableIcons.filter((i) => i.category === 'Memes').length})
            </button>
            <button
              onClick={() => setActiveTab('Standard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'Standard'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Estándar ({availableIcons.filter((i) => i.isBuiltin || i.category === 'Standard').length})
            </button>
            {availableIcons.some((i) => i.category === 'Custom') && (
              <button
                onClick={() => setActiveTab('Custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'Custom'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom ({availableIcons.filter((i) => i.category === 'Custom').length})
              </button>
            )}
          </div>

          <button
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-darkbg border border-darkborder hover:border-accentred/40 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-semibold transition-all"
            title="Quitar icono personalizado y usar el predeterminado"
          >
            <Trash2 size={13} />
            Por Defecto
          </button>
        </div>

        {/* Icons Grid */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {filteredIcons.map((icon) => {
              const isSelected = selected === icon.id;
              return (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => setSelected(icon.id)}
                  className={`group relative flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all duration-200 ${
                    isSelected
                      ? 'bg-primary/20 border-primary shadow-lg shadow-primary/20 scale-105'
                      : 'bg-darkbg/60 border-darkborder hover:border-primary/50 hover:bg-darkbg hover:scale-102'
                  }`}
                >
                  <SoundIcon src={icon.id} alt={icon.name} size="lg" className="mb-1.5" />
                  <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white line-clamp-1 text-center w-full">
                    {icon.name}
                  </span>

                  {isSelected && (
                    <div className="absolute top-1 right-1 p-0.5 bg-primary text-white rounded-full shadow-md">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-darkborder bg-darkbg/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Seleccionado:</span>
            <SoundIcon src={selected} size="sm" />
            <span className="text-xs font-semibold text-white">
              {selected ? PRESET_SOUND_ICONS.find((i) => i.id === selected)?.name || 'Personalizado' : 'Por Defecto'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-darkbg border border-darkborder hover:border-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-primary hover:bg-primaryhover disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/20 transition-all flex items-center gap-1.5"
            >
              <Check size={14} />
              {isSaving ? 'Guardando...' : 'Asociar Icono'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
