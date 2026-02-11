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
});
