export interface Pole {
  id: number;
  name?: string;
  lat?: number;
  lng?: number;
  utm_x?: string;
  utm_y?: string;
  tenant_id?: number;
  status?: string;
  ahi_score?: number;
  installation_date?: string;
  material?: string;
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
