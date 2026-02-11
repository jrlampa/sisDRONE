import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET GIS Export (GeoJSON)
router.get('/export/geojson', async (req: Request, res: Response) => {
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
router.post('/import/geojson', async (req: Request, res: Response) => {
  const { geojson } = req.body;
  if (!geojson || geojson.type !== 'FeatureCollection') {
    return res.status(400).json({ error: 'Invalid GeoJSON' });
  }
  try {
    const db = await getDb();
    for (const feature of geojson.features) {
      const { coordinates } = feature.geometry;
      const { name, utm_x, utm_y } = feature.properties;
      await db.run(
        'INSERT INTO poles (lat, lng, name, utm_x, utm_y) VALUES (?, ?, ?, ?, ?)',
        [coordinates[1], coordinates[0], name || 'Imported', utm_x || '', utm_y || '']
      );
    }
    res.json({ detail: `${geojson.features.length} postes importados!` });
  } catch (err) {
    res.status(500).json({ error: 'Import error' });
  }
});

export default router;
