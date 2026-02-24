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
  notes?: string;
  created_at: string;
  from_lat: number;
  from_lng: number;
  from_name: string;
  to_lat: number;
  to_lng: number;
  to_name: string;
}
