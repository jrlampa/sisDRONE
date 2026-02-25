/**
 * geoMeasure.ts — API de Medição Geoespacial (Phase 52)
 *
 * POST /api/geo/measure
 *   Recebe um array de pontos geográficos e retorna comprimentos de segmentos
 *   e distância total via fórmula de Haversine.
 *
 * Body JSON: { points: [[lat, lng], [lat, lng], ...] }
 *   - Mínimo 2 pontos, máximo 100 pontos
 *   - lat: número entre -90 e 90
 *   - lng: número entre -180 e 180
 *
 * Resposta:
 *   { segments: [{ from, to, distance_m }], total_m, total_km }
 */
import { Router, Request, Response } from 'express';
import { haversineMeters } from '../utils/geo';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const MIN_POINTS = 2;
const MAX_POINTS = 100;

/**
 * POST /api/geo/measure
 * Calcula distâncias entre waypoints sequenciais usando Haversine.
 */
router.post('/measure', rateLimit(60, 60_000), (req: Request, res: Response) => {
  const { points } = req.body ?? {};

  if (!Array.isArray(points) || points.length < MIN_POINTS) {
    return res.status(400).json({
      error: `São necessários pelo menos ${MIN_POINTS} pontos.`,
    });
  }

  if (points.length > MAX_POINTS) {
    return res.status(400).json({
      error: `Máximo de ${MAX_POINTS} pontos por requisição.`,
    });
  }

  // Valida cada ponto
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!Array.isArray(p) || p.length < 2) {
      return res.status(400).json({ error: `Ponto ${i}: formato inválido. Esperado [lat, lng].` });
    }
    const [lat, lng] = p;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: `Ponto ${i}: lat e lng devem ser números.` });
    }
    if (lat < -90 || lat > 90) {
      return res.status(400).json({ error: `Ponto ${i}: latitude deve estar entre -90 e 90.` });
    }
    if (lng < -180 || lng > 180) {
      return res.status(400).json({ error: `Ponto ${i}: longitude deve estar entre -180 e 180.` });
    }
  }

  // Calcula segmentos
  type Segment = { from: [number, number]; to: [number, number]; distance_m: number };
  const segments: Segment[] = [];
  let totalM = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lng1] = points[i] as [number, number];
    const [lat2, lng2] = points[i + 1] as [number, number];
    const rawDist    = haversineMeters(lat1, lng1, lat2, lng2);
    const distance_m = Math.round(rawDist * 100) / 100;
    totalM += rawDist; // acumula sem arredondamento intermediário
    segments.push({ from: [lat1, lng1], to: [lat2, lng2], distance_m });
  }

  res.json({
    segments,
    total_m:  Math.round(totalM * 100) / 100,
    total_km: Math.round((totalM / 1000) * 10_000) / 10_000,
  });
});

export default router;
