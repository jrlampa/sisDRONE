import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { api } from '../../services/api';
import type { User, Pole, WorkOrder } from '../../types';

interface WorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  pole: Pole;
  users: User[];
  onSuccess: () => void;
}

const WorkOrderModal: React.FC<WorkOrderModalProps> = ({ isOpen, onClose, pole, users, onSuccess }) => {
  const [title, setTitle] = useState(`Manutenção: ${pole.name}`);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MED' | 'HIGH' | 'CRITICAL'>('MED');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createWorkOrder({
        title,
        description: `${description}\n\n[Asset: ${pole.name} (${pole.id})]`,
        priority,
        pole_id: pole.id,
        assignee_id: assigneeId ? Number(assigneeId) : undefined,
        status: 'OPEN'
      });
      alert('Ordem de Serviço criada com sucesso!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating WO', error);
      alert('Erro ao criar OS.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-xl shadow-2xl w-full max-w-md border border-white/10 animate-fade-in">
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h3 className="font-bold text-lg text-white">Nova Ordem de Serviço</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="wo-title" className="block text-sm text-gray-400 mb-1">Título</label>
            <input
              id="wo-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded p-2 text-white"
              required
              title="Título da Ordem de Serviço"
            />
          </div>

          <div>
            <label htmlFor="wo-priority" className="block text-sm text-gray-400 mb-1">Prioridade</label>
            <select
              id="wo-priority"
              value={priority}
              onChange={e => setPriority(e.target.value as WorkOrder['priority'])}
              className="w-full bg-black/20 border border-white/10 rounded p-2 text-white"
              title="Prioridade"
            >
              <option value="LOW">Baixa</option>
              <option value="MED">Média</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </select>
          </div>

          <div>
            <label htmlFor="wo-assignee" className="block text-sm text-gray-400 mb-1">Atribuir a</label>
            <select
              id="wo-assignee"
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-black/20 border border-white/10 rounded p-2 text-white"
              title="Atribuir a"
            >
              <option value="">-- Selecione --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="wo-desc" className="block text-sm text-gray-400 mb-1">Descrição</label>
            <textarea
              id="wo-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-black/20 border border-white/10 rounded p-2 text-white resize-none"
              placeholder="Detalhes do problema..."
              title="Descrição"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-gray-300 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={16} />
              {loading ? 'Salvando...' : 'Criar OS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkOrderModal;
