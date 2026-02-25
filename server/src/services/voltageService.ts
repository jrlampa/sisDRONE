/**
 * voltageService.ts — Cálculo de Queda de Tensão nos Vãos (Phase 33)
 *
 * Fórmula simplificada NBR 5410:
 *   ΔV% = (R_Ω_km × I_A × L_km × 2) / (V_V) × 100
 *   (×2 = fator para circuito monofásico ida+volta)
 *
 * Parâmetros fixos por tipo de rede (baseados em bitolas típicas):
 *   MT  (≥ 13.8 kV): R = 0.25 Ω/km, I = 80 A  (cabo 95 mm² XLPE)
 *   BT  (0.22 kV):   R = 0.50 Ω/km, I = 160 A  (cabo 50 mm² AL)
 *   ramal (0.22 kV): R = 0.80 Ω/km, I = 40 A   (cabo 16 mm² AL)
 *
 * Limites NBR 5410:
 *   > 10% → critical
 *   > 5%  → warning
 *   ≤ 5%  → ok
 */

export type VoltageStatus = 'ok' | 'warning' | 'critical';

interface NetworkTypeParams {
  resistance_ohm_per_km: number;
  current_A: number;
  voltage_V: number; // default nominal voltage in V
}

/**
 * Fixed electrical parameters per network type.
 * Based on typical Brazilian distribution network cables (NBR 5410 / ABNT):
 *   MT (≥13.8 kV): 95 mm² XLPE — R≈0.25 Ω/km; typical feeder load: 80 A
 *   BT (220 V):    50 mm² AL   — R≈0.50 Ω/km; typical urban load:   160 A
 *   Ramal (220 V): 16 mm² AL   — R≈0.80 Ω/km; typical service load: 40 A
 * Voltage defaults used only when conductor.voltage_kv is not set.
 */
const NETWORK_PARAMS: Record<string, NetworkTypeParams> = {
  MT:    { resistance_ohm_per_km: 0.25, current_A: 80,  voltage_V: 13_800 },
  BT:    { resistance_ohm_per_km: 0.50, current_A: 160, voltage_V:    220 },
  ramal: { resistance_ohm_per_km: 0.80, current_A: 40,  voltage_V:    220 },
};

export interface VoltageDrop {
  conductor_id: number;
  pole_from: number;
  pole_to: number;
  from_name: string | null;
  to_name: string | null;
  network_type: string;
  length_m: number;
  voltage_kv: number;
  delta_v_percent: number;
  status: VoltageStatus;
}

export interface RawConductorRow {
  id: number;
  pole_from: number;
  pole_to: number;
  from_name: string | null;
  to_name: string | null;
  network_type: string;
  computed_length_m: number | null;
  length_m: number | null;
  voltage_kv: number | null;
}

/**
 * Determine voltage-drop status per NBR 5410 thresholds.
 */
export function classifyVoltageDrop(deltaPercent: number): VoltageStatus {
  if (deltaPercent > 10) return 'critical';
  if (deltaPercent > 5) return 'warning';
  return 'ok';
}

/**
 * Calculate voltage drop for a single conductor row.
 * Returns null when length or voltage are unavailable.
 */
export function calculateVoltageDrop(row: RawConductorRow): VoltageDrop | null {
  const lengthM = row.computed_length_m ?? row.length_m;
  if (lengthM == null || lengthM <= 0) return null;

  const params = NETWORK_PARAMS[row.network_type] ?? NETWORK_PARAMS.BT;

  // Use declared voltage if provided, otherwise fall back to default for network type
  const voltageV = row.voltage_kv != null && row.voltage_kv > 0
    ? row.voltage_kv * 1000
    : params.voltage_V;

  const lengthKm = lengthM / 1000;

  // ΔV% = (R × I × L × 2) / V × 100
  const deltaV = (params.resistance_ohm_per_km * params.current_A * lengthKm * 2) / voltageV * 100;
  const deltaVRounded = parseFloat(deltaV.toFixed(3));

  return {
    conductor_id: row.id,
    pole_from: row.pole_from,
    pole_to: row.pole_to,
    from_name: row.from_name,
    to_name: row.to_name,
    network_type: row.network_type,
    length_m: lengthM,
    voltage_kv: voltageV / 1000,
    delta_v_percent: deltaVRounded,
    status: classifyVoltageDrop(deltaVRounded),
  };
}
