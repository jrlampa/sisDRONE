/**
 * MapLayerControls — Phase 60
 * Controles de camada flutuantes no mapa para alternar
 * visibilidade de postes por nível de tensão e condutores por tipo.
 */
import React from 'react';
import { Layers, X } from 'lucide-react';

export interface LayerVisibility {
  polesMT: boolean;
  polesBT: boolean;
  polesAT: boolean;
  conductorMT: boolean;
  conductorBT: boolean;
  conductorRamal: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  polesMT: true,
  polesBT: true,
  polesAT: true,
  conductorMT: true,
  conductorBT: true,
  conductorRamal: true,
};

interface MapLayerControlsProps {
  visibility: LayerVisibility;
  onChange: (v: LayerVisibility) => void;
  open: boolean;
  onToggle: () => void;
}

const LAYERS: { key: keyof LayerVisibility; label: string; color: string }[] = [
  { key: 'polesMT', label: 'Postes MT', color: '#f97316' },
  { key: 'polesBT', label: 'Postes BT', color: '#3b82f6' },
  { key: 'polesAT', label: 'Postes AT', color: '#a855f7' },
  { key: 'conductorMT', label: 'Condutores MT', color: '#f97316' },
  { key: 'conductorBT', label: 'Condutores BT', color: '#3b82f6' },
  { key: 'conductorRamal', label: 'Ramais', color: '#22c55e' },
];

const MapLayerControls: React.FC<MapLayerControlsProps> = ({ visibility, onChange, open, onToggle }) => {
  const toggle = (key: keyof LayerVisibility) =>
    onChange({ ...visibility, [key]: !visibility[key] });

  return (
    <div style={{
      position: 'absolute', bottom: 80, right: 16, zIndex: 1000,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
    }}>
      <button
        className={`btn btn-sm ${open ? 'btn-primary' : 'btn-outline'}`}
        style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
        onClick={onToggle}
        title="Controles de Camada"
        aria-label="Controles de Camada"
      >
        <Layers size={18} />
      </button>

      {open && (
        <div className="glass-panel" style={{ padding: '10px 12px', minWidth: 180, borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Camadas</span>
            <button className="btn-icon" onClick={onToggle} aria-label="Fechar"><X size={14} /></button>
          </div>
          {LAYERS.map(({ key, label, color }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 0', fontSize: '0.82rem' }}>
              <input
                type="checkbox"
                checked={visibility[key]}
                onChange={() => toggle(key)}
                style={{ width: 14, height: 14 }}
              />
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapLayerControls;
