import { describe, it, expect } from 'vitest';
import { predictLifespan } from './predictionService';
import { Pole } from '../types';

describe('PredictionService', () => {
  it('should predict logic for standard Concrete pole', () => {
    // 5 years old, score 95 (lost 1pt/year) -> Normal decay
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 1,
      material: 'Concreto',
      installation_date: new Date(currentYear - 5, 0, 1).toISOString(),
      ahi_score: 95
    };

    const result = predictLifespan(pole);
    // 100 - 95 = 5 pts lost in 5 years = 1 pt/year
    // To reach 30 (failure), need to lose 65 more points.
    // 65 / 1 = 65 years remaining.
    expect(result.decay_rate).toBeCloseTo(1.0);
    expect(result.years_remaining).toBeCloseTo(65.0);
  });

  it('should predict accelerated decay for damaged pole', () => {
    // 10 years old, score 60 (Major damage) -> Fast decay
    const currentYear = new Date().getFullYear();
    const pole: Pole = {
      id: 2,
      material: 'Madeira', // 25 year lifespan usually
      installation_date: new Date(currentYear - 10, 0, 1).toISOString(),
      ahi_score: 60
    };

    // 100 - 60 = 40 pts lost in 10 years = 4 pts/year
    // To reach 30, need to lose 30 more points.
    // 30 / 4 = 7.5 years remaining.
    const result = predictLifespan(pole);
    expect(result.decay_rate).toBe(4);
    expect(result.years_remaining).toBe(7.5);
  });
});
