import React from 'react';
import { Activity, CheckCircle, AlertTriangle, FileText, Loader, Clock, Archive } from 'lucide-react';
import type { AnalysisResult } from '../../types';

interface MaintenancePlan {
  id: number;
  pole_id: number;
  plan_text: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED';
  created_at: string;
  estimated_cost?: number;
}

interface PoleAnalysisResultProps {
  analysis: AnalysisResult;
  apiBase: string;
  maintenancePlan: MaintenancePlan | null;
  history: MaintenancePlan[];
  loadingPlan: boolean;
  showHistory: boolean;
  onFeedback: (isCorrect: boolean) => void;
  onGeneratePlan: () => void;
  onMarkCompleted: (plan: MaintenancePlan) => void;
  onSetMaintenancePlan: (plan: MaintenancePlan) => void;
  onToggleHistory: () => void;
}

const PoleAnalysisResult: React.FC<PoleAnalysisResultProps> = ({
  analysis,
  apiBase,
  maintenancePlan,
  history,
  loadingPlan,
  showHistory,
  onFeedback,
  onGeneratePlan,
  onMarkCompleted,
  onSetMaintenancePlan,
  onToggleHistory,
}) => (
  <div className="analysis-result card gradient-border animate-slide-up">
    <div className="analysis-header">
      <h3><Activity size={16} /> Relatório Vision</h3>
      <span className={`badge ${analysis.confidence > 0.8 ? 'badge-success' : 'badge-warning'}`}>
        {Math.round(analysis.confidence * 100)}% Conf.
      </span>
    </div>

    {analysis.imageUrl && (
      <div className="analysis-img">
        <img src={`${apiBase}${analysis.imageUrl}`} alt="Imagem inspecionada" />
      </div>
    )}

    <p><strong>Tipo:</strong> {analysis.pole_type}</p>
    <p>
      <strong>Condição:</strong>{' '}
      <span className={analysis.condition.toLowerCase().includes('boa') ? 'text-success' : 'text-danger'}>
        {analysis.condition}
      </span>
    </p>
    <div className="analysis-summary">{analysis.analysis_summary}</div>

    <div className="feedback-row">
      <button className="btn btn-outline btn-success" onClick={() => onFeedback(true)}>
        <CheckCircle size={16} /> OK
      </button>
      <button className="btn btn-outline btn-danger" onClick={() => onFeedback(false)}>
        <AlertTriangle size={16} /> Corrigir
      </button>
    </div>

    <div className="maintenance-section">
      <button
        className="btn btn-secondary btn-full mt-2"
        onClick={onGeneratePlan}
        disabled={loadingPlan}
      >
        {loadingPlan ? <Loader className="spin" size={16} /> : <FileText size={16} />}
        {loadingPlan ? 'Gerando Plano...' : 'Gerar Plano de Manutenção'}
      </button>

      {maintenancePlan && (
        <div className="maintenance-plan mt-2 card bg-darker">
          <div className="flex-between">
            <h4><FileText size={14} /> Plano de Manutenção #{maintenancePlan.id}</h4>
            <span className={`badge ${maintenancePlan.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
              {maintenancePlan.status}
            </span>
          </div>
          <div className="plan-meta text-muted text-xs mb-2">
            <Clock size={10} /> {new Date(maintenancePlan.created_at).toLocaleString('pt-BR')}
          </div>
          <div className="plan-content">
            {maintenancePlan.plan_text.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          {maintenancePlan.status !== 'COMPLETED' && (
            <button
              className="btn btn-sm btn-success w-full mt-2"
              onClick={() => onMarkCompleted(maintenancePlan)}
            >
              <CheckCircle size={14} /> Marcar como Realizado
            </button>
          )}
        </div>
      )}

      {history.length > 0 && !maintenancePlan && (
        <button className="btn btn-outline btn-sm w-full mt-2" onClick={onToggleHistory}>
          <Archive size={14} /> Ver Histórico ({history.length})
        </button>
      )}

      {showHistory && !maintenancePlan && (
        <div className="history-list mt-2">
          {history.map(h => (
            <div key={h.id} className="history-item card p-2 mb-1" onClick={() => onSetMaintenancePlan(h)}>
              <div className="flex-between">
                <span>#{h.id} - {new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                <div className="flex gap-2">
                  {h.estimated_cost && (
                    <span className="badge badge-info">R$ {h.estimated_cost.toFixed(2)}</span>
                  )}
                  <span className={`badge ${h.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                    {h.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default PoleAnalysisResult;
