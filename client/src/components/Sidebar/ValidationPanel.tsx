/**
 * ValidationPanel.tsx — Painel de Validação de Topologia (Phase 42)
 *
 * Exibe o relatório de inconsistências topológicas da rede elétrica:
 *   - is_valid: badge verde/vermelho
 *   - Loops detectados
 *   - Postes dead-end (1 conexão)
 *   - Condutores duplicados (mesmo par from/to)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Loader } from 'lucide-react';
import { api } from '../../services/api';
import type { TopologyValidation } from '../../types';

interface ValidationPanelProps {
  tenantId?: number;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ tenantId }) => {
  const [data, setData] = useState<TopologyValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getNetworkValidation(tenantId);
      setData(res.data);
    } catch {
      setError('Erro ao carregar validação da rede.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted">
        <Loader size={16} className="spin" />
        <span>Validando topologia...</span>
      </div>
    );
  }

  if (error) return <p className="text-danger text-sm p-3">{error}</p>;
  if (!data)  return null;

  return (
    <div className="validation-panel animate-fade-in">
      {/* Status geral */}
      <div className="flex items-center gap-2 mb-4">
        {data.is_valid
          ? <ShieldCheck size={20} className="text-success" />
          : <ShieldAlert size={20} className="text-danger" />
        }
        <span className={`font-semibold ${data.is_valid ? 'text-success' : 'text-danger'}`}>
          {data.is_valid ? 'Topologia válida' : 'Inconsistências detectadas'}
        </span>
        <button className="btn btn-ghost btn-sm ml-auto" onClick={load} title="Revalidar">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* KPI mini-grid */}
      <div className="stats-mini-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '0.75rem' }}>
        <div className="stat-card" style={{ borderColor: data.loops_count > 0 ? 'var(--danger)' : undefined }}>
          <div className="stat-value" style={{ color: data.loops_count > 0 ? 'var(--danger)' : undefined }}>
            {data.loops_count}
          </div>
          <div className="stat-label">Loops</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.dead_ends_count}</div>
          <div className="stat-label">Terminais</div>
        </div>
        <div className="stat-card" style={{ borderColor: data.isolated_count > 0 ? 'var(--warning)' : undefined }}>
          <div className="stat-value" style={{ color: data.isolated_count > 0 ? 'var(--warning)' : undefined }}>
            {data.isolated_count}
          </div>
          <div className="stat-label">Isolados</div>
        </div>
        <div className="stat-card" style={{ borderColor: data.duplicates_count > 0 ? 'var(--danger)' : undefined }}>
          <div className="stat-value" style={{ color: data.duplicates_count > 0 ? 'var(--danger)' : undefined }}>
            {data.duplicates_count}
          </div>
          <div className="stat-label">Duplicatas</div>
        </div>
      </div>

      {/* Loops detail */}
      {data.loops.length > 0 && (
        <div className="card mb-3" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="card-header">
            <span className="text-xs font-semibold text-danger">🔁 Loops / Ciclos detectados</span>
          </div>
          <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {data.loops.map((cycle, i) => (
              <div key={i} className="text-xs px-2 py-1 text-muted border-b" style={{ borderColor: 'var(--border)' }}>
                Ciclo {i + 1}: postes {cycle.join(' → ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate spans detail */}
      {data.duplicate_spans.length > 0 && (
        <div className="card mb-3" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="card-header">
            <span className="text-xs font-semibold text-danger">⚡ Condutores duplicados</span>
          </div>
          <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {data.duplicate_spans.map((dup, i) => (
              <div key={i} className="text-xs px-2 py-1 text-muted border-b" style={{ borderColor: 'var(--border)' }}>
                Postes {dup.pole_from}↔{dup.pole_to} — condutores: {dup.conductor_ids.join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.is_valid && (
        <p className="text-xs text-muted text-center py-2">
          ✅ Nenhuma inconsistência encontrada. {data.node_count} postes e {data.edge_count} condutores verificados.
        </p>
      )}
    </div>
  );
};

export default ValidationPanel;
