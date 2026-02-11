import axios from 'axios';

const API_BASE = 'http://localhost:3001';

export const api = {
  getPoles: () => axios.get(`${API_BASE}/api/poles`),
  getStats: () => axios.get(`${API_BASE}/api/stats`),
  getHistory: (id: number) => axios.get(`${API_BASE}/api/poles/${id}/history`),
  createPole: (data: { lat: number, lng: number, name: string, utm_x: string, utm_y: string }) =>
    axios.post(`${API_BASE}/api/poles`, data),
  exportGis: () => axios.get(`${API_BASE}/api/gis/export/geojson`),
  importGis: (geojson: { type: string, features: any[] }) => axios.post(`${API_BASE}/api/gis/import/geojson`, { geojson }),
  analyzeImage: (poleId: number, base64Image: string) =>
    axios.post(`${API_BASE}/api/analyze`, { poleId, image: base64Image }),
  sendFeedback: (data: { labelId: number, poleId: number, isCorrect: boolean, correction: string }) =>
    axios.post(`${API_BASE}/api/feedback`, data),
};
