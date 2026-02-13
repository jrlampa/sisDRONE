import { describe, it, expect } from 'vitest';
import { calculateAHI } from './healthService';
import { Pole, AnalysisResult } from '../types';

describe('HealthService', () => {
  it('should return 100 for a new pole with no analysis', () => {
    const pole: Pole = { id: 1, installation_date: new Date().toISOString() };
    expect(calculateAHI(pole)).toBe(100); // Actually it might be 95 due to ID%2==0 logic? Let's check environment mock
  });

  it('should deduct points for age', () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 10);
    const pole: Pole = { id: 3, installation_date: oldDate.toISOString() }; // ID 3 (odd) avoids environment penalty
    // 100 - 10 = 90
    expect(calculateAHI(pole)).toBe(90);
  });

  it('should deduct 40 points for Critical condition', () => {
    const pole: Pole = { id: 3 };
    const analysis: AnalysisResult = {
      labelId: 1,
      pole_type: 'Concreto',
      structures: [],
      condition: 'Crítica (Trinca exposta)',
      confidence: 0.9,
      analysis_summary: ''
    };
    // 100 - 40 = 60
    expect(calculateAHI(pole, analysis)).toBe(60);
  });

  it('should deduct 15 points for Warning condition', () => {
    const pole: Pole = { id: 3 };
    const analysis: AnalysisResult = {
      labelId: 1,
      pole_type: 'Madeira',
      structures: [],
      condition: 'Atenção (Desgaste moderado)',
      confidence: 0.9,
      analysis_summary: ''
    };
    // 100 - 15 = 85
    expect(calculateAHI(pole, analysis)).toBe(85);
  });

  it('should apply environment penalty for even IDs', () => {
    const pole: Pole = { id: 2 }; // Even ID = Coastal = -5
    expect(calculateAHI(pole)).toBe(95);
  });
});
