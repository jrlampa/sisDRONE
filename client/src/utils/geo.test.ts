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
});
