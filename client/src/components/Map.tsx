import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Pole, Span } from '../types';
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

interface MapProps {
  poles: Pole[];
  selectedPole: Pole | null;
  onMarkerClick: (pole: Pole) => void;
  onMapClick: (lat: number, lng: number) => void;
  isMeasuring: boolean;
  activeSpan: Span | null;
  userRole: 'ADMIN' | 'ENGINEER' | 'VIEWER';
  showHeatmap: boolean;
}

const Map: React.FC<MapProps> = ({
  poles, selectedPole, onMarkerClick, onMapClick, isMeasuring, activeSpan, userRole, showHeatmap
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
      center={[-23.5505, -46.6333]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents />

      {showHeatmap && <HeatmapLayer points={heatmapPoints} />}

      {poles.map((pole) => (
        <Marker
          key={pole.id}
          position={[pole.lat, pole.lng]}
          eventHandlers={{
            click: () => onMarkerClick(pole),
          }}
          opacity={selectedPole?.id === pole.id ? 1 : 0.8}
        >
          <Popup>
            <div className="popup-content">
              <strong>{pole.name || `Poste ${pole.id}`}</strong>
              <p>Coords: {pole.lat.toFixed(6)}, {pole.lng.toFixed(6)}</p>
              <p>Coords: {pole.lat.toFixed(6)}, {pole.lng.toFixed(6)}</p>
              <p>AHI: <span className={`status-badge ${(pole.ahi_score || 100) < 50 ? 'critical' : ((pole.ahi_score || 100) < 80 ? 'warning' : 'saudavel')}`}>
                {pole.ahi_score ?? 100}
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
