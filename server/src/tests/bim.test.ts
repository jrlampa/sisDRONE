import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('BIM Structure API', () => {
  let testPoleId: number;

  it('POST /api/poles creates a pole for BIM tests', async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185,
      name: 'Poste BIM Teste', tenant_id: 1,
    });
    expect(res.status).toBe(200);
    testPoleId = res.body.id;
    expect(testPoleId).toBeGreaterThan(0);
  });

  describe('GET /api/bim/:poleId', () => {
    it('should return 400 for invalid poleId', async () => {
      const res = await request(app).get('/api/bim/abc');
      expect(res.status).toBe(400);
    });

    it('should return 400 for poleId=0', async () => {
      const res = await request(app).get('/api/bim/0');
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent pole', async () => {
      const res = await request(app).get('/api/bim/99999');
      expect(res.status).toBe(404);
    });

    it('should return default structure for existing pole', async () => {
      const res = await request(app).get(`/api/bim/${testPoleId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('poleId', testPoleId);
      expect(res.body).toHaveProperty('structure');
      expect(res.body.structure).toHaveProperty('ifc_class');
      expect(res.body.structure).toHaveProperty('height_m');
      expect(res.body.structure).toHaveProperty('material');
    });
  });

  describe('PUT /api/bim/:poleId', () => {
    it('should return 400 for invalid poleId', async () => {
      const res = await request(app).put('/api/bim/abc')
        .send({ structure_data: { height_m: 11 } });
      expect(res.status).toBe(400);
    });

    it('should return 400 if structure_data is missing', async () => {
      const res = await request(app).put(`/api/bim/${testPoleId}`).send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid ifc_class', async () => {
      const res = await request(app).put(`/api/bim/${testPoleId}`)
        .send({ structure_data: { ifc_class: 'InvalidClass' } });
      expect(res.status).toBe(400);
    });

    it('should return 400 for out-of-range height_m', async () => {
      const res = await request(app).put(`/api/bim/${testPoleId}`)
        .send({ structure_data: { height_m: 200 } });
      expect(res.status).toBe(400);
    });

    it('should update structure successfully', async () => {
      const structure = {
        ifc_class: 'IfcTelecomDevice',
        height_m: 11.5,
        material: 'concreto',
        cross_arm_count: 2,
        transformer: false,
        insulator_count: 6,
        conductor_lines: 4,
        ground_wire: true,
        elevation_m: 850,
        notes: 'Poste próximo à subestação SE-01',
      };
      const res = await request(app).put(`/api/bim/${testPoleId}`)
        .send({ structure_data: structure });
      expect(res.status).toBe(200);
      expect(res.body.structure.height_m).toBe(11.5);
      expect(res.body.structure.cross_arm_count).toBe(2);
      expect(res.body.structure.elevation_m).toBe(850);
    });

    it('should persist updated structure on GET', async () => {
      const res = await request(app).get(`/api/bim/${testPoleId}`);
      expect(res.status).toBe(200);
      expect(res.body.structure.height_m).toBe(11.5);
      expect(res.body.structure.notes).toBe('Poste próximo à subestação SE-01');
    });

    it('should sanitize unknown fields', async () => {
      const res = await request(app).put(`/api/bim/${testPoleId}`)
        .send({ structure_data: { height_m: 10, __proto__: 'hack', unknownField: 'value' } });
      expect(res.status).toBe(200);
      expect(res.body.structure).not.toHaveProperty('unknownField');
      expect(res.body.structure).not.toHaveProperty('__proto__');
    });

    it('should return 404 for non-existent pole', async () => {
      const res = await request(app).put('/api/bim/99999')
        .send({ structure_data: { height_m: 11 } });
      expect(res.status).toBe(404);
    });
  });
});
