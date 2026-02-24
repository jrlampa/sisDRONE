import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { api } from '../services/api';
import type { PoleSummary } from '../types';
import type { Prediction } from '../types/prediction';

export interface PoleMaintenancePlan {
  id: number;
  pole_id: number;
  plan_text: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED';
  created_at: string;
  estimated_cost?: number;
}

interface UsePoleSummaryReturn {
  summary: PoleSummary | null;
  prediction: Prediction | null;
  history: PoleMaintenancePlan[];
  maintenancePlan: PoleMaintenancePlan | null;
  setMaintenancePlan: Dispatch<SetStateAction<PoleMaintenancePlan | null>>;
  setHistory: Dispatch<SetStateAction<PoleMaintenancePlan[]>>;
}

/**
 * Loads summary, prediction and maintenance history for a given pole.
 * Resets state and re-fetches whenever poleId changes.
 * Respects component unmount to avoid stale state updates.
 */
export function usePoleSummary(poleId: number): UsePoleSummaryReturn {
  const [summary, setSummary] = useState<PoleSummary | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<PoleMaintenancePlan[]>([]);
  const [maintenancePlan, setMaintenancePlan] = useState<PoleMaintenancePlan | null>(null);

  useEffect(() => {
    let cancelled = false;

    setSummary(null);
    setPrediction(null);
    setHistory([]);
    setMaintenancePlan(null);

    // Summary is a non-critical enhancement; log at debug level only
    api.getPoleSummary(poleId)
      .then(res => { if (!cancelled) setSummary(res.data); })
      .catch(e => console.debug('Falha ao carregar resumo do poste (não crítico):', e));

    api.getPrediction(poleId)
      .then(res => { if (!cancelled) setPrediction(res.data); })
      .catch(e => console.error('Falha ao carregar previsão', e));

    api.getMaintenancePlans(poleId)
      .then(res => {
        if (cancelled) return;
        const plans: PoleMaintenancePlan[] = res.data ?? [];
        setHistory(plans);
        if (plans.length > 0 && plans[0].status === 'PENDING') {
          setMaintenancePlan(plans[0]);
        }
      })
      .catch(e => console.error('Falha ao carregar histórico', e));

    return () => { cancelled = true; };
  }, [poleId]);

  return { summary, prediction, history, maintenancePlan, setMaintenancePlan, setHistory };
}
