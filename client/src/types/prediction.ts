export interface Prediction {
  estimated_eol_date: string;
  years_remaining: number;
  decay_rate: number;
  confidence: number;
  health_history: { year: number; score: number }[];
}
