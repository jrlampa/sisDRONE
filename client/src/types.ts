export interface Pole {
  id: number;
  name: string;
  lat: number;
  lng: number;
  utm_x?: string;
  utm_y?: string;
  tenant_id: number;
  status: string;
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
  pole_type: string;
  structures: string[];
  condition: string;
  confidence: number;
  analysis_summary: string;
  imageUrl?: string;
}

export interface Stats {
  total: number;
  critical: number;
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
