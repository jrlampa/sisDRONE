import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { DashboardData } from '../types';

interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getStats()
      .then(res => {
        if (!cancelled) setData(res.data);
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Falha ao carregar estatísticas do painel:', err);
          setError('Falha ao carregar dados do painel');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadCounter]);

  return { data, loading, error, reload: () => setReloadCounter(c => c + 1) };
}
