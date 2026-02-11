import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet + React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  poles: any[];
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick: (pole: any) => void;
}

const MapEvents = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const Map: React.FC<MapProps> = ({ poles, onMapClick, onMarkerClick }) => {
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
      <MapEvents onMapClick={onMapClick} />
      {poles.map((pole) => (
        <Marker
          key={pole.id}
          position={[pole.lat, pole.lng]}
          eventHandlers={{
            click: () => onMarkerClick(pole),
          }}
        >
          <Popup>
            <div>
              <strong>{pole.external_id || `Pole ${pole.id}`}</strong>
              <p>Coords: {pole.lat.toFixed(6)}, {pole.lng.toFixed(6)}</p>
              <p>Status: {pole.status}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default Map;
