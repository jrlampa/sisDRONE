/**
 * AhiHistoryChart.tsx — Histórico de AHI por Poste (Phase 34)
 *
 * Exibe a evolução do AHI Score ao longo do tempo:
 *  - Lista cronológica invertida (mais recente primeiro)
 *  - Barra colorida proporcional ao valor (verde/amarelo/vermelho)
 *  - Carregamento lazy ao montar o componente
 */
import React, { useEffect, useState, useCallback } from 'react';
import { TrendingDown, Loader, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

interface AhiEntry {
  id: number;
  ahi_score: number;
  recorded_at: string;
}

interface AhiHistoryChartProps {
  poleId: number;
  limit?: number;
}

function ahiColor(score: number): string {
  if (score < 50) return '#ef4444';
  if (score < 80) return '#f59e0b';
  return '#10b981';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const AhiHistoryChart: React.FC<AhiHistoryChartProps> = ({ poleId, limit = 20 }) => {
  const [history, setHistory] = useState<AhiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAhiHistory(poleId, limit);
      setHistory(res.data.history);
    } catch {
      setError('Erro ao carregar histórico AHI.');
    } finally {
      setLoading(false);
    }
  }, [poleId, limit]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 text-muted text-sm">
        <Loader size={14} className="spin" /> Carregando histórico AHI...
      </div>
    );
  }

  if (error) {
    return <p className="text-danger text-xs p-2">{error}</p>;
  }

  if (history.length === 0) {
    return (
      <p className="text-muted text-xs p-2">
        Nenhum registro de AHI disponível para este poste.
      </p>
    );
  }

  return (
    <div className="ahi-history-chart animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 text-xs text-muted">
          <TrendingDown size={13} />
          <span>Histórico AHI ({history.length} entradas)</span>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} title="Recarregar">
          <RefreshCw size={11} />
        </button>
      </div>

      <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
        {history.map(entry => {
          const color = ahiColor(entry.ahi_score);
          const widthPct = `${entry.ahi_score}%`;
          return (
            <div key={entry.id} className="ahi-row" style={{ marginBottom: '6px' }}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">{formatDate(entry.recorded_at)}</span>
                <span className="font-semibold" style={{ color }}>{entry.ahi_score}/100</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: '3px', height: '6px' }}>
                <div style={{
                  width: widthPct,
                  background: color,
                  height: '100%',
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AhiHistoryChart;
