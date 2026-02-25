/**
 * CircuitHealthPanel.tsx — Relatório de Saúde de Circuito (Phase 65)
 *
 * Exibe um painel consolidado de saúde de um circuito específico:
 *   - KPIs de AHI, postes críticos, extensão total
 *   - Distribuição de AHI por faixa
 *   - Resumo de queda de tensão (NBR 5410)
 *   - Validação topológica resumida
 *   - Equipamentos por tipo
 */
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import type { CircuitHealthReport } from '../../types';

interface Props {
  circuitId: number;
  circuitName?: string;
}

const AHI_BAND_COLOR: Record<string, string> = {
  '0-20':   '#ef4444',
  '21-40':  '#f97316',
  '41-60':  '#eab308',
  '61-80':  '#84cc16',
  '81-100': '#22c55e',
  sem_dados: '#94a3b8',
};

export default function CircuitHealthPanel({ circuitId, circuitName }: Props) {
  const [report, setReport] = useState<CircuitHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCircuitHealth(circuitId);
      setReport(res.data);
    } catch {
      setError('Falha ao carregar relatório de saúde do circuito.');
    } finally {
      setLoading(false);
    }
  }, [circuitId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 16, color: '#94a3b8' }}>Carregando...</div>;
  if (error)   return <div style={{ padding: 16, color: '#ef4444' }}>{error}</div>;
  if (!report) return null;

  const s = report.summary;

  return (
    <div style={{ padding: '12px 16px', fontFamily: 'sans-serif', fontSize: 13, color: '#e2e8f0' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#f8fafc' }}>
        ⚡ Saúde: {circuitName ?? report.circuit_name}
      </h3>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <KpiCard label="Postes" value={s.total_poles} />
        <KpiCard label="Críticos" value={s.critical_poles} color="#ef4444" />
        <KpiCard label="AHI médio" value={s.avg_ahi != null ? s.avg_ahi : '—'} />
        <KpiCard label="Condutores" value={s.total_conductors} />
        <KpiCard label="Extensão km" value={s.total_length_km} />
        <KpiCard label="Topologia" value={s.is_topology_valid ? '✓ OK' : '⚠ Erro'} color={s.is_topology_valid ? '#22c55e' : '#f97316'} />
      </div>

      {/* AHI Distribution */}
      <Section title="Distribuição AHI">
        {Object.entries(report.ahi_distribution).map(([band, count]) => (
          <div key={band} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: AHI_BAND_COLOR[band] ?? '#94a3b8', flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#94a3b8' }}>{band}</span>
            <span style={{ fontWeight: 600 }}>{count}</span>
          </div>
        ))}
      </Section>

      {/* Voltage Drop */}
      <Section title="Queda de Tensão (NBR 5410)">
        <div style={{ display: 'flex', gap: 16 }}>
          <Pill label="Crítico" count={report.voltage_drop.critical} color="#ef4444" />
          <Pill label="Atenção" count={report.voltage_drop.warning}  color="#f97316" />
          <Pill label="OK"      count={report.voltage_drop.ok}       color="#22c55e" />
        </div>
      </Section>

      {/* Topology */}
      <Section title="Validação Topológica">
        <Row label="Loops detectados"    value={report.topology.loops_count} warn={report.topology.loops_count > 0} />
        <Row label="Dead-ends"           value={report.topology.dead_ends_count} />
        <Row label="Postes isolados"     value={report.topology.isolated_count} warn={report.topology.isolated_count > 0} />
        <Row label="Vãos duplicados"     value={report.topology.duplicates_count} warn={report.topology.duplicates_count > 0} />
      </Section>

      {/* Equipment */}
      {Object.keys(report.equipment).length > 0 && (
        <Section title="Equipamentos">
          {Object.entries(report.equipment).map(([type, count]) => (
            <Row key={type} label={type} value={count} />
          ))}
        </Section>
      )}

      <div style={{ fontSize: 11, color: '#475569', marginTop: 8, textAlign: 'right' }}>
        Gerado em {new Date(report.generated_at).toLocaleString('pt-BR')}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: color ?? '#f8fafc' }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ fontWeight: 600, color: warn ? '#f97316' : '#e2e8f0' }}>{value}</span>
    </div>
  );
}

function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ background: color + '22', border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 8px', color }}>
      {label}: <strong>{count}</strong>
    </div>
  );
}
