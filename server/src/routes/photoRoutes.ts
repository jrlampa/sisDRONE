/**
 * photoRoutes.ts — Upload de Fotos de Campo por Poste (Phase 56)
 *
 * POST /api/poles/:id/photos — Upload de foto de campo (base64 JPEG/PNG)
 *
 * As fotos são armazenadas em /uploads/photos/ e referenciadas na tabela
 * `images` existente (compartilhada com capturas de vídeo/análise IA).
 *
 * Smart Backend: validação completa server-side.
 * Segurança: whitelista de MIME, tamanho máximo, sanitização de path.
 */
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHOTOS_DIR = path.join(__dirname, '../../../uploads/photos');
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const VALID_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Garante que o diretório de upload exista */
function ensurePhotosDir(): void {
  if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

const router = Router({ mergeParams: true });

/**
 * POST /api/poles/:id/photos
 * Body JSON: { image: string (base64), mime_type?: string, label?: string }
 *
 * Salva a foto em disco e registra em `images` com pole_id.
 * Retorna: { id, pole_id, file_path, captured_at }
 */
router.post('/:id/photos', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const poleId = parseInt(req.params.id, 10);
  if (isNaN(poleId) || poleId <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }

  const { image, mime_type = 'image/jpeg', label } = req.body ?? {};

  if (!image || typeof image !== 'string' || image.trim().length === 0) {
    return res.status(400).json({ error: 'Campo "image" (base64) é obrigatório' });
  }

  const safeMime = String(mime_type).toLowerCase().trim();
  if (!VALID_MIME.has(safeMime)) {
    return res.status(415).json({ error: 'Tipo de imagem não suportado. Use JPEG, PNG ou WebP.' });
  }

  // Strip optional data-URL prefix (data:image/jpeg;base64,...)
  const base64Data = image.replace(/^data:[^;]+;base64,/, '');

  // Validate size before decoding fully
  const estimatedBytes = Math.ceil(base64Data.length * 0.75);
  if (estimatedBytes > MAX_SIZE_BYTES) {
    return res.status(413).json({ error: `Imagem muito grande. Máximo: ${MAX_SIZE_BYTES / 1024 / 1024} MB` });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch {
    return res.status(400).json({ error: 'Dados de imagem inválidos (base64 corrompido)' });
  }

  if (buffer.length === 0) {
    return res.status(400).json({ error: 'Imagem vazia após decodificação' });
  }

  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [poleId]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    ensurePhotosDir();

    const ext = MIME_EXT[safeMime];
    const filename = `pole_${poleId}_${Date.now()}.${ext}`;
    const filePath = path.join(PHOTOS_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    const relPath = `/uploads/photos/${filename}`;
    const capturedAt = new Date().toISOString();

    const result = await db.run(
      'INSERT INTO images (pole_id, file_path, captured_at) VALUES (?, ?, ?)',
      [poleId, relPath, capturedAt],
    );

    return res.status(201).json({
      id: result.lastID,
      pole_id: poleId,
      file_path: relPath,
      label: label ? String(label).slice(0, 255) : null,
      captured_at: capturedAt,
    });
  } catch (err) {
    console.error('Erro ao salvar foto de campo:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao salvar foto de campo' });
  }
});

export default router;
