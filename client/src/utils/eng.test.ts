import { describe, it, expect } from 'vitest';
import { calculateSag, calculateRequiredTension } from './eng';

describe('Engineering Utils', () => {
  it('should calculate correct sag for a 40m span', () => {
    const weight = 0.545; // Penguin
    const length = 40;
    const tension = 250;

    const sag = calculateSag(weight, length, tension);
    // f = (0.545 * 1600) / (8 * 250) = 872 / 2000 = 0.436
    expect(sag).toBeCloseTo(0.436, 3);
  });

  it('should calculate correct tension for a specific sag', () => {
    const weight = 0.343; // Pidgeon
    const length = 50;
    const sag = 0.8;

    const tension = calculateRequiredTension(weight, length, sag);
    // T = (0.343 * 2500) / (8 * 0.8) = 857.5 / 6.4 = 134.0
    expect(tension).toBeCloseTo(133.98, 1);
  });

  it('should return 0 for non-positive input', () => {
    expect(calculateSag(0.5, 40, 0)).toBe(0);
    expect(calculateRequiredTension(0.5, 40, -1)).toBe(0);
  });
});
