import React from 'react';
import { MapPin, Upload, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Pole, AnalysisResult } from '../../types';

interface PoleDetailsProps {
  pole: Pole;
  isCapturing: boolean;
  onAnalyze: () => void;
  analysis: AnalysisResult | null;
  onFeedback: (isCorrect: boolean) => void;
  apiBase: string;
}

const PoleDetails: React.FC<PoleDetailsProps> = ({
  pole, isCapturing, onAnalyze, analysis, onFeedback, apiBase
}) => {
  return (
    <div className="pole-details animate-fade-in">
      <div className="card">
        <div className="card-header">
          <MapPin size={20} className="text-accent" />
          <h2>{pole.name}</h2>
        </div>
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-label">Latitude</span>
            <span className="stat-value">{pole.lat.toFixed(6)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Longitude</span>
            <span className="stat-value">{pole.lng.toFixed(6)}</span>
          </div>
        </div>
        <div className="utm-line"><strong>UTM:</strong> {pole.utm_x}, {pole.utm_y}</div>
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={onAnalyze}
        disabled={isCapturing}
      >
        <Upload size={18} /> {isCapturing ? 'Refinando Visão...' : 'Análise IA'}
      </button>

      {analysis && (
        <div className="analysis-result card gradient-border animate-slide-up">
          <div className="analysis-header">
            <h3><Activity size={16} /> Relatório Vision</h3>
            <span className={`badge ${analysis.confidence > 0.8 ? 'badge-success' : 'badge-warning'}`}>
              {Math.round(analysis.confidence * 100)}% Conf.
            </span>
          </div>
          {analysis.imageUrl && (
            <div className="analysis-img">
              <img src={`${apiBase}${analysis.imageUrl}`} alt="Audit" />
            </div>
          )}
          <p><strong>Tipo:</strong> {analysis.pole_type}</p>
          <p>
            <strong>Condição:</strong>
            <span className={analysis.condition.toLowerCase().includes('boa') ? 'text-success' : 'text-danger'}>
              {analysis.condition}
            </span>
          </p>
          <div className="analysis-summary">{analysis.analysis_summary}</div>
          <div className="feedback-row">
            <button
              className="btn btn-outline btn-success"
              onClick={() => onFeedback(true)}
            >
              <CheckCircle size={16} /> OK
            </button>
            <button
              className="btn btn-outline btn-danger"
              onClick={() => onFeedback(false)}
            >
              <AlertTriangle size={16} /> Corrigir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoleDetails;
