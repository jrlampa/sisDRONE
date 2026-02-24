import React from 'react';
import { Loader, Save } from 'lucide-react';

/** Mapeamento de status (interno) → rótulo em pt-BR */
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  inspected: 'Inspecionado',
  maintenance: 'Manutenção',
  critical: 'Crítico',
  ok: 'OK',
};

interface PoleEditFormProps {
  editName: string;
  editMaterial: string;
  editStatus: string;
  validStatuses: readonly string[];
  savingEdit: boolean;
  onChangeName: (v: string) => void;
  onChangeMaterial: (v: string) => void;
  onChangeStatus: (v: string) => void;
  onSave: () => void;
}

/**
 * Formulário inline de edição de poste.
 * Extraído de PoleDetails.tsx — Single Responsibility Principle.
 */
const PoleEditForm: React.FC<PoleEditFormProps> = ({
  editName,
  editMaterial,
  editStatus,
  validStatuses,
  savingEdit,
  onChangeName,
  onChangeMaterial,
  onChangeStatus,
  onSave,
}) => (
  <div className="edit-form mt-2">
    <div className="form-group mb-2">
      <label className="text-xs text-muted">Nome</label>
      <input
        className="glass-input w-full mt-1"
        value={editName}
        onChange={e => onChangeName(e.target.value.slice(0, 100))}
        placeholder="Nome do poste"
      />
    </div>
    <div className="form-group mb-2">
      <label className="text-xs text-muted">Material</label>
      <input
        className="glass-input w-full mt-1"
        value={editMaterial}
        onChange={e => onChangeMaterial(e.target.value.slice(0, 50))}
        placeholder="Concreto, Madeira, Metal..."
      />
    </div>
    <div className="form-group mb-2">
      <label className="text-xs text-muted">Status</label>
      <select
        className="glass-input w-full mt-1"
        value={editStatus}
        onChange={e => onChangeStatus(e.target.value)}
      >
        {validStatuses.map(s => (
          <option key={s} value={s}>
            {STATUS_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </div>
    <button
      className="btn btn-primary btn-full mt-1"
      onClick={onSave}
      disabled={savingEdit || !editName.trim()}
    >
      {savingEdit ? <Loader size={14} className="spin" /> : <Save size={14} />}
      {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
    </button>
  </div>
);

export default PoleEditForm;
