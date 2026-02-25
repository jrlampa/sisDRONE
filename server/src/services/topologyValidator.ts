/**
 * topologyValidator.ts — Validação de Topologia da Rede Elétrica (Phase 42)
 *
 * Algoritmos puros (testáveis sem Express) que detectam inconsistências:
 *   - loops:           condutores que formam ciclos (DFS)
 *   - dead_ends:       postes com exatamente 1 conexão
 *   - isolated:        postes sem nenhuma conexão
 *   - duplicate_spans: dois condutores com mesmo par from↔to
 */

export interface ValidationEdge {
  id: number;
  pole_from: number;
  pole_to: number;
}

export interface ValidationNode {
  id: number;
  name: string | null;
}

export interface ValidationResult {
  loops:            number[][];         // cycles: arrays of pole_ids
  dead_ends:        number[];           // pole_ids with degree === 1
  isolated:         number[];           // pole_ids with degree === 0
  duplicate_spans:  Array<{ conductor_ids: number[]; pole_from: number; pole_to: number }>;
  is_valid:         boolean;            // true when no loops and no duplicates
}

/**
 * Build adjacency list (undirected) from edges.
 */
function buildAdj(nodes: ValidationNode[], edges: ValidationEdge[]): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.pole_from)?.add(e.pole_to);
    adj.get(e.pole_to)?.add(e.pole_from);
    // Ensure entries exist even if pole not in nodes
    if (!adj.has(e.pole_from)) adj.set(e.pole_from, new Set([e.pole_to]));
    if (!adj.has(e.pole_to))   adj.set(e.pole_to,   new Set([e.pole_from]));
  }
  return adj;
}

/**
 * Detect duplicate spans: pairs of conductors connecting the same two poles
 * (regardless of direction).
 */
export function findDuplicateSpans(
  edges: ValidationEdge[]
): Array<{ conductor_ids: number[]; pole_from: number; pole_to: number }> {
  const seen = new Map<string, { ids: number[]; from: number; to: number }>();
  for (const e of edges) {
    const key = `${Math.min(e.pole_from, e.pole_to)}:${Math.max(e.pole_from, e.pole_to)}`;
    if (!seen.has(key)) {
      seen.set(key, { ids: [e.id], from: e.pole_from, to: e.pole_to });
    } else {
      seen.get(key)!.ids.push(e.id);
    }
  }
  const duplicates: Array<{ conductor_ids: number[]; pole_from: number; pole_to: number }> = [];
  for (const entry of seen.values()) {
    if (entry.ids.length > 1) {
      duplicates.push({ conductor_ids: entry.ids, pole_from: entry.from, pole_to: entry.to });
    }
  }
  return duplicates;
}

/**
 * Detect loops using DFS on undirected graph.
 * Returns one cycle per connected component that has a cycle.
 * Each cycle is the list of pole_ids involved.
 */
export function findLoops(nodes: ValidationNode[], edges: ValidationEdge[]): number[][] {
  const adj = buildAdj(nodes, edges);
  const visited = new Set<number>();
  const cycles: number[][] = [];

  function dfs(node: number, parent: number, path: number[]): boolean {
    visited.add(node);
    path.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (neighbor === parent) continue;
      if (visited.has(neighbor)) {
        // Found a back-edge → cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart));
        return true;
      }
      if (dfs(neighbor, node, [...path])) return true;
    }
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node, -1, []);
    }
  }
  return cycles;
}

/**
 * Find dead-end poles (degree === 1).
 */
export function findDeadEnds(nodes: ValidationNode[], edges: ValidationEdge[]): number[] {
  const degree = new Map<number, number>();
  for (const n of nodes) degree.set(n.id, 0);
  for (const e of edges) {
    degree.set(e.pole_from, (degree.get(e.pole_from) ?? 0) + 1);
    degree.set(e.pole_to,   (degree.get(e.pole_to)   ?? 0) + 1);
  }
  return [...degree.entries()].filter(([, d]) => d === 1).map(([id]) => id);
}

/**
 * Find isolated poles (degree === 0).
 */
export function findIsolated(nodes: ValidationNode[], edges: ValidationEdge[]): number[] {
  const connected = new Set<number>();
  for (const e of edges) {
    connected.add(e.pole_from);
    connected.add(e.pole_to);
  }
  return nodes.map(n => n.id).filter(id => !connected.has(id));
}

/**
 * Main entry point — runs all checks and returns combined report.
 */
export function validateTopology(
  nodes: ValidationNode[],
  edges: ValidationEdge[]
): ValidationResult {
  const loops           = findLoops(nodes, edges);
  const dead_ends       = findDeadEnds(nodes, edges);
  const isolated        = findIsolated(nodes, edges);
  const duplicate_spans = findDuplicateSpans(edges);

  return {
    loops,
    dead_ends,
    isolated,
    duplicate_spans,
    is_valid: loops.length === 0 && duplicate_spans.length === 0,
  };
}
