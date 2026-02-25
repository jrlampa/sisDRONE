/**
 * DroneRoutePanel.tsx — Planejamento de Rota de Inspeção por Drone (Phase 55)
 *
 * Interface para gerar e visualizar o roteiro de inspeção otimizado (TSP) sobre
 * os postes de uma concessionária.
 *
 * Thin Frontend: toda lógica de roteamento está no backend (routeService.ts).
 */
import React, { useState, useCallback } from 'react';
import { Navigation, Download, RefreshCw, Loader, MapPin, Clock, Ruler } from 'lucide-react';
import { api } from '../../services/api';
import type { DroneRoute } from '../../types';
import { useToast } from '../../hooks/useToast';
import ToastBanner from '../ToastBanner';

interface DroneRoutePanelProps {
  tenantId: number | null;
}

const AHI_COLOR: Record<string, string> = {
  critical: '#ef4444',
  attention: '#f59e0b',
  good: '#10b981',
  unknown: '#9ca3af',
};

function ahiColor(ahi: number | null): string {
  if (ahi === null || ahi === undefined) return AHI_COLOR.unknown;
  if (ahi < 50) return AHI_COLOR.critical;
  if (ahi < 80) return AHI_COLOR.attention;
  return AHI_COLOR.good;
}

const DroneRoutePanel: React.FC<DroneRoutePanelProps> = ({ tenantId }) => {
  const [route, setRoute] = useState<DroneRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const { toast, showToast, clearToast } = useToast();

  const generate = useCallback(async () => {
    if (!tenantId) {
      showToast('Selecione uma concessionária antes de gerar a rota.', 'error');
      return;
    }
    setLoading(true);
    try {
      const lat = startLat ? parseFloat(startLat) : undefined;
      const lng = startLng ? parseFloat(startLng) : undefined;
      const res = await api.getDroneRoute(tenantId, lat, lng);
      setRoute(res.data);
      showToast(`Rota gerada com ${res.data.total_poles} waypoints.`, 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(msg ?? 'Erro ao gerar rota de drone.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, startLat, startLng, showToast]);

  const handleKmlDownload = () => {
    if (!tenantId) return;
    window.open(api.getDroneRouteKmlUrl(tenantId), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-4">
      {toast && <ToastBanner message={toast.message} type={toast.type} onClose={clearToast} />}

      <div className="flex items-center gap-2 text-sm font-bold text-accent uppercase tracking-wide">
        <Navigation size={16} />
        Roteiro de Inspeção por Drone
      </div>

      {/* Ponto de Partida Opcional */}
      <div className="bg-panel rounded-lg p-3 border border-light/10">
        <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wide">
          Ponto de Partida (opcional)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted block mb-0.5">Latitude</label>
            <input
              type="number"
              step="any"
              placeholder="-22.15018"
              value={startLat}
              onChange={(e) => setStartLat(e.target.value)}
              className="w-full bg-background border border-light/20 rounded px-2 py-1 text-xs text-light focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted block mb-0.5">Longitude</label>
            <input
              type="number"
              step="any"
              placeholder="-42.92185"
              value={startLng}
              onChange={(e) => setStartLng(e.target.value)}
              className="w-full bg-background border border-light/20 rounded px-2 py-1 text-xs text-light focus:border-accent focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[10px] text-muted mt-1.5">
          Se não informado, inicia pelo poste de menor AHI (mais crítico).
        </p>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <button
          onClick={generate}
          disabled={loading || !tenantId}
          className="flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-accent/90 disabled:opacity-50 transition"
        >
          {loading ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? 'Gerando...' : 'Gerar Rota'}
        </button>

        {route && (
          <button
            onClick={handleKmlDownload}
            className="flex items-center gap-1.5 border border-light/20 text-light text-xs font-semibold px-3 py-1.5 rounded hover:bg-light/5 transition"
          >
            <Download size={12} />
            Baixar KML
          </button>
        )}
      </div>

      {/* Sumário da Rota */}
      {route && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-panel border border-light/10 rounded-lg p-2 text-center">
              <MapPin size={14} className="mx-auto mb-1 text-accent" />
              <p className="text-sm font-bold text-light">{route.total_poles}</p>
              <p className="text-[10px] text-muted">Postes</p>
            </div>
            <div className="bg-panel border border-light/10 rounded-lg p-2 text-center">
              <Ruler size={14} className="mx-auto mb-1 text-accent" />
              <p className="text-sm font-bold text-light">{route.total_distance_km} km</p>
              <p className="text-[10px] text-muted">Distância</p>
            </div>
            <div className="bg-panel border border-light/10 rounded-lg p-2 text-center">
              <Clock size={14} className="mx-auto mb-1 text-accent" />
              <p className="text-sm font-bold text-light">~{route.estimated_flight_minutes} min</p>
              <p className="text-[10px] text-muted">Voo estimado</p>
            </div>
          </div>

          {/* Lista de Waypoints */}
          <div>
            <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-2">
              Waypoints ({route.waypoints.length})
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {route.waypoints.map((wp) => (
                <div
                  key={wp.pole_id}
                  className="flex items-center gap-2 bg-panel border border-light/10 rounded px-2 py-1.5 text-xs"
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: ahiColor(wp.ahi_score) }}
                  >
                    {wp.order}
                  </span>
                  <span className="flex-1 truncate text-light">
                    {wp.name ?? `Poste #${wp.pole_id}`}
                  </span>
                  <span className="text-muted shrink-0">
                    {wp.order === 1 ? 'início' : `${wp.distance_from_prev_m} m`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DroneRoutePanel;
