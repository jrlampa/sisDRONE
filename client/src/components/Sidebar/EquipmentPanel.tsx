/**
 * EquipmentPanel.tsx — Phase 53: Equipamentos por Poste
 *
 * Lista, cadastra e remove equipamentos de infraestrutura elétrica
 * associados a um poste (transformadores, fusíveis, religadores, etc.)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Equipment, EquipmentType, EquipmentStatus, Pole } from '../../types';

interface EquipmentPanelProps {
  pole: Pole;
}

const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  transformer: 'Transformador',
  fuse: 'Fusível / Chave Fusível',
  recloser: 'Religador',
  lightning_rod: 'Para-Raios',
  insulator: 'Isolador',
  surge_arrester: 'Para-Raios ZnO',
  capacitor_bank: 'Banco de Capacitores',
  voltage_regulator: 'Regulador de Tensão',
  disconnect_switch: 'Chave Seccionadora',
  meter: 'Medidor de Energia',
  other: 'Outro',
};

const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  defective: 'Com Defeito',
  scheduled_maintenance: 'Manutenção Programada',
};

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  active: 'text-success',
  inactive: 'text-muted',
  defective: 'text-danger',
  scheduled_maintenance: 'text-warning',
};

const EQUIPMENT_TYPES = Object.keys(EQUIPMENT_TYPE_LABELS) as EquipmentType[];
const EQUIPMENT_STATUSES = Object.keys(EQUIPMENT_STATUS_LABELS) as EquipmentStatus[];

interface NewEquipmentForm {
  type: EquipmentType;
  brand: string;
  model: string;
  serial_number: string;
  installation_date: string;
  status: EquipmentStatus;
  notes: string;
}

const EMPTY_FORM: NewEquipmentForm = {
  type: 'transformer',
  brand: '',
  model: '',
  serial_number: '',
  installation_date: '',
  status: 'active',
  notes: '',
};

const EquipmentPanel: React.FC<EquipmentPanelProps> = ({ pole }) => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewEquipmentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEquipment({ pole_id: pole.id });
      setEquipment(res.data.equipment);
    } catch {
      setError('Erro ao carregar equipamentos');
    } finally {
      setLoading(false);
    }
  }, [pole.id]);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createEquipment({
        pole_id: pole.id,
        tenant_id: pole.tenant_id,
        type: form.type,
        brand: form.brand || undefined,
        model: form.model || undefined,
        serial_number: form.serial_number || undefined,
        installation_date: form.installation_date || undefined,
        status: form.status,
        notes: form.notes || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadEquipment();
    } catch {
      setError('Erro ao cadastrar equipamento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Remover este equipamento?')) return;
    try {
      await api.deleteEquipment(id);
      setEquipment(prev => prev.filter(e => e.id !== id));
    } catch {
      setError('Erro ao remover equipamento');
    }
  };

  return (
    <div className="equipment-panel">
      <div className="card">
        <div className="card-header">
          <Wrench size={18} className="text-accent" />
          <h3>Equipamentos</h3>
          <span className="badge ml-auto">{equipment.length}</span>
        </div>

        {error && (
          <div className="alert alert-danger flex gap-2 items-center">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div className="loading-spinner-sm">Carregando...</div>
        ) : (
          <div className="equipment-list">
            {equipment.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">
                Nenhum equipamento cadastrado neste poste.
              </p>
            ) : (
              equipment.map(eq => (
                <div key={eq.id} className="equipment-item card mb-2">
                  <div
                    className="equipment-item-header flex-between cursor-pointer"
                    onClick={() => setExpandedId(expandedId === eq.id ? null : eq.id)}
                    role="button"
                    aria-expanded={expandedId === eq.id}
                  >
                    <div>
                      <span className="font-semibold text-sm">{EQUIPMENT_TYPE_LABELS[eq.type]}</span>
                      {eq.brand && <span className="text-muted text-xs ml-2">— {eq.brand}</span>}
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`text-xs ${STATUS_COLORS[eq.status]}`}>
                        {EQUIPMENT_STATUS_LABELS[eq.status]}
                      </span>
                      <button
                        className="btn-icon text-danger"
                        onClick={e => { e.stopPropagation(); handleDelete(eq.id); }}
                        title="Remover equipamento"
                        aria-label="Remover equipamento"
                      >
                        <Trash2 size={13} />
                      </button>
                      {expandedId === eq.id
                        ? <ChevronUp size={13} />
                        : <ChevronDown size={13} />}
                    </div>
                  </div>

                  {expandedId === eq.id && (
                    <div className="equipment-item-details mt-2 pt-2 border-t border-light/10 text-xs">
                      {eq.model && <div><strong>Modelo:</strong> {eq.model}</div>}
                      {eq.serial_number && <div><strong>Série:</strong> {eq.serial_number}</div>}
                      {eq.installation_date && (
                        <div><strong>Instalação:</strong> {eq.installation_date}</div>
                      )}
                      {eq.notes && <div className="mt-1 text-muted">{eq.notes}</div>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <button
          className="btn btn-outline btn-sm w-full mt-2"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={13} /> Adicionar Equipamento
        </button>

        {showForm && (
          <form className="equipment-form mt-3 pt-3 border-t border-light/10" onSubmit={handleAddEquipment}>
            <div className="form-group">
              <label className="form-label">Tipo *</label>
              <select
                className="glass-input"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as EquipmentType }))}
                required
              >
                {EQUIPMENT_TYPES.map(t => (
                  <option key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Fabricante</label>
              <input
                className="glass-input"
                type="text"
                maxLength={100}
                placeholder="Ex: Eletrobras, ABB, Siemens"
                value={form.brand}
                onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Modelo</label>
              <input
                className="glass-input"
                type="text"
                maxLength={100}
                placeholder="Ex: TR-15kVA, RF-630A"
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Número de Série</label>
              <input
                className="glass-input"
                type="text"
                maxLength={100}
                placeholder="Ex: SN-20250001"
                value={form.serial_number}
                onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data de Instalação</label>
              <input
                className="glass-input"
                type="date"
                value={form.installation_date}
                onChange={e => setForm(f => ({ ...f, installation_date: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                className="glass-input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as EquipmentStatus }))}
              >
                {EQUIPMENT_STATUSES.map(s => (
                  <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea
                className="glass-input"
                maxLength={500}
                rows={2}
                placeholder="Observações técnicas..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className="btn btn-primary btn-sm flex-1"
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EquipmentPanel;
