import React, { useCallback } from 'react';
import type { WorkOrder, User } from '../../types';
import { Clock, AlertTriangle, CheckCircle, User as UserIcon, Ban, Trash2 } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { useWorkOrders } from '../../hooks/useWorkOrders';

interface KanbanBoardProps {
  currentUser: User | null;
  users: User[];
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

interface ColumnProps {
  status: string;
  title: string;
  icon: React.ElementType;
  tasks: WorkOrder[];
  users: User[];
  onDelete: (id: number) => void;
}

const Column: React.FC<ColumnProps> = ({ status, title, icon: Icon, tasks, users, onDelete }) => (
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
          onDelete={onDelete}
        />
      ))}
    </div>
  </div>
);

const KanbanBoard: React.FC<KanbanBoardProps> = ({ users }) => {
  const { tasks, stats, loading, handleStatusChange, handleDeleteTask } = useWorkOrders();
  const { confirmState, confirm, handleAnswer } = useConfirm();

  const handleDelete = useCallback(async (taskId: number) => {
    const ok = await confirm({
      title: 'Remover Ordem de Serviço',
      message: 'Deseja remover permanentemente esta ordem de serviço?',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    await handleDeleteTask(taskId);
  }, [confirm, handleDeleteTask]);

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
          <Column status="OPEN" title="A Fazer" icon={Clock} tasks={tasks} users={users} onDelete={handleDelete} />
        </div>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'IN_PROGRESS')} className="flex-1">
          <Column status="IN_PROGRESS" title="Em Andamento" icon={AlertTriangle} tasks={tasks} users={users} onDelete={handleDelete} />
        </div>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'BLOCKED')} className="flex-1">
          <Column status="BLOCKED" title="Bloqueado" icon={Ban} tasks={tasks} users={users} onDelete={handleDelete} />
        </div>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'COMPLETED')} className="flex-1">
          <Column status="COMPLETED" title="Concluído" icon={CheckCircle} tasks={tasks} users={users} onDelete={handleDelete} />
        </div>
      </div>
    </>
  );
};

export default KanbanBoard;
