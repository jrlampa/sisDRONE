/**
 * MeasurementToolbar.tsx — Régua Digital no Mapa (Phase 52)
 *
 * Barra flutuante de ferramentas de medição que exibe:
 * - Botão para ativar/desativar modo de medição
 * - Lista de pontos coletados
 * - Comprimentos por segmento
 * - Distância total em metros e quilômetros
 * - Botão para limpar a medição
 *
 * Posicionada como overlay do mapa Leaflet.
 */
import React from 'react';
import { Ruler, X, Trash2, MapPin } from 'lucide-react';
import type { UseMeasurementReturn } from '../hooks/useMeasurement';

interface MeasurementToolbarProps {
  measurement: UseMeasurementReturn;
}

export const MeasurementToolbar: React.FC<MeasurementToolbarProps> = ({ measurement }) => {
  const { active, points, result, error, loading, startMeasuring, stopMeasuring, clearMeasurement } = measurement;

  return (
    <div style={containerStyle}>
      {/* Toggle button */}
      <button
        onClick={active ? stopMeasuring : startMeasuring}
        title={active ? 'Desativar régua' : 'Ativar régua digital'}
        style={{
          ...toggleBtnStyle,
          background: active ? '#3b82f6' : '#1e293b',
          color: active ? 'white' : '#94a3b8',
          borderColor: active ? '#3b82f6' : '#334155',
        }}
      >
        <Ruler size={15} />
        <span style={{ fontSize: '11px', fontWeight: 600 }}>
          {active ? 'Medindo…' : 'Régua'}
        </span>
      </button>

      {/* Expanded panel when active or has result */}
      {(active || result) && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f1f5f9' }}>
              Régua Digital
            </span>
            <button onClick={clearMeasurement} title="Limpar medição" style={iconBtnStyle}>
              <Trash2 size={12} color="#ef4444" />
            </button>
          </div>

          {/* Instructions when active */}
          {active && points.length < 2 && (
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>
              Clique no mapa para adicionar pontos de medição.
            </div>
          )}

          {/* Points list */}
          {points.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              {points.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
                  <MapPin size={10} color="#3b82f6" />
                  <span>P{i + 1}: {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ fontSize: '10px', color: '#64748b' }}>Calculando…</div>
          )}

          {/* Error */}
          {error && (
            <div style={{ fontSize: '10px', color: '#ef4444' }}>{error}</div>
          )}

          {/* Segments */}
          {result && result.segments.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '6px', marginTop: '4px' }}>
                {result.segments.map((seg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
                    <span>Segmento {i + 1}</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                      {seg.distance_m >= 1000
                        ? `${(seg.distance_m / 1000).toFixed(2)} km`
                        : `${seg.distance_m.toFixed(1)} m`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{
                borderTop: '1px solid #334155',
                paddingTop: '6px',
                marginTop: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>Total</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>
                  {result.total_m >= 1000
                    ? `${result.total_km.toFixed(3)} km`
                    : `${result.total_m.toFixed(1)} m`}
                </span>
              </div>
            </>
          )}

          {/* Close when not actively measuring */}
          {!active && result && (
            <button onClick={clearMeasurement} style={{ ...iconBtnStyle, marginTop: '6px', width: '100%', fontSize: '10px', color: '#64748b' }}>
              <X size={11} /> Fechar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '4px',
  pointerEvents: 'all',
};

const toggleBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid #334155',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  transition: 'all 0.15s',
};

const panelStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: '8px',
  padding: '10px 12px',
  minWidth: '200px',
  maxWidth: '260px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

export default MeasurementToolbar;
