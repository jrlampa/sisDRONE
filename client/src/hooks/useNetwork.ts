import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Pole, Stats } from '../types';

export const useNetwork = () => {
  const [poles, setPoles] = useState<Pole[]>([]);
  const [stats, setStats] = useState<Stats>({ totalPoles: 0, totalInspections: 0, activeAlerts: 0, status: '...' });
  const [loading, setLoading] = useState(true);

  const fetchPoles = useCallback(async () => {
    try {
      const res = await api.getPoles();
      setPoles(res.data);
    } catch (err) {
      console.error('Error fetching poles', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPoles(), fetchStats()]);
      setLoading(false);
    };
    init();
  }, [fetchPoles, fetchStats]);

  return { poles, setPoles, stats, fetchStats, fetchPoles, loading };
};
