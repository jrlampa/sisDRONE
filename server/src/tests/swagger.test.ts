import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { spec } from '../routes/swaggerRoutes';

describe('GET /api/docs/json — OpenAPI spec', () => {
  it('retorna 200 com JSON válido', async () => {
    const res = await request(app).get('/api/docs/json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('spec contém openapi 3.0', () => {
    expect((spec as any).openapi).toBe('3.0.0');
  });

  it('info.version está presente', () => {
    expect((spec as any).info.version).toBeTruthy();
  });

  it('paths contém /poles', () => {
    const paths = (spec as any).paths as Record<string, unknown>;
    expect(Object.keys(paths)).toContain('/poles');
  });
});
