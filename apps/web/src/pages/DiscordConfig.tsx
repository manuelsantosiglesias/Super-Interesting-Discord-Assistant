import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { 
  Disc, 
  Settings, 
  RefreshCw, 
  Link as LinkIcon, 
  Sliders, 
  ShieldCheck
} from 'lucide-react';

export const DiscordConfig: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);

  // Estados del formulario del servidor seleccionado
  const [commandPrefix, setCommandPrefix] = useState('');
  const [defaultVolume, setDefaultVolume] = useState(1.0);
  const [leaveAfterSeconds, setLeaveAfterSeconds] = useState(15);
  const [maxQueueSize, setMaxQueueSize] = useState(10);
  const [userCooldownSeconds, setUserCooldownSeconds] = useState(2);
  const [isEnabled, setIsEnabled] = useState(true);
  const [allowedTextChannelIds, setAllowedTextChannelIds] = useState<string[]>([]);

  // 1. Cargar estado del bot
  const { data: status } = useQuery({
    queryKey: ['discord-status'],
    queryFn: () => apiRequest('/api/discord/status')
  });

  // 2. Cargar URL de instalación
  const { data: installUrlRes } = useQuery({
    queryKey: ['discord-install-url'],
    queryFn: () => apiRequest('/api/discord/install-url')
  });

  // 3. Cargar servidores
  const { data: guilds } = useQuery({
    queryKey: ['discord-guilds'],
    queryFn: () => apiRequest('/api/discord/guilds')
  });

  // 4. Cargar configuración del servidor seleccionado
  const { data: guildDetail } = useQuery({
    queryKey: ['discord-guild-detail', selectedGuildId],
    queryFn: () => apiRequest(`/api/discord/guilds/${selectedGuildId}`),
    enabled: !!selectedGuildId
  });

  // Cargar canales del servidor seleccionado
  const { data: channels } = useQuery({
    queryKey: ['discord-guild-channels', selectedGuildId],
    queryFn: () => apiRequest(`/api/discord/guilds/${selectedGuildId}/channels`),
    enabled: !!selectedGuildId
  });

  // Rellenar formulario del servidor
  React.useEffect(() => {
    if (guildDetail) {
      setCommandPrefix(guildDetail.commandPrefix);
      setDefaultVolume(guildDetail.defaultVolume);
      setLeaveAfterSeconds(guildDetail.leaveAfterSeconds);
      setMaxQueueSize(guildDetail.maxQueueSize);
      setUserCooldownSeconds(guildDetail.userCooldownSeconds);
      setIsEnabled(guildDetail.isEnabled);
      setAllowedTextChannelIds(guildDetail.allowedTextChannelIds || []);
    }
  }, [guildDetail]);

  // Mutación: Guardar cambios del servidor
  const updateGuildMutation = useMutation({
    mutationFn: (body: any) => 
      apiRequest(`/api/discord/guilds/${selectedGuildId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discord-guilds'] });
      alert('Configuración del servidor guardada correctamente.');
    },
    onError: (err: any) => {
      alert(`Error al guardar configuración: ${err.message}`);
    }
  });

  // Mutación: Recomandos
  const registerCommandsMutation = useMutation({
    mutationFn: () => apiRequest('/api/discord/register-commands', { method: 'POST' }),
    onSuccess: () => {
      alert('Comandos slash sincronizados con Discord con éxito.');
    },
    onError: (err: any) => {
      alert(`Error al registrar comandos: ${err.message}`);
    }
  });

  // Mutación: Reconectar bot
  const reconnectMutation = useMutation({
    mutationFn: () => apiRequest('/api/discord/reconnect', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discord-status'] });
      alert('Se envió la señal de reconexión al bot.');
    },
    onError: (err: any) => {
      alert(`Error al reconectar: ${err.message}`);
    }
  });

  const handleGuildSelect = (guildId: string) => {
    setSelectedGuildId(guildId);
  };

  const handleAllowedChannelToggle = (channelId: string) => {
    setAllowedTextChannelIds((prev) => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId) 
        : [...prev, channelId]
    );
  };

  const handleGuildFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuildId) return;

    updateGuildMutation.mutate({
      commandPrefix,
      defaultVolume,
      leaveAfterSeconds,
      maxQueueSize,
      userCooldownSeconds,
      isEnabled,
      allowedTextChannelIds
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Gestión de Discord</h2>
        <p className="text-slate-400 text-sm mt-1">Revisa el estado de conexión del bot, gestiona sus permisos y configura los servidores individuales.</p>
      </div>

      {/* Bot Status & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Card */}
        <div className="bg-darkcard border border-darkborder p-6 rounded-2xl flex flex-col justify-between lg:col-span-1">
          <div className="flex items-center gap-4">
            {status?.avatar ? (
              <img src={status.avatar} alt="Avatar" className="w-16 h-16 rounded-full border border-darkborder shadow-md" />
            ) : (
              <div className="w-16 h-16 bg-primary/25 rounded-full flex items-center justify-center text-primary shadow-md border border-darkborder">
                <Disc size={32} />
              </div>
            )}
            <div>
              <h3 className="font-bold text-white text-base">{status?.botName || 'Asistente Desconectado'}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {status?.clientId || 'N/A'}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${status?.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-xs text-slate-300 font-semibold">{status?.connected ? 'En Línea' : 'Desconectado'}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            {installUrlRes?.url && (
              <a
                href={installUrlRes.url}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-primary hover:bg-primaryhover text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg shadow-primary/10 transition-all flex items-center justify-center gap-2"
              >
                <LinkIcon size={14} />
                Añadir Bot a Discord
              </a>
            )}
            
            <button
              onClick={() => registerCommandsMutation.mutate()}
              className="w-full bg-darkbg hover:bg-darkborder border border-darkborder text-slate-300 hover:text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck size={14} />
              Registrar Comandos Slash
            </button>

            <button
              onClick={() => reconnectMutation.mutate()}
              className="w-full bg-darkbg hover:bg-darkborder border border-darkborder text-slate-300 hover:text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              Reconectar Bot
            </button>
          </div>
        </div>

        {/* Guilds List Card */}
        <div className="bg-darkcard border border-darkborder p-6 rounded-2xl lg:col-span-2">
          <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
            <Sliders className="text-primary" size={16} />
            Servidores Vinculados ({guilds?.length || 0})
          </h3>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {guilds && guilds.length > 0 ? (
              guilds.map((g: any) => (
                <button
                  key={g.id}
                  onClick={() => handleGuildSelect(g.id)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                    selectedGuildId === g.id
                      ? 'bg-primary/10 border-primary text-white'
                      : 'bg-darkbg/40 border-darkborder text-slate-300 hover:bg-darkborder/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {g.guildIcon ? (
                      <img src={g.guildIcon} alt="Icon" className="w-8 h-8 rounded-lg" />
                    ) : (
                      <div className="w-8 h-8 bg-darkborder rounded-lg flex items-center justify-center font-bold text-xs text-white">
                        {g.guildName?.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-white">{g.guildName}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Prefijo: {g.commandPrefix}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    g.isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {g.isEnabled ? 'Habilitado' : 'Desactivado'}
                  </span>
                </button>
              ))
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                <span>El bot no está en ningún servidor todavía.</span>
                <span className="text-xs text-slate-600 text-center max-w-sm">Usa el botón "Añadir Bot a Discord" para vincularlo a tu primer servidor de pruebas.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Guild Configuration Editor */}
      {selectedGuildId && (
        <div className="bg-darkcard border border-darkborder p-6 rounded-2xl shadow-xl shadow-black/15 animate-fade-in">
          <h3 className="font-bold text-white text-lg mb-6 border-b border-darkborder pb-4 flex items-center gap-2">
            <Settings className="text-primary" size={20} />
            Configuración: {guildDetail?.guildName || 'Cargando...'}
          </h3>

          <form onSubmit={handleGuildFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column Fields */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Prefijo de Comando
                </label>
                <input
                  type="text"
                  value={commandPrefix}
                  onChange={(e) => setCommandPrefix(e.target.value)}
                  required
                  className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                  placeholder="-sbdb"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  Volumen del Servidor (Por Defecto)
                  <span className="text-sm font-semibold text-white">{defaultVolume.toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={defaultVolume}
                  onChange={(e) => setDefaultVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-darkbg border border-darkborder rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    T. Desconexión (s)
                  </label>
                  <input
                    type="number"
                    value={leaveAfterSeconds}
                    onChange={(e) => setLeaveAfterSeconds(parseInt(e.target.value, 10))}
                    min="0"
                    required
                    className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Cola Máx.
                  </label>
                  <input
                    type="number"
                    value={maxQueueSize}
                    onChange={(e) => setMaxQueueSize(parseInt(e.target.value, 10))}
                    min="1"
                    max="50"
                    required
                    className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Cooldown Usr. (s)
                  </label>
                  <input
                    type="number"
                    value={userCooldownSeconds}
                    onChange={(e) => setUserCooldownSeconds(parseInt(e.target.value, 10))}
                    min="0"
                    required
                    className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-darkbg/35 border border-darkborder p-4 rounded-xl">
                <input
                  type="checkbox"
                  id="guildIsEnabled"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-4 h-4 text-primary bg-darkbg border-darkborder focus:ring-primary rounded cursor-pointer"
                />
                <label htmlFor="guildIsEnabled" className="text-sm font-semibold text-white cursor-pointer select-none">
                  Servidor Habilitado (Activo)
                  <p className="text-xs font-normal text-slate-400 mt-0.5">Si se desactiva, el bot ignorará todos los comandos de este servidor.</p>
                </label>
              </div>
            </div>

            {/* Right Column Fields (Allowed Channels) */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Restringir Canales de Texto Permitidos
                </label>
                <p className="text-xs text-slate-400 mb-3">Si no seleccionas ningún canal, el bot permitirá comandos en todos los canales de texto visibles.</p>

                <div className="bg-darkbg/40 border border-darkborder rounded-xl p-4 max-h-56 overflow-y-auto space-y-2">
                  {channels?.textChannels && channels.textChannels.length > 0 ? (
                    channels.textChannels.map((ch: any) => (
                      <label key={ch.id} className="flex items-center gap-3 px-3 py-2 bg-darkbg/30 border border-darkborder/50 hover:bg-darkborder/30 rounded-lg cursor-pointer transition-colors text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={allowedTextChannelIds.includes(ch.id)}
                          onChange={() => handleAllowedChannelToggle(ch.id)}
                          className="w-4 h-4 text-primary bg-darkbg border-darkborder/50 focus:ring-primary rounded cursor-pointer"
                        />
                        <span className="font-mono text-xs">#</span> {ch.name}
                      </label>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-8">
                      No se detectaron canales de texto. Asegúrate de que el bot tenga permisos o que esté en línea.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Actions Footer */}
            <div className="md:col-span-2 flex justify-end gap-3 pt-6 border-t border-darkborder">
              <button
                type="button"
                onClick={() => setSelectedGuildId(null)}
                className="px-5 py-2.5 bg-darkbg hover:bg-darkborder border border-darkborder text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all"
              >
                Cerrar Editor
              </button>
              <button
                type="submit"
                disabled={updateGuildMutation.isPending}
                className="px-5 py-2.5 bg-primary hover:bg-primaryhover text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/10 transition-all"
              >
                {updateGuildMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
};
