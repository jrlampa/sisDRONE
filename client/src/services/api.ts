import axios from 'axios';
import type { Tenant, User, WorkOrder } from '../types';
import type { Prediction } from '../types/prediction';
import { addToQueue } from '../utils/offlineQueue';

const API_BASE = 'http://localhost:3001';

// Dynamic header injection for RBAC Mock
axios.interceptors.request.use(config => {
  const role = localStorage.getItem('sisdrone_mock_role');
  if (role) {
    config.headers['x-user-role'] = role;
  }
  return config;
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
  getPoles: () => axios.get(`${API_BASE}/api/poles`),
  getStats: () => axios.get(`${API_BASE}/api/stats`),
  getHistory: (id: number) => axios.get(`${API_BASE}/api/poles/${id}/history`),
  createPole: (data: { lat: number, lng: number, name: string, utm_x: string, utm_y: string, tenant_id: number }) =>
    axios.post(`${API_BASE}/api/poles`, data),
  exportGis: () => axios.get(`${API_BASE}/api/gis/export/geojson`),
  importGis: (geojson: { type: string, features: unknown[] }) => axios.post(`${API_BASE}/api/gis/import/geojson`, { geojson }),
  getTenants: () => axios.get<Tenant[]>(`${API_BASE}/api/tenants`),
  getUsers: () => axios.get<User[]>(`${API_BASE}/api/users`),
  analyzeImage: (poleId: number, base64Image: string) =>
    axios.post(`${API_BASE}/api/analyze`, { poleId, image: base64Image }),
  sendFeedback: (data: { labelId: number, poleId: number, isCorrect: boolean, correction: string }) =>
    axios.post(`${API_BASE}/api/feedback`, data),
  generateMaintenancePlan: (poleId: number, analysis: any) =>
    axios.post<{ plan: string, planId: number, estimatedCost: number }>(`${API_BASE}/api/ai/plan`, { poleId, analysis }),
  getMaintenancePlans: (poleId: number) => axios.get(`${API_BASE}/api/maintenance/${poleId}`),
  updateMaintenanceStatus: (planId: number, status: string) =>
    axios.patch(`${API_BASE}/api/maintenance/${planId}/status`, { status }),
  chatWithAI: (message: string, context: any) =>
    axios.post(`${API_BASE}/api/ai/chat`, { message, context }),
  getPrediction: (id: number) => axios.get<Prediction>(`${API_BASE}/api/ai/predict/${id}`),
  exportCSV: () => axios.get(`${API_BASE}/api/poles/export`, { responseType: 'blob' }),
  getWorkOrders: (params?: { status?: string, assignee_id?: number }) =>
    axios.get<WorkOrder[]>(`${API_BASE}/api/work-orders`, { params }),
  createWorkOrder: (data: Partial<WorkOrder>) =>
    axios.post<WorkOrder>(`${API_BASE}/api/work-orders`, data),
  updateWorkOrder: (id: number, data: Partial<WorkOrder>) =>
    axios.put<WorkOrder>(`${API_BASE}/api/work-orders/${id}`, data),
};
