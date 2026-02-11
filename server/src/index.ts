import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDb } from './db.js';
import { analyzeImage } from './services/groqService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
    const analysisStr = await analyzeImage(image);
    const analysis = JSON.parse(analysisStr as string);

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, ?, ?, ?)',
      [poleId, analysis.analysis_summary, analysis.confidence, 'ai']
    );

    res.json({
      ...analysis,
      labelId: result.lastID
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
