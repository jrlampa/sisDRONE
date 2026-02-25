import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('GIS Export — GET /api/gis/export/geojson', () => {
  it('deve retornar 200 com GeoJSON válido', async () => {
    const res = await request(app).get('/api/gis/export/geojson');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.features)).toBe(true);
  });

  it('cada feature deve ter geometry.coordinates com lng e lat', async () => {
    const res = await request(app).get('/api/gis/export/geojson');
    expect(res.status).toBe(200);
    for (const feat of res.body.features) {
      expect(feat.type).toBe('Feature');
      // Phase 51: FeatureCollection contém Points (postes) e LineStrings (condutores)
      expect(['Point', 'LineString']).toContain(feat.geometry.type);
      expect(Array.isArray(feat.geometry.coordinates)).toBe(true);
    }
  });
});

describe('GIS Import — POST /api/gis/import/geojson', () => {
  it('deve retornar 400 para payload sem geojson', async () => {
    const res = await request(app).post('/api/gis/import/geojson').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 para geojson com type errado', async () => {
    const res = await request(app).post('/api/gis/import/geojson').send({
      geojson: { type: 'Feature', geometry: null, properties: {} }
    });
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 para geojson sem features', async () => {
    const res = await request(app).post('/api/gis/import/geojson').send({
      geojson: { type: 'FeatureCollection', features: [] }
    });
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 se features > 1000', async () => {
    const features = Array.from({ length: 1001 }, (_, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-42.9 + i * 0.001, -22.15] },
      properties: { name: `Poste ${i}` }
    }));
    const res = await request(app).post('/api/gis/import/geojson').send({
      geojson: { type: 'FeatureCollection', features }
    });
    expect(res.status).toBe(400);
  });

  it('deve importar postes com GeoJSON válido e retornar contagem', async () => {
    const validGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-42.92185, -22.15018] },
          properties: { name: 'Poste GIS Nova Friburgo', utm_x: '788547', utm_y: '7634925' }
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-42.93, -22.16] },
          properties: { name: 'Poste GIS 2' }
        }
      ]
    };
    const res = await request(app).post('/api/gis/import/geojson').send({ geojson: validGeoJSON });
    expect(res.status).toBe(200);
    expect(res.body.detail).toMatch(/2 postes importados/);
  });

  it('deve ignorar features com coordenadas inválidas e importar as válidas', async () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-42.92185, -22.15018] },
          properties: { name: 'Válido' }
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [999, 999] }, // fora do range
          properties: { name: 'Inválido' }
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: ['a', 'b'] }, // não-numérico
          properties: { name: 'Tipo errado' }
        }
      ]
    };
    const res = await request(app).post('/api/gis/import/geojson').send({ geojson });
    expect(res.status).toBe(200);
    expect(res.body.detail).toMatch(/1 postes importados/);
  });
});
