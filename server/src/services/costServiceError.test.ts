import { describe, it, expect, vi } from 'vitest';

// Mock the database to throw an error for this test suite
vi.mock('../db', () => ({
  getDb: vi.fn().mockRejectedValue(new Error('DB connection failed'))
}));

import { calculatePlanCost } from '../services/costService';

describe('CostService — DB error branch', () => {
  it('should return 0 when DB throws', async () => {
    const cost = await calculatePlanCost('concreto');
    expect(cost).toBe(0);
  });
});
