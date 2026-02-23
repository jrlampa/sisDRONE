import { describe, it, expect } from 'vitest';
import { predictLifespan } from './predictionService';
import { Pole } from '../types';

describe('PredictionService', () => {
  it('should predict logic for standard Concrete pole', () => {
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 1,
      material: 'Concreto',
      installation_date: new Date(currentYear - 5, 0, 1).toISOString(),
      ahi_score: 95
    };

    const result = predictLifespan(pole);
    expect(result.decay_rate).toBeCloseTo(1.0);
    expect(result.years_remaining).toBeCloseTo(65.0);
  });

  it('should predict accelerated decay for damaged pole', () => {
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 2,
      material: 'Madeira',
      installation_date: new Date(currentYear - 10, 0, 1).toISOString(),
      ahi_score: 60
    };

    const result = predictLifespan(pole);
    expect(result.decay_rate).toBe(4);
    expect(result.years_remaining).toBe(7.5);
  });

  it('should use default age (10 years) when no installation_date provided', () => {
    const pole: Pole = { id: 3, material: 'Metal', ahi_score: 90 };
    const result = predictLifespan(pole);
    // age = 10, score = 90, decay = (100-90)/10 = 1 pt/yr (age>2 && score<100)
    expect(result.decay_rate).toBeCloseTo(1.0);
    expect(result.years_remaining).toBeCloseTo(60.0);
    expect(result.health_history).toHaveLength(3);
  });

  it('should fall back to default lifespan (30yr) for unknown material', () => {
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 4,
      material: 'Fibra',
      installation_date: new Date(currentYear - 15, 0, 1).toISOString(),
      ahi_score: 85
    };
    const result = predictLifespan(pole);
    // age=15 > 2, score<100 → actual decay = (100-85)/15 = 1 pt/yr
    expect(result.decay_rate).toBeCloseTo(1.0);
    // unknown material → MATERIAL_LIFESPAN['default'] = 30
    // default decay_rate = 100/30 ≈ 3.33 but actual (1.0) is used since age>2
    expect(result.health_history).toHaveLength(3);
  });

  it('should use default decay rate for pole aged <= 2 years', () => {
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 5,
      material: 'concreto',
      installation_date: new Date(currentYear - 1, 0, 1).toISOString(),
      ahi_score: 98
    };
    const result = predictLifespan(pole);
    // age = 1 (≤2) → decayRate = 100/40 = 2.5 (concrete lifespan)
    // but clamped to max(0.5, 2.5) = 2.5
    expect(result.decay_rate).toBeCloseTo(2.5);
  });

  it('should return confidence 0.5 for pole aged <= 5 years', () => {
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 6,
      material: 'madeira',
      installation_date: new Date(currentYear - 3, 0, 1).toISOString(),
      ahi_score: 97
    };
    const result = predictLifespan(pole);
    // age = 3 (≤5) → confidence = 0.5
    expect(result.confidence).toBe(0.5);
  });

  it('should return confidence 0.85 for pole aged > 5 years', () => {
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 7,
      material: 'metal',
      installation_date: new Date(currentYear - 10, 0, 1).toISOString(),
      ahi_score: 80
    };
    const result = predictLifespan(pole);
    // age = 10 (>5) → confidence = 0.85
    expect(result.confidence).toBe(0.85);
  });

  it('should clamp years_remaining to 0 for pole already at or below failure threshold', () => {
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 8,
      material: 'metal',
      installation_date: new Date(currentYear - 20, 0, 1).toISOString(),
      ahi_score: 20 // below failure threshold (30)
    };
    const result = predictLifespan(pole);
    expect(result.years_remaining).toBe(0);
  });
});
