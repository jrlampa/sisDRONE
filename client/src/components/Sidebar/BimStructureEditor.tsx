import React, { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, Building2, Loader } from 'lucide-react';
import { api } from '../../services/api';
import type { Pole } from '../../types';

interface BimStructure {
  [key: string]: string | number | boolean;
  ifc_class: string;
  height_m: number;
  material: string;
  cross_arm_count: number;
  transformer: boolean;
  insulator_count: number;
  conductor_lines: number;
  ground_wire: boolean;
  elevation_m: number;
  notes: string;
}

const DEFAULT_STRUCTURE: BimStructure = {
  ifc_class: 'IfcTelecomDevice',
  height_m: 11,
  material: 'concreto',
  cross_arm_count: 1,
  transformer: false,
  insulator_count: 3,
  conductor_lines: 3,
  ground_wire: false,
  elevation_m: 0,
  notes: '',
};

const IFC_CLASSES = ['IfcTelecomDevice', 'IfcColumn', 'IfcPile'];

interface BimStructureEditorProps {
  pole: Pole;
}

const BimStructureEditor: React.FC<BimStructureEditorProps> = ({ pole }) => {
  const [structure, setStructure] = useState<BimStructure>(DEFAULT_STRUCTURE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStructure = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getBimStructure(pole.id);
      setStructure({ ...DEFAULT_STRUCTURE, ...res.data.structure });
    } catch {
      setStructure(DEFAULT_STRUCTURE);
    } finally {
      setLoading(false);
    }
  }, [pole.id]);

  useEffect(() => {
    loadStructure();
    setMessage(null);
  }, [loadStructure]);

  const handleChange = (field: keyof BimStructure, value: unknown) => {
    setStructure(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateBimStructure(pole.id, structure as Record<string, unknown>);
      setMessage({ type: 'success', text: 'Estrutura BIM salva com sucesso!' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar estrutura BIM.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="spin text-accent" size={24} />
        <span className="ml-2 text-muted">Carregando dados BIM...</span>
      </div>
    );
  }

  return (
    <div className="bim-editor animate-fade-in">
      <div className="card mb-3">
        <div className="card-header">
          <Building2 size={18} className="text-accent" />
          <h3>Estrutura IFC-lite — {pole.name}</h3>
        </div>

        <div className="form-grid">
          <label className="form-label">
            <span>Classe IFC</span>
            <select
              value={structure.ifc_class}
              onChange={e => handleChange('ifc_class', e.target.value)}
              className="glass-input"
            >
              {IFC_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="form-label">
            <span>Altura (m)</span>
            <input
              type="number" min={0} max={100} step={0.5}
              value={structure.height_m}
              onChange={e => handleChange('height_m', parseFloat(e.target.value) || 0)}
              className="glass-input"
            />
          </label>

          <label className="form-label">
            <span>Material</span>
            <input
              type="text" maxLength={50}
              value={structure.material}
              onChange={e => handleChange('material', e.target.value)}
              className="glass-input"
              placeholder="ex: concreto"
            />
          </label>

          <label className="form-label">
            <span>Cruzetas</span>
            <input
              type="number" min={0} max={20} step={1}
              value={structure.cross_arm_count}
              onChange={e => handleChange('cross_arm_count', parseInt(e.target.value, 10) || 0)}
              className="glass-input"
            />
          </label>

          <label className="form-label">
            <span>Isoladores</span>
            <input
              type="number" min={0} max={100} step={1}
              value={structure.insulator_count}
              onChange={e => handleChange('insulator_count', parseInt(e.target.value, 10) || 0)}
              className="glass-input"
            />
          </label>

          <label className="form-label">
            <span>Ramais (fios)</span>
            <input
              type="number" min={0} max={20} step={1}
              value={structure.conductor_lines}
              onChange={e => handleChange('conductor_lines', parseInt(e.target.value, 10) || 0)}
              className="glass-input"
            />
          </label>

          <label className="form-label">
            <span>Elevação do Terreno (m)</span>
            <input
              type="number" min={-500} max={9000} step={1}
              value={structure.elevation_m}
              onChange={e => handleChange('elevation_m', parseFloat(e.target.value) || 0)}
              className="glass-input"
            />
          </label>
        </div>

        <div className="flex gap-4 mt-3">
          <label className="checkbox-label flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={structure.transformer}
              onChange={e => handleChange('transformer', e.target.checked)}
            />
            <span className="text-sm">Transformador</span>
          </label>
          <label className="checkbox-label flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={structure.ground_wire}
              onChange={e => handleChange('ground_wire', e.target.checked)}
            />
            <span className="text-sm">Cabo Guarda</span>
          </label>
        </div>

        <label className="form-label mt-3">
          <span>Observações</span>
          <textarea
            value={structure.notes}
            onChange={e => handleChange('notes', e.target.value)}
            className="glass-input"
            rows={2}
            maxLength={1000}
            placeholder="Notas técnicas sobre a estrutura..."
          />
        </label>

        {message && (
          <div className={`mt-2 text-sm px-3 py-2 rounded ${message.type === 'success' ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar BIM'}
          </button>
          <button className="btn btn-outline" onClick={loadStructure} title="Recarregar">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BimStructureEditor;
