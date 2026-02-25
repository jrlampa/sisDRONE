/**
 * InspectionWizard.tsx — Wizard de Levantamento em Campo (Phase 63)
 *
 * Formulário passo-a-passo otimizado para uso em campo (mobile-first).
 * Cria poste + equipamentos + label de inspeção em uma única chamada ao backend.
 *
 * Passos:
 *   1. Localização (lat/lng + nome)
 *   2. Estrutura (material/nível/configuração)
 *   3. Equipamentos (lista, até 10 itens)
 *   4. Condição (inspeção visual)
 *   5. Confirmar e enviar
 */
import React, { useState, useCallback } from 'react';
import { MapPin, Zap, Wrench, ClipboardCheck, ChevronRight, ChevronLeft, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

interface WizardEquipmentItem {
  type: string;
  brand: string;
  model: string;
}

interface WizardResult {
  pole_id: number;
  label_id: number;
  equipment_ids: number[];
  message: string;
}

interface InspectionWizardProps {
  tenantId: number;
  onSuccess?: (result: WizardResult) => void;
  onCancel?: () => void;
}

const VALID_CONDITIONS = ['bom', 'atenção', 'crítico', 'desconhecido'] as const;
const VALID_MATERIALS = ['concreto', 'madeira', 'aço', 'fibra', 'outro'] as const;
const VALID_NETWORK_LEVELS = ['MT', 'BT', 'AT'] as const;
const VALID_STRUCTURE_CONFIGS = [
  'tangente', 'angulo', 'derivacao', 'seccionamento', 'terminal', 'passagem',
] as const;
const VALID_PHASE_CONFIGS = ['M', 'B', 'T'] as const;
const VALID_EQUIPMENT_TYPES = [
  'transformador', 'chave_fusivel', 'chave_seccionadora', 'para-raios',
  'capacitor', 'religador', 'medidor', 'luminaria', 'caixa_de_passagem',
  'conector', 'outro',
] as const;

const CONDITION_LABELS: Record<string, string> = {
  bom: 'Bom ✅',
  'atenção': 'Atenção ⚠️',
  'crítico': 'Crítico 🔴',
  desconhecido: 'Desconhecido ❓',
};

const CONDITION_COLORS: Record<string, string> = {
  bom: '#10b981',
  'atenção': '#f59e0b',
  'crítico': '#ef4444',
  desconhecido: '#9ca3af',
};

const STEP_ICONS = [MapPin, Zap, Wrench, ClipboardCheck];
const STEP_LABELS = ['Localização', 'Estrutura', 'Equipamentos', 'Condição'];

const EMPTY_EQ: WizardEquipmentItem = { type: 'transformador', brand: '', model: '' };

const InspectionWizard: React.FC<InspectionWizardProps> = ({ tenantId, onSuccess, onCancel }) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Localização
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  // Step 2: Estrutura
  const [material, setMaterial] = useState<string>('concreto');
  const [networkLevel, setNetworkLevel] = useState<string>('BT');
  const [structureConfig, setStructureConfig] = useState<string>('tangente');
  const [phaseConfig, setPhaseConfig] = useState<string>('T');
  const [numArms, setNumArms] = useState('0');
  const [height, setHeight] = useState('');

  // Step 3: Equipamentos
  const [equipment, setEquipment] = useState<WizardEquipmentItem[]>([]);

  // Step 4: Condição
  const [condition, setCondition] = useState<string>('bom');
  const [notes, setNotes] = useState('');
  const [inspectorName, setInspectorName] = useState('');

  const addEquipment = useCallback(() => {
    if (equipment.length >= 10) return;
    setEquipment(prev => [...prev, { ...EMPTY_EQ }]);
  }, [equipment.length]);

  const removeEquipment = useCallback((idx: number) => {
    setEquipment(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateEquipment = useCallback((idx: number, field: keyof WizardEquipmentItem, value: string) => {
    setEquipment(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }, []);

  const canProceed = useCallback((): boolean => {
    if (step === 0) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      return !isNaN(latNum) && latNum >= -90 && latNum <= 90 &&
             !isNaN(lngNum) && lngNum >= -180 && lngNum <= 180;
    }
    if (step === 1) return true;
    if (step === 2) return true;
    if (step === 3) return !!condition;
    return true;
  }, [step, lat, lng, condition]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        tenant_id: tenantId,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        name: name.trim() || undefined,
        material,
        network_level: networkLevel,
        structure_config: structureConfig || undefined,
        phase_config: phaseConfig || undefined,
        num_arms: parseInt(numArms, 10) || 0,
        height: height ? parseFloat(height) : undefined,
        condition,
        notes: notes.trim() || undefined,
        inspector_name: inspectorName.trim() || undefined,
        equipment: equipment.filter(e => e.type).map(e => ({
          type: e.type,
          brand: e.brand.trim() || undefined,
          model: e.model.trim() || undefined,
        })),
      };
      const res = await api.createInspectionWizard(payload);
      setResult(res.data);
      onSuccess?.(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Erro ao registrar levantamento');
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, lat, lng, name, material, networkLevel, structureConfig, phaseConfig, numArms, height, condition, notes, inspectorName, equipment, onSuccess]);

  if (result) {
    return (
      <div className="p-4 text-center">
        <CheckCircle size={48} className="mx-auto mb-3 text-success" />
        <h3 className="text-success fw-bold mb-2">Levantamento Registrado!</h3>
        <p className="text-muted small mb-1">Poste #{result.pole_id} criado</p>
        <p className="text-muted small mb-1">Inspeção #{result.label_id} registrada</p>
        {result.equipment_ids.length > 0 && (
          <p className="text-muted small mb-3">{result.equipment_ids.length} equipamento(s) cadastrado(s)</p>
        )}
        <button className="btn btn-sm btn-outline-primary" onClick={onCancel}>Fechar</button>
      </div>
    );
  }

  return (
    <div className="inspection-wizard p-3">
      {/* Progress bar */}
      <div className="d-flex justify-content-between mb-3">
        {STEP_LABELS.map((label, i) => {
          const Icon = STEP_ICONS[i];
          const active = i === step;
          const done = i < step;
          return (
            <div key={i} className="d-flex flex-column align-items-center" style={{ flex: 1 }}>
              <div
                className={`rounded-circle d-flex align-items-center justify-content-center mb-1`}
                style={{
                  width: 28, height: 28,
                  background: done ? '#10b981' : active ? '#3b82f6' : '#e2e8f0',
                  color: done || active ? 'white' : '#64748b',
                  fontSize: 13,
                }}
              >
                <Icon size={13} />
              </div>
              <span style={{ fontSize: 9, color: active ? '#3b82f6' : '#94a3b8' }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 0 && (
        <div>
          <h6 className="fw-bold mb-3 text-primary">📍 Localização</h6>
          <div className="mb-2">
            <label className="form-label form-label-sm">Nome do Poste (opcional)</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: P-0001"
              maxLength={100}
            />
          </div>
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label form-label-sm">Latitude *</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="-22.15018"
                step="any"
              />
            </div>
            <div className="col-6">
              <label className="form-label form-label-sm">Longitude *</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder="-42.92185"
                step="any"
              />
            </div>
          </div>
          <p className="text-muted mt-2" style={{ fontSize: 11 }}>
            Use as coordenadas do GPS do dispositivo. Ref: −22.15018, −42.92185
          </p>
        </div>
      )}

      {step === 1 && (
        <div>
          <h6 className="fw-bold mb-3 text-primary">⚡ Estrutura</h6>
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label form-label-sm">Material</label>
              <select className="form-select form-select-sm" value={material} onChange={e => setMaterial(e.target.value)}>
                {VALID_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label form-label-sm">Nível de Rede</label>
              <select className="form-select form-select-sm" value={networkLevel} onChange={e => setNetworkLevel(e.target.value)}>
                {VALID_NETWORK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label form-label-sm">Configuração</label>
              <select className="form-select form-select-sm" value={structureConfig} onChange={e => setStructureConfig(e.target.value)}>
                {VALID_STRUCTURE_CONFIGS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label form-label-sm">Fase</label>
              <select className="form-select form-select-sm" value={phaseConfig} onChange={e => setPhaseConfig(e.target.value)}>
                {VALID_PHASE_CONFIGS.map(p => (
                  <option key={p} value={p}>{p === 'M' ? 'Monofásico' : p === 'B' ? 'Bifásico' : 'Trifásico'}</option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label form-label-sm">Braços</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={numArms}
                onChange={e => setNumArms(e.target.value)}
                min={0} max={20}
              />
            </div>
            <div className="col-6">
              <label className="form-label form-label-sm">Altura (m)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={height}
                onChange={e => setHeight(e.target.value)}
                placeholder="11"
                step="0.5"
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h6 className="fw-bold mb-2 text-primary">🔧 Equipamentos ({equipment.length}/10)</h6>
          {equipment.map((item, idx) => (
            <div key={idx} className="border rounded p-2 mb-2" style={{ background: '#f8fafc' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: 11, fontWeight: 600 }}>Equipamento {idx + 1}</span>
                <button className="btn btn-sm p-0 text-danger" onClick={() => removeEquipment(idx)}>
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="row g-1">
                <div className="col-12">
                  <select className="form-select form-select-sm" value={item.type} onChange={e => updateEquipment(idx, 'type', e.target.value)}>
                    {VALID_EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <input
                    type="text" className="form-control form-control-sm"
                    placeholder="Marca" value={item.brand}
                    onChange={e => updateEquipment(idx, 'brand', e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="col-6">
                  <input
                    type="text" className="form-control form-control-sm"
                    placeholder="Modelo" value={item.model}
                    onChange={e => updateEquipment(idx, 'model', e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
            </div>
          ))}
          {equipment.length < 10 && (
            <button className="btn btn-sm btn-outline-secondary w-100" onClick={addEquipment}>
              <Plus size={13} className="me-1" />Adicionar Equipamento
            </button>
          )}
          {equipment.length === 0 && (
            <p className="text-muted small mt-2">Nenhum equipamento. Clique acima para adicionar.</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <h6 className="fw-bold mb-3 text-primary">📋 Condição Visual</h6>
          <div className="mb-2">
            <label className="form-label form-label-sm">Condição Observada *</label>
            <div className="d-flex gap-2 flex-wrap">
              {VALID_CONDITIONS.map(c => (
                <button
                  key={c}
                  className={`btn btn-sm ${condition === c ? 'text-white' : 'btn-outline-secondary'}`}
                  style={{ background: condition === c ? CONDITION_COLORS[c] : undefined, borderColor: CONDITION_COLORS[c] }}
                  onClick={() => setCondition(c)}
                >
                  {CONDITION_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-2">
            <label className="form-label form-label-sm">Nome do Inspetor</label>
            <input
              type="text" className="form-control form-control-sm"
              value={inspectorName} onChange={e => setInspectorName(e.target.value)}
              placeholder="Nome completo" maxLength={100}
            />
          </div>
          <div className="mb-2">
            <label className="form-label form-label-sm">Observações</label>
            <textarea
              className="form-control form-control-sm"
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={3} placeholder="Inclinação, danos visíveis, vegetação..." maxLength={2000}
            />
          </div>
          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
              <XCircle size={14} />{error}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="d-flex justify-content-between mt-3">
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
          disabled={submitting}
        >
          <ChevronLeft size={14} className="me-1" />{step === 0 ? 'Cancelar' : 'Anterior'}
        </button>
        {step < 3 ? (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
          >
            Próximo <ChevronRight size={14} className="ms-1" />
          </button>
        ) : (
          <button
            className="btn btn-sm btn-success"
            onClick={handleSubmit}
            disabled={submitting || !condition}
          >
            {submitting ? (
              <span className="spinner-border spinner-border-sm me-1" />
            ) : (
              <CheckCircle size={14} className="me-1" />
            )}
            Registrar
          </button>
        )}
      </div>
    </div>
  );
};

export default InspectionWizard;
