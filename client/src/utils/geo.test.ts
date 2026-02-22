import { describe, it, expect } from 'vitest';
import { degreesToUtm } from './geo';

describe('Frontend Geo Utils', () => {
  it('should match backend UTM logic for Rio de Janeiro', () => {
    const lat = -22.9068;
    const lng = -43.1729;

    const result = degreesToUtm(lat, lng);

    expect(result.zone).toBe('23S');
    expect(parseFloat(result.x)).toBeGreaterThan(687000);
    expect(parseFloat(result.y)).toBeGreaterThan(7465000);
  });

  it('should convert Nova Friburgo/RJ test coordinates to correct UTM zone', () => {
    const lat = -22.15018;
    const lng = -42.92185;

    const result = degreesToUtm(lat, lng);

    expect(result.zone).toBe('23S');
    // Easting ~714315 for these decimal coordinates in zone 23
    expect(parseFloat(result.x)).toBeGreaterThan(713500);
    expect(parseFloat(result.x)).toBeLessThan(715500);
    // Northing ~7549084 (Southern hemisphere with 10M false northing)
    expect(parseFloat(result.y)).toBeGreaterThan(7548000);
    expect(parseFloat(result.y)).toBeLessThan(7550500);
  });
});

