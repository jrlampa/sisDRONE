import { Pole, AnalysisResult } from '../types';
// Since we don't have shared types set up between client/server easily without monorepo tools, I will define simple interfaces here or rely on 'any' for the mixed context, but best to define them.

interface PoleData {
  id?: number;
  installation_date?: string;
  ahi_score?: number;
}

interface AIAnalysis {
  condition: string; // 'Good', 'Warning', 'Critical'
  confidence: number;
}

export const calculateAHI = (pole: Pole, analysis?: AnalysisResult): number => {
  let score = 100;

  // 1. Age Factor
  if (pole.installation_date) {
    const installYear = new Date(pole.installation_date).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - installYear;
    score -= Math.max(0, age * 1); // -1 point per year
  }

  // 2. AI Condition Factor
  if (analysis) {
    const condition = analysis.condition.toLowerCase();
    if (condition.includes('crítica') || condition.includes('critical') || condition.includes('trinca') || condition.includes('corrosão')) {
      score -= 40;
    } else if (condition.includes('atenção') || condition.includes('warning') || condition.includes('desgaste')) {
      score -= 15;
    }
  }

  // 3. Environmental Factor (Mocked based on ID for determinism)
  // Even IDs are "Coastal" (-5 pts)
  if (pole.id && pole.id % 2 === 0) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score)); // Clamp between 0-100
};
