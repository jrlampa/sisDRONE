import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database before importing costService
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    all: vi.fn().mockResolvedValue([
      { name: 'Poste de Concreto', unit_price: 1200.00, match_keys: 'poste,concreto,substituição de poste' },
      { name: 'Cruzeta de Madeira', unit_price: 150.00, match_keys: 'cruzeta,madeira,braço' },
      { name: 'Transformador 75kVA', unit_price: 8500.00, match_keys: 'transformador,trafo' },
    ])
  })
}));

import { calculatePlanCost } from '../services/costService';

describe('CostService', () => {
  it('should return 0 for empty plan text', async () => {
    const cost = await calculatePlanCost('Sem material reconhecível');
    expect(cost).toBe(0);
  });

  it('should calculate cost for plan mentioning concreto', async () => {
    const planText = 'Substituição de poste de concreto danificado. Usar poste novo.';
    const cost = await calculatePlanCost(planText);
    // "poste" and "concreto" match the first material → 1200 * 1.4 = 1680
    expect(cost).toBeGreaterThan(0);
  });

  it('should accumulate costs for multiple materials', async () => {
    const planText = 'Substituição de concreto. Instalar nova cruzeta. Verificar transformador.';
    const cost = await calculatePlanCost(planText);
    // All 3 materials matched → (1200 + 150 + 8500) * 1.4 = 13790
    expect(cost).toBeCloseTo((1200 + 150 + 8500) * 1.4, 0);
  });

  it('should apply 40% labor surcharge', async () => {
    const planText = 'Instalar cruzeta de madeira.';
    const cost = await calculatePlanCost(planText);
    expect(cost).toBeCloseTo(150 * 1.4, 1);
  });
});
