import React, { useState } from 'react';
import { MapPin, Upload, FileText, Loader, Download, Edit2, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import type { Pole, AnalysisResult, User } from '../../types';
import WorkOrderModal from '../WorkOrders/WorkOrderModal';
import ToastBanner from '../ToastBanner';
import ConfirmDialog from '../ConfirmDialog';
import PoleAnalysisResult from './PoleAnalysisResult';
import PoleEditForm from './PoleEditForm';
import PoleImages from './PoleImages';
import AhiHistoryChart from './AhiHistoryChart';
import InspectionTimeline from './InspectionTimeline';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { usePoleSummary } from '../../hooks/usePoleSummary';
import type { PoleMaintenancePlan } from '../../hooks/usePoleSummary';

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

  const { toast, showToast, clearToast } = useToast();
  const { confirmState, confirm, handleAnswer } = useConfirm();

  const { summary, prediction, history, maintenancePlan, setMaintenancePlan, setHistory } = usePoleSummary(pole.id);

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

  // Reset edit state when pole changes
  React.useEffect(() => {
    setIsEditing(false);
    setEditName(pole.name);
    setEditMaterial(pole.material || '');
    setEditStatus(
      VALID_STATUSES.includes(pole.status as typeof VALID_STATUSES[number])
        ? pole.status as typeof VALID_STATUSES[number]
        : 'pending'
    );
  }, [pole.id, pole.name, pole.material, pole.status]);

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
      showToast('Erro ao salvar alterações', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePole = async () => {
    const ok = await confirm({
      title: 'Excluir Poste',
      message: `Confirmar exclusão do poste "${pole.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await api.deletePole(pole.id);
      onPoleDeleted?.(pole.id);
    } catch {
      showToast('Erro ao excluir poste', 'error');
    }
  };

  const handleGeneratePlan = async () => {
    if (!analysis) return;
    setLoadingPlan(true);
    try {
      const res = await api.generateMaintenancePlan(pole.id, analysis);
      const newPlan: PoleMaintenancePlan = {
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
      console.error('Erro ao gerar plano', error);
      showToast('Erro ao gerar plano de manutenção', 'error');
    } finally {
      setLoadingPlan(false);
    }
  };

  const markCompleted = async (plan: PoleMaintenancePlan) => {
    try {
      await api.updateMaintenanceStatus(plan.id, 'COMPLETED');
      const updated = { ...plan, status: 'COMPLETED' as const };
      setMaintenancePlan(updated);
      setHistory(prev => prev.map(p => p.id === plan.id ? updated : p));
    } catch {
      showToast('Erro ao atualizar status do plano', 'error');
    }
  };

  return (
    <div className="pole-details animate-fade-in">
      <ConfirmDialog state={confirmState} onAnswer={handleAnswer} />
      <ToastBanner toast={toast} onDismiss={clearToast} />
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
          <PoleEditForm
            editName={editName}
            editMaterial={editMaterial}
            editStatus={editStatus}
            validStatuses={VALID_STATUSES}
            savingEdit={savingEdit}
            onChangeName={setEditName}
            onChangeMaterial={setEditMaterial}
            onChangeStatus={(v) => setEditStatus(v as typeof VALID_STATUSES[number])}
            onSave={handleSaveEdit}
          />
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

            {/* Classificação MT/BT (Phase 54) */}
            {(pole.network_level || pole.structure_config || pole.phase_config) && (
              <div className="mt-2 pt-2 border-t border-light/10">
                <p className="text-xs uppercase tracking-wider text-muted font-bold mb-1">Classificação Estrutural</p>
                <div className="stats-row">
                  {pole.network_level && (
                    <div className="stat-item">
                      <span className="stat-label">Nível</span>
                      <span className={`stat-value font-bold ${pole.network_level === 'MT' ? 'text-warning' : 'text-accent'}`}>
                        {pole.network_level}
                      </span>
                    </div>
                  )}
                  {pole.structure_config && (
                    <div className="stat-item">
                      <span className="stat-label">Configuração</span>
                      <span className="stat-value text-xs capitalize">{pole.structure_config}</span>
                    </div>
                  )}
                  {pole.phase_config && (
                    <div className="stat-item">
                      <span className="stat-label">Fase</span>
                      <span className="stat-value">
                        {pole.phase_config === 'M' ? 'Monofásico' : pole.phase_config === 'B' ? 'Bifásico' : 'Trifásico'}
                      </span>
                    </div>
                  )}
                  {pole.num_arms !== undefined && pole.num_arms > 0 && (
                    <div className="stat-item">
                      <span className="stat-label">Braços</span>
                      <span className="stat-value">{pole.num_arms}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Images Section */}
        <PoleImages poleId={pole.id} apiBase={apiBase} />

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

          {/* AHI History (Phase 34) */}
          <div className="mt-3">
            <AhiHistoryChart poleId={pole.id} limit={10} />
          </div>

          {/* Timeline de Inspeções (Phase 45) */}
          <div className="mt-4 pt-3 border-t border-light/10">
            <p className="text-xs uppercase tracking-wider text-muted font-bold mb-3">Timeline de Eventos</p>
            <InspectionTimeline poleId={pole.id} />
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
        onSuccess={() => showToast('Ordem de Serviço criada com sucesso!', 'success')}
      />


      {analysis && (
        <PoleAnalysisResult
          analysis={analysis}
          apiBase={apiBase}
          maintenancePlan={maintenancePlan}
          history={history}
          loadingPlan={loadingPlan}
          showHistory={showHistory}
          onFeedback={onFeedback}
          onGeneratePlan={handleGeneratePlan}
          onMarkCompleted={markCompleted}
          onSetMaintenancePlan={setMaintenancePlan}
          onToggleHistory={() => setShowHistory(prev => !prev)}
        />
      )}
    </div>
  );
};

export default PoleDetails;