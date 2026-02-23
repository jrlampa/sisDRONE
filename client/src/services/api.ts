import axios from 'axios';
import type { Tenant, User, WorkOrder, Pole, AnalysisResult, PoleSummary } from '../types';
import type { Prediction } from '../types/prediction';
import { addToQueue } from '../utils/offlineQueue';

const API_BASE = 'http://localhost:3001';

// Inject JWT Bearer token (preferred) or mock role header (dev fallback)
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('sisdrone_jwt');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  } else {
    const role = localStorage.getItem('sisdrone_mock_role');
    if (role) {
      config.headers['x-user-role'] = role;
    }
  }
  return config;
});

// Offline Queue Interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if it's a network error or explicitly offline
    if (error.message === 'Network Error' || !navigator.onLine) {
      // Only queue specific mutations
      const allowedMethods = ['post', 'put', 'delete', 'patch'];
      if (allowedMethods.includes(originalRequest.method)) {
        console.log('[Offline] Queuing request:', originalRequest.url);

        await addToQueue({
          url: originalRequest.url,
          method: originalRequest.method,
          data: JSON.parse(originalRequest.data || '{}'),
        });

        // Optimistic UI response
        return Promise.resolve({
          data: {},
          status: 200,
          statusText: 'Offline Queued',
          headers: {},
          config: originalRequest,
          isOffline: true
        });
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  login: (username: string, password: string) =>
    axios.post<{ token: string, user: User }>(`${API_BASE}/api/auth/login`, { username, password }),
  register: (username: string, password: string, options?: { role?: string; tenant_id?: number }) =>
    axios.post<{ token: string, user: User }>(`${API_BASE}/api/auth/register`, { username, password, ...options }),
  changePassword: (username: string, currentPassword: string, newPassword: string) =>
    axios.post<{ message: string }>(`${API_BASE}/api/auth/change-password`, { username, currentPassword, newPassword }),
  getPoles: (tenantId?: number, page = 1, limit = 100, filters?: { ahi_min?: number; ahi_max?: number; status?: string }) =>
    axios.get(`${API_BASE}/api/poles`, { params: { ...(tenantId ? { tenant_id: tenantId } : {}), page, limit, ...filters } }),
  getHeatmapData: (tenantId?: number) =>
    axios.get<{ count: number; points: Array<{ id: number; lat: number; lng: number; ahi_score: number | null; name: string }> }>(
      `${API_BASE}/api/poles/heatmap`,
      { params: tenantId ? { tenant_id: tenantId } : {} }
    ),
  getAlerts: (tenantId?: number) =>
    axios.get<{ threshold: number; count: number; poles: Pole[] }>(`${API_BASE}/api/poles/alerts`, { params: tenantId ? { tenant_id: tenantId } : {} }),
  getPole: (id: number) => axios.get(`${API_BASE}/api/poles/${id}`),
  updatePole: (id: number, data: { name?: string; material?: string; height?: number; structure_type?: string; status?: string }) =>
    axios.put(`${API_BASE}/api/poles/${id}`, data),
  deletePole: (id: number) => axios.delete(`${API_BASE}/api/poles/${id}`),
  getNearbyPoles: (lat: number, lng: number, radius: number) =>
    axios.get(`${API_BASE}/api/poles/nearby`, { params: { lat, lng, radius } }),
  getStats: () => axios.get(`${API_BASE}/api/poles/stats`),
  getHistory: (id: number) => axios.get(`${API_BASE}/api/poles/${id}/history`),
  getPoleSummary: (id: number) => axios.get<PoleSummary>(`${API_BASE}/api/poles/${id}/summary`),
  getPoleImages: (id: number) =>
    axios.get<{ pole_id: number; count: number; images: Array<{ id: number; file_path: string; captured_at: string }> }>(
      `${API_BASE}/api/poles/${id}/images`
    ),
  getInspection: (id: number) => axios.get(`${API_BASE}/api/inspections/${id}`),
  deleteInspection: (id: number) => axios.delete<{ message: string; id: number }>(`${API_BASE}/api/inspections/${id}`),
  getInspections: (poleId?: number, page = 1, limit = 50) =>
    axios.get(`${API_BASE}/api/inspections`, { params: { ...(poleId ? { pole_id: poleId } : {}), page, limit } }),
  getPoleWorkOrders: (poleId: number) =>
    axios.get<{ pole_id: number; count: number; work_orders: WorkOrder[] }>(`${API_BASE}/api/poles/${poleId}/work-orders`),
  createPole: (data: { lat: number, lng: number, name: string, utm_x: string, utm_y: string, tenant_id: number }) =>
    axios.post(`${API_BASE}/api/poles`, data),
  exportGis: () => axios.get(`${API_BASE}/api/gis/export/geojson`),
  importGis: (geojson: { type: string, features: unknown[] }) => axios.post(`${API_BASE}/api/gis/import/geojson`, { geojson }),
  getTenants: () => axios.get<Tenant[]>(`${API_BASE}/api/tenants`),
  getUsers: () => axios.get<User[]>(`${API_BASE}/api/users`),
  getUserById: (id: number) => axios.get<User>(`${API_BASE}/api/users/${id}`),
  updateUser: (id: number, data: { username?: string; role?: string }) =>
    axios.put<User>(`${API_BASE}/api/users/${id}`, data),
  deleteUser: (id: number) =>
    axios.delete<{ message: string; id: number }>(`${API_BASE}/api/users/${id}`),
  analyzeImage: (poleId: number, base64Image: string) =>
    axios.post(`${API_BASE}/api/analyze`, { poleId, image: base64Image }),
  sendFeedback: (data: { labelId: number, poleId: number, isCorrect: boolean, correction: string }) =>
    axios.post(`${API_BASE}/api/feedback`, data),
  generateMaintenancePlan: (poleId: number, analysis: AnalysisResult) =>
    axios.post<{ plan: string, planId: number, estimatedCost: number }>(`${API_BASE}/api/ai/plan`, { poleId, analysis }),
  getMaintenancePlans: (poleId: number) => axios.get(`${API_BASE}/api/maintenance/${poleId}`),
  updateMaintenanceStatus: (planId: number, status: string) =>
    axios.patch(`${API_BASE}/api/maintenance/${planId}/status`, { status }),
  deleteMaintenancePlan: (planId: number) =>
    axios.delete(`${API_BASE}/api/maintenance/${planId}`),
  chatWithAI: (message: string, context: { pole: Pole | null, analysis: AnalysisResult | null }) =>
    axios.post(`${API_BASE}/api/ai/chat`, { message, context }),
  getPrediction: (id: number) => axios.get<Prediction>(`${API_BASE}/api/ai/predict/${id}`),
  exportCSV: () => axios.get(`${API_BASE}/api/poles/export`, { responseType: 'blob' }),
  getWorkOrders: (params?: { status?: string; assignee_id?: number; page?: number; limit?: number }) =>
    axios.get<{ work_orders: WorkOrder[]; total: number; page: number; limit: number; pages: number }>(`${API_BASE}/api/work-orders`, { params }),
  getWorkOrderStats: () =>
    axios.get<{ total: number; OPEN: number; IN_PROGRESS: number; BLOCKED: number; COMPLETED: number }>(`${API_BASE}/api/work-orders/stats`),
  createWorkOrder: (data: Partial<WorkOrder>) =>
    axios.post<WorkOrder>(`${API_BASE}/api/work-orders`, data),
  updateWorkOrder: (id: number, data: Partial<WorkOrder>) =>
    axios.put<WorkOrder>(`${API_BASE}/api/work-orders/${id}`, data),
  deleteWorkOrder: (id: number) =>
    axios.delete<{ message: string; id: number }>(`${API_BASE}/api/work-orders/${id}`),

  // Video Analysis
  startVideoSession: (poleId: number, tenantId: number, mode: 'frame' | 'recording') =>
    axios.post<{ sessionId: number; mode: string; status: string }>(
      `${API_BASE}/api/video/session/start`,
      { pole_id: poleId, tenant_id: tenantId, mode }
    ),
  analyzeVideoFrame: (poleId: number, image: string, sessionId: number | null, sequence: number) =>
    axios.post(`${API_BASE}/api/video/frame`, { pole_id: poleId, image, sessionId, sequence }),
  uploadVideoChunk: (data: {
    sessionId: number; pole_id: number; chunk: string;
    chunkIndex: number; totalChunks: number; isLast: boolean;
  }) => axios.post(`${API_BASE}/api/video/upload`, data),
  completeVideoSession: (sessionId: number) =>
    axios.post(`${API_BASE}/api/video/session/${sessionId}/complete`),
  getVideoSessions: (poleId: number) =>
    axios.get(`${API_BASE}/api/video/sessions/${poleId}`),

  // ANEEL OpenData
  getAneelAgents: (uf?: string, limit?: number) =>
    axios.get(`${API_BASE}/api/aneel/agents`, { params: { uf, limit } }),

  // BIM Half-way (IFC-lite)
  getBimStructure: (poleId: number) =>
    axios.get(`${API_BASE}/api/bim/${poleId}`),
  updateBimStructure: (poleId: number, structureData: Record<string, unknown>) =>
    axios.put(`${API_BASE}/api/bim/${poleId}`, { structure_data: structureData }),

  // PDF Report
  getPoleReportUrl: (poleId: number) =>
    `${API_BASE}/api/report/pole/${poleId}`,
};
