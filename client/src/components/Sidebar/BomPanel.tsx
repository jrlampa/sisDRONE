/**
 * BomPanel.tsx — Relação de Materiais / BOM (Phase 64)
 *
 * Exibe quantitativos estruturados por material, nível de rede, tipo de condutor e equipamento.
 * Permite download do CSV UTF-8 (compatível com Excel pt-BR).
 */
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import type { BomReport } from '../../types';

interface Props {
  tenantId: number;
  circuitId?: number;
}

export default function BomPanel({ tenantId, circuitId }: Props) {
  const [bom, setBom]       = useState<BomReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBom({ tenant_id: tenantId, circuit_id: circuitId });
      setBom(res.data);
    } catch {
      setError('Falha ao carregar Relação de Materiais.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, circuitId]);

  useEffect(() => { load(); }, [load]);

  const downloadUrl = api.getBomCsvUrl(tenantId, circuitId);

  if (loading) return <div style={{ padding: 16, color: '#94a3b8' }}>Carregando BOM...</div>;
  if (error)   return <div style={{ padding: 16, color: '#ef4444' }}>{error}</div>;
  if (!bom)    return null;

  return (
    <div style={{ padding: '12px 16px', fontFamily: 'sans-serif', fontSize: 13, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#f8fafc' }}>📋 Relação de Materiais</h3>
        <a
          href={downloadUrl}
          download="relacao_materiais.csv"
          style={{ fontSize: 12, color: '#38bdf8', textDecoration: 'none', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '3px 8px' }}
        >
          ⬇ CSV
        </a>
      </div>

      <BomSection title="Postes por Material" data={bom.poles.by_material} total={bom.poles.total} />
      <BomSection title="Postes por Nível de Rede" data={bom.poles.by_network_level} />
      <BomSection title="Postes por Config. Estrutural" data={bom.poles.by_structure_config} />
      <BomSection title="Condutores por Tipo de Rede" data={bom.conductors.by_network_type} total={bom.conductors.total_conductors} />
      <BomSection title="Condutores por Tipo de Cabo" data={bom.conductors.by_cable_type} />

      <div style={{ marginBottom: 10 }}>
        <SectionHeader title="Extensão Total" />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Comprimento total</span>
          <span style={{ fontWeight: 600 }}>{bom.conductors.total_length_km} km</span>
        </div>
      </div>

      <BomSection title="Equipamentos por Tipo" data={bom.equipment.by_type} total={bom.equipment.total} />

      <div style={{ fontSize: 11, color: '#475569', marginTop: 8, textAlign: 'right' }}>
        Gerado em {new Date(bom.generated_at).toLocaleString('pt-BR')}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
      {title}
    </div>
  );
}

function BomSection({ title, data, total }: { title: string; data: Record<string, number>; total?: number }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <SectionHeader title={title} />
        {total !== undefined && (
          <span style={{ fontSize: 11, color: '#64748b' }}>Total: {total}</span>
        )}
      </div>
      {entries.map(([key, count]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ color: '#94a3b8' }}>{key}</span>
          <span style={{ fontWeight: 600 }}>{count}</span>
        </div>
      ))}
    </div>
  );
}
