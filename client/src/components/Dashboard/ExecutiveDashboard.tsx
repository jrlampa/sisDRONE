/**
 * ExecutiveDashboard.tsx — KPIs Executivos da Rede Elétrica (Phase 49)
 *
 * Painel de indicadores de desempenho operacional:
 *   - MTTR (Mean Time to Repair)
 *   - Taxa de inspeção
 *   - Custo total de manutenção no período
 *   - AHI médio atual vs. período anterior
 *   - Postes recuperados (AHI saiu de crítico)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Clock, CheckCircle, DollarSign, Activity, TrendingUp, RefreshCw } from 'lucide-react';

interface KpiData {
  tenant_id: number | null;
  period_days: number;
  mttr_hours: number | null;
  inspection_rate_pct: number;
  maintenance_cost_total: number;
  avg_ahi_current: number | null;
  avg_ahi_previous: number | null;
  avg_ahi_delta_pct: number | null;
  recovered_poles: number;
  inspected_poles: number;
  total_poles: number;
}

interface Props {
  apiBase: string;
  tenantId?: number;
  periodDays?: number;
}

const PERIOD_OPTIONS = [7, 15, 30, 60, 90];

const ExecutiveDashboard: React.FC<Props> = ({ apiBase, tenantId, periodDays: initialPeriod = 30 }) => {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(initialPeriod);

  const fetchKpis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period_days: String(period) });
      if (tenantId) params.set('tenant_id', String(tenantId));
      const res = await fetch(`${apiBase}/api/kpis?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Erro ${res.status}`);
        return;
      }
      setData(await res.json());
    } catch {
      setError('Falha ao carregar KPIs');
    } finally {
      setLoading(false);
    }
  }, [apiBase, tenantId, period]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  const deltaColor = (delta: number | null) => {
    if (delta == null) return 'text-gray-400';
    return delta >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const deltaLabel = (delta: number | null) =>
    delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`;

  return (
    <div className="flex flex-col gap-3 p-2">
      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">Período:</span>
        {PERIOD_OPTIONS.map(d => (
          <button
            key={d}
            className={`text-xs px-2 py-0.5 rounded ${period === d ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => setPeriod(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading && <div className="text-xs text-gray-400 animate-pulse">Carregando KPIs…</div>}
      {error   && <div className="text-xs text-red-400">{error}</div>}

      {data && !loading && (
        <div className="grid grid-cols-2 gap-2">
          {/* MTTR */}
          <div className="card p-2 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} /> MTTR
            </div>
            <div className="text-lg font-bold">
              {data.mttr_hours != null ? `${data.mttr_hours}h` : '—'}
            </div>
            <div className="text-xs text-gray-500">tempo médio reparo</div>
          </div>

          {/* Taxa de inspeção */}
          <div className="card p-2 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <CheckCircle size={11} /> Inspecionados
            </div>
            <div className="text-lg font-bold">{data.inspection_rate_pct}%</div>
            <div className="text-xs text-gray-500">
              {data.inspected_poles}/{data.total_poles} postes
            </div>
          </div>

          {/* Custo total */}
          <div className="card p-2 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <DollarSign size={11} /> Custo Manutenção
            </div>
            <div className="text-lg font-bold">
              {data.maintenance_cost_total > 0
                ? `R$\u00a0${data.maintenance_cost_total.toFixed(2)}`
                : 'R$\u00a00,00'}
            </div>
            <div className="text-xs text-gray-500">últimos {period} dias</div>
          </div>

          {/* AHI médio */}
          <div className="card p-2 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Activity size={11} /> AHI Médio
            </div>
            <div className="text-lg font-bold">
              {data.avg_ahi_current != null ? data.avg_ahi_current : '—'}
            </div>
            <div className={`text-xs font-medium ${deltaColor(data.avg_ahi_delta_pct)}`}>
              {deltaLabel(data.avg_ahi_delta_pct)} vs. período anterior
            </div>
          </div>

          {/* Postes recuperados */}
          <div className="card p-2 flex flex-col gap-1 col-span-2">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <TrendingUp size={11} /> Postes Recuperados
            </div>
            <div className="flex items-end gap-2">
              <div className="text-2xl font-bold text-green-400">{data.recovered_poles}</div>
              <div className="text-xs text-gray-500 mb-1">
                postes saíram de crítico (&lt;30) para ≥30 AHI
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        className="btn btn-outline text-xs mt-1 flex items-center gap-1 self-start"
        onClick={fetchKpis}
        disabled={loading}
      >
        <RefreshCw size={11} /> Atualizar
      </button>
    </div>
  );
};

export default ExecutiveDashboard;
