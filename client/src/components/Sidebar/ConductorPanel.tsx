import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Trash2, RefreshCw, Loader } from 'lucide-react';
import { api } from '../../services/api';
import type { Pole, Conductor } from '../../types';
import { useToast } from '../../hooks/useToast';
import ToastBanner from '../ToastBanner';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';

const NETWORK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MT: { label: 'Média Tensão', color: '#f97316' },
  BT: { label: 'Baixa Tensão', color: '#3b82f6' },
  ramal: { label: 'Ramal', color: '#22c55e' },
};

interface ConductorPanelProps {
  pole: Pole;
  allPoles: Pole[];
}

const ConductorPanel: React.FC<ConductorPanelProps> = ({ pole, allPoles }) => {
  const [conductors, setConductors] = useState<Conductor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [poleToId, setPoleToId] = useState<number | ''>('');
  const [networkType, setNetworkType] = useState<'MT' | 'BT' | 'ramal'>('BT');
  const [cableType, setCableType] = useState('');
  const [voltageKv, setVoltageKv] = useState('');
  const [lengthM, setLengthM] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { toast, showToast, clearToast } = useToast();
  const { confirmState, confirm, handleAnswer } = useConfirm();

  const loadConductors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getConductors({ pole_id: pole.id });
      setConductors(res.data.conductors);
    } catch {
      showToast('Erro ao carregar condutores.', 'error');
    } finally {
      setLoading(false);
    }
  }, [pole.id, showToast]);

  useEffect(() => {
    loadConductors();
  }, [loadConductors]);

  const resetForm = () => {
    setPoleToId('');
    setNetworkType('BT');
    setCableType('');
    setVoltageKv('');
    setLengthM('');
    setNotes('');
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!poleToId) { showToast('Selecione o poste de destino.', 'error'); return; }
    if (Number(poleToId) === pole.id) { showToast('Origem e destino devem ser diferentes.', 'error'); return; }

    setSaving(true);
    try {
      await api.createConductor({
        pole_from: pole.id,
        pole_to: Number(poleToId),
        network_type: networkType,
        cable_type: cableType || undefined,
        voltage_kv: voltageKv ? parseFloat(voltageKv) : undefined,
        length_m: lengthM ? parseFloat(lengthM) : undefined,
        notes: notes || undefined,
        tenant_id: pole.tenant_id,
      });
      showToast('Condutor adicionado com sucesso!', 'success');
      resetForm();
      loadConductors();
    } catch {
      showToast('Erro ao adicionar condutor.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: 'Remover Condutor', message: 'Remover este condutor elétrico?' });
    if (!ok) return;
    try {
      await api.deleteConductor(id);
      showToast('Condutor removido.', 'success');
      loadConductors();
    } catch {
      showToast('Erro ao remover condutor.', 'error');
    }
  };

  const otherPoles = allPoles.filter(p => p.id !== pole.id);

  return (
    <div className="conductor-panel animate-fade-in">
      <ToastBanner toast={toast} onDismiss={clearToast} />
      <ConfirmDialog state={confirmState} onAnswer={handleAnswer} />

      <div className="card mb-3">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-accent" />
            <h3>Condutores — {pole.name}</h3>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={loadConductors} title="Recarregar">
              <RefreshCw size={13} />
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(f => !f)}>
              <Plus size={13} /> Adicionar
            </button>
          </div>
        </div>

        {showForm && (
          <div className="form-grid mt-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <label className="form-label">
              <span>Poste Destino *</span>
              <select
                value={poleToId}
                onChange={e => setPoleToId(e.target.value ? Number(e.target.value) : '')}
                className="glass-input"
              >
                <option value="">Selecione...</option>
                {otherPoles.map(p => (
                  <option key={p.id} value={p.id}>{p.name || `Poste ${p.id}`}</option>
                ))}
              </select>
            </label>

            <label className="form-label">
              <span>Tipo de Rede</span>
              <select
                value={networkType}
                onChange={e => setNetworkType(e.target.value as 'MT' | 'BT' | 'ramal')}
                className="glass-input"
              >
                {Object.entries(NETWORK_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({k})</option>
                ))}
              </select>
            </label>

            <label className="form-label">
              <span>Tipo de Cabo</span>
              <input
                type="text" maxLength={100} placeholder="ex: XLPE 70mm²"
                value={cableType} onChange={e => setCableType(e.target.value)}
                className="glass-input"
              />
            </label>

            <label className="form-label">
              <span>Tensão (kV)</span>
              <input
                type="number" min={0} max={500} step={0.1} placeholder="ex: 13.8"
                value={voltageKv} onChange={e => setVoltageKv(e.target.value)}
                className="glass-input"
              />
            </label>

            <label className="form-label">
              <span>Comprimento (m)</span>
              <input
                type="number" min={0} max={100000} step={1} placeholder="ex: 80"
                value={lengthM} onChange={e => setLengthM(e.target.value)}
                className="glass-input"
              />
            </label>

            <label className="form-label" style={{ gridColumn: '1 / -1' }}>
              <span>Observações</span>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                className="glass-input" rows={2} maxLength={1000}
                placeholder="Notas técnicas sobre o condutor..."
              />
            </label>

            <div className="flex gap-2" style={{ gridColumn: '1 / -1' }}>
              <button className="btn btn-primary flex-1" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader size={13} className="spin" /> : <Plus size={13} />}
                {saving ? 'Salvando...' : 'Salvar Condutor'}
              </button>
              <button className="btn btn-outline" onClick={resetForm}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-4 text-muted">
          <Loader size={16} className="spin" />
          <span>Carregando condutores...</span>
        </div>
      ) : conductors.length === 0 ? (
        <p className="text-muted text-sm p-2">Nenhum condutor registrado para este poste.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {conductors.map(c => {
            const nt = NETWORK_TYPE_LABELS[c.network_type] || { label: c.network_type, color: '#888' };
            const isFrom = c.pole_from === pole.id;
            const otherName = isFrom ? c.to_name : c.from_name;
            return (
              <div key={c.id} className="card" style={{ borderLeft: `3px solid ${nt.color}`, padding: '0.6rem 0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="text-sm font-semibold" style={{ color: nt.color }}>{nt.label}</span>
                    <span className="text-muted text-sm"> → {otherName || `Poste ${isFrom ? c.pole_to : c.pole_from}`}</span>
                    <div className="text-xs text-muted mt-1">
                      {c.cable_type && <span>{c.cable_type} </span>}
                      {c.voltage_kv !== undefined && c.voltage_kv !== null && <span>· {c.voltage_kv} kV </span>}
                      {c.length_m !== undefined && c.length_m !== null && <span>· {c.length_m} m (manual) </span>}
                      {c.computed_length_m !== undefined && c.computed_length_m !== null && (
                        <span title="Comprimento calculado via Haversine">· <strong>{c.computed_length_m.toFixed(0)} m</strong> ↯</span>
                      )}
                    </div>
                    {c.notes && <div className="text-xs text-muted">{c.notes}</div>}
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)', padding: '2px 6px' }}
                    onClick={() => handleDelete(c.id)}
                    title="Remover condutor"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 text-xs text-muted" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
        <span style={{ color: '#f97316' }}>■ MT</span>{' '}
        <span style={{ color: '#3b82f6' }}>■ BT</span>{' '}
        <span style={{ color: '#22c55e' }}>■ Ramal</span>
      </div>
    </div>
  );
};

export default ConductorPanel;
