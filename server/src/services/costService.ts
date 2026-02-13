import { getDb } from '../db';

interface Material {
  name: string;
  unit_price: number;
  match_keys: string;
}

export async function calculatePlanCost(planText: string): Promise<number> {
  try {
    const db = await getDb();
    const materials: Material[] = await db.all('SELECT * FROM materials');

    let totalCost = 0;
    const normalizedPlan = planText.toLowerCase();

    // Simple keyword matching algorithm
    // In a real scenario, LLM could extract exact quantities
    for (const material of materials) {
      const keys = material.match_keys.split(',');
      for (const key of keys) {
        if (normalizedPlan.includes(key.trim().toLowerCase())) {
          // Assume 1 unit per match for now, or add base cost
          // Adding randomness to simulate quantity variation for demo purposes
          // or fixed quantity logic:
          totalCost += material.unit_price;
          break; // Count material only once per plan text match group
        }
      }
    }

    // Add 40% labor and incidental costs
    return totalCost * 1.4;
  } catch (error) {
    console.error('Failed to calculate cost:', error);
    return 0;
  }
}
