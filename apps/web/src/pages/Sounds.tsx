import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { 
  Search, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Volume2,
  Disc,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Plus,
  Download,
  Loader2,
  Zap
} from 'lucide-react';

export const Sounds: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sort, setSort] = useState<'displayName' | 'commandName' | 'createdAt' | 'durationMs'>('createdAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  
  // Reproductor Web
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [quickPlayingId, setQuickPlayingId] = useState<string | null>(null);

  // Reproducción remota en Discord
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');

  // 1. Cargar sonidos con filtros
  const activeParam = activeFilter === 'active' ? 'true' : activeFilter === 'inactive' ? 'false' : undefined;
  const { data: soundsRes, isLoading } = useQuery({
    queryKey: ['sounds', search, activeFilter, page, pageSize, sort, direction],
    queryFn: () => apiRequest(`/api/sounds?search=${search}&page=${page}&pageSize=${pageSize}&sort=${sort}&direction=${direction}${activeParam !== undefined ? `&active=${activeParam}` : ''}`)
  });

  // 2. Cargar servidores del bot para el modal de Discord
  const { data: guilds } = useQuery({
    queryKey: ['discord-guilds'],
    queryFn: () => apiRequest('/api/discord/guilds'),
    enabled: showDiscordModal
  });

  // 3. Cargar canales del servidor seleccionado
  const { data: channels } = useQuery({
    queryKey: ['discord-channels', selectedGuildId],
    queryFn: () => apiRequest(`/api/discord/guilds/${selectedGuildId}/channels`),
    enabled: showDiscordModal && !!selectedGuildId
  });

  // Mutación: Reproducir en Discord
  const playDiscordMutation = useMutation({
    mutationFn: ({ soundId, guildId, voiceChannelId }: { soundId: string; guildId: string; voiceChannelId: string }) => 
      apiRequest(`/api/sounds/${soundId}/play-discord`, {
        method: 'POST',
        body: JSON.stringify({ guildId, voiceChannelId })
      }),
    onSuccess: () => {
      setShowDiscordModal(false);
      alert('Sonido encolado en Discord correctamente.');
    },
    onError: (err: any) => {
      alert(`Error al reproducir en Discord: ${err.message}`);
    }
  });

  // Mutación: Borrar sonido
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/sounds/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sounds'] });
      alert('Sonido eliminado (lógicamente) de forma segura.');
    },
    onError: (err: any) => {
      alert(`Error al eliminar: ${err.message}`);
    }
  });

  // Mutación: Alternar estado de sonido (activar/desactivar)
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      apiRequest(`/api/sounds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sounds'] });
    }
  });

  // Detener audio al desmontar
  useEffect(() => {
    return () => {
      if (audioObj) {
        audioObj.pause();
      }
    };
  }, [audioObj]);

  const handlePlayPreview = (soundId: string) => {
    if (audioObj) {
      try { audioObj.pause(); } catch {}
    }

    if (playingId === soundId) {
      setPlayingId(null);
      setAudioObj(null);
      return;
    }

    setPlayingId(soundId);
    const audioUrl = `/api/sounds/${soundId}/audio`;
    const newAudio = new Audio(audioUrl);

    newAudio.onended = () => {
      setPlayingId(null);
      setAudioObj(null);
    };

    newAudio.onerror = (e) => {
      console.error('Error al reproducir audio web:', e);
      setPlayingId(null);
      setAudioObj(null);
    };

    setAudioObj(newAudio);
    newAudio.play().catch((err) => {
      console.error('Autoplay error:', err);
      setPlayingId(null);
      setAudioObj(null);
    });
  };

  const handleDownloadSound = async (soundId: string, filename: string) => {
    try {
      setDownloadingId(soundId);
      const audioUrl = `/api/sounds/${soundId}/audio`;
      const response = await fetch(audioUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al descargar el archivo.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const downloadName = filename || `sound-${soundId}.ogg`;
      a.download = downloadName.includes('.') ? downloadName : `${downloadName}.ogg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Error al descargar el sonido: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleQuickPlay = async (soundId: string) => {
    try {
      setQuickPlayingId(soundId);
      await apiRequest(`/api/sounds/${soundId}/quick-play`, { method: 'POST' });
    } catch (err: any) {
      console.error('Error al reproducir rápido:', err);
    } finally {
      setQuickPlayingId(null);
    }
  };

  const handleOpenDiscordPlay = (soundId: string) => {
    setSelectedSoundId(soundId);
    setShowDiscordModal(true);
    const savedGuild = localStorage.getItem('lastSelectedGuildId') || '';
    const savedChannel = localStorage.getItem('lastSelectedChannelId') || '';
    setSelectedGuildId(savedGuild);
    setSelectedChannelId(savedChannel);
  };

  const handleDiscordPlaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSoundId || !selectedGuildId || !selectedChannelId) return;
    localStorage.setItem('lastSelectedGuildId', selectedGuildId);
    localStorage.setItem('lastSelectedChannelId', selectedChannelId);
    playDiscordMutation.mutate({
      soundId: selectedSoundId,
      guildId: selectedGuildId,
      voiceChannelId: selectedChannelId
    });
  };

  const handleDeleteSound = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el sonido "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    toggleStatusMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleSort = (field: typeof sort) => {
    if (sort === field) {
      setDirection(direction === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setDirection('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Explorador de Sonidos</h2>
          <p className="text-slate-400 text-sm mt-1">Busca, escucha en el navegador y reproduce sonidos en canales de Discord.</p>
        </div>
        <Link
          to="/sounds/new"
          className="bg-primary hover:bg-primaryhover text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-primary/10 transition-all duration-150 flex items-center gap-2"
        >
          <Plus size={16} />
          Subir Sonido
        </Link>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-darkcard p-4 border border-darkborder rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre o comando..."
            className="w-full bg-darkbg border border-darkborder focus:border-primary focus:ring-1 focus:ring-primary rounded-xl pl-11 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-darkbg border border-darkborder focus:border-primary rounded-lg px-2.5 py-1 text-xs font-semibold text-white outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Estado:</span>
            {(['all', 'active', 'inactive'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => { setActiveFilter(filter); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                  activeFilter === filter
                    ? 'bg-primary border-primary text-white'
                    : 'bg-darkbg border-darkborder text-slate-400 hover:text-white'
                }`}
              >
                {filter === 'all' ? 'Todos' : filter === 'active' ? 'Activos' : 'Inactivos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sounds Table */}
      <div className="bg-darkcard border border-darkborder rounded-xl overflow-hidden shadow-lg shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-darkborder bg-darkbg/40 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4">
                  <button onClick={() => handleSort('displayName')} className="flex items-center gap-1 hover:text-white transition-colors">
                    Nombre Visible <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="p-4">
                  <button onClick={() => handleSort('commandName')} className="flex items-center gap-1 hover:text-white transition-colors">
                    Comando <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="p-4">
                  <button onClick={() => handleSort('durationMs')} className="flex items-center gap-1 hover:text-white transition-colors">
                    Duración <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="p-4">
                  <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-white transition-colors">
                    Fecha Añadido <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="p-4">Volumen</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkborder">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 text-sm">
                    Cargando sonidos...
                  </td>
                </tr>
              ) : soundsRes?.items && soundsRes.items.length > 0 ? (
                soundsRes.items.map((sound: any) => (
                  <tr key={sound.id} className="hover:bg-darkbg/10 text-sm text-slate-200">
                    <td className="p-4 font-semibold text-white">{sound.displayName}</td>
                    <td className="p-4 font-mono text-xs text-slate-400">{sound.commandName}</td>
                    <td className="p-4 text-slate-400">{(sound.durationMs / 1000).toFixed(2)}s</td>
                    <td className="p-4 text-slate-400 text-xs font-mono">
                      {sound.createdAt ? new Date(sound.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </td>
                    <td className="p-4 text-slate-400">{sound.volume.toFixed(2)}</td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleStatus(sound.id, sound.isActive)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          sound.isActive
                            ? 'bg-green-500/10 border-green-500/20 text-green-500'
                            : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}
                      >
                        {sound.isActive ? (
                          <>
                            <CheckCircle size={12} />
                            Activo
                          </>
                        ) : (
                          <>
                            <XCircle size={12} />
                            Inactivo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {/* 1. Play Web Preview */}
                        <button
                          onClick={() => handlePlayPreview(sound.id)}
                          className="p-2 bg-darkbg border border-darkborder hover:border-primary text-slate-300 hover:text-white rounded-lg transition-all"
                          title="Previsualizar en Navegador"
                        >
                          {playingId === sound.id ? <Pause size={16} /> : <Play size={16} />}
                        </button>

                        {/* 2. Quick Play Discord (Automático en el canal con más personas o último activo) */}
                        <button
                          onClick={() => handleQuickPlay(sound.id)}
                          disabled={!sound.isActive || quickPlayingId === sound.id}
                          className={`p-2 border rounded-lg transition-all ${
                            sound.isActive
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white'
                              : 'bg-slate-800/10 border-slate-700/20 text-slate-600 cursor-not-allowed'
                          }`}
                          title={sound.isActive ? 'Reproducción rápida (reproduce en el canal con más gente o el último usado)' : 'Sonido desactivado'}
                        >
                          {quickPlayingId === sound.id ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                        </button>

                        {/* 3. Seleccionar canal y reproducir en Discord (Antes de editar) */}
                        <button
                          onClick={() => handleOpenDiscordPlay(sound.id)}
                          disabled={!sound.isActive}
                          className={`p-2 border rounded-lg transition-all ${
                            sound.isActive
                              ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-white'
                              : 'bg-slate-800/10 border-slate-700/20 text-slate-600 cursor-not-allowed'
                          }`}
                          title={sound.isActive ? 'Seleccionar servidor y canal de voz para reproducir' : 'Sonido desactivado'}
                        >
                          <Volume2 size={16} />
                        </button>

                        {/* 4. Edit */}
                        <Link
                          to={`/sounds/${sound.id}`}
                          className="p-2 bg-darkbg border border-darkborder hover:border-blue-500 text-slate-300 hover:text-white rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </Link>

                        {/* 5. Delete */}
                        <button
                          onClick={() => handleDeleteSound(sound.id, sound.displayName)}
                          className="p-2 bg-darkbg border border-darkborder hover:border-accentred text-slate-300 hover:text-accentred rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>

                        {/* 6. Download Sound (Al final del todo) */}
                        <button
                          onClick={() => handleDownloadSound(sound.id, sound.originalFilename || sound.displayName)}
                          disabled={downloadingId === sound.id}
                          className="p-2 bg-darkbg border border-darkborder hover:border-emerald-500 text-slate-300 hover:text-emerald-400 rounded-lg transition-all disabled:opacity-50"
                          title="Descargar Sonido"
                        >
                          {downloadingId === sound.id ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 text-sm">
                    No se encontraron sonidos en la base de datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {soundsRes?.pagination && (
          <div className="bg-darkbg/25 border-t border-darkborder px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">
                Mostrando página {soundsRes.pagination.page} de {soundsRes.pagination.totalPages} ({soundsRes.pagination.totalItems} sonidos en total)
              </span>
            </div>

            {soundsRes.pagination.totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-darkbg border border-darkborder rounded-lg text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400"
                >
                  Anterior
                </button>
                {Array.from({ length: Math.min(soundsRes.pagination.totalPages, 10) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      page === i + 1
                        ? 'bg-primary border-primary text-white'
                        : 'bg-darkbg border-darkborder text-slate-400 hover:text-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, soundsRes.pagination.totalPages))}
                  disabled={page === soundsRes.pagination.totalPages}
                  className="px-3 py-1.5 bg-darkbg border border-darkborder rounded-lg text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Reproducir en Discord */}
      {showDiscordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-darkcard border border-darkborder rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Disc className="text-primary animate-pulse" size={20} />
              Reproducir en Servidor
            </h3>
            
            <form onSubmit={handleDiscordPlaySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Seleccionar Servidor (Guild)
                </label>
                <select
                  value={selectedGuildId}
                  onChange={(e) => { 
                    const val = e.target.value;
                    setSelectedGuildId(val); 
                    localStorage.setItem('lastSelectedGuildId', val);
                    setSelectedChannelId(''); 
                  }}
                  required
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                >
                  <option value="">Selecciona un servidor...</option>
                  {guilds?.map((g: any) => (
                    <option key={g.discordGuildId} value={g.discordGuildId} disabled={!g.isEnabled}>
                      {g.guildName} {!g.isEnabled ? '(Desactivado)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Canal de Voz
                </label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedChannelId(val);
                    localStorage.setItem('lastSelectedChannelId', val);
                  }}
                  required
                  disabled={!selectedGuildId}
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none disabled:opacity-40"
                >
                  <option value="">Selecciona un canal de voz...</option>
                  {channels?.voiceChannels?.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>
                      🔊 {ch.name} ({ch.userCount ?? 0})
                    </option>
                  ))}
                </select>
              </div>

              {channels?.voiceChannels?.length === 0 && selectedGuildId && (
                <div className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
                  No se detectaron canales de voz visibles en este servidor. Asegúrate de que el bot tenga permisos de lectura.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-darkborder">
                <button
                  type="button"
                  onClick={() => setShowDiscordModal(false)}
                  className="px-4 py-2 bg-darkbg hover:bg-darkborder border border-darkborder rounded-xl text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedChannelId || playDiscordMutation.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primaryhover disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/10"
                >
                  {playDiscordMutation.isPending ? 'Encolando...' : 'Reproducir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
