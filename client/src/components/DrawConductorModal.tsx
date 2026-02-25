/**
 * DrawConductorModal — Phase 58
 * Modal para confirmar e configurar a criação de um condutor
 * após o usuário selecionar dois postes no mapa.
 */
import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { api } from '../services/api';
import type { Pole } from '../types';

const NETWORK_TYPE_LABELS: Record<string, string> = {
  MT: 'Média Tensão (MT)',
  BT: 'Baixa Tensão (BT)',
  ramal: 'Ramal de Ligação',
};

interface DrawConductorModalProps {
  fromPole: Pole;
  toPole: Pole;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  tenantId: number;
}

const DrawConductorModal: React.FC<DrawConductorModalProps> = ({
  fromPole, toPole, open, onClose, onCreated, tenantId,
}) => {
  const [networkType, setNetworkType] = useState<'MT' | 'BT' | 'ramal'>('BT');
  const [cableType, setCableType] = useState('');
  const [voltageKv, setVoltageKv] = useState('');
  const [lengthM, setLengthM] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createConductor({
        tenant_id: tenantId,
        pole_from: fromPole.id,
        pole_to: toPole.id,
        network_type: networkType,
        cable_type: cableType || undefined,
        voltage_kv: voltageKv ? parseFloat(voltageKv) : undefined,
        length_m: lengthM ? parseFloat(lengthM) : undefined,
      });
      onCreated();
      onClose();
    } catch {
      setError('Falha ao criar condutor. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Criar Condutor"
      onClick={onClose}
    >
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <Zap size={20} className="text-accent" />
          <h2 className="modal-title">Criar Condutor</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: '0.9rem' }}>
          <span className="status-badge saudavel">{fromPole.name || `Poste ${fromPole.id}`}</span>
          <span>→</span>
          <span className="status-badge saudavel">{toPole.name || `Poste ${toPole.id}`}</span>
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="form-label">
            Tipo de Rede *
            <select
              value={networkType}
              onChange={e => setNetworkType(e.target.value as 'MT' | 'BT' | 'ramal')}
              className="glass-input"
              required
            >
              {Object.entries(NETWORK_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>

          <label className="form-label">
            Tipo de Cabo
            <input
              type="text"
              value={cableType}
              onChange={e => setCableType(e.target.value.slice(0, 100))}
              className="glass-input"
              placeholder="ex: XLPE 150mm², CA 35mm²"
            />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <label className="form-label" style={{ flex: 1 }}>
              Tensão (kV)
              <input
                type="number"
                value={voltageKv}
                onChange={e => setVoltageKv(e.target.value)}
                className="glass-input"
                min="0" max="500" step="0.1"
                placeholder="13.8"
              />
            </label>
            <label className="form-label" style={{ flex: 1 }}>
              Comprimento (m)
              <input
                type="number"
                value={lengthM}
                onChange={e => setLengthM(e.target.value)}
                className="glass-input"
                min="0" max="5000" step="0.1"
                placeholder="auto"
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Criando...' : 'Criar Condutor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DrawConductorModal;
