import axios from 'axios';
import type { Tenant, User } from '../types';

const API_BASE = 'http://localhost:3001';

// Dynamic header injection for RBAC Mock
axios.interceptors.request.use(config => {
  const role = localStorage.getItem('sisdrone_mock_role');
  if (role) {
    config.headers['x-user-role'] = role;
  }
  return config;
});

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
};
