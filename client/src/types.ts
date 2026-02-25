export interface Pole {
  id: number;
  name: string;
  lat: number;
  lng: number;
  utm_x?: string;
  utm_y?: string;
  tenant_id: number;
  status: string;
  ahi_score?: number;
  installation_date?: string;
  material?: string;
  // Phase 54 — MT/BT Structure Classification
  network_level?: 'MT' | 'BT' | 'AT';
  structure_config?: 'tangente' | 'angulo' | 'derivacao' | 'seccionamento' | 'terminal' | 'passagem';
  phase_config?: 'M' | 'B' | 'T';
  num_arms?: number;
}

export interface Span {
  p1: Pole;
  p2: Pole;
  distance: number;
}

export interface Inspection {
  id: number;
  pole_id: number;
  label: string;
  confidence: number;
  source: string;
  created_at: string;
  file_path?: string;
}

export interface AnalysisResult {
  labelId: number;
  imageId?: number;
  pole_type: string;
  structures: string[];
  condition: string;
  confidence: number;
  analysis_summary: string;
  imageUrl?: string;
  ahi_score?: number;
}

export interface Stats {
  total: number;
  critical: number;
  warning: number;
  healthy: number;
}

export interface Tenant {
  id: number;
  name: string;
  primary_color: string;
  accent_color: string;
  logo_url?: string;
}

export interface User {
  id: number;
  username: string;
  role: 'ADMIN' | 'ENGINEER' | 'VIEWER';
  tenant_id: number;
}

export interface DashboardData {
  totalPoles: number;
  totalInspections: number;
  conditionStats: { condition: string; count: number }[];
  materialStats: { material: string; count: number }[];
  ahiHistogram: { range: string; count: number }[];
}

export interface WorkOrder {
  id: number;
  title: string;
  description: string;
  priority: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';
  assignee_id?: number;
  pole_id?: number;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PoleSummaryInspection {
  label: string;
  confidence: number;
  source: string;
  created_at: string;
  file_path?: string;
}

export interface PoleSummaryPlan {
  id: number;
  status: string;
  estimated_cost: number;
  created_at: string;
}

export interface PoleSummary {
  pole: Pick<Pole, 'id' | 'name' | 'ahi_score' | 'status' | 'material' | 'installation_date' | 'tenant_id'>;
  last_inspection: PoleSummaryInspection | null;
  active_plan: PoleSummaryPlan | null;
  inspection_count: number;
}

export interface Conductor {
  id: number;
  tenant_id: number;
  pole_from: number;
  pole_to: number;
  network_type: 'MT' | 'BT' | 'ramal';
  cable_type?: string;
  voltage_kv?: number;
  length_m?: number;
  computed_length_m?: number;
  notes?: string;
  created_at: string;
  from_lat: number;
  from_lng: number;
  from_name: string;
  to_lat: number;
  to_lng: number;
  to_name: string;
}

export interface NetworkSegment {
  segment_id: number;
  pole_ids: number[];
  size: number;
}

export interface NetworkGraph {
  node_count: number;
  edge_count: number;
  nodes: Pole[];
  edges: Conductor[];
}

export interface Circuit {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

export interface TopologyValidation {
  node_count: number;
  edge_count: number;
  is_valid: boolean;
  loops_count: number;
  dead_ends_count: number;
  isolated_count: number;
  duplicates_count: number;
  loops: number[][];
  dead_ends: number[];
  isolated: number[];
  duplicate_spans: Array<{ conductor_ids: number[]; pole_from: number; pole_to: number }>;
}

// Phase 47 — Simulação de Falha
export interface FailureSimulationResult {
  type: 'pole' | 'conductor';
  removed_id: number;
  affected_poles: number[];
  affected_count: number;
  partitions_before: number;
  partitions_after: number;
  estimated_affected_customers: number;
}

// Phase 43 — Dashboard Executivo Multi-Tenant
export interface TenantOverview {
  id: number;
  name: string;
  total_poles: number;
  avg_ahi: number | null;
  critical_poles: number;
  open_work_orders: number;
  last_inspection: string | null;
}

export interface AdminOverviewData {
  total_tenants: number;
  total_poles: number;
  total_open_orders: number;
  tenants: TenantOverview[];
}

export interface TenantStats {
  tenant_id: number;
  tenant_name: string;
  total_poles: number;
  total_conductors: number;
  avg_ahi: number | null;
  critical_poles: number;
  total_work_orders: number;
  open_work_orders: number;
}

// Phase 49 — KPIs Executivos
export interface KpiData {
  tenant_id: number | null;
  period_days: number;
  mttr_hours: number | null;
  inspection_rate_pct: number;
  maintenance_cost_total: number;
  avg_ahi_current: number | null;
  avg_ahi_previous: number | null;
  avg_ahi_delta_pct: number | null;
  recovered_poles: number;
  inspected_poles: number;
  total_poles: number;
}

// Phase 45 — Timeline de Inspeções por Poste
export interface TimelineInspectionEntry {
  type: 'inspection';
  id: number;
  date: string;
  label: string;
  confidence: number;
  source: string;
  file_path: string | null;
}

export interface TimelineAhiEntry {
  type: 'ahi_snapshot';
  id: number;
  date: string;
  ahi_score: number;
  delta_ahi: number | null;
}

export type TimelineEntry = TimelineInspectionEntry | TimelineAhiEntry;

// Phase 46 — Geocodificação Reversa (Nominatim)
export interface GeoAddress {
  display_name: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

// Phase 50 — Audit Log
export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_role: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: number | null;
  ip: string | null;
  created_at: string;
}

// Phase 51 — GIS Export
export interface GeoJSONExportMetadata {
  generated_at: string;
  total_poles: number;
  total_conductors: number;
  filters: { tenant_id: number | null; circuit_id: number | null; ahi_max: number | null };
}

// Phase 52 — Medição Geoespacial
export interface MeasurementSegment {
  from: [number, number];
  to: [number, number];
  distance_m: number;
}

export interface MeasurementResult {
  segments: MeasurementSegment[];
  total_m: number;
  total_km: number;
}

// Phase 53 — Equipamentos por Poste
export type EquipmentType =
  | 'transformer' | 'fuse' | 'recloser' | 'lightning_rod' | 'insulator'
  | 'surge_arrester' | 'capacitor_bank' | 'voltage_regulator'
  | 'disconnect_switch' | 'meter' | 'other';

export type EquipmentStatus = 'active' | 'inactive' | 'defective' | 'scheduled_maintenance';

export interface Equipment {
  id: number;
  pole_id: number;
  tenant_id: number;
  type: EquipmentType;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  installation_date: string | null;
  status: EquipmentStatus;
  notes: string | null;
  created_at: string;
  pole_name?: string;
}

// ── Phase 55: Roteiro de Inspeção por Drone ──────────────────────────────────

export interface RouteWaypoint {
  pole_id: number;
  name: string | null;
  lat: number;
  lng: number;
  ahi_score: number | null;
  order: number;
  distance_from_prev_m: number;
}

export interface DroneRoute {
  total_poles: number;
  total_distance_m: number;
  total_distance_km: number;
  estimated_flight_minutes: number;
  waypoints: RouteWaypoint[];
}

// ── Phase 56: Upload de Fotos de Campo ───────────────────────────────────────

export interface FieldPhoto {
  id: number;
  pole_id: number;
  file_path: string;
  label: string | null;
  captured_at: string;
}

// ── Phase 64: Relação de Materiais (BOM) ─────────────────────────────────────

export interface BomReport {
  tenant_id: number | null;
  circuit_id: number | null;
  generated_at: string;
  poles: {
    by_material: Record<string, number>;
    by_network_level: Record<string, number>;
    by_structure_config: Record<string, number>;
    total: number;
  };
  conductors: {
    by_network_type: Record<string, number>;
    by_cable_type: Record<string, number>;
    total_conductors: number;
    total_length_km: number;
  };
  equipment: {
    by_type: Record<string, number>;
    total: number;
  };
}

// ── Phase 65: Saúde de Circuito ───────────────────────────────────────────────

export interface CircuitHealthReport {
  circuit_id: number;
  circuit_name: string;
  generated_at: string;
  summary: {
    total_poles: number;
    critical_poles: number;
    avg_ahi: number | null;
    total_conductors: number;
    total_length_km: number;
    is_topology_valid: boolean;
  };
  ahi_distribution: Record<string, number>;
  voltage_drop: { total: number; critical: number; warning: number; ok: number };
  topology: {
    loops_count: number;
    dead_ends_count: number;
    isolated_count: number;
    duplicates_count: number;
    is_valid: boolean;
    loops: number[][];
  };
  equipment: Record<string, number>;
}

// ── Phase 66: Agrupamento Espacial de Postes ──────────────────────────────────

export interface PoleCluster {
  cluster_id: number;
  centroid_lat: number;
  centroid_lng: number;
  pole_count: number;
  avg_ahi: number | null;
  critical_count: number;
  network_levels: string[];
  pole_ids: number[];
}

export interface PoleClusters {
  cluster_count: number;
  total_poles: number;
  radius_m: number;
  clusters: PoleCluster[];
}

// ── Map Layer Controls (Phase 60) ──────────────────────────────────────────────

export interface LayerVisibility {
  polesMT: boolean;
  polesBT: boolean;
  polesAT: boolean;
  conductorMT: boolean;
  conductorBT: boolean;
  conductorRamal: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  polesMT: true,
  polesBT: true,
  polesAT: true,
  conductorMT: true,
  conductorBT: true,
  conductorRamal: true,
};
