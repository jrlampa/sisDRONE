import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Pole, Span, Conductor } from '../types';
import HeatmapLayer from './HeatmapLayer';

// Fix for default marker icons in Leaflet + React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

/** Returns a colored circular divIcon based on AHI score and selection state:
 *  AHI ≥ 80 → verde | 50–79 → amarelo | < 50 → vermelho | sem AHI → cinza
 *  selected → larger ring with white border for visual highlight */
function getAhiIcon(ahi: number | null, selected = false): L.DivIcon {
  const isUnknown = ahi === null || ahi === undefined;
  const score = ahi ?? 0;
  const bg = isUnknown ? '#9ca3af' : score < 50 ? '#ef4444' : score < 80 ? '#f59e0b' : '#10b981';
  const border = selected ? '#ffffff' : (isUnknown ? '#6b7280' : score < 50 ? '#b91c1c' : score < 80 ? '#b45309' : '#065f46');
  const size = selected ? 20 : 14;
  const shadow = selected ? '0 0 0 3px rgba(255,255,255,0.4), 0 3px 8px rgba(0,0,0,0.55)' : '0 2px 5px rgba(0,0,0,0.45)';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${selected ? 3 : 2.5}px solid ${border};box-shadow:${shadow};transition:all .2s;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -12],
  });
}

/** Cor e espessura da linha por tipo de rede elétrica */
function getConductorStyle(type: string): { color: string; weight: number; dashArray?: string } {
  if (type === 'MT') return { color: '#f97316', weight: 3 };
  if (type === 'ramal') return { color: '#22c55e', weight: 1.5, dashArray: '6, 4' };
  return { color: '#3b82f6', weight: 2 }; // BT padrão
}

interface MapProps {
  poles: Pole[];
  selectedPole: Pole | null;
  onMarkerClick: (pole: Pole) => void;
  onMapClick: (lat: number, lng: number) => void;
  isMeasuring: boolean;
  activeSpan: Span | null;
  userRole: 'ADMIN' | 'ENGINEER' | 'VIEWER';
  showHeatmap: boolean;
  conductors?: Conductor[];
}

const Map: React.FC<MapProps> = ({
  poles, selectedPole, onMarkerClick, onMapClick, isMeasuring, activeSpan, userRole, showHeatmap,
  conductors = [],
}) => {
  const heatmapPoints: [number, number, number][] = poles.map(p => {
    // Inverse of AHI: Lower score = Higher intensity in heatmap (more damaged)
    const intensity = p.ahi_score ? (100 - p.ahi_score) / 100 : 0.2;
    return [p.lat, p.lng, intensity];
  });
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!isMeasuring && userRole !== 'VIEWER') {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      },
    });
    return null;
  };

  return (
    <MapContainer
      center={[-22.15018, -42.92185]}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents />

      {showHeatmap && <HeatmapLayer points={heatmapPoints} />}

      {conductors.map((c) => {
        const style = getConductorStyle(c.network_type);
        return (
          <Polyline
            key={`c-${c.id}`}
            positions={[[c.from_lat, c.from_lng], [c.to_lat, c.to_lng]]}
            color={style.color}
            weight={style.weight}
            dashArray={style.dashArray}
            opacity={0.85}
          >
            <Tooltip sticky>
              <span><strong>{c.network_type}</strong> — {c.from_name} → {c.to_name}</span>
              {c.cable_type && <><br />{c.cable_type}</>}
              {c.voltage_kv !== undefined && c.voltage_kv !== null && <><br />{c.voltage_kv} kV</>}
              {c.length_m !== undefined && c.length_m !== null && <><br />{c.length_m} m</>}
            </Tooltip>
          </Polyline>
        );
      })}

      {poles.map((pole) => (
        <Marker
          key={pole.id}
          position={[pole.lat, pole.lng]}
          icon={getAhiIcon(pole.ahi_score ?? null, selectedPole?.id === pole.id)}
          eventHandlers={{
            click: () => onMarkerClick(pole),
          }}
          opacity={1}
        >
          <Popup>
            <div className="popup-content">
              <strong>{pole.name || `Poste ${pole.id}`}</strong>
              <p>Coords: {pole.lat.toFixed(6)}, {pole.lng.toFixed(6)}</p>
              <p>AHI: <span className={`status-badge ${pole.ahi_score === null || pole.ahi_score === undefined ? 'warning' : pole.ahi_score < 50 ? 'critical' : pole.ahi_score < 80 ? 'warning' : 'saudavel'}`}>
                {pole.ahi_score ?? 'N/A'}
              </span></p>
            </div>
          </Popup>
        </Marker>
      ))}

      {activeSpan && (
        <Polyline
          positions={[[activeSpan.p1.lat, activeSpan.p1.lng], [activeSpan.p2.lat, activeSpan.p2.lng]]}
          color="var(--accent)"
          weight={3}
          dashArray="10, 10"
        />
      )}
    </MapContainer>
  );
};

export default Map;
