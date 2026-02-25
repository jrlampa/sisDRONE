/**
 * gis.ts — Rotas GIS: Export GeoJSON/KML e Import GeoJSON (Phase 51 aprimorado)
 *
 * GET /api/gis/export/geojson?tenant_id=&circuit_id=&ahi_max=
 *   Exporta postes (Point) + condutores (LineString) como FeatureCollection GeoJSON.
 *   Suporta filtros opcionais por tenant, circuito e AHI máximo.
 *
 * GET /api/gis/export/kml?tenant_id=
 *   Exporta postes como KML para uso em Google Earth Pro e similares.
 *
 * POST /api/gis/import/geojson
 *   Importa postes a partir de um GeoJSON FeatureCollection (máx 1000).
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escapa caracteres especiais XML para uso seguro em KML/XML */
function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── GET /api/gis/export/geojson ───────────────────────────────────────────────

/**
 * Exporta a rede como GeoJSON FeatureCollection com:
 * - Postes como Features de geometria Point
 * - Condutores como Features de geometria LineString
 * Filtros opcionais: tenant_id, circuit_id, ahi_max
 */
router.get('/export/geojson', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const tenantId  = req.query.tenant_id  ? parseInt(String(req.query.tenant_id),  10) : null;
  const circuitId = req.query.circuit_id ? parseInt(String(req.query.circuit_id), 10) : null;
  const ahiMax    = req.query.ahi_max    ? parseFloat(String(req.query.ahi_max))       : null;

  if (tenantId  !== null && (isNaN(tenantId)  || tenantId  <= 0)) return res.status(400).json({ error: 'tenant_id inválido'  });
  if (circuitId !== null && (isNaN(circuitId) || circuitId <= 0)) return res.status(400).json({ error: 'circuit_id inválido' });
  if (ahiMax    !== null && (isNaN(ahiMax)    || ahiMax < 0 || ahiMax > 100)) return res.status(400).json({ error: 'ahi_max deve estar entre 0 e 100' });

  try {
    const db = await getDb();

    // ── Poles ──
    const poleConds: string[] = [];
    const poleParams: (number)[] = [];
    if (tenantId  !== null) { poleConds.push('tenant_id = ?');  poleParams.push(tenantId);  }
    if (circuitId !== null) { poleConds.push('circuit_id = ?'); poleParams.push(circuitId); }
    if (ahiMax    !== null) { poleConds.push('(ahi_score IS NULL OR ahi_score <= ?)'); poleParams.push(ahiMax); }
    const poleWhere = poleConds.length ? `WHERE ${poleConds.join(' AND ')}` : '';

    const poles = await db.all(
      `SELECT id, name, lat, lng, ahi_score, status, material, structure_type,
              height, circuit_id, tenant_id, installation_date
         FROM poles ${poleWhere} ORDER BY id`,
      poleParams
    );

    // ── Conductors ──
    const condConds: string[] = [
      'pf.lat IS NOT NULL AND pf.lng IS NOT NULL',
      'pt.lat IS NOT NULL AND pt.lng IS NOT NULL',
    ];
    const condParams: (number)[] = [];
    if (tenantId  !== null) { condConds.push('c.tenant_id = ?');  condParams.push(tenantId);  }
    if (circuitId !== null) { condConds.push('c.circuit_id = ?'); condParams.push(circuitId); }

    const conductors = await db.all(
      `SELECT c.id, c.network_type, c.cable_type, c.voltage_kv,
              c.length_m, c.computed_length_m, c.circuit_id, c.tenant_id,
              pf.lat AS from_lat, pf.lng AS from_lng, pf.name AS from_name,
              pt.lat AS to_lat,   pt.lng AS to_lng,   pt.name AS to_name
         FROM conductors c
         JOIN poles pf ON pf.id = c.pole_from
         JOIN poles pt ON pt.id = c.pole_to
        WHERE ${condConds.join(' AND ')}
        ORDER BY c.id`,
      condParams
    );

    // ── Build FeatureCollection ──
    const poleFeatures = poles.map((p: Record<string, unknown>) => ({
      type: 'Feature' as const,
      id: p.id,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: {
        entity: 'pole',
        name: p.name,
        ahi_score: p.ahi_score,
        status: p.status,
        material: p.material,
        structure_type: p.structure_type,
        height: p.height,
        circuit_id: p.circuit_id,
        tenant_id: p.tenant_id,
        installation_date: p.installation_date,
      },
    }));

    const conductorFeatures = conductors.map((c: Record<string, unknown>) => ({
      type: 'Feature' as const,
      id: `c${c.id}`,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [c.from_lng, c.from_lat],
          [c.to_lng,   c.to_lat],
        ],
      },
      properties: {
        entity: 'conductor',
        network_type: c.network_type,
        cable_type: c.cable_type,
        voltage_kv: c.voltage_kv,
        length_m: c.computed_length_m ?? c.length_m,
        circuit_id: c.circuit_id,
        tenant_id: c.tenant_id,
        from_name: c.from_name,
        to_name: c.to_name,
      },
    }));

    const geojson = {
      type: 'FeatureCollection',
      features: [...poleFeatures, ...conductorFeatures],
      metadata: {
        generated_at: new Date().toISOString(),
        total_poles: poles.length,
        total_conductors: conductors.length,
        filters: { tenant_id: tenantId, circuit_id: circuitId, ahi_max: ahiMax },
      },
    };

    res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sisdrone_network.geojson"');
    res.json(geojson);
  } catch (err) {
    console.error('Erro ao exportar GeoJSON:', err);
    res.status(500).json({ error: 'Erro ao exportar GeoJSON' });
  }
});

// ── GET /api/gis/export/kml ───────────────────────────────────────────────────

/**
 * Exporta postes como KML (Keyhole Markup Language) para Google Earth Pro.
 * Filtros: tenant_id.
 */
router.get('/export/kml', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const tenantId = req.query.tenant_id ? parseInt(String(req.query.tenant_id), 10) : null;
  if (tenantId !== null && (isNaN(tenantId) || tenantId <= 0)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  try {
    const db = await getDb();

    const kmlConds: string[] = ['lat IS NOT NULL', 'lng IS NOT NULL'];
    const kmlParams: (number)[] = [];
    if (tenantId !== null) { kmlConds.push('tenant_id = ?'); kmlParams.push(tenantId); }

    const poles = await db.all(
      `SELECT id, name, lat, lng, ahi_score, status, material, structure_type
         FROM poles
        WHERE ${kmlConds.join(' AND ')}
        ORDER BY id`,
      kmlParams
    );

    // ── AHI → estilo KML ──
    function ahiStyle(ahi: number | null): string {
      if (ahi == null)  return 'ff888888'; // cinza — sem dado
      if (ahi < 30)     return 'ff0000cc'; // vermelho
      if (ahi < 50)     return 'ff00aaff'; // laranja
      if (ahi < 80)     return 'ff00ddff'; // amarelo
      return               'ff00bb44'; // verde
    }

    const placemarks = poles
      .filter((p: Record<string, unknown>) => p.lat != null && p.lng != null)
      .map((p: Record<string, unknown>) => {
        const name        = escapeXml(String(p.name ?? `Poste #${p.id}`));
        const description = escapeXml(
          `AHI: ${p.ahi_score ?? 'N/D'} | Status: ${p.status ?? 'N/D'} | Material: ${p.material ?? 'N/D'}`
        );
        const color = ahiStyle(p.ahi_score as number | null);
        return `
  <Placemark>
    <name>${name}</name>
    <description>${description}</description>
    <Style>
      <IconStyle>
        <color>${color}</color>
        <scale>0.8</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Point>
      <coordinates>${p.lng},${p.lat},0</coordinates>
    </Point>
  </Placemark>`;
      })
      .join('\n');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>sisDRONE — Rede Elétrica</name>
    <description>Exportação de postes gerada em ${new Date().toLocaleDateString('pt-BR')}</description>
    ${placemarks}
  </Document>
</kml>`;

    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sisdrone_rede.kml"');
    res.send(kml);
  } catch (err) {
    console.error('Erro ao exportar KML:', err);
    res.status(500).json({ error: 'Erro ao exportar KML' });
  }
});

// ── POST /api/gis/import/geojson ─────────────────────────────────────────────

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
      const name  = feature.properties?.name  ? String(feature.properties.name).slice(0, 100)  : 'Importado';
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
    console.error('Erro ao importar GeoJSON:', err);
    res.status(500).json({ error: 'Import error' });
  }
});

export default router;

