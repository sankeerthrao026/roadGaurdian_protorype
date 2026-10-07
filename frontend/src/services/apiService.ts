import axios from 'axios';
import type {
  CameraListResponse,
  Telemetry,
  Incident,
  Dispatch,
  ModelComparisonResponse,
  RAGIncident,
  AuthorityAlert
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiService = {
  // Camera & Stream Controls
  getCameras: async (): Promise<CameraListResponse> => {
    const res = await axios.get(`${API_BASE_URL}/api/cameras`);
    return res.data;
  },

  setActiveCamera: async (cameraId: string): Promise<void> => {
    await axios.post(`${API_BASE_URL}/api/cameras/active`, { camera_id: cameraId });
  },

  controlCamera: async (action: 'play' | 'pause' | 'restart'): Promise<void> => {
    await axios.post(`${API_BASE_URL}/api/cameras/control`, { action });
  },

  getTelemetry: async (): Promise<Telemetry> => {
    const res = await axios.get(`${API_BASE_URL}/api/telemetry`);
    return res.data;
  },

  getStreamUrl: (cameraId: string): string => {
    return `${API_BASE_URL}/api/stream/${cameraId}?t=${Date.now()}`;
  },

  // Incidents & RAG Data
  getIncidents: async (): Promise<Incident[]> => {
    const res = await axios.get(`${API_BASE_URL}/api/incidents`);
    return res.data;
  },

  getIncidentDetails: async (incidentId: string): Promise<Incident> => {
    const res = await axios.get(`${API_BASE_URL}/api/incidents/${incidentId}`);
    return res.data;
  },

  getSimilarIncidents: async (incidentId: string): Promise<RAGIncident[]> => {
    const res = await axios.get(`${API_BASE_URL}/api/incidents/${incidentId}/similar`);
    return res.data;
  },

  getDispatches: async (): Promise<Dispatch[]> => {
    const res = await axios.get(`${API_BASE_URL}/api/dispatches`);
    return res.data;
  },

  getModelComparison: async (): Promise<ModelComparisonResponse> => {
    const res = await axios.get(`${API_BASE_URL}/api/models/comparison`);
    return res.data;
  },

  // AI Copilot RAG Question Answering
  askCopilot: async (question: string, incidentId?: string): Promise<{ question: string; answer: string; rag_context?: string }> => {
    const res = await axios.post(`${API_BASE_URL}/api/copilot`, { question, incident_id: incidentId });
    return res.data;
  },

  // Footage Discovery & Selection
  getFootageList: async (): Promise<{ id: number; filename: string; display_name: string; size_mb: number }[]> => {
    const res = await axios.get(`${API_BASE_URL}/api/footage`);
    return res.data.footage ?? [];
  },

  setCameraFootage: async (footageId: number | string): Promise<{ status: string; footage_id: number; filename: string }> => {
    const payload = typeof footageId === 'number' ? { footage_id: footageId } : { filename: String(footageId) };
    const res = await axios.post(`${API_BASE_URL}/api/footage/select`, payload);
    return res.data;
  },

  // Authority Alerts
  getAlerts: async (): Promise<AuthorityAlert[]> => {
    const res = await axios.get(`${API_BASE_URL}/api/alerts`);
    return res.data;
  },

  acknowledgeAlert: async (alertId: string): Promise<{ status: string; alert: AuthorityAlert }> => {
    const res = await axios.post(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`);
    return res.data;
  },
};

