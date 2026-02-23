import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import polesRouter from './routes/poles';
import inspectionsRouter from './routes/inspections';
import gisRouter from './routes/gis';
import tenantsRouter from './routes/tenants';
import usersRouter from './routes/users';
import aiRoutes from './routes/aiRoutes';
import maintenanceRouter from './routes/maintenance';
import workOrderRouter from './routes/workOrders';
import authRouter from './routes/authRoutes';
import videoRouter from './routes/videoRoutes';
import aneelRouter from './routes/aneelRoutes';
import bimRouter from './routes/bimRoutes';
import reportRouter from './routes/reportRoutes';
import { checkPermission } from './middleware/auth';
import { rateLimit } from './middleware/rateLimit';
import { getDb } from './db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const START_TIME = Date.now();
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', rateLimit(60, 60_000), async (_req, res) => {
  try {
    const db = await getDb();
    const polesRow = await db.get('SELECT COUNT(*) as count FROM poles');
    res.json({
      status: 'ok',
      uptime_s: Math.floor((Date.now() - START_TIME) / 1000),
      db: 'connected',
      poles: polesRow?.count ?? 0,
      version: '1.0.0',
    });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'error' });
  }
});

// Auth (no role required)
app.use('/api/auth', authRouter);

// Routes
app.use('/api/poles', polesRouter);
app.use('/api/inspections', inspectionsRouter); // new: GET /api/inspections (list)
app.use('/api', inspectionsRouter);             // legacy: /api/analyze, /api/feedback, /api/:id/history
app.use('/api/gis', gisRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/users', usersRouter);
app.use('/api/ai', aiRoutes);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/work-orders', workOrderRouter);
app.use('/api/video', videoRouter);
app.use('/api/aneel', aneelRouter);
app.use('/api/bim', bimRouter);
app.use('/api/report', reportRouter);

// Global Guard Example: Only ADMIN can export GIS
app.get('/api/gis/export/geojson', checkPermission(['ADMIN']));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

export default app;
