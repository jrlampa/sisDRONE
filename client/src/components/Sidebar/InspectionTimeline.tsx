/**
 * InspectionTimeline.tsx — Phase 45: Timeline de Inspeções por Poste
 * Exibe linha do tempo vertical com inspeções e snapshots de AHI ordenados por data.
 */
import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, Activity, TrendingUp, TrendingDown, Minus, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { TimelineEntry } from '../../types';

interface Props {
  poleId: number;
}

const CONDITION_COLOR: Record<string, string> = {
  'Bom': '#22c55e',
  'Atenção': '#f59e0b',
  'Crítico': '#ef4444',
};

function AhiBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: 4,
      background: color,
      color: '#fff',
      fontWeight: 700,
      fontSize: 13,
    }}>
      AHI {score}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta > 0) return <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 2, fontSize: 13 }}><TrendingUp size={13} />+{delta}</span>;
  if (delta < 0) return <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 2, fontSize: 13 }}><TrendingDown size={13} />{delta}</span>;
  return <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 2, fontSize: 13 }}><Minus size={13} />0</span>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function InspectionTimeline({ poleId }: Props) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPoleTimeline(poleId);
      setTimeline(res.data.timeline);
    } catch {
      setError('Falha ao carregar timeline do poste');
    } finally {
      setLoading(false);
    }
  }, [poleId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#9ca3af' }}>
      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
      <span>Carregando timeline…</span>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', padding: '8px 0' }}>
      <AlertCircle size={16} /><span>{error}</span>
    </div>
  );

  if (timeline.length === 0) return (
    <p style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>Nenhum evento registrado para este poste.</p>
  );

  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      {/* vertical guide line */}
      <div style={{
        position: 'absolute', left: 10, top: 0, bottom: 0, width: 2,
        background: '#374151', borderRadius: 1,
      }} />

      {timeline.map((entry, idx) => {
        const isInspection = entry.type === 'inspection';
        const dotColor = isInspection
          ? (CONDITION_COLOR[entry.label] ?? '#6366f1')
          : '#60a5fa';

        return (
          <div key={`${entry.type}-${entry.id}-${idx}`} style={{ position: 'relative', marginBottom: 20 }}>
            {/* dot */}
            <div style={{
              position: 'absolute', left: -23, top: 2,
              width: 16, height: 16, borderRadius: '50%',
              background: dotColor, border: '2px solid #1f2937',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isInspection
                ? <ClipboardList size={9} color="#fff" />
                : <Activity size={9} color="#fff" />}
            </div>

            {/* content */}
            <div style={{ background: '#1f2937', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#6b7280', fontSize: 11 }}>{formatDate(entry.date)}</span>
                {isInspection
                  ? <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Inspeção</span>
                  : <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>AHI</span>}
              </div>

              {isInspection ? (
                <div>
                  <span style={{ fontWeight: 600, color: dotColor }}>{entry.label}</span>
                  <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 8 }}>
                    {(entry.confidence * 100).toFixed(0)}% confiança · {entry.source}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AhiBadge score={entry.ahi_score} />
                  <DeltaBadge delta={entry.delta_ahi} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
