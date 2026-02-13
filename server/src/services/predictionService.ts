import { Pole } from '../types';

interface Prediction {
  estimated_eol_date: string;
  years_remaining: number;
  decay_rate: number; // points per year
  confidence: number;
  health_history: { year: number; score: number }[];
}

const MATERIAL_LIFESPAN: Record<string, number> = {
  'concreto': 40,
  'concrete': 40,
  'madeira': 25,
  'wood': 25,
  'metal': 35,
  'steel': 35,
  'ferro': 35,
  'default': 30
};

export const predictLifespan = (pole: Pole): Prediction => {
  const currentYear = new Date().getFullYear();
  const installDate = pole.installation_date ? new Date(pole.installation_date) : new Date(currentYear - 10, 0, 1);
  const installYear = installDate.getFullYear();
  const age = currentYear - installYear;

  const currentScore = pole.ahi_score ?? 100;

  // Normalize material to lowercase for lookup
  const material = (pole.material || 'default').toLowerCase();
  const expectedLifespan = MATERIAL_LIFESPAN[material] || MATERIAL_LIFESPAN['default'];

  // Calculate specific decay rate for this asset
  // Standard decay = 100 / expectedLifespan
  // Actual decay = (100 - currentScore) / age (if age > 0)

  let decayRate = 100 / expectedLifespan; // default assumption
  if (age > 2 && currentScore < 100) {
    decayRate = (100 - currentScore) / age;
  }

  // Clamp decay rate to avoid division by zero or negative
  decayRate = Math.max(0.5, decayRate);

  // Failure threshold is AHI = 30
  const pointsToLose = currentScore - 30;
  const yearsRemaining = Math.max(0, pointsToLose / decayRate);

  const eolYear = currentYear + Math.round(yearsRemaining);
  const estimated_eol_date = new Date(eolYear, installDate.getMonth(), installDate.getDate()).toISOString();

  // Generate a simple projection for the chart (Past + Future)
  const health_history: { year: number; score: number }[] = [];

  // Past: Start (100) -> Now (currentScore)
  health_history.push({ year: installYear, score: 100 });
  health_history.push({ year: currentYear, score: currentScore });

  // Future: Now -> EOL (30)
  health_history.push({ year: eolYear, score: 30 });

  return {
    estimated_eol_date,
    years_remaining: parseFloat(yearsRemaining.toFixed(1)),
    decay_rate: parseFloat(decayRate.toFixed(2)),
    confidence: age > 5 ? 0.85 : 0.5, // deeper history = higher confidence
    health_history
  };
};
