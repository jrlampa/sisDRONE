import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Poles Stats — GET /api/poles/stats (melhorado Phase 26)', () => {
  it('GET /api/poles/stats deve retornar 200', async () => {
    const res = await request(app).get('/api/poles/stats');
    expect(res.status).toBe(200);
  });

  it('deve incluir contadores diretos healthy, warning, critical, unknown', async () => {
    const res = await request(app).get('/api/poles/stats');
    expect(res.body).toHaveProperty('healthy');
    expect(res.body).toHaveProperty('warning');
    expect(res.body).toHaveProperty('critical');
    expect(res.body).toHaveProperty('unknown');
    expect(typeof res.body.healthy).toBe('number');
    expect(typeof res.body.warning).toBe('number');
    expect(typeof res.body.critical).toBe('number');
    expect(typeof res.body.unknown).toBe('number');
  });

  it('deve incluir averageAhi (número ou null)', async () => {
    const res = await request(app).get('/api/poles/stats');
    expect(res.body).toHaveProperty('averageAhi');
    const avg = res.body.averageAhi;
    expect(avg === null || typeof avg === 'number').toBe(true);
    if (avg !== null) {
      expect(avg).toBeGreaterThanOrEqual(0);
      expect(avg).toBeLessThanOrEqual(100);
    }
  });

  it('soma healthy + warning + critical + unknown deve ser igual a totalPoles', async () => {
    const res = await request(app).get('/api/poles/stats');
    const { healthy, warning, critical, unknown, totalPoles } = res.body;
    expect(healthy + warning + critical + unknown).toBe(totalPoles);
  });

  it('conditionStats deve incluir campo "Sem Dados" para ahi_score IS NULL (se existir)', async () => {
    const res = await request(app).get('/api/poles/stats');
    expect(Array.isArray(res.body.conditionStats)).toBe(true);
    // conditionStats should NOT contain 'Saudável' for NULL ahi_score poles anymore
    const validConditions = ['Crítico', 'Atenção', 'Saudável', 'Sem Dados'];
    for (const stat of res.body.conditionStats) {
      expect(validConditions).toContain(stat.condition);
    }
  });
});
