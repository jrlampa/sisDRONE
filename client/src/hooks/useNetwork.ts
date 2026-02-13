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
    };
    init();
  }, [fetchPoles, fetchStats]);

  return {
    poles, setPoles, stats, fetchStats, fetchPoles,
    activeTenantId, setActiveTenantId,
    currentUser, setCurrentUser,
    isOnline, isSyncing
  };
}
