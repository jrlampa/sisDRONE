import React, { useState } from 'react';
import { MapPin, Upload, Activity, CheckCircle, AlertTriangle, FileText, Loader, Clock, Archive, Download, Edit2, Trash2, Save, X } from 'lucide-react';
import { api } from '../../services/api';
import type { Pole, AnalysisResult, User, PoleSummary } from '../../types';
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
  onPoleUpdated?: (pole: Pole) => void;
  onPoleDeleted?: (id: number) => void;
}

const VALID_STATUSES = ['pending', 'inspected', 'maintenance', 'critical', 'ok'] as const;

const PoleDetails: React.FC<PoleDetailsProps> = ({
  pole, isCapturing, onAnalyze, analysis, onFeedback, apiBase, users,
  onPoleUpdated, onPoleDeleted,
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

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(pole.name);
  const [editMaterial, setEditMaterial] = useState(pole.material || '');
  const [editStatus, setEditStatus] = useState<typeof VALID_STATUSES[number]>(
    VALID_STATUSES.includes(pole.status as typeof VALID_STATUSES[number]) ? pole.status as typeof VALID_STATUSES[number] : 'pending'
  );
  const [savingEdit, setSavingEdit] = useState(false);

  const [summary, setSummary] = useState<PoleSummary | null>(null);

  const loadSummary = React.useCallback(async () => {
    try {
      const res = await api.getPoleSummary(pole.id);
      setSummary(res.data);
    } catch {
      // summary is optional enhancement, fail silently
    }
  }, [pole.id]);
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
      loadSummary();
      setMaintenancePlan(null);
      setIsEditing(false);
      setEditName(pole.name);
      setEditMaterial(pole.material || '');
      setEditStatus(VALID_STATUSES.includes(pole.status as typeof VALID_STATUSES[number]) ? pole.status as typeof VALID_STATUSES[number] : 'pending');
    }
  }, [pole.id, loadHistory, loadPrediction, loadSummary]);

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await api.updatePole(pole.id, {
        name: editName,
        material: editMaterial || undefined,
        status: editStatus,
      });
      onPoleUpdated?.(res.data);
      setIsEditing(false);
    } catch {
      alert('Erro ao salvar alterações');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePole = async () => {
    if (!window.confirm(`Confirmar exclusão do poste "${pole.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.deletePole(pole.id);
      onPoleDeleted?.(pole.id);
    } catch {
      alert('Erro ao excluir poste');
    }
  };

  const handleGeneratePlan = async () => {
    if (!analysis) return;
    setLoadingPlan(true);
    try {
      const res = await api.generateMaintenancePlan(pole.id, analysis);
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
          <div className="flex gap-1 ml-auto">
            <button
              className="btn-icon"
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? 'Cancelar edição' : 'Editar poste'}
              aria-label={isEditing ? 'Cancelar edição' : 'Editar poste'}
            >
              {isEditing ? <X size={16} /> : <Edit2 size={16} />}
            </button>
            <button
              className="btn-icon text-danger"
              onClick={handleDeletePole}
              title="Excluir poste"
              aria-label="Excluir poste"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="edit-form mt-2">
            <div className="form-group mb-2">
              <label className="text-xs text-muted">Nome</label>
              <input
                className="glass-input w-full mt-1"
                value={editName}
                onChange={e => setEditName(e.target.value.slice(0, 100))}
                placeholder="Nome do poste"
              />
            </div>
            <div className="form-group mb-2">
              <label className="text-xs text-muted">Material</label>
              <input
                className="glass-input w-full mt-1"
                value={editMaterial}
                onChange={e => setEditMaterial(e.target.value.slice(0, 50))}
                placeholder="Concreto, Madeira, Metal..."
              />
            </div>
            <div className="form-group mb-2">
              <label className="text-xs text-muted">Status</label>
              <select
                className="glass-input w-full mt-1"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as typeof VALID_STATUSES[number])}
              >
                {VALID_STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary btn-full mt-1"
              onClick={handleSaveEdit}
              disabled={savingEdit || !editName.trim()}
            >
              {savingEdit ? <Loader size={14} className="spin" /> : <Save size={14} />}
              {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}

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
          {summary && (
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted">
              <span>
                🔍 <strong>{summary.inspection_count}</strong> inspeção{summary.inspection_count !== 1 ? 'ões' : ''}
              </span>
              <span>
                {summary.last_inspection
                  ? `📅 ${new Date(summary.last_inspection.created_at).toLocaleDateString('pt-BR')}`
                  : '📅 Sem inspeção'}
              </span>
              {summary.active_plan && (
                <span className="col-span-2 text-yellow-400">
                  ⚠️ Plano ativo: {summary.active_plan.status}
                  {summary.active_plan.estimated_cost ? ` · R$ ${summary.active_plan.estimated_cost.toFixed(2)}` : ''}
                </span>
              )}
            </div>
          )}
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
              <svg className="w-full h-full" viewBox="0 0 100 50" preserveAspectRatio="none">
                <line x1="0" y1="40" x2="100" y2="40" stroke="#333" strokeWidth="0.5" />
                <line x1="0" y1="10" x2="100" y2="10" stroke="#333" strokeDasharray="2" strokeWidth="0.5" />
                <polyline
                  points={prediction.health_history.map((pt, _, arr) => {
                    const startYear = arr[0].year;
                    const totalYears = arr[arr.length - 1].year - startYear;
                    const x = ((pt.year - startYear) / totalYears) * 100;
                    const y = 50 - (pt.score / 100) * 50;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke={prediction.years_remaining < 5 ? '#ef4444' : '#10b981'}
                  strokeWidth="2"
                />
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

      <a
        href={api.getPoleReportUrl(pole.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline btn-full mt-2"
        title="Baixar Relatório PDF do Poste"
      >
        <Download size={18} /> Relatório PDF
      </a>

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
