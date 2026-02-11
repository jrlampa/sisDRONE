import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Pole, Stats, User } from '../types';

export function useNetwork() {
  const [poles, setPoles] = useState<Pole[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<number>(1);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const fetchPoles = useCallback(async () => {
    try {
      const res = await api.getPoles();
      // Filter by tenant client-side for now
      setPoles(res.data.filter((p: Pole) => p.tenant_id === activeTenantId));
    } catch (error) {
      console.error('Failed to fetch poles:', error);
    }
  }, [activeTenantId]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchPoles();
    fetchStats();
  }, [fetchPoles, fetchStats]);

  return {
    poles, setPoles, stats, fetchStats, fetchPoles,
    activeTenantId, setActiveTenantId,
    currentUser, setCurrentUser
  };
}
