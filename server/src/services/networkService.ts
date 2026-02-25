/**
 * networkService.ts — Serviço de Topologia de Rede Elétrica (Phase 30)
 *
 * Algoritmos de grafo sobre o conjunto de postes (nodes) e condutores (edges):
 *  - Componentes conectados via BFS (segmentos de rede)
 *  - Postes isolados (sem nenhum condutor)
 *  - Montagem do grafo JSON para visualização
 */
import { Database } from 'sqlite';

export interface GraphNode {
  id: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  tenant_id: number;
  ahi_score: number | null;
  status: string | null;
}

export interface GraphEdge {
  id: number;
  pole_from: number;
  pole_to: number;
  network_type: string;
  cable_type: string | null;
  computed_length_m: number | null;
  length_m: number | null;
}

export interface NetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NetworkSegment {
  segment_id: number;
  pole_ids: number[];
  size: number;
}

export interface IsolatedPole {
  id: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  ahi_score: number | null;
}

/**
 * Builds adjacency list from edges (undirected).
 */
function buildAdjacency(edges: GraphEdge[]): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  for (const e of edges) {
    if (!adj.has(e.pole_from)) adj.set(e.pole_from, new Set());
    if (!adj.has(e.pole_to)) adj.set(e.pole_to, new Set());
    adj.get(e.pole_from)!.add(e.pole_to);
    adj.get(e.pole_to)!.add(e.pole_from);
  }
  return adj;
}

/**
 * BFS to find all connected components (segments).
 */
function findConnectedComponents(nodeIds: number[], adj: Map<number, Set<number>>): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];

  for (const nodeId of nodeIds) {
    if (visited.has(nodeId)) continue;

    const component: number[] = [];
    const queue = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      const neighbors = adj.get(current) ?? new Set<number>();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  return components;
}

/**
 * Fetches the full network graph for a tenant from the database.
 */
export async function getNetworkGraph(db: Database, tenantId?: number | null): Promise<NetworkGraph> {
  const poleWhere = tenantId ? 'WHERE tenant_id = ?' : '';
  const poleParams = tenantId ? [tenantId] : [];

  const nodes: GraphNode[] = await db.all(
    `SELECT id, name, lat, lng, tenant_id, ahi_score, status FROM poles ${poleWhere} ORDER BY id`,
    poleParams
  );

  const conductorWhere = tenantId ? 'WHERE c.tenant_id = ?' : '';
  const conductorParams = tenantId ? [tenantId] : [];

  const edges: GraphEdge[] = await db.all(
    `SELECT id, pole_from, pole_to, network_type, cable_type, computed_length_m, length_m
     FROM conductors c ${conductorWhere} ORDER BY id`,
    conductorParams
  );

  return { nodes, edges };
}

/**
 * Returns connected segments (components) of the network.
 * Only nodes connected by at least one edge appear in a segment.
 * Isolated nodes are excluded (use getIsolatedPoles for those).
 */
export async function getNetworkSegments(db: Database, tenantId?: number | null): Promise<NetworkSegment[]> {
  const { nodes, edges } = await getNetworkGraph(db, tenantId);
  if (edges.length === 0) return [];

  const adj = buildAdjacency(edges);
  // Only include nodes that appear in at least one edge
  const connectedNodeIds = [...new Set(edges.flatMap(e => [e.pole_from, e.pole_to]))];
  const components = findConnectedComponents(connectedNodeIds, adj);

  return components
    .filter(c => c.length > 0)
    .map((component, idx) => ({
      segment_id: idx + 1,
      pole_ids: component.sort((a, b) => a - b),
      size: component.length,
    }));
}

/**
 * Returns poles with no conductors attached (isolated from the network).
 */
export async function getIsolatedPoles(db: Database, tenantId?: number | null): Promise<IsolatedPole[]> {
  const tenantFilter = tenantId ? 'AND p.tenant_id = ?' : '';
  const params = tenantId ? [tenantId] : [];

  const isolated: IsolatedPole[] = await db.all(
    `SELECT p.id, p.name, p.lat, p.lng, p.ahi_score
     FROM poles p
     WHERE p.id NOT IN (
       SELECT pole_from FROM conductors
       UNION
       SELECT pole_to FROM conductors
     ) ${tenantFilter}
     ORDER BY p.id`,
    params
  );

  return isolated;
}
