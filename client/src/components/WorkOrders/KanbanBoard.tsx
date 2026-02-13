import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { WorkOrder, User } from '../../types';
import { Clock, AlertTriangle, CheckCircle, User as UserIcon } from 'lucide-react';

interface KanbanBoardProps {
  currentUser: User | null;
  users: User[];
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ users }) => {
  const [tasks, setTasks] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.getWorkOrders();
      setTasks(res.data);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: WorkOrder['status']) => {
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.updateWorkOrder(taskId, { status: newStatus });
    } catch (error) {
      console.error('Failed to update status', error);
      fetchTasks(); // Revert on error
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL': return 'border-l-4 border-red-500';
      case 'HIGH': return 'border-l-4 border-orange-500';
      case 'MED': return 'border-l-4 border-yellow-500';
      default: return 'border-l-4 border-blue-500';
    }
  };

  const Column = ({ status, title, icon: Icon }: { status: string, title: string, icon: any }) => (
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
        {tasks.filter(t => t.status === status).map(task => {
          const assignee = users.find(u => u.id === task.assignee_id);
          return (
            <div
              key={task.id}
              className={`bg-gray-800/80 p-3 rounded shadow-md cursor-pointer hover:bg-gray-800 transition-colors ${getPriorityColor(task.priority)}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('taskId', task.id.toString())}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-semibold text-sm">{task.title}</h4>
                <span className="text-[10px] bg-white/10 px-1 rounded">{task.priority}</span>
              </div>
              <p className="text-xs text-gray-400 line-clamp-2 mb-2">{task.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <UserIcon size={12} />
                  <span>{assignee?.username || 'Unassigned'}</span>
                </div>
                <span>{new Date(task.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const handleDrop = (e: React.DragEvent, status: any) => {
    const taskId = Number(e.dataTransfer.getData('taskId'));
    if (taskId) handleStatusChange(taskId, status);
  };

  if (loading) return <div className="p-10 text-center">Carregando tarefas...</div>;

  return (
    <div className="flex gap-4 p-4 h-full overflow-x-auto">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, 'OPEN')}
        className="flex-1"
      >
        <Column status="OPEN" title="A Fazer" icon={Clock} />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, 'IN_PROGRESS')}
        className="flex-1"
      >
        <Column status="IN_PROGRESS" title="Em Andamento" icon={AlertTriangle} />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, 'COMPLETED')}
        className="flex-1"
      >
        <Column status="COMPLETED" title="Concluído" icon={CheckCircle} />
      </div>
    </div>
  );
};

export default KanbanBoard;
