/**
 * AdminOverview.tsx — Dashboard Executivo Multi-Tenant (Phase 43)
 *
 * Visão consolidada cross-tenant para administradores globais.
 * Exibe cards por tenant com postes, AHI médio, postes críticos e OS abertas.
 * Visível apenas para role ADMIN.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Building2, AlertTriangle, ClipboardList, Activity } from 'lucide-react';

interface TenantOverview {
  id: number;
  name: string;
  total_poles: number;
  avg_ahi: number | null;
  critical_poles: number;
  open_work_orders: number;
  last_inspection: string | null;
}

interface AdminOverviewData {
  total_tenants: number;
  total_poles: number;
  total_open_orders: number;
  tenants: TenantOverview[];
}

interface Props {
  apiBase: string;
}

const AdminOverview: React.FC<Props> = ({ apiBase }) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/overview`, {
        headers: { 'x-user-role': 'ADMIN' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Erro ${res.status}`);
        return;
      }
      setData(await res.json());
    } catch {
      setError('Falha ao carregar dashboard executivo');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  if (loading) return <div className="p-4 text-sm text-gray-400">Carregando dashboard executivo…</div>;
  if (error)   return <div className="p-4 text-sm text-red-400">{error}</div>;
  if (!data)   return null;

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Totais globais */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card stat-card">
          <span className="stat-label">Tenants</span>
          <span className="stat-value">{data.total_tenants}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Postes</span>
          <span className="stat-value">{data.total_poles}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">OS Abertas</span>
          <span className="stat-value">{data.total_open_orders}</span>
        </div>
      </div>

      {/* Cards por tenant */}
      <div className="flex flex-col gap-2">
        {data.tenants.map(t => (
          <div key={t.id} className="card p-3 flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Building2 size={14} className="text-blue-400" />
              {t.name}
            </div>

            <div className="grid grid-cols-2 gap-1 mt-1 text-xs">
              <div className="flex items-center gap-1">
                <Activity size={11} className="text-green-400" />
                <span className="text-gray-400">Postes:</span>
                <span className="font-medium">{t.total_poles}</span>
              </div>

              <div className="flex items-center gap-1">
                <Activity size={11} className={t.avg_ahi != null && t.avg_ahi < 50 ? 'text-orange-400' : 'text-green-400'} />
                <span className="text-gray-400">AHI médio:</span>
                <span className="font-medium">{t.avg_ahi != null ? `${t.avg_ahi}` : 'N/A'}</span>
              </div>

              <div className="flex items-center gap-1">
                <AlertTriangle size={11} className={t.critical_poles > 0 ? 'text-red-400' : 'text-gray-500'} />
                <span className="text-gray-400">Críticos:</span>
                <span className={`font-medium ${t.critical_poles > 0 ? 'text-red-400' : ''}`}>
                  {t.critical_poles}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <ClipboardList size={11} className={t.open_work_orders > 0 ? 'text-yellow-400' : 'text-gray-500'} />
                <span className="text-gray-400">OS abertas:</span>
                <span className="font-medium">{t.open_work_orders}</span>
              </div>
            </div>

            {t.last_inspection && (
              <div className="text-xs text-gray-500 mt-1">
                Última inspeção: {new Date(t.last_inspection).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
