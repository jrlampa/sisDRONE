import { describe, it, expect } from 'vitest';
import { degreesToUtm } from '../utils/geo.js';

describe('Geospatial Utils', () => {
  it('should convert Rio de Janeiro coordinates to UTM Zone 23S correctly', () => {
    // Approx coordinates for a point in Rio
    const lat = -22.9068;
    const lng = -43.1729;

    const result = degreesToUtm(lat, lng);

    expect(result.zone).toBe('23S');
    // Approximate expected values for these coordinates
    expect(result.x).toBeGreaterThan(687000);
    expect(result.x).toBeLessThan(688000);
    expect(result.y).toBeGreaterThan(7465000);
    expect(result.y).toBeLessThan(7466000);
  });

  it('should handle northern hemisphere correctly', () => {
    const lat = 40.7128; // New York
    const lng = -74.0060;

    const result = degreesToUtm(lat, lng);
    expect(result.zone).toBe('18N');
  });

  it('should convert Nova Friburgo/RJ test coordinates (decimal) to Zone 23S UTM', () => {
    // Decimal coordinates from problem statement: -22.15018, -42.92185
    // These are in UTM Zone 23S
    const lat = -22.15018;
    const lng = -42.92185;

    const result = degreesToUtm(lat, lng);

    expect(result.zone).toBe('23S');
    // Easting ~714315 (lng -42.92185 is ~2.08° east of zone 23 central meridian at -45°)
    expect(result.x).toBeGreaterThan(713500);
    expect(result.x).toBeLessThan(715500);
    // Northing ~7549084 (Southern hemisphere with 10,000,000 false northing)
    expect(result.y).toBeGreaterThan(7548000);
    expect(result.y).toBeLessThan(7550500);
  });
});

