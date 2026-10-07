export interface Camera {
  id: string;
  name: string;
  location: string;
  gps: {
    lat: number;
    lng: number;
  };
  status: string;
  source_path: string;
}

export interface CameraListResponse {
  cameras: Camera[];
  active_camera_id: string;
}

export interface Telemetry {
  status: "PLAYING" | "PAUSED" | "ENDED" | "ERROR";
  processing_state: "ANALYZING" | "FINAL_ANALYSIS" | "COMPLETE";
  camera_id: string;
  road_name: string;
  location?: { lat?: number; lon?: number; name?: string };
  frame_idx: number;
  total_frames: number;
  progress_pct: number;
  video_fps: number;
  ai_fps: number;
  display_fps: number;
  frames_processed: number;
  frames_skipped: number;
  num_vehicles: number;
  num_persons: number;
  video_duration_s?: number;
  processing_duration_s?: number;
  final_result?: Incident | null;
  active_incidents_count?: number;
  dispatches?: Dispatch[];
  active_alerts?: AuthorityAlert[];
}

export interface AuthorityAlert {
  alert_id: string;
  incident_id: string;
  incident_type: string;
  severity_label: "Low" | "Medium" | "High" | "Critical";
  severity_score: number;
  camera_id: string;
  road_name: string;
  location?: { lat?: number; lon?: number; name?: string; road_name?: string };
  timestamp: string;
  authorities: string[];
  status: "GENERATED" | "ACKNOWLEDGED" | "RESOLVED";
  badge: string;
  created_at: string;
  acknowledged_at?: string | null;
}

export interface IncidentFeatures {
  vehicle_count: number;
  person_on_road: boolean;
  fire_smoke: boolean;
  rollover: boolean;
  traffic_impact: string;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
}

export interface IncidentEvidence {
  summary: string;
  timeline: TimelineEvent[];
}

export interface Incident {
  incident_id: string;
  type: string;
  camera_id: string;
  location: {
    road_name: string;
    coordinates?: [number, number];
  };
  timestamp: string;
  features: IncidentFeatures;
  severity_score: number;
  severity_label: "Low" | "Medium" | "High" | "Critical";
  shap_values?: Record<string, number>;
  priority_rank?: number;
  report_text?: string;
  evidence?: IncidentEvidence;
  similar_incidents?: RAGIncident[];
}

export interface RAGIncident {
  incident_id: string;
  type: string;
  severity: string;
  severity_score: number;
  location: string;
  timestamp: string;
  summary: string;
}

export interface Dispatch {
  service: string;
  badge: string;
  message: string;
  target_incident: string;
}

export interface ModelMetric {
  Model: string;
  "R² Score": number;
  RMSE: number;
  Accuracy: string;
  F1: number;
}

export interface ModelComparisonResponse {
  winner: string;
  models: Record<string, {
    r2_score: number;
    rmse: number;
    accuracy: number;
    f1_weighted: number;
  }>;
}

export interface CopilotMessage {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  rag_context?: string;
}
