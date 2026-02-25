import { WebSocket } from 'ws';

export type NotificationType = 'ahi_critical' | 'inspection_critical' | 'work_order_critical';

export interface NotificationEvent {
  type: NotificationType;
  title: string;
  message: string;
  pole_id?: number;
  work_order_id?: number;
  tenant_id: number;
  timestamp: number;
}

/** Map: tenant_id → active WebSocket clients */
const connections = new Map<number, Set<WebSocket>>();

export function registerConnection(tenantId: number, ws: WebSocket): void {
  if (!connections.has(tenantId)) {
    connections.set(tenantId, new Set());
  }
  connections.get(tenantId)!.add(ws);
}

export function unregisterConnection(tenantId: number, ws: WebSocket): void {
  const set = connections.get(tenantId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) connections.delete(tenantId);
  }
}

/**
 * Broadcast a typed notification event to all open clients of the given tenant.
 */
export function broadcast(event: NotificationEvent): void {
  const tenantClients = connections.get(event.tenant_id);
  if (!tenantClients) return;

  const payload = JSON.stringify(event);
  for (const client of tenantClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

export function getConnectionCount(tenantId: number): number {
  return connections.get(tenantId)?.size ?? 0;
}

/** Exposed only for testing */
export function _clearConnections(): void {
  connections.clear();
}
