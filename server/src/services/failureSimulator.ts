/**
 * failureSimulator.ts — Simulação de Falha na Rede Elétrica (Phase 47)
 *
 * Simula a remoção de um poste ou condutor da rede e calcula o impacto:
 *   - Postes que ficam desconectados (perderam alcance ao maior componente)
 *   - Particionamento da rede: número de componentes antes e depois
 *   - Estimativa de clientes afetados (heurística: affected_poles × CUSTOMERS_PER_POLE)
 *
 * Algoritmo:
 *   1. Monta grafo de adjacência (undirected) a partir dos condutores
 *   2. Remove o poste ou condutor informado (sem alterar o banco)
 *   3. Executa BFS para encontrar componentes conectados antes e depois
 *   4. Retorna postes em componentes que cresceram de tamanho ≠ ou foram isolados
 */

export interface SimNode {
  id: number;
  name?: string | null;
}

export interface SimEdge {
  id: number;
  pole_from: number;
  pole_to: number;
}

export interface FailureSimulationResult {
  type: 'pole' | 'conductor';
  removed_id: number;
  /** IDs de postes que eram alcançáveis pelo maior componente e deixaram de ser após a remoção */
  affected_poles: number[];
  affected_count: number;
  partitions_before: number;
  partitions_after: number;
  /** Heurística: 3 clientes por poste afetado */
  estimated_affected_customers: number;
}

const CUSTOMERS_PER_POLE = 3;

/** Builds an undirected adjacency map from edge list. */
function buildAdj(nodes: SimNode[], edges: SimEdge[]): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.pole_from)?.add(e.pole_to);
    adj.get(e.pole_to)?.add(e.pole_from);
  }
  return adj;
}

/** BFS from a starting node, returns the component. */
function bfsComponent(start: number, adj: Map<number, Set<number>>, visited: Set<number>): number[] {
  const component: number[] = [];
  const queue = [start];
  visited.add(start);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    component.push(curr);
    for (const neighbor of adj.get(curr) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return component;
}

/** Returns all connected components as arrays of node IDs. */
function findComponents(adj: Map<number, Set<number>>): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];
  for (const nodeId of adj.keys()) {
    if (!visited.has(nodeId)) {
      components.push(bfsComponent(nodeId, adj, visited));
    }
  }
  return components;
}

/** ID of the largest component (main feeder). */
function largestComponentIds(components: number[][]): Set<number> {
  if (components.length === 0) return new Set();
  const largest = components.reduce((a, b) => (b.length > a.length ? b : a));
  return new Set(largest);
}

/**
 * Simulates removing a pole from the network.
 * Returns the set of poles that are no longer reachable from the main component.
 */
export function simulatePoleFailure(
  nodes: SimNode[],
  edges: SimEdge[],
  poleId: number
): FailureSimulationResult {
  // Build baseline graph
  const adj = buildAdj(nodes, edges);
  const before = findComponents(adj);

  // Remove the pole
  const filteredNodes = nodes.filter(n => n.id !== poleId);
  const filteredEdges = edges.filter(e => e.pole_from !== poleId && e.pole_to !== poleId);

  const adjAfter = buildAdj(filteredNodes, filteredEdges);
  const after = findComponents(adjAfter);

  // Poles in the main component before the failure
  const mainBefore = largestComponentIds(before);

  // Poles in the main component after (without the removed pole itself)
  const mainAfter = largestComponentIds(after);

  // Affected: were in main component before, are not now (and not the removed pole itself)
  const affected = [...mainBefore].filter(id => id !== poleId && !mainAfter.has(id));

  return {
    type: 'pole',
    removed_id: poleId,
    affected_poles: affected.sort((a, b) => a - b),
    affected_count: affected.length,
    partitions_before: before.length,
    partitions_after: after.length,
    estimated_affected_customers: affected.length * CUSTOMERS_PER_POLE,
  };
}

/**
 * Simulates removing a conductor (span) from the network.
 * Returns the set of poles that are no longer reachable from the main component.
 */
export function simulateConductorFailure(
  nodes: SimNode[],
  edges: SimEdge[],
  conductorId: number
): FailureSimulationResult {
  const adj = buildAdj(nodes, edges);
  const before = findComponents(adj);
  const mainBefore = largestComponentIds(before);

  const filteredEdges = edges.filter(e => e.id !== conductorId);

  const adjAfter = buildAdj(nodes, filteredEdges);
  const after = findComponents(adjAfter);
  const mainAfter = largestComponentIds(after);

  const affected = [...mainBefore].filter(id => !mainAfter.has(id));

  return {
    type: 'conductor',
    removed_id: conductorId,
    affected_poles: affected.sort((a, b) => a - b),
    affected_count: affected.length,
    partitions_before: before.length,
    partitions_after: after.length,
    estimated_affected_customers: affected.length * CUSTOMERS_PER_POLE,
  };
}
