import React, { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Pole } from '../types';

interface AlertBannerProps {
  alerts: Pole[];
  onSelectPole?: (pole: Pole) => void;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onSelectPole }) => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || alerts.length === 0) return null;

  return (
    <div className="alert-banner" role="alert" aria-live="polite">
      <div className="alert-banner-header" onClick={() => setExpanded(prev => !prev)}>
        <span className="alert-banner-icon">
          <AlertTriangle size={16} />
        </span>
        <span className="alert-banner-title">
          {alerts.length === 1
            ? '1 poste em estado crítico (AHI < 30)'
            : `${alerts.length} postes em estado crítico (AHI < 30)`}
        </span>
        <button
          className="alert-banner-toggle"
          aria-label={expanded ? 'Recolher alertas' : 'Expandir alertas'}
          onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          className="alert-banner-close"
          aria-label="Dispensar alertas"
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
        >
          <X size={14} />
        </button>
      </div>

      {expanded && (
        <ul className="alert-banner-list">
          {alerts.map(pole => (
            <li key={pole.id} className="alert-banner-item">
              <button
                className="alert-banner-pole-btn"
                onClick={() => onSelectPole?.(pole)}
                title={`Ver poste ${pole.name}`}
              >
                <span className="alert-banner-pole-name">{pole.name}</span>
                <span className="alert-banner-pole-ahi">AHI: {pole.ahi_score ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AlertBanner;
