import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { 
  Music, 
  Server, 
  Activity, 
  Database,
  Volume2,
  Clock
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // 1. Obtener listado de sonidos para contar
  const { data: soundsData } = useQuery({
    queryKey: ['sounds-count'],
    queryFn: () => apiRequest('/api/sounds?page=1&pageSize=1')
  });

  // 2. Obtener listado de sonidos activos para contar
  const { data: activeSoundsData } = useQuery({
    queryKey: ['active-sounds-count'],
    queryFn: () => apiRequest('/api/sounds?active=true&page=1&pageSize=1')
  });

  // 3. Obtener estado del bot
  const { data: botStatus } = useQuery({
    queryKey: ['discord-status'],
    queryFn: () => apiRequest('/api/discord/status')
  });

  // 4. Obtener preparación del sistema (/ready)
  const { data: readyStatus } = useQuery({
    queryKey: ['system-ready'],
    queryFn: () => apiRequest('/ready')
  });

  // 5. Obtener logs de auditoría recientes (Solo ADMIN)
  const { data: auditLogs } = useQuery({
    queryKey: ['recent-audit'],
    queryFn: () => apiRequest('/api/audit-log?page=1&pageSize=5'),
    enabled: user?.role === 'ADMIN'
  });

  const totalSounds = soundsData?.pagination?.totalItems ?? 0;
  const activeSounds = activeSoundsData?.pagination?.totalItems ?? 0;
  const serversCount = botStatus?.guildsCount ?? 0;
  const dbStatus = readyStatus?.database === 'OK' ? 'Activa' : 'Error';
  const botConnected = botStatus?.connected ? 'Conectado' : 'Desconectado';

  const stats = [
    { label: 'Total Sonidos', value: totalSounds, icon: Music, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Sonidos Activos', value: activeSounds, icon: Volume2, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Servidores Discord', value: serversCount, icon: Server, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: 'Base de Datos MySQL', value: dbStatus, icon: Database, color: dbStatus === 'Activa' ? 'text-emerald-500' : 'text-red-500', bg: dbStatus === 'Activa' ? 'bg-emerald-500/10' : 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-white">¡Hola, {user?.username}!</h2>
        <p className="text-slate-400 text-sm mt-1">Este es el estado actual de tu Asistente de Discord.</p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-darkcard border border-darkborder p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1.5">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
                <Icon size={24} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Discord Bot Status Card */}
        <div className="bg-darkcard border border-darkborder p-6 rounded-2xl lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              Estado del Bot
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-darkborder">
                <span className="text-sm text-slate-400">Cliente Discord</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  botConnected === 'Conectado' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                }`}>{botConnected}</span>
              </div>

              {botStatus?.connected && (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-darkborder">
                    <span className="text-sm text-slate-400">Nombre en Discord</span>
                    <span className="text-sm font-medium text-white">{botStatus.botName}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-400">ID de Aplicación</span>
                    <span className="text-xs font-mono bg-darkbg px-2 py-1 rounded text-slate-300 select-all">{botStatus.clientId}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {!botStatus?.connected && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-xl text-xs">
              Configura el token del bot de Discord en config.ini para que se conecte a los servidores de voz.
            </div>
          )}
        </div>

        {/* Recent Actions / Audits (Only ADMIN) */}
        {user?.role === 'ADMIN' ? (
          <div className="bg-darkcard border border-darkborder p-6 rounded-2xl lg:col-span-2">
            <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
              <Clock size={18} className="text-primary" />
              Acciones Recientes (Auditoría)
            </h3>
            
            {auditLogs?.items && auditLogs.items.length > 0 ? (
              <div className="flow-root">
                <ul className="-my-5 divide-y divide-darkborder">
                  {auditLogs.items.map((log: any) => (
                    <li key={log.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            Entidad: {log.entityType} ({log.entityId || 'N/A'})
                          </p>
                        </div>
                        <div className="inline-flex items-center text-xs text-slate-500 font-medium">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-slate-500">
                No hay actividades de auditoría registradas aún.
              </div>
            )}
          </div>
        ) : (
          <div className="bg-darkcard border border-darkborder p-6 rounded-2xl lg:col-span-2 flex items-center justify-center text-sm text-slate-400">
            Los datos detallados de auditoría solo están disponibles para administradores.
          </div>
        )}

      </div>
    </div>
  );
};
