import os
import sys
import json
import time
from typing import Dict, Any, List, Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import cv2

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config.settings import CAMERAS_CONFIG_PATH
from vision.camera_worker import global_camera_manager
from agents.state import global_incident_store
from agents.graph import process_incident_through_agents
from rag.store import global_rag_store
from severity.scorer import get_model_comparison_metrics, score_incident
from db import FootageStoreUnavailable, footage_store, resolve_storage_key

# Load Camera Configuration
def load_cameras_config():
    with open(CAMERAS_CONFIG_PATH, "r") as f:
        return json.load(f)

cameras_config = load_cameras_config()
global_camera_manager.initialize_cameras(cameras_config)
if cameras_config:
    global_camera_manager.set_active_camera(cameras_config[0]["id"])
    global_camera_manager.play_active()

app = FastAPI(
    title="RoadGuardian AI — Backend API",
    description="Agentic Traffic Incident Intelligence, Computer Vision & Explainable Severity API",
    version="2.0.0"
)

@app.on_event("startup")
def initialise_footage_store():
    """Create the metadata & incidents tables when PostgreSQL is configured."""
    footage_store.init()

raw_frontend_url = os.getenv("FRONTEND_URL", "")
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
if raw_frontend_url:
    for url in raw_frontend_url.split(","):
        cleaned = url.strip()
        if cleaned and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)
else:
    allowed_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class CameraSelectPayload(BaseModel):
    camera_id: str

class CameraControlPayload(BaseModel):
    action: str  # "play", "pause", "restart"

class CopilotQueryPayload(BaseModel):
    question: str
    incident_id: Optional[str] = None

class IncidentPayload(BaseModel):
    incident_id: str
    type: str
    camera_id: str
    location: Dict[str, Any]
    timestamp: str
    features: Dict[str, Any]
    severity_score: Optional[int] = None
    severity_label: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None

@app.get("/")
def root():
    return {
        "status": "online",
        "system": "RoadGuardian AI",
        "version": "2.0.0",
        "endpoints": [
            "/api/cameras",
            "/api/cameras/active",
            "/api/telemetry",
            "/api/stream/{camera_id}",
            "/api/incidents",
            "/api/incidents/{id}",
            "/api/incidents/{id}/similar",
            "/api/models/comparison",
            "/api/dispatches",
            "/api/copilot"
        ]
    }

# 1. Camera Management Endpoints
@app.get("/api/cameras")
def get_cameras():
    return {
        "cameras": cameras_config,
        "active_camera_id": global_camera_manager.get_active_camera_id()
    }

@app.post("/api/cameras/active")
def set_active_camera(payload: CameraSelectPayload):
    success = global_camera_manager.set_active_camera(payload.camera_id)
    if not success:
        raise HTTPException(status_code=404, detail="Camera ID not found")
    return {
        "status": "success",
        "active_camera_id": global_camera_manager.get_active_camera_id()
    }

@app.post("/api/cameras/control")
def control_camera(payload: CameraControlPayload):
    action = payload.action.lower()
    if action == "play":
        global_camera_manager.play_active()
    elif action == "pause":
        global_camera_manager.pause_active()
    elif action == "restart":
        global_camera_manager.restart_active()
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use play, pause, or restart.")
    
    active_worker = global_camera_manager.get_active_worker()
    status = active_worker.status if active_worker else "UNKNOWN"
    return {"status": "success", "action": action, "playback_status": status}

# 2. Real-Time Telemetry & Frame Streaming
@app.get("/api/telemetry")
def get_telemetry():
    worker = global_camera_manager.get_active_worker()
    if not worker:
        return {"status": "NO_WORKER"}
    
    _, meta = worker.get_frame_and_meta()
    
    # Enrich meta with active incident store
    active_incidents = global_incident_store.get_all_active_sorted()
    meta["active_incidents_count"] = len(active_incidents)
    meta["dispatches"] = global_incident_store.get_dispatches()
    
    return meta

def gen_mjpeg_frames(camera_id: str):
    worker = global_camera_manager.get_worker(camera_id) or global_camera_manager.get_active_worker()
    while True:
        if worker:
            rgb_frame, _ = worker.get_frame_and_meta()
            if rgb_frame is not None:
                bgr_frame = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR)
                ret, buffer = cv2.imencode('.jpg', bgr_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                if ret:
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.04)  # ~25 FPS stream rate

@app.get("/api/stream/{camera_id}")
def stream_video(camera_id: str):
    return StreamingResponse(
        gen_mjpeg_frames(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# 3. Incidents & Intelligence Endpoints
@app.get("/api/incidents")
def list_incidents():
    incidents = global_incident_store.get_all_active_sorted()
    if incidents:
        return incidents

    # Check PostgreSQL persistent incident store
    pg_incidents = footage_store.list_saved_incidents()
    if pg_incidents:
        return pg_incidents

    # Fallback to active camera worker final_result or live candidate during playback
    worker = global_camera_manager.get_active_worker()
    if worker:
        if worker.final_result:
            return [worker.final_result]
        # While analyzing, return live candidate so Priority Queue shows real-time tracking
        _, meta = worker.get_frame_and_meta()
        clean_cam = worker.camera_id.replace("-", "").replace("_", "")
        num_v = meta.get("num_vehicles", 0)
        num_p = meta.get("num_persons", 0)
        return [{
            "incident_id": f"{clean_cam}_LIVE",
            "camera_id": worker.camera_id,
            "type": "MONITORING",
            "location": {"road_name": worker.road_name, "name": worker.road_name},
            "timestamp": meta.get("time_str", "LIVE"),
            "features": {
                "vehicle_count": num_v,
                "person_on_road": num_p > 0,
                "fire_smoke": False,
                "rollover": False,
                "traffic_impact": "evaluating"
            },
            "severity_score": 45 if num_v > 1 else 25,
            "severity_label": "Medium" if num_v > 1 else "Low",
            "priority_rank": 1,
            "status": "ANALYZING"
        }]
    return []

@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str):
    inc = global_incident_store.get_incident(incident_id)
    if not inc:
        inc = footage_store.get_saved_incident(incident_id)
    if not inc:
        worker = global_camera_manager.get_active_worker()
        if worker and worker.final_result and worker.final_result.get("incident_id") == incident_id:
            inc = worker.final_result
        elif worker:
            # Fallback for live candidate
            _, meta = worker.get_frame_and_meta()
            inc = {
                "incident_id": incident_id,
                "camera_id": worker.camera_id,
                "type": "MONITORING",
                "location": {"road_name": worker.road_name, "name": worker.road_name},
                "timestamp": meta.get("time_str", "LIVE"),
                "features": {
                    "vehicle_count": meta.get("num_vehicles", 0),
                    "person_on_road": meta.get("num_persons", 0) > 0,
                    "fire_smoke": False,
                    "rollover": False,
                    "traffic_impact": "evaluating"
                },
                "severity_score": 45,
                "severity_label": "Medium",
                "priority_rank": 1
            }
        else:
            raise HTTPException(status_code=404, detail="Incident not found")
    
    similar = global_rag_store.find_similar_incidents(inc, top_k=3)
    inc_copy = dict(inc)
    inc_copy["similar_incidents"] = similar
    return inc_copy

@app.get("/api/incidents/{incident_id}/similar")
def get_similar_incidents(incident_id: str):
    inc = global_incident_store.get_incident(incident_id)
    if not inc:
        inc = footage_store.get_saved_incident(incident_id)
    if not inc:
        worker = global_camera_manager.get_active_worker()
        if worker and worker.final_result:
            inc = worker.final_result
        else:
            raise HTTPException(status_code=404, detail="Incident not found")
    return global_rag_store.find_similar_incidents(inc, top_k=3)

@app.get("/api/models/comparison")
def get_model_comparison():
    return get_model_comparison_metrics()

@app.get("/api/dispatches")
def get_dispatches():
    return global_incident_store.get_dispatches()

# 5. Footage Discovery & Selection Endpoints
class FootageSelectPayload(BaseModel):
    footage_id: int

@app.get("/api/footage")
def list_footage():
    """
    Return PostgreSQL-backed or local video metadata for the selector.
    """
    records = footage_store.list_footage()
    return {"footage": [
        {"id": record["id"], "filename": record["filename"],
         "display_name": record["display_name"], "size_mb": float(record["size_mb"] or 0)}
        for record in records
    ]}

@app.post("/api/footage/select")
def select_footage(payload: FootageSelectPayload):
    """
    Resolve selected footage and swap on active CameraWorker.
    """
    footage = footage_store.get_footage_by_id(payload.footage_id)
    if footage is None:
        raise HTTPException(status_code=404, detail="Footage record not found.")

    try:
        resolved = resolve_storage_key(footage["storage_key"])
    except (EnvironmentError, FileNotFoundError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Could not retrieve footage from storage: {exc}") from exc

    ok = global_camera_manager.swap_active_footage(resolved)
    if not ok:
        raise HTTPException(status_code=500, detail="No active camera worker to swap footage on.")

    return {
        "status": "success",
        "footage_id": footage["id"],
        "filename": footage["filename"],
        "active_camera_id": global_camera_manager.get_active_camera_id(),
    }


# 4. AI Copilot RAG Question Answering Endpoint
@app.post("/api/copilot")
def copilot_query(payload: CopilotQueryPayload):
    question = payload.question.lower()

    worker = global_camera_manager.get_active_worker()
    final_res = worker.final_result if worker else None

    # Retrieve RAG Context
    rag_context = ""
    if final_res:
        rag_context = global_rag_store.get_similar_incidents_text(final_res, top_k=2)

    # Check for Gemini API Key
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""You are RoadGuardian AI Copilot, an intelligent traffic safety & emergency dispatch assistant.
System Telemetry:
- Camera: {final_res.get('camera_id', 'CAM-01') if final_res else 'CAM-01'}
- Road: {worker.road_name if worker else 'Corridor'}
- Status: {final_res.get('type', 'MONITORING') if final_res else 'Analyzing CCTV Feed'}
- Severity: {final_res.get('severity_score', 'N/A') if final_res else 'Evaluating'}/100 ({final_res.get('severity_label', 'Medium') if final_res else 'Evaluating'})
- SHAP Drivers: {final_res.get('shap_values', {}) if final_res else {}}
- Historical RAG Context: {rag_context}
- Active Dispatches: {global_incident_store.get_dispatches()}

User Question: {payload.question}

Provide a concise, direct, helpful answer based on the real system telemetry above:"""
            response = model.generate_content(prompt)
            if response and response.text:
                return {
                    "question": payload.question,
                    "answer": response.text.strip(),
                    "rag_context": rag_context
                }
        except Exception as gemini_err:
            print(f"[Copilot] Gemini API fallback: {gemini_err}")

    # Contextual Intelligence Answer Synthesis based on real system state
    if "priority" in question or "rank" in question:
        if final_res:
            answer = f"Incident [{final_res.get('incident_id', 'INC-001')}] is ranked Priority #{final_res.get('priority_rank', 1)} because of a high ML severity score of {final_res.get('severity_score', 85)}/100 and multiple active hazard flags."
        else:
            answer = "Currently analyzing CCTV video feed. Incident priority will be finalized upon video completion."

    elif "severity" in question or "score" in question or "why" in question:
        if final_res:
            shap_info = final_res.get("shap_values", {})
            top_factors = [f"{k} ({v:+.1f})" for k, v in shap_info.items() if abs(v) > 0.5]
            shap_str = ", ".join(top_factors) if top_factors else "vehicle count and trajectory deviation"
            answer = f"The severity score is {final_res.get('severity_score', 85)}/100 ({final_res.get('severity_label', 'High')}). Primary SHAP attribution drivers: {shap_str}."
        else:
            answer = "Severity model scoring is currently evaluating vehicle count, pedestrian proximity, and movement delta in real-time."

    elif "evidence" in question or "timeline" in question:
        if final_res and "evidence" in final_res:
            ev = final_res["evidence"]
            timeline = ev.get("timeline", [])
            t_str = " -> ".join([f"{t['timestamp']} {t['event']}" for t in timeline[-3:]])
            answer = f"Key evidence: {ev.get('summary', 'Traffic incident detected.')} Timeline: {t_str}"
        else:
            answer = "Frame evidence is aggregated frame-by-frame using YOLOv8 bounding boxes and ByteTrack motion vectors."

    elif "dispatch" in question or "response" in question or "police" in question or "ambulance" in question:
        dispatches = global_incident_store.get_dispatches()
        if dispatches:
            d_str = "; ".join([f"{d.get('service')}: {d.get('message')}" for d in dispatches])
            answer = f"Active Simulated Dispatches: {d_str}"
        else:
            answer = "Simulated Emergency Dispatch Agent triggers automatically upon confirming high-severity incidents."

    else:
        if final_res:
            answer = f"RoadGuardian AI is monitoring {final_res.get('camera_id', 'CAM-01')}. Confirmed Incident: {final_res.get('type', 'COLLISION').upper()} with severity {final_res.get('severity_score', 85)}/100 ({final_res.get('severity_label', 'High')}). {rag_context}"
        else:
            answer = "RoadGuardian AI is running real-time Computer Vision analysis on the active CCTV feed. Ask me about severity scores, evidence, dispatches, or RAG context."

    return {
        "question": payload.question,
        "answer": answer,
        "rag_context": rag_context
    }
