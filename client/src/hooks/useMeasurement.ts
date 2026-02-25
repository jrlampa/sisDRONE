/**
 * useMeasurement.ts — Hook de Medição Geoespacial (Phase 52)
 *
 * Gerencia o estado da ferramenta de régua digital no mapa Leaflet.
 * Permite ao usuário clicar em pontos no mapa e obter comprimentos de segmentos
 * e a distância total em metros e quilômetros via API Haversine do backend.
 *
 * Uso:
 *   const { active, points, result, startMeasuring, addPoint, clearMeasurement, error } = useMeasurement();
 */
import { useState, useCallback, useRef } from 'react';
import { measureDistance, type MeasurementResult } from '../services/api';

export interface MeasurementPoint {
  lat: number;
  lng: number;
}

export interface UseMeasurementReturn {
  /** Indica se o modo de medição está ativo */
  active: boolean;
  /** Lista de pontos coletados pelo usuário */
  points: MeasurementPoint[];
  /** Resultado calculado pela API (null se ainda não calculado) */
  result: MeasurementResult | null;
  /** Mensagem de erro, se houver */
  error: string | null;
  /** Indica que o cálculo está em andamento */
  loading: boolean;
  /** Ativa o modo de medição */
  startMeasuring: () => void;
  /** Adiciona um ponto e solicita cálculo ao backend quando há ≥2 pontos */
  addPoint: (lat: number, lng: number) => Promise<void>;
  /** Limpa todos os pontos e o resultado */
  clearMeasurement: () => void;
  /** Desativa o modo de medição sem limpar os pontos */
  stopMeasuring: () => void;
}

/**
 * Hook de régua digital para o mapa sisDRONE.
 * Integra com POST /api/geo/measure para cálculo server-side com Haversine.
 *
 * Usa um ref para evitar closures stale no callback `addPoint`, garantindo
 * que chamadas rápidas consecutivas sempre lêem a lista mais recente de pontos.
 */
export function useMeasurement(): UseMeasurementReturn {
  const [active, setActive]   = useState(false);
  const [points, setPoints]   = useState<MeasurementPoint[]>([]);
  const [result, setResult]   = useState<MeasurementResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Ref espelho de points — evita closure stale em addPoint (dep-array vazio) */
  const pointsRef = useRef<MeasurementPoint[]>([]);

  const startMeasuring = useCallback(() => {
    setActive(true);
    setPoints([]);
    pointsRef.current = [];
    setResult(null);
    setError(null);
  }, []);

  const stopMeasuring = useCallback(() => {
    setActive(false);
  }, []);

  const clearMeasurement = useCallback(() => {
    setActive(false);
    setPoints([]);
    pointsRef.current = [];
    setResult(null);
    setError(null);
  }, []);

  /** addPoint usa pointsRef para evitar leitura stale de `points` entre renders */
  const addPoint = useCallback(async (lat: number, lng: number) => {
    const newPoints = [...pointsRef.current, { lat, lng }];
    pointsRef.current = newPoints;
    setPoints(newPoints);
    setError(null);

    // Só calcula quando há pelo menos 2 pontos
    if (newPoints.length < 2) return;

    setLoading(true);
    try {
      const apiPoints = newPoints.map(p => [p.lat, p.lng] as [number, number]);
      const data = await measureDistance(apiPoints);
      setResult(data);
    } catch {
      setError('Falha ao calcular distância. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []); // dep-array vazio — lê sempre de pointsRef (ref estável)

  return { active, points, result, error, loading, startMeasuring, addPoint, clearMeasurement, stopMeasuring };
}
