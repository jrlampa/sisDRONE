/**
 * Structural Engineering Utilities for Power Lines
 */

export interface CableType {
  name: string;
  weight: number; // kg/m
}

export const COMMON_CABLES: CableType[] = [
  { name: 'CAA 4/0 Penguin', weight: 0.545 },
  { name: 'CAA 2/0 Pidgeon', weight: 0.343 },
  { name: 'Alumínio 1/0 Raven', weight: 0.145 },
  { name: 'Multiplexado 3x70+70', weight: 0.850 }
];

/**
 * Calculates theoretical Sag (Flecha) using the Parabolic Approximation
 * f = (w * L^2) / (8 * T)
 * 
 * @param weight Conductor weight in kg/m
 * @param length Span length in meters
 * @param tension Horizontal tension in kgf (kilogram-force)
 * @returns Sag in meters
 */
export function calculateSag(weight: number, length: number, tension: number): number {
  if (tension <= 0) return 0;
  return (weight * Math.pow(length, 2)) / (8 * tension);
}

/**
 * Calculates Tension required for a specific Sag
 * T = (w * L^2) / (8 * f)
 */
export function calculateRequiredTension(weight: number, length: number, sag: number): number {
  if (sag <= 0) return 0;
  return (weight * Math.pow(length, 2)) / (8 * sag);
}
