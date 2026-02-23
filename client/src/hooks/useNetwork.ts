import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Pole, Stats, User } from '../types';

import { getQueue, removeFromQueue } from '../utils/offlineQueue';
import axios from 'axios';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Pole[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<number>(1);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const fetchPoles = useCallback(async () => {
    try {
      const res = await api.getPoles(activeTenantId);
      // Suporta resposta paginada { poles, total, ... } ou array legado
      const data = res.data;
      setPoles(Array.isArray(data) ? data : (data.poles ?? []));
    } catch (error) {
      console.error('Failed to fetch poles:', error);
    }
  }, [activeTenantId]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.getAlerts(activeTenantId);
      setAlerts(res.data.poles ?? []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  }, [activeTenantId]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getStats();
      const data = res.data;
      // Derive Stats from the DashboardData response
      const critical = data.conditionStats?.find((c: { condition: string }) => c.condition === 'Crítico')?.count || 0;
      const healthy = data.conditionStats?.find((c: { condition: string }) => c.condition === 'Saudável')?.count || 0;
      setStats({ total: data.totalPoles || 0, critical, healthy });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    const queue = await getQueue();

    for (const req of queue) {
      try {
        console.log('[Sync] Retrying:', req.url);
        await axios({
          url: req.url,
          method: req.method,
          data: req.data,
          headers: { 'x-user-role': localStorage.getItem('sisdrone_mock_role') || 'VIEWER' }
        });
        if (req.id) await removeFromQueue(req.id);
      } catch (err) {
        console.error('[Sync] Failed:', err);
      }
    }

    setIsSyncing(false);
    fetchPoles(); // Refresh data after sync
    fetchStats();
  }, [fetchPoles, fetchStats]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncQueue(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    const initSync = async () => {
      if (navigator.onLine) {
        await syncQueue();
      }
    };
    initSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  useEffect(() => {
    const init = async () => {
      await fetchPoles();
      await fetchStats();
      await fetchAlerts();
    };
    init();
  }, [fetchPoles, fetchStats, fetchAlerts]);

  return {
    poles, setPoles, stats, fetchStats, fetchPoles,
    alerts, fetchAlerts,
    activeTenantId, setActiveTenantId,
    currentUser, setCurrentUser,
    isOnline, isSyncing
  };
}
