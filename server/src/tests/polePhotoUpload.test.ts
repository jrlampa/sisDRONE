/**
 * polePhotoUpload.test.ts — Phase 56: Upload de Fotos de Campo por Poste
 *
 * Testa POST /api/poles/:id/photos (base64 field photo upload).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId: number;
let poleId: number;

// Minimal 1×1 red JPEG in base64 (valid image, ~600 bytes)
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEB/8QAIBAAAgIBBQEBAAAAAAAAAAAAAQIDBAUREiExQf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABbRRQAUAFAB/9k=';

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  const result = await db.run(
    'INSERT INTO poles (tenant_id, name, lat, lng) VALUES (?, ?, ?, ?)',
    [tenantId, 'Foto-Poste-Teste', -22.15018, -42.92185],
  );
  poleId = result.lastID!;
});

describe('Phase 56 — Upload de Fotos de Campo', () => {
  it('POST /api/poles/:id/photos retorna 400 para ID inválido', async () => {
    const res = await request(app)
      .post('/api/poles/abc/photos')
      .send({ image: TINY_JPEG_B64 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ID de poste inválido/);
  });

  it('POST /api/poles/:id/photos retorna 400 sem campo image', async () => {
    const res = await request(app)
      .post(`/api/poles/${poleId}/photos`)
      .send({ mime_type: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/);
  });

  it('POST /api/poles/:id/photos retorna 415 para mime_type não suportado', async () => {
    const res = await request(app)
      .post(`/api/poles/${poleId}/photos`)
      .send({ image: TINY_JPEG_B64, mime_type: 'image/gif' });
    expect(res.status).toBe(415);
  });

  it('POST /api/poles/:id/photos retorna 404 para poste inexistente', async () => {
    const res = await request(app)
      .post('/api/poles/999999/photos')
      .send({ image: TINY_JPEG_B64, mime_type: 'image/jpeg' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Poste não encontrado/);
  });

  it('POST /api/poles/:id/photos cria foto e retorna 201 com campos corretos', async () => {
    const res = await request(app)
      .post(`/api/poles/${poleId}/photos`)
      .send({ image: TINY_JPEG_B64, mime_type: 'image/jpeg', label: 'Foto de campo' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.pole_id).toBe(poleId);
    expect(res.body.file_path).toMatch(/\.jpg$/);
    expect(res.body.captured_at).toBeDefined();
  });

  it('Foto salva aparece em GET /api/poles/:id/images', async () => {
    // Upload first
    await request(app)
      .post(`/api/poles/${poleId}/photos`)
      .send({ image: TINY_JPEG_B64, mime_type: 'image/png' });

    const res = await request(app).get(`/api/poles/${poleId}/images`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(res.body.images[0]).toHaveProperty('file_path');
  });
});
