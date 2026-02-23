import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db';
import { analyzeImage } from '../services/groqService';
import { rateLimit } from '../middleware/rateLimit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../../uploads/video_sessions');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const router = Router();

/**
 * POST /api/video/session/start
 * Start a new video capture session (frame or recording mode)
 * Body: { pole_id, tenant_id, mode: 'frame' | 'recording' }
 */
router.post('/session/start', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const { pole_id, tenant_id, mode } = req.body;

  if (!pole_id || !['frame', 'recording'].includes(mode)) {
    return res.status(400).json({ error: 'pole_id e mode (frame|recording) são obrigatórios' });
  }

  const safePoleId = parseInt(String(pole_id), 10);
  const safeTenantId = parseInt(String(tenant_id || 1), 10);
  if (isNaN(safePoleId) || safePoleId <= 0) {
    return res.status(400).json({ error: 'pole_id inválido' });
  }

  try {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO video_sessions (pole_id, tenant_id, mode, status, frame_count)
       VALUES (?, ?, ?, 'recording', 0)`,
      [safePoleId, safeTenantId, mode]
    );
    res.status(201).json({ sessionId: result.lastID, mode, status: 'recording' });
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Erro ao iniciar sessão de vídeo' });
  }
});

/**
 * POST /api/video/frame
 * Receive a single captured frame, analyze with Groq AI, return result.
 * Body: { sessionId, pole_id, image: base64, sequence: number }
 */
router.post('/frame', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const { sessionId, pole_id, image, sequence } = req.body;

  if (!pole_id || !image) {
    return res.status(400).json({ error: 'pole_id e image são obrigatórios' });
  }
  const safePoleId = parseInt(String(pole_id), 10);
  const safeSessionId = sessionId ? parseInt(String(sessionId), 10) : null;

  if (isNaN(safePoleId) || safePoleId <= 0) {
    return res.status(400).json({ error: 'pole_id inválido' });
  }
  if (typeof image !== 'string' || image.length > 10_000_000) {
    return res.status(400).json({ error: 'Frame inválido ou muito grande (máx 10MB)' });
  }

  try {
    const db = await getDb();

    // Save frame to disk
    ensureUploadDir();
    const sessionDir = safeSessionId
      ? path.join(UPLOAD_DIR, String(safeSessionId))
      : UPLOAD_DIR;
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const seq = parseInt(String(sequence || 0), 10);
    const filename = `frame_${Date.now()}_${seq}.jpg`;
    const filePath = path.join(sessionDir, filename);
    fs.writeFileSync(filePath, Buffer.from(image, 'base64'));

    const relPath = safeSessionId
      ? `/uploads/video_sessions/${safeSessionId}/${filename}`
      : `/uploads/video_sessions/${filename}`;

    // Save image record
    const imgRes = await db.run(
      'INSERT INTO images (pole_id, file_path) VALUES (?, ?)',
      [safePoleId, relPath]
    );

    // Update session frame count
    if (safeSessionId) {
      await db.run(
        'UPDATE video_sessions SET frame_count = frame_count + 1 WHERE id = ?',
        [safeSessionId]
      );
    }

    // Analyze frame with Groq AI
    const analysis = await analyzeImage(image);

    // Save label
    const labelRes = await db.run(
      'INSERT INTO labels (pole_id, image_id, label, confidence, source) VALUES (?, ?, ?, ?, ?)',
      [safePoleId, imgRes.lastID, analysis.analysis_summary, analysis.confidence, 'video_frame']
    );

    res.json({
      ...analysis,
      labelId: labelRes.lastID,
      imageId: imgRes.lastID,
      imageUrl: relPath,
      sequence: seq,
    });
  } catch (err) {
    console.error('Frame analysis error:', err);
    res.status(500).json({ error: 'Erro na análise do frame' });
  }
});

/**
 * POST /api/video/upload
 * Upload a recorded video chunk (offline fallback).
 * Body: { sessionId, pole_id, chunk: base64, chunkIndex, totalChunks, isLast }
 */
router.post('/upload', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const { sessionId, pole_id, chunk, chunkIndex, totalChunks, isLast } = req.body;

  if (!pole_id || !chunk || chunkIndex === undefined) {
    return res.status(400).json({ error: 'pole_id, chunk e chunkIndex são obrigatórios' });
  }

  const safePoleId = parseInt(String(pole_id), 10);
  const safeSessionId = parseInt(String(sessionId), 10);
  const safeChunkIndex = parseInt(String(chunkIndex), 10);

  if (isNaN(safePoleId) || safePoleId <= 0) {
    return res.status(400).json({ error: 'pole_id inválido' });
  }
  if (isNaN(safeSessionId) || safeSessionId <= 0) {
    return res.status(400).json({ error: 'sessionId inválido' });
  }
  if (typeof chunk !== 'string' || chunk.length > 20_000_000) {
    return res.status(400).json({ error: 'Chunk inválido ou muito grande (máx 20MB)' });
  }

  try {
    ensureUploadDir();
    const sessionDir = path.join(UPLOAD_DIR, String(safeSessionId));
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    // Write chunk to disk
    const chunkPath = path.join(sessionDir, `chunk_${safeChunkIndex}.webm`);
    fs.writeFileSync(chunkPath, Buffer.from(chunk, 'base64'));

    const db = await getDb();

    if (isLast) {
      // Assemble all chunks into a single file
      const safeTotalChunks = parseInt(String(totalChunks || safeChunkIndex + 1), 10);
      const finalPath = path.join(sessionDir, 'recording.webm');
      const writeStream = fs.createWriteStream(finalPath);

      for (let i = 0; i < safeTotalChunks; i++) {
        const cp = path.join(sessionDir, `chunk_${i}.webm`);
        if (fs.existsSync(cp)) {
          writeStream.write(fs.readFileSync(cp));
          fs.unlinkSync(cp); // clean up chunk
        }
      }
      writeStream.end();

      const relPath = `/uploads/video_sessions/${safeSessionId}/recording.webm`;

      await db.run(
        `UPDATE video_sessions
         SET status = 'completed', blob_path = ?, completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [relPath, safeSessionId]
      );

      return res.json({ status: 'completed', path: relPath, sessionId: safeSessionId });
    }

    res.json({ status: 'chunk_received', chunkIndex: safeChunkIndex });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Erro no upload do vídeo' });
  }
});

/**
 * POST /api/video/session/:id/complete
 * Mark a session as completed.
 */
router.post('/session/:id/complete', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de sessão inválido' });
  }

  try {
    const db = await getDb();
    const session = await db.get('SELECT * FROM video_sessions WHERE id = ?', [id]);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    await db.run(
      `UPDATE video_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    res.json({ sessionId: id, status: 'completed', frameCount: session.frame_count });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao finalizar sessão' });
  }
});

/**
 * GET /api/video/sessions/:poleId
 * List video sessions for a pole.
 */
router.get('/sessions/:poleId', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const poleId = parseInt(req.params.poleId, 10);
  if (isNaN(poleId) || poleId <= 0) {
    return res.status(400).json({ error: 'poleId inválido' });
  }

  try {
    const db = await getDb();
    const sessions = await db.all(
      'SELECT * FROM video_sessions WHERE pole_id = ? ORDER BY started_at DESC',
      [poleId]
    );
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar sessões' });
  }
});

export default router;
