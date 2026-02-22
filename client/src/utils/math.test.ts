import { describe, it, expect } from 'vitest';
import { calculateDistance } from './math';

describe('Haversine Distance Utils', () => {
  it('should return ~0 for identical coordinates', () => {
    const d = calculateDistance(-22.15018, -42.92185, -22.15018, -42.92185);
    expect(d).toBeCloseTo(0, 1);
  });

  it('should calculate ~100m distance between two close points', () => {
    // ~100m north of the Nova Friburgo reference point
    const d = calculateDistance(-22.15018, -42.92185, -22.14928, -42.92185);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });

  it('should calculate ~500m distance', () => {
    // ~500m north
    const d = calculateDistance(-22.15018, -42.92185, -22.14568, -42.92185);
    expect(d).toBeGreaterThan(450);
    expect(d).toBeLessThan(550);
  });

  it('should calculate ~1km distance', () => {
    // ~1km north
    const d = calculateDistance(-22.15018, -42.92185, -22.14118, -42.92185);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });

  it('should be symmetric (A→B equals B→A)', () => {
    const d1 = calculateDistance(-22.15018, -42.92185, -22.9068, -43.1729);
    const d2 = calculateDistance(-22.9068, -43.1729, -22.15018, -42.92185);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('should calculate known distance between Rio and São Paulo (~360km)', () => {
    const d = calculateDistance(-22.9068, -43.1729, -23.5505, -46.6333);
    expect(d / 1000).toBeGreaterThan(350);
    expect(d / 1000).toBeLessThan(380);
  });
});
