import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { analyzeImage } from './services/groqService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET statistics
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const polesCount = await db.get('SELECT COUNT(*) as count FROM poles');
    const inspectionsCount = await db.get('SELECT COUNT(*) as count FROM labels');
    const alertsCount = await db.get('SELECT COUNT(*) as count FROM labels WHERE label LIKE "%danificado%" OR label LIKE "%inclinado%"');

    res.json({
      totalPoles: polesCount.count,
      totalInspections: inspectionsCount.count,
      activeAlerts: alertsCount.count,
      status: 'Operacional'
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET all poles
app.get('/api/poles', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const poles = await db.all('SELECT * FROM poles ORDER BY created_at DESC');
    res.json(poles);
  } catch (error) {
    console.error('Error fetching poles:', error);
    res.status(500).json({ error: 'Failed to fetch poles' });
  }
});

// GET pole history
app.get('/api/poles/:id/history', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const history = await db.all(`
      SELECT l.*, i.file_path 
      FROM labels l 
      LEFT JOIN images i ON l.image_id = i.id 
      WHERE l.pole_id = ? 
      ORDER BY l.created_at DESC
    `, [id]);
    res.json(history);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// POST new pole
app.post('/api/poles', async (req: Request, res: Response) => {
  const { lat, lng, utm_x, utm_y, name } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Latitude e Longitude são obrigatórias' });
  }

  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO poles (external_id, lat, lng, utm_x, utm_y) VALUES (?, ?, ?, ?, ?)',
      [name, lat, lng, utm_x, utm_y]
    );
    res.status(201).json({ id: result.lastID, lat, lng, name });
  } catch (error) {
    console.error('Error creating pole:', error);
    res.status(500).json({ error: 'Failed to create pole' });
  }
});

// POST analyze image
app.post('/api/analyze', async (req: Request, res: Response) => {
  const { poleId, image } = req.body; // image is base64

  if (!poleId || !image) {
    return res.status(400).json({ error: 'poleId e image são obrigatórios' });
  }

  try {
    const db = await getDb();

    // 1. Save image to disk
    const fileName = `pole_${poleId}_${Date.now()}.jpg`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(image, 'base64'));

    // 2. Save image record
    const imgResult = await db.run(
      'INSERT INTO images (pole_id, file_path) VALUES (?, ?)',
      [poleId, `/uploads/${fileName}`]
    );
    const imageId = imgResult.lastID;

    // 3. Analyze image
    const analysisStr = await analyzeImage(image);
    const analysis = JSON.parse(analysisStr as string);

    // 4. Save label record linked to image
    const labelResult = await db.run(
      'INSERT INTO labels (pole_id, image_id, label, confidence, source) VALUES (?, ?, ?, ?, ?)',
      [poleId, imageId, analysis.analysis_summary, analysis.confidence, 'ai']
    );

    res.json({
      ...analysis,
      labelId: labelResult.lastID,
      imageUrl: `/uploads/${fileName}`
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

// POST feedback
app.post('/api/feedback', async (req: Request, res: Response) => {
  const { labelId, poleId, isCorrect, correction } = req.body;

  if (poleId === undefined || isCorrect === undefined) {
    return res.status(400).json({ error: 'poleId e isCorrect são obrigatórios' });
  }

  try {
    const db = await getDb();

    if (isCorrect) {
      if (labelId === undefined) return res.status(400).json({ error: 'labelId é obrigatório para feedback positivo' });
      await db.run('UPDATE labels SET confidence = 1.0, source = "ai_verified" WHERE id = ?', [labelId]);
    } else {
      await db.run(
        'INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, ?, ?, ?)',
        [poleId, correction || 'Correção do usuário', 1.0, 'user']
      );
    }

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`sisDRONE backend running on http://localhost:${port}`);
  });
}
