/**
 * routeService.ts — Planejamento de Rota de Inspeção por Drone (TSP Nearest Neighbor)
 *
 * Implementa heurística do vizinho mais próximo (O(n²)) para gerar um roteiro
 * de inspeção eficiente sobre os postes de uma concessionária.
 *
 * Regras: Zero custo (sem APIs externas), Smart Backend, Clean Code.
 */
import { haversineMeters } from '../utils/geo';

/** Velocidade média do drone em m/s (conservadora: 10 m/s ≈ 36 km/h) */
const DRONE_SPEED_MS = 10;

export interface RouteWaypoint {
  pole_id: number;
  name: string | null;
  lat: number;
  lng: number;
  ahi_score: number | null;
  order: number;
  /** Distância em metros em relação ao waypoint anterior (0 para o primeiro) */
  distance_from_prev_m: number;
}

export interface DroneRoute {
  total_poles: number;
  total_distance_m: number;
  total_distance_km: number;
  /** Tempo estimado de voo em minutos (baseado em DRONE_SPEED_MS) */
  estimated_flight_minutes: number;
  waypoints: RouteWaypoint[];
}

interface RawPole {
  id: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  ahi_score: number | null;
}

/**
 * planInspectionRoute — Gera rota de inspeção por TSP nearest-neighbor.
 *
 * @param rawPoles  - Postes do tenant (lat/lng podem ser null → descartados)
 * @param startLat  - Latitude do ponto inicial (opcional; se omitido, começa pelo poste de menor AHI)
 * @param startLng  - Longitude do ponto inicial (opcional)
 */
export function planInspectionRoute(
  rawPoles: RawPole[],
  startLat?: number,
  startLng?: number,
): DroneRoute {
  const poles = rawPoles.filter(
    (p) => p.lat !== null && p.lng !== null && isFinite(p.lat!) && isFinite(p.lng!),
  ) as Array<RawPole & { lat: number; lng: number }>;

  if (poles.length === 0) {
    return {
      total_poles: 0,
      total_distance_m: 0,
      total_distance_km: 0,
      estimated_flight_minutes: 0,
      waypoints: [],
    };
  }

  const visited = new Set<number>();
  const waypoints: RouteWaypoint[] = [];
  let totalDist = 0;

  // Determine starting position
  let curLat: number;
  let curLng: number;

  if (startLat !== undefined && startLng !== undefined) {
    curLat = startLat;
    curLng = startLng;
  } else {
    // Start from the pole with the lowest AHI (most critical first)
    const criticalPole = poles.reduce(
      (prev, p) => (p.ahi_score ?? 100) < (prev.ahi_score ?? 100) ? p : prev,
      poles[0],
    );
    curLat = criticalPole.lat;
    curLng = criticalPole.lng;
  }

  while (visited.size < poles.length) {
    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < poles.length; i++) {
      if (visited.has(poles[i].id)) continue;
      const d = haversineMeters(curLat, curLng, poles[i].lat, poles[i].lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    if (nearestIdx === -1) break;

    const pole = poles[nearestIdx];
    visited.add(pole.id);
    totalDist += nearestDist;

    waypoints.push({
      pole_id: pole.id,
      name: pole.name,
      lat: pole.lat,
      lng: pole.lng,
      ahi_score: pole.ahi_score,
      order: waypoints.length + 1,
      distance_from_prev_m: Math.round(nearestDist),
    });

    curLat = pole.lat;
    curLng = pole.lng;
  }

  const totalDistM = Math.round(totalDist);

  return {
    total_poles: waypoints.length,
    total_distance_m: totalDistM,
    total_distance_km: parseFloat((totalDistM / 1000).toFixed(2)),
    estimated_flight_minutes: Math.ceil(totalDistM / DRONE_SPEED_MS / 60),
    waypoints,
  };
}
