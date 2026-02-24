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
