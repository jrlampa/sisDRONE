import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  registerConnection,
  unregisterConnection,
  broadcast,
  getConnectionCount,
  _clearConnections,
  type NotificationEvent,
} from '../services/notificationService';

/** Minimal mock WebSocket */
function makeMockWs(readyState: number = WebSocket.OPEN) {
  const sent: string[] = [];
  return {
    readyState,
    send: (payload: string) => { sent.push(payload); },
    _sent: sent,
  } as unknown as WebSocket & { _sent: string[] };
}

describe('notificationService', () => {
  beforeEach(() => {
    _clearConnections();
  });

  it('registerConnection adds client to tenant set', () => {
    const ws = makeMockWs();
    registerConnection(1, ws);
    expect(getConnectionCount(1)).toBe(1);
  });

  it('registerConnection supports multiple tenants independently', () => {
    registerConnection(1, makeMockWs());
    registerConnection(2, makeMockWs());
    registerConnection(2, makeMockWs());
    expect(getConnectionCount(1)).toBe(1);
    expect(getConnectionCount(2)).toBe(2);
  });

  it('unregisterConnection removes client and cleans up empty tenant entry', () => {
    const ws = makeMockWs();
    registerConnection(1, ws);
    expect(getConnectionCount(1)).toBe(1);
    unregisterConnection(1, ws);
    expect(getConnectionCount(1)).toBe(0);
  });

  it('broadcast sends JSON payload to all OPEN clients of the tenant', () => {
    const ws1 = makeMockWs(WebSocket.OPEN);
    const ws2 = makeMockWs(WebSocket.OPEN);
    registerConnection(5, ws1);
    registerConnection(5, ws2);

    const event: NotificationEvent = {
      type: 'ahi_critical',
      title: 'AHI Crítico',
      message: 'Poste 10 em estado crítico',
      pole_id: 10,
      tenant_id: 5,
      timestamp: 1000,
    };
    broadcast(event);

    expect(ws1._sent).toHaveLength(1);
    expect(ws2._sent).toHaveLength(1);
    const parsed = JSON.parse(ws1._sent[0]);
    expect(parsed.type).toBe('ahi_critical');
    expect(parsed.pole_id).toBe(10);
  });

  it('broadcast skips clients that are not OPEN', () => {
    const openWs = makeMockWs(WebSocket.OPEN);
    const closedWs = makeMockWs(WebSocket.CLOSED);
    registerConnection(3, openWs);
    registerConnection(3, closedWs);

    broadcast({
      type: 'work_order_critical',
      title: 'OS Crítica',
      message: 'Teste',
      tenant_id: 3,
      timestamp: Date.now(),
    });

    expect(openWs._sent).toHaveLength(1);
    expect(closedWs._sent).toHaveLength(0);
  });

  it('broadcast to unknown tenant is a no-op', () => {
    expect(() => {
      broadcast({
        type: 'work_order_critical',
        title: 'OS',
        message: 'msg',
        tenant_id: 999,
        timestamp: Date.now(),
      });
    }).not.toThrow();
  });
});
