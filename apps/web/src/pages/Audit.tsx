import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { FileText, Search, User as UserIcon } from 'lucide-react';

export const Audit: React.FC = () => {
  const [page, setPage] = useState(1);
  const [userIdFilter, setUserIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  // 1. Cargar logs de auditoría
  const queryParts = [
    `page=${page}`,
    `pageSize=15`,
    userIdFilter ? `userId=${userIdFilter}` : '',
    actionFilter ? `action=${actionFilter}` : '',
    entityTypeFilter ? `entityType=${entityTypeFilter}` : ''
  ].filter(Boolean).join('&');

  const { data: auditRes, isLoading } = useQuery({
    queryKey: ['audit-logs', page, userIdFilter, actionFilter, entityTypeFilter],
    queryFn: () => apiRequest(`/api/audit-log?${queryParts}`)
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Registro de Auditoría</h2>
        <p className="text-slate-400 text-sm mt-1">Monitorea los eventos importantes de la aplicación, inicio de sesiones y modificaciones de recursos.</p>
      </div>

      {/* Filter panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-darkcard p-4 border border-darkborder rounded-xl">
        
        {/* User filter */}
        <div className="relative">
          <UserIcon className="absolute left-3 top-3.5 text-slate-500" size={16} />
          <input
            type="text"
            value={userIdFilter}
            onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
            placeholder="Filtrar por UUID de usuario..."
            className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>

        {/* Action filter */}
        <div className="relative">
          <Search className="absolute left-3 top-3.5 text-slate-500" size={16} />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            placeholder="Filtrar por acción (ej. USER_LOGIN)..."
            className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>

        {/* Entity type filter */}
        <div className="relative">
          <FileText className="absolute left-3 top-3.5 text-slate-500" size={16} />
          <input
            type="text"
            value={entityTypeFilter}
            onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
            placeholder="Filtrar por entidad (ej. Sound)..."
            className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>

      </div>

      {/* Logs Table */}
      <div className="bg-darkcard border border-darkborder rounded-xl overflow-hidden shadow-lg shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-darkborder bg-darkbg/40 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Fecha</th>
                <th className="p-4">Usuario ID</th>
                <th className="p-4">Acción</th>
                <th className="p-4">Entidad</th>
                <th className="p-4">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkborder font-mono text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm font-sans">
                    Cargando registros...
                  </td>
                </tr>
              ) : auditRes?.items && auditRes.items.length > 0 ? (
                auditRes.items.map((log: any) => (
                  <tr key={log.id} className="hover:bg-darkbg/10 text-slate-300">
                    <td className="p-4 text-slate-400 font-sans whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 text-slate-400 truncate max-w-xs" title={log.userId || 'Sistema'}>
                      {log.userId || 'SISTEMA'}
                    </td>
                    <td className="p-4 font-semibold text-white whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="p-4 text-slate-400 whitespace-nowrap">
                      {log.entityType ? `${log.entityType} (${log.entityId})` : 'N/A'}
                    </td>
                    <td className="p-4 max-w-md truncate" title={JSON.stringify(log.metadataJson)}>
                      {log.metadataJson ? JSON.stringify(log.metadataJson) : '{}'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 text-sm font-sans">
                    No se encontraron registros de auditoría con los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {auditRes?.pagination && auditRes.pagination.totalPages > 1 && (
          <div className="bg-darkbg/25 border-t border-darkborder px-4 py-4 flex items-center justify-between font-sans">
            <span className="text-xs text-slate-400 font-medium">
              Página {auditRes.pagination.page} de {auditRes.pagination.totalPages} ({auditRes.pagination.totalItems} registros)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-darkbg border border-darkborder rounded-lg text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, auditRes.pagination.totalPages))}
                disabled={page === auditRes.pagination.totalPages}
                className="px-3 py-1.5 bg-darkbg border border-darkborder rounded-lg text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
