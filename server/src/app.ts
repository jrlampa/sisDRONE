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
import { checkPermission } from './middleware/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/poles', polesRouter);
app.use('/api', inspectionsRouter);
app.use('/api/gis', gisRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/users', usersRouter);

// Global Guard Example: Only ADMIN can export GIS
app.get('/api/gis/export/geojson', checkPermission(['ADMIN']));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

export default app;
