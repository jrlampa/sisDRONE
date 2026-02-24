import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { WorkOrder } from '../types';

interface WorkOrderStats {
  total: number;
  OPEN: number;
  IN_PROGRESS: number;
  BLOCKED: number;
  COMPLETED: number;
}

interface UseWorkOrdersReturn {
  tasks: WorkOrder[];
  stats: WorkOrderStats | null;
  loading: boolean;
  fetchTasks: () => Promise<void>;
  fetchStats: () => Promise<void>;
  handleStatusChange: (taskId: number, newStatus: WorkOrder['status']) => Promise<void>;
  handleDeleteTask: (taskId: number) => Promise<boolean>;
}

export function useWorkOrders(): UseWorkOrdersReturn {
  const [tasks, setTasks] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<WorkOrderStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getWorkOrderStats();
      setStats(res.data);
    } catch (error) {
      console.error('Falha ao carregar estatísticas de ordens de serviço:', error);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.getWorkOrders();
      setTasks(res.data.work_orders);
    } catch (error) {
      console.error('Falha ao carregar ordens de serviço:', error);
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
      console.error('Falha ao atualizar status:', error);
      fetchTasks();
    }
  }, [fetchTasks]);

  const handleDeleteTask = useCallback(async (taskId: number): Promise<boolean> => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await api.deleteWorkOrder(taskId);
      await fetchStats();
      return true;
    } catch (error) {
      console.error('Falha ao excluir ordem de serviço:', error);
      await fetchTasks();
      return false;
    }
  }, [fetchTasks, fetchStats]);

  return { tasks, stats, loading, fetchTasks, fetchStats, handleStatusChange, handleDeleteTask };
}
