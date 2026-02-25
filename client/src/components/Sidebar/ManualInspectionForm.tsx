/**
 * ManualInspectionForm — Phase 59
 * Formulário de inspeção manual estruturada para projetistas em campo.
 * Envia dados via POST /api/inspections/manual (source='manual', sem IA).
 */
import React, { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../../services/api';
import type { Pole } from '../../types';

const CONDITIONS: { value: string; label: string }[] = [
  { value: 'bom', label: 'Bom estado' },
  { value: 'atenção', label: 'Atenção' },
  { value: 'crítico', label: 'Crítico' },
  { value: 'desconhecido', label: 'Desconhecido' },
];

const STRUCTURE_CONFIGS: { value: string; label: string }[] = [
  { value: '', label: 'Não informado' },
  { value: 'tangente', label: 'Tangente (linha reta)' },
  { value: 'angulo', label: 'Ângulo/Curva' },
  { value: 'derivacao', label: 'Derivação' },
  { value: 'seccionamento', label: 'Seccionamento' },
  { value: 'terminal', label: 'Terminal (fim de linha)' },
  { value: 'passagem', label: 'Passagem' },
];

const PHASE_CONFIGS: { value: string; label: string }[] = [
  { value: '', label: 'Não informado' },
  { value: 'M', label: 'Monofásico' },
  { value: 'B', label: 'Bifásico' },
  { value: 'T', label: 'Trifásico' },
];

const NETWORK_LEVELS: { value: string; label: string }[] = [
  { value: '', label: 'Não informado' },
  { value: 'BT', label: 'Baixa Tensão (BT)' },
  { value: 'MT', label: 'Média Tensão (MT)' },
  { value: 'AT', label: 'Alta Tensão (AT)' },
];

interface ManualInspectionFormProps {
  pole: Pole;
  onSaved: () => void;
}

const ManualInspectionForm: React.FC<ManualInspectionFormProps> = ({ pole, onSaved }) => {
  const [condition, setCondition] = useState('bom');
  const [notes, setNotes] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [networkLevel, setNetworkLevel] = useState('');
  const [structureConfig, setStructureConfig] = useState('');
  const [phaseConfig, setPhaseConfig] = useState('');
  const [numArms, setNumArms] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.createManualInspection({
        pole_id: pole.id,
        condition,
        notes: notes || undefined,
        inspector_name: inspectorName || undefined,
        network_level: networkLevel || undefined,
        structure_config: structureConfig || undefined,
        phase_config: phaseConfig || undefined,
        num_arms: numArms !== '' ? parseInt(numArms, 10) : undefined,
      });
      setSuccess(true);
      setNotes('');
      onSaved();
    } catch {
      setError('Falha ao salvar inspeção. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manual-inspection-form" style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ClipboardCheck size={18} className="text-accent" />
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Inspeção Manual de Campo</span>
      </div>

      {success && (
        <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 6, padding: '6px 10px', fontSize: '0.83rem', marginBottom: 8 }}>
          ✓ Inspeção registrada com sucesso
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '6px 10px', fontSize: '0.83rem', marginBottom: 8 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="form-label" style={{ fontSize: '0.82rem' }}>
          Condição Geral *
          <select value={condition} onChange={e => setCondition(e.target.value)} className="glass-input" required>
            {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>

        <label className="form-label" style={{ fontSize: '0.82rem' }}>
          Nome do Inspetor
          <input
            type="text"
            value={inspectorName}
            onChange={e => setInspectorName(e.target.value.slice(0, 100))}
            className="glass-input"
            placeholder="Engenheiro de campo"
          />
        </label>

        <label className="form-label" style={{ fontSize: '0.82rem' }}>
          Nível de Tensão
          <select value={networkLevel} onChange={e => setNetworkLevel(e.target.value)} className="glass-input">
            {NETWORK_LEVELS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <label className="form-label" style={{ fontSize: '0.82rem', flex: 1 }}>
            Configuração
            <select value={structureConfig} onChange={e => setStructureConfig(e.target.value)} className="glass-input">
              {STRUCTURE_CONFIGS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="form-label" style={{ fontSize: '0.82rem', flex: 1 }}>
            Fase
            <select value={phaseConfig} onChange={e => setPhaseConfig(e.target.value)} className="glass-input">
              {PHASE_CONFIGS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        </div>

        <label className="form-label" style={{ fontSize: '0.82rem' }}>
          Nº de Braços
          <input
            type="number"
            value={numArms}
            onChange={e => setNumArms(e.target.value)}
            className="glass-input"
            min="0" max="20"
            placeholder="0"
          />
        </label>

        <label className="form-label" style={{ fontSize: '0.82rem' }}>
          Observações
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, 1000))}
            className="glass-input"
            rows={3}
            placeholder="Condições observadas em campo..."
            style={{ resize: 'vertical' }}
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Salvando...' : 'Registrar Inspeção'}
        </button>
      </form>
    </div>
  );
};

export default ManualInspectionForm;
