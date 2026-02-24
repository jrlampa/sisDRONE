import { useMemo } from 'react';
import type { Pole } from '../types';

export type FilterCondition = 'All' | 'Critical' | 'Warning' | 'Good';

const AHI_THRESHOLDS = {
  Critical: { max: 50 },
  Warning: { min: 50, max: 80 },
  Good: { min: 80 },
} as const;

/**
 * usePoleSearch — Single-Responsibility hook for pole filtering.
 * Extracted from App.tsx `filteredPoles` useMemo block.
 *
 * @param poles - All poles to filter
 * @param searchQuery - Text search (matches name or ID)
 * @param filterCondition - AHI-based condition filter
 * @returns Memoized filtered poles array
 */
export function usePoleSearch(
  poles: Pole[],
  searchQuery: string,
  filterCondition: FilterCondition
): Pole[] {
  return useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return poles.filter(pole => {
      const matchesSearch =
        !query ||
        pole.name.toLowerCase().includes(query) ||
        pole.id.toString().includes(query);

      if (!matchesSearch) return false;
      if (filterCondition === 'All') return true;

      const score = pole.ahi_score ?? 100;
      if (filterCondition === 'Critical') return score < AHI_THRESHOLDS.Critical.max;
      if (filterCondition === 'Warning') {
        return score >= AHI_THRESHOLDS.Warning.min && score < AHI_THRESHOLDS.Warning.max;
      }
      return score >= AHI_THRESHOLDS.Good.min; // Good
    });
  }, [poles, searchQuery, filterCondition]);
}
