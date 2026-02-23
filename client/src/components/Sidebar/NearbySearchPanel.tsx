import React, { useState, useCallback } from 'react';
import { MapPin, Search, Loader, Navigation } from 'lucide-react';
import { api } from '../../services/api';
import type { Pole } from '../../types';

const RADIUS_OPTIONS = [
  { label: '100 m', value: 100 },
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
] as const;

interface NearbySearchPanelProps {
  onSelectPole: (pole: Pole) => void;
}

const NearbySearchPanel: React.FC<NearbySearchPanelProps> = ({ onSelectPole }) => {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState<number>(500);
  const [results, setResults] = useState<(Pole & { distance_m: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada neste dispositivo.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setError(null);
      },
      () => setError('Não foi possível obter a localização. Verifique as permissões do navegador.')
    );
  }, []);

  const handleSearch = useCallback(async () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setError('Coordenadas inválidas. Informe latitude e longitude decimais.');
      return;
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setError('Coordenadas fora do intervalo válido.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.getNearbyPoles(latNum, lngNum, radius);
      setResults(res.data);
      if (res.data.length === 0) setError('Nenhum poste encontrado no raio informado.');
    } catch {
      setError('Erro ao buscar postes próximos. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radius]);

  const getAhiBadge = (score?: number) => {
    const s = score ?? 100;
    if (s < 50) return 'badge-danger';
    if (s < 80) return 'badge-warning';
    return 'badge-success';
  };

  return (
    <div className="nearby-search-panel">
      <button
        className="btn btn-outline btn-sm w-full flex items-center gap-2"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Busca por Proximidade"
      >
        <MapPin size={14} />
        Busca por Proximidade
        <span className="ml-auto text-muted text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="nearby-form animate-fade-in mt-2">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Latitude (ex: -22.15018)"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="glass-input flex-1 text-xs"
              aria-label="Latitude"
            />
            <input
              type="text"
              placeholder="Longitude (ex: -42.92185)"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="glass-input flex-1 text-xs"
              aria-label="Longitude"
            />
          </div>

          <div className="flex gap-1 mb-2">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`btn btn-sm flex-1 ${radius === opt.value ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setRadius(opt.value)}
                aria-pressed={radius === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={handleGeolocate}
              title="Usar minha localização atual"
            >
              <Navigation size={13} />
            </button>
            <button
              className="btn btn-primary btn-sm flex-1"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? <Loader size={13} className="spin" /> : <Search size={13} />}
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {error && (
            <p className="text-xs text-danger mt-2">{error}</p>
          )}

          {results.length > 0 && (
            <ul className="nearby-results mt-2">
              {results.map((pole) => (
                <li
                  key={pole.id}
                  className="nearby-result-item"
                  onClick={() => onSelectPole(pole)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectPole(pole)}
                >
                  <div className="flex-between">
                    <span className="text-xs font-medium">{pole.name}</span>
                    <span className={`badge ${getAhiBadge(pole.ahi_score)} text-xs`}>
                      AHI {pole.ahi_score ?? 100}
                    </span>
                  </div>
                  <span className="text-xs text-muted" aria-label={`Distância: ${pole.distance_m.toFixed(0)} metros`}>{pole.distance_m.toFixed(0)} m</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NearbySearchPanel;
