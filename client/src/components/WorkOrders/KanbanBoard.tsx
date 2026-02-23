import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import type { WorkOrder, User } from '../../types';
import { Clock, AlertTriangle, CheckCircle, User as UserIcon, Ban, Trash2 } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';

interface KanbanBoardProps {
  currentUser: User | null;
  users: User[];
}

interface WorkOrderStats {
  total: number;
  OPEN: number;
  IN_PROGRESS: number;
  BLOCKED: number;
  COMPLETED: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'border-l-4 border-red-500',
  HIGH: 'border-l-4 border-orange-500',
  MED: 'border-l-4 border-yellow-500',
};

interface TaskCardProps {
  task: WorkOrder;
  assignee?: User;
  onDelete: (id: number) => void;
}

const TaskCard: React.FC<TaskCardProps> = React.memo(({ task, assignee, onDelete }) => {
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(task.id);
  }, [task.id, onDelete]);

  return (
    <div
      className={`bg-gray-800/80 p-3 rounded shadow-md cursor-pointer hover:bg-gray-800 transition-colors ${PRIORITY_COLORS[task.priority] || 'border-l-4 border-blue-500'}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id.toString())}
    >
      <div className="flex justify-between items-start mb-1">
        <h4 className="font-semibold text-sm flex-1 pr-2">{task.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] bg-white/10 px-1 rounded">{task.priority}</span>
          <button
            onClick={handleDeleteClick}
            className="text-gray-500 hover:text-red-400 transition-colors"
            title="Remover ordem de serviço"
            aria-label="Remover ordem de serviço"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 line-clamp-2 mb-2">{task.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <UserIcon size={12} />
          <span>{assignee?.username || 'Não atribuído'}</span>
        </div>
        <span>{new Date(task.created_at).toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  );
});

const KanbanBoard: React.FC<KanbanBoardProps> = ({ users }) => {
  const [tasks, setTasks] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<WorkOrderStats | null>(null);
  const { confirmState, confirm, handleAnswer } = useConfirm();

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getWorkOrderStats();
      setStats(res.data);
    } catch (err) {
      console.error('Falha ao carregar estatísticas de ordens de serviço', err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.getWorkOrders();
      setTasks(res.data);
    } catch (error) {
      console.error('Falha ao carregar ordens de serviço', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [fetchTasks, fetchStats]);

  const handleStatusChange = useCallback(async (taskId: number, newStatus: WorkOrder['status']) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.updateWorkOrder(taskId, { status: newStatus });
    } catch (error) {
      console.error('Falha ao atualizar status', error);
      fetchTasks();
    }
  }, [fetchTasks]);

  const handleDelete = useCallback(async (taskId: number) => {
    const ok = await confirm({
      title: 'Remover Ordem de Serviço',
      message: 'Deseja remover permanentemente esta ordem de serviço?',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await api.deleteWorkOrder(taskId);
      fetchStats();
    } catch (error) {
      console.error('Falha ao excluir ordem de serviço', error);
      fetchTasks();
    }
  }, [fetchTasks, fetchStats]);

  const Column = useCallback(({ status, title, icon: Icon }: { status: string, title: string, icon: React.ElementType }) => (
    <div className="flex-1 min-w-[300px] bg-white/5 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold flex items-center gap-2">
          <Icon size={18} /> {title}
        </h3>
        <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
          {tasks.filter(t => t.status === status).length}
        </span>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-200px)]">
        {tasks.filter(t => t.status === status).map(task => (
          <TaskCard
            key={task.id}
            task={task}
            assignee={users.find(u => u.id === task.assignee_id)}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  ), [tasks, users, handleDelete]);

  const handleDrop = useCallback((e: React.DragEvent, status: WorkOrder['status']) => {
    const taskId = Number(e.dataTransfer.getData('taskId'));
    if (taskId) handleStatusChange(taskId, status);
  }, [handleStatusChange]);

  if (loading) return <div className="p-10 text-center">Carregando tarefas...</div>;

  return (
    <>
      <ConfirmDialog state={confirmState} onAnswer={handleAnswer} />
      {stats && (
        <div className="flex gap-6 px-4 pt-3 pb-1 text-sm border-b border-white/10 text-muted">
          <span className="font-bold text-light">Total: {stats.total}</span>
          <span className="text-blue-400">● A Fazer: {stats.OPEN}</span>
          <span className="text-yellow-400">● Em Andamento: {stats.IN_PROGRESS}</span>
          <span className="text-red-400">● Bloqueado: {stats.BLOCKED}</span>
          <span className="text-green-400">● Concluído: {stats.COMPLETED}</span>
        </div>
      )}
      <div className="flex gap-4 p-4 h-full overflow-x-auto">
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'OPEN')} className="flex-1">
          <Column status="OPEN" title="A Fazer" icon={Clock} />
        </div>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'IN_PROGRESS')} className="flex-1">
          <Column status="IN_PROGRESS" title="Em Andamento" icon={AlertTriangle} />
        </div>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'BLOCKED')} className="flex-1">
          <Column status="BLOCKED" title="Bloqueado" icon={Ban} />
        </div>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'COMPLETED')} className="flex-1">
          <Column status="COMPLETED" title="Concluído" icon={CheckCircle} />
        </div>
      </div>
    </>
  );
};

export default KanbanBoard;
