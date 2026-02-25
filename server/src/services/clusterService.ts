/**
 * clusterService.ts — Agrupamento Espacial de Postes por Proximidade (Phase 66)
 *
 * Implementa clustering de grade simples (O(n)):
 *   1. Converte raio_m para graus de lat/lng (aproximado)
 *   2. Quantiza cada poste a uma célula de grade
 *   3. Postes na mesma célula formam um cluster
 *
 * Resultado: lista de clusters com centróide, AHI médio, contagem e IDs dos postes.
 */

export interface ClusterPole {
  id: number;
  lat: number;
  lng: number;
  ahi_score: number | null;
  network_level: string | null;
}

export interface PoleCluster {
  cluster_id: number;
  centroid_lat: number;
  centroid_lng: number;
  pole_count: number;
  avg_ahi: number | null;
  critical_count: number;
  network_levels: string[];
  pole_ids: number[];
}

const METERS_PER_DEGREE_LAT = 111320;

/** Clusters poles by spatial proximity using a grid-cell approach. */
export function clusterPoles(poles: ClusterPole[], radiusMeters: number): PoleCluster[] {
  if (poles.length === 0 || radiusMeters <= 0) return [];

  // Convert radius to approximate degree steps
  const latStep = radiusMeters / METERS_PER_DEGREE_LAT;
  // Average longitude degree size at Brazil's center (~-22°)
  const lngStep = radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos((-22 * Math.PI) / 180));

  const cellMap = new Map<string, ClusterPole[]>();

  for (const pole of poles) {
    const cellLat = Math.floor(pole.lat / latStep);
    const cellLng = Math.floor(pole.lng / lngStep);
    const key = `${cellLat}:${cellLng}`;
    const bucket = cellMap.get(key) ?? [];
    bucket.push(pole);
    cellMap.set(key, bucket);
  }

  const clusters: PoleCluster[] = [];
  let clusterId = 0;

  for (const group of cellMap.values()) {
    clusterId++;
    const centroidLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
    const centroidLng = group.reduce((s, p) => s + p.lng, 0) / group.length;

    const ahiValues = group.filter(p => p.ahi_score != null).map(p => p.ahi_score as number);
    const avgAhi = ahiValues.length > 0
      ? Math.round((ahiValues.reduce((s, v) => s + v, 0) / ahiValues.length) * 10) / 10
      : null;

    const criticalCount = group.filter(p => (p.ahi_score ?? 100) < 30).length;
    const networkLevels = [...new Set(group.map(p => p.network_level ?? 'N/A'))];

    clusters.push({
      cluster_id:    clusterId,
      centroid_lat:  Math.round(centroidLat * 1e6) / 1e6,
      centroid_lng:  Math.round(centroidLng * 1e6) / 1e6,
      pole_count:    group.length,
      avg_ahi:       avgAhi,
      critical_count: criticalCount,
      network_levels: networkLevels,
      pole_ids:      group.map(p => p.id),
    });
  }

  // Sort by pole_count desc for consistent ordering
  clusters.sort((a, b) => b.pole_count - a.pole_count || a.cluster_id - b.cluster_id);

  return clusters;
}
