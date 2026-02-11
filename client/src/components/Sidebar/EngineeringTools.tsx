import React from 'react';
import { Hammer } from 'lucide-react';
import type { Span } from '../../types';
import { calculateSag, COMMON_CABLES } from '../../utils/eng';

interface EngineeringToolsProps {
  activeSpan: Span;
  conductorWeight: number;
  setConductorWeight: (w: number) => void;
  tension: number;
  setTension: (t: number) => void;
}

const EngineeringTools: React.FC<EngineeringToolsProps> = ({
  activeSpan, conductorWeight, setConductorWeight, tension, setTension
}) => {
  const currentSag = calculateSag(conductorWeight, activeSpan.distance, tension);

  return (
    <div className="engineering-module animate-fade-in">
      <div className="card gradient-border">
        <div className="card-header">
          <Hammer size={20} className="text-primary" />
          <h2>Cálculo de Flecha</h2>
        </div>

        <div className="form-group">
          <label htmlFor="conductor-select">Condutor</label>
          <select
            id="conductor-select"
            className="glass-input"
            value={conductorWeight}
            onChange={(e) => setConductorWeight(parseFloat(e.target.value))}
            aria-label="Selecionar tipo de condutor"
          >
            {COMMON_CABLES.map(c => <option key={c.name} value={c.weight}>{c.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="tension-input">Tração (kgf)</label>
          <input
            id="tension-input"
            type="number"
            value={tension}
            onChange={(e) => setTension(parseFloat(e.target.value))}
            className="glass-input"
            aria-label="Informar tração horizontal"
          />
        </div>

        <div className="stats-grid-compact">
          <div className="stat-item">
            <span className="stat-label">Vão</span>
            <span className="stat-value">{activeSpan.distance.toFixed(1)}m</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Flecha</span>
            <span className={`stat-value ${currentSag > 2 ? 'text-danger' : 'text-success'}`}>
              {currentSag.toFixed(2)}m
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EngineeringTools;
