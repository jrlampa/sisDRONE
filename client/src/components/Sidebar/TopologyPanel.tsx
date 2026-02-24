/**
 * TopologyPanel.tsx — Painel de Topologia de Rede Elétrica (Phase 30 + 33)
 *
 * Exibe: segmentos contíguos, postes isolados, estatísticas do grafo
 *        e resumo de queda de tensão (Phase 33).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Network, RefreshCw, Loader, AlertTriangle, GitBranch, Zap } from 'lucide-react';
import { api } from '../../services/api';
import type { NetworkSegment, Pole } from '../../types';

interface TopologyStats {
  nodeCount: number;
  edgeCount: number;
  segmentCount: number;
  isolatedCount: number;
  segments: NetworkSegment[];
  isolated: Pole[];
  vdCritical: number;
  vdWarning: number;
  loading: boolean;
  error: string | null;
}

interface TopologyPanelProps {
  tenantId?: number;
  onSelectPole?: (pole: Pole) => void;
}

const TopologyPanel: React.FC<TopologyPanelProps> = ({ tenantId, onSelectPole }) => {
  const [stats, setStats] = useState<TopologyStats>({
    nodeCount: 0,
    edgeCount: 0,
    segmentCount: 0,
    isolatedCount: 0,
    segments: [],
    isolated: [],
    vdCritical: 0,
    vdWarning: 0,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setStats(s => ({ ...s, loading: true, error: null }));
    try {
      const [graphRes, segRes, isolRes, vdRes] = await Promise.all([
        api.getNetworkGraph(tenantId),
        api.getNetworkSegments(tenantId),
        api.getNetworkIsolated(tenantId),
        api.getVoltageDrop(tenantId).catch(() => null),
      ]);
      setStats({
        nodeCount: graphRes.data.node_count,
        edgeCount: graphRes.data.edge_count,
        segmentCount: segRes.data.segment_count,
        isolatedCount: isolRes.data.count,
        segments: segRes.data.segments,
        isolated: isolRes.data.poles,
        vdCritical: vdRes?.data.summary.critical ?? 0,
        vdWarning: vdRes?.data.summary.warning ?? 0,
        loading: false,
        error: null,
      });
    } catch {
      setStats(s => ({ ...s, loading: false, error: 'Erro ao carregar topologia da rede.' }));
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  if (stats.loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted">
        <Loader size={16} className="spin" />
        <span>Calculando topologia...</span>
      </div>
    );
  }

  if (stats.error) {
    return <p className="text-danger text-sm p-3">{stats.error}</p>;
  }

  return (
    <div className="topology-panel animate-fade-in">
      {/* KPI Cards */}
      <div className="stats-mini-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '0.75rem' }}>
        <div className="stat-card">
          <div className="stat-value">{stats.nodeCount}</div>
          <div className="stat-label">Postes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.edgeCount}</div>
          <div className="stat-label">Condutores</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.segmentCount}</div>
          <div className="stat-label">Segmentos</div>
        </div>
        <div className="stat-card" style={{ borderColor: stats.isolatedCount > 0 ? 'var(--warning)' : undefined }}>
          <div className="stat-value" style={{ color: stats.isolatedCount > 0 ? 'var(--warning)' : undefined }}>
            {stats.isolatedCount}
          </div>
          <div className="stat-label">Isolados</div>
        </div>
      </div>

      {/* Voltage Drop Summary (Phase 33) */}
      {(stats.vdCritical > 0 || stats.vdWarning > 0) && (
        <div className="card mb-3" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="card-header">
            <Zap size={15} className="text-danger" />
            <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Queda de Tensão (NBR 5410)</h4>
          </div>
          <div className="flex gap-3 px-2 py-1 text-xs">
            {stats.vdCritical > 0 && (
              <span className="text-danger font-semibold">⚡ {stats.vdCritical} crítico{stats.vdCritical > 1 ? 's' : ''} (&gt;10%)</span>
            )}
            {stats.vdWarning > 0 && (
              <span className="text-warning font-semibold">⚠ {stats.vdWarning} atenção (&gt;5%)</span>
            )}
          </div>
        </div>
      )}

      {/* Segments */}
      {stats.segments.length > 0 && (
        <div className="card mb-3">
          <div className="card-header">
            <GitBranch size={15} className="text-accent" />
            <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Segmentos Conectados</h4>
          </div>
          <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
            {stats.segments.map(seg => (
              <div key={seg.segment_id} className="flex items-center gap-2 py-1 px-2 text-xs border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="font-semibold text-accent">S{seg.segment_id}</span>
                <span className="text-muted">{seg.size} postes</span>
                <span className="text-muted">IDs: {seg.pole_ids.slice(0, 6).join(', ')}{seg.pole_ids.length > 6 ? '…' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Isolated Poles */}
      {stats.isolated.length > 0 && (
        <div className="card">
          <div className="card-header">
            <AlertTriangle size={15} className="text-warning" />
            <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Postes Isolados (sem condutor)</h4>
          </div>
          <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
            {stats.isolated.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-2 py-1 px-2 text-xs border-b cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => onSelectPole?.(p)}
              >
                <AlertTriangle size={10} className="text-warning shrink-0" />
                <span className="font-semibold">{p.name || `#${p.id}`}</span>
                {p.ahi_score != null && (
                  <span className="text-muted">AHI: {p.ahi_score}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.segments.length === 0 && stats.isolated.length === 0 && (
        <p className="text-muted text-sm p-2">Nenhum condutor registrado. Adicione condutores para ver a topologia.</p>
      )}

      <div className="flex justify-end mt-2">
        <button className="btn btn-outline btn-sm" onClick={load} title="Recarregar">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>
    </div>
  );
};

export default TopologyPanel;
