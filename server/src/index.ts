import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import type { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import app from './app';
import { getDb } from './db';
import { registerConnection, unregisterConnection } from './services/notificationService';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await getDb();
    console.log('Database initialized.');

    const server = http.createServer(app);

    // WebSocket server for drone telemetry
    const wss = new WebSocketServer({ server, path: '/ws/drone' });

    wss.on('connection', (ws: WebSocket) => {
      console.log('[WS] Drone client connected');

      // Emit simulated telemetry at 2Hz
      const interval = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          clearInterval(interval);
          return;
        }
        const telemetry = {
          type: 'telemetry',
          timestamp: Date.now(),
          battery: Math.max(10, 42 - Math.random() * 0.05),
          signal: Math.min(100, 95 + Math.round(Math.random() * 5 - 2)),
          altitude_m: parseFloat((12.4 + (Math.random() - 0.5) * 0.5).toFixed(1)),
          speed_ms: parseFloat((2.1 + (Math.random() - 0.5) * 0.4).toFixed(1)),
          lat: -22.15018 + (Math.random() - 0.5) * 0.0002,
          lng: -42.92185 + (Math.random() - 0.5) * 0.0002,
        };
        ws.send(JSON.stringify(telemetry));
      }, 500);

      ws.on('close', () => {
        clearInterval(interval);
        console.log('[WS] Drone client disconnected');
      });
    });

    // WebSocket server for push notifications (per-tenant)
    const wssNotify = new WebSocketServer({ server, path: '/ws/notifications' });

    wssNotify.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url ?? '', `http://localhost:${PORT}`);
      const tenantId = parseInt(url.searchParams.get('tenant_id') ?? '1', 10);
      const safeTenantId = isNaN(tenantId) || tenantId <= 0 ? 1 : tenantId;

      registerConnection(safeTenantId, ws);
      console.log(`[WS:notify] Tenant ${safeTenantId} client connected`);

      ws.on('close', () => {
        unregisterConnection(safeTenantId, ws);
        console.log(`[WS:notify] Tenant ${safeTenantId} client disconnected`);
      });
    });

    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`WebSocket telemetry at ws://localhost:${PORT}/ws/drone`);
      console.log(`WebSocket notifications at ws://localhost:${PORT}/ws/notifications`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
