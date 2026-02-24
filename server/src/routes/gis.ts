import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// GET GIS Export (GeoJSON)
router.get('/export/geojson', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const poles = await db.all('SELECT * FROM poles');
    const geojson = {
      type: 'FeatureCollection',
      features: poles.map(p => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { name: p.name, utm_x: p.utm_x, utm_y: p.utm_y }
      }))
    };
    res.json(geojson);
  } catch (err) {
    res.status(500).json({ error: 'Export error' });
  }
});

// POST GIS Import (GeoJSON)
router.post('/import/geojson', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  const { geojson } = req.body;
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    return res.status(400).json({ error: 'GeoJSON inválido' });
  }
  if (geojson.features.length === 0) {
    return res.status(400).json({ error: 'Nenhuma feature encontrada no GeoJSON' });
  }
  if (geojson.features.length > 1000) {
    return res.status(400).json({ error: 'Máximo de 1000 features por importação' });
  }

  let imported = 0;
  try {
    const db = await getDb();
    for (const feature of geojson.features) {
      if (!feature?.geometry?.coordinates || !Array.isArray(feature.geometry.coordinates)) continue;
      const [lng, lat] = feature.geometry.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      const name = feature.properties?.name ? String(feature.properties.name).slice(0, 100) : 'Importado';
      const utm_x = feature.properties?.utm_x ? String(feature.properties.utm_x).slice(0, 50) : null;
      const utm_y = feature.properties?.utm_y ? String(feature.properties.utm_y).slice(0, 50) : null;
      await db.run(
        'INSERT INTO poles (lat, lng, name, utm_x, utm_y) VALUES (?, ?, ?, ?, ?)',
        [lat, lng, name, utm_x, utm_y]
      );
      imported++;
    }
    res.json({ detail: `${imported} postes importados!` });
  } catch (err) {
    res.status(500).json({ error: 'Import error' });
  }
});

export default router;
