import React, { useState } from 'react';
import { MapPin, Upload, Activity, CheckCircle, AlertTriangle, FileText, Loader, Clock, Archive } from 'lucide-react';
import { api } from '../../services/api';
import type { Pole, AnalysisResult, User } from '../../types';
import type { Prediction } from '../../types/prediction';
import WorkOrderModal from '../WorkOrders/WorkOrderModal';

interface MaintenancePlan {
  id: number;
  pole_id: number;
  plan_text: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED';
  created_at: string;
  estimated_cost?: number;
}

interface PoleDetailsProps {
  pole: Pole;
  isCapturing: boolean;
  onAnalyze: () => void;
  analysis: AnalysisResult | null;
  onFeedback: (isCorrect: boolean) => void;
  apiBase: string;
  users: User[];
}

const PoleDetails: React.FC<PoleDetailsProps> = ({
  pole, isCapturing, onAnalyze, analysis, onFeedback, apiBase, users
}) => {
  const getAHIStatus = (score: number = 100) => {
    if (score < 50) return { color: 'text-danger', bg: 'bg-danger', label: 'Crítico' };
    if (score < 80) return { color: 'text-warning', bg: 'bg-warning', label: 'Atenção' };
    return { color: 'text-success', bg: 'bg-success', label: 'Saudável' };
  };

  const [maintenancePlan, setMaintenancePlan] = useState<MaintenancePlan | null>(null);
  const [history, setHistory] = useState<MaintenancePlan[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isWOModalOpen, setIsWOModalOpen] = useState(false);

  const loadPrediction = React.useCallback(async () => {
    try {
      const res = await api.getPrediction(pole.id);
      setPrediction(res.data);
    } catch (e) {
      console.error('Failed to load prediction', e);
    }
  }, [pole.id]);

  const loadHistory = React.useCallback(async () => {
    try {
      const res = await api.getMaintenancePlans(pole.id);
      if (res.data && res.data.length > 0) {
        setHistory(res.data);
        // Default to showing the latest plan if pending
        if (res.data[0].status === 'PENDING') {
          setMaintenancePlan(res.data[0]);
        }
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Failed to load history', error);
    }
  }, [pole.id]);

  React.useEffect(() => {
    if (pole.id) {
      loadHistory();
      loadPrediction();
      setMaintenancePlan(null);
    }
  }, [pole.id, loadHistory, loadPrediction]);

  React.useEffect(() => {
    if (pole.id) {
      loadHistory();
      setMaintenancePlan(null); // Reset current view
    }
  }, [pole.id, loadHistory]);

  const handleGeneratePlan = async () => {
    if (!analysis) return;
    setLoadingPlan(true);
    try {
      // Optimistic update wrapper not needed here as we want real data
      const res = await api.generateMaintenancePlan(pole.id, analysis);
      // Construct local object from response
      const newPlan: MaintenancePlan = {
        id: res.data.planId,
        pole_id: pole.id,
        plan_text: res.data.plan,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        estimated_cost: res.data.estimatedCost
      };
      setMaintenancePlan(newPlan);
      setHistory(prev => [newPlan, ...prev]);
    } catch (error) {
      console.error('Error generating plan', error);
      alert('Erro ao gerar plano.');
    } finally {
      setLoadingPlan(false);
    }
  };

  const markCompleted = async (plan: MaintenancePlan) => {
    try {
      await api.updateMaintenanceStatus(plan.id, 'COMPLETED');
      const updated = { ...plan, status: 'COMPLETED' as const };
      setMaintenancePlan(updated);
      setHistory(prev => prev.map(p => p.id === plan.id ? updated : p));
    } catch {
      alert('Erro ao atualizar status');
    }
  };

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

        {/* AHI Gauge */}
        <div className="mt-3 pt-3 border-t border-light/10">
          <div className="flex-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Índice de Saúde (AHI)</span>
            <span className={`font-mono font-bold ${getAHIStatus(pole.ahi_score).color}`}>
              {pole.ahi_score ?? 100}/100
            </span>
          </div>
          <div className="h-2 bg-darker rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${getAHIStatus(pole.ahi_score).bg}`}
              style={{ width: `${pole.ahi_score ?? 100}%` }}
            />
          </div>
        </div>

        {/* Prediction Section */}
        {prediction && (
          <div className="mt-4 pt-3 border-t border-light/10 animate-fade-in">
            <div className="flex-between mb-2">
              <span className="text-xs uppercase tracking-wider text-muted font-bold">Vida Útil Restante</span>
              <span className={`badge ${prediction.years_remaining < 5 ? 'badge-danger' : 'badge-success'}`}>
                {prediction.years_remaining} Anos
              </span>
            </div>

            <div className="relative h-24 w-full bg-darker rounded p-2">
              {/* SVG Decay Chart */}
              <svg className="w-full h-full" viewBox="0 0 100 50" preserveAspectRatio="none">
                {/* Grid Lines */}
                <line x1="0" y1="40" x2="100" y2="40" stroke="#333" strokeWidth="0.5" />
                <line x1="0" y1="10" x2="100" y2="10" stroke="#333" strokeDasharray="2" strokeWidth="0.5" />

                {/* Decay Curve */}
                <polyline
                  points={prediction.health_history.map((pt, _, arr) => {
                    const startYear = arr[0].year;
                    const totalYears = arr[arr.length - 1].year - startYear;
                    const x = ((pt.year - startYear) / totalYears) * 100;
                    const y = 50 - (pt.score / 100) * 50; // Invert Y (0 is top)
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke={prediction.years_remaining < 5 ? '#ef4444' : '#10b981'}
                  strokeWidth="2"
                />

                {/* Current Point */}
                <circle
                  cx={(() => {
                    const startYear = prediction.health_history[0].year;
                    const totalYears = prediction.health_history[2].year - startYear;
                    return ((new Date().getFullYear() - startYear) / totalYears) * 100;
                  })()}
                  cy={50 - ((pole.ahi_score ?? 100) / 100) * 50}
                  r="3"
                  fill="#fff"
                />
              </svg>
              <div className="flex-between text-[10px] text-muted mt-1">
                <span>{prediction.health_history[0].year}</span>
                <span>Modelo Linear (Conf: {prediction.confidence * 100}%)</span>
                <span>{prediction.health_history[2].year} (EOL)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        className="btn btn-primary btn-full mt-2"
        onClick={onAnalyze}
        disabled={isCapturing}
      >
        <Upload size={18} /> {isCapturing ? 'Refinando Visão...' : 'Análise IA'}
      </button>

      <button
        className="btn btn-secondary btn-full mt-2"
        onClick={() => setIsWOModalOpen(true)}
      >
        <FileText size={18} /> Criar Ordem de Serviço
      </button>

      <WorkOrderModal
        isOpen={isWOModalOpen}
        onClose={() => setIsWOModalOpen(false)}
        pole={pole}
        users={users}
        onSuccess={() => alert('OS Criada!')}
      />

      {
        analysis && (
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

            <div className="maintenance-section">
              <button
                className="btn btn-secondary btn-full mt-2"
                onClick={handleGeneratePlan}
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
                    <Clock size={10} /> {new Date(maintenancePlan.created_at).toLocaleString()}
                  </div>

                  <div className="plan-content">
                    {maintenancePlan.plan_text.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>

                  {maintenancePlan.status !== 'COMPLETED' && (
                    <button
                      className="btn btn-sm btn-success w-full mt-2"
                      onClick={() => markCompleted(maintenancePlan)}
                    >
                      <CheckCircle size={14} /> Marcar como Realizado
                    </button>
                  )}
                </div>
              )}

              {history.length > 0 && !maintenancePlan && (
                <button className="btn btn-outline btn-sm w-full mt-2" onClick={() => setShowHistory(!showHistory)}>
                  <Archive size={14} /> Ver Histórico ({history.length})
                </button>
              )}

              {showHistory && !maintenancePlan && (
                <div className="history-list mt-2">
                  {history.map(h => (
                    <div key={h.id} className="history-item card p-2 mb-1" onClick={() => setMaintenancePlan(h)}>
                      <div className="flex-between">
                        <span>#{h.id} - {new Date(h.created_at).toLocaleDateString()}</span>
                        <div className="flex gap-2">
                          {h.estimated_cost && <span className="badge badge-info">R$ {h.estimated_cost.toFixed(2)}</span>}
                          <span className={`badge ${h.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>{h.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      }
    </div>
  );
};

export default PoleDetails;
