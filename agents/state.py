import threading
from typing import Dict, List, Any, Optional
from datetime import datetime

class IncidentStore:
    """Thread-safe state store for active incidents and camera tracking."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(IncidentStore, cls).__new__(cls)
                cls._instance._initialize()
            return cls._instance

    def _initialize(self):
        self.incidents: Dict[str, Dict[str, Any]] = {}
        self.active_order: List[str] = []
        self.camera_status: Dict[str, Dict[str, Any]] = {}
        self.dispatch_log: List[Dict[str, Any]] = []
        self.alerts: Dict[str, Dict[str, Any]] = {}

    def generate_or_update_alert(self, incident: Dict[str, Any]) -> Dict[str, Any]:
        """Generates or updates a structured authority alert for a confirmed incident."""
        inc_id = incident.get("incident_id", "UNKNOWN")
        alert_id = f"ALERT_{inc_id}"
        
        # If already exists, preserve status & created_at
        current_status = "GENERATED"
        created_at = incident.get("timestamp", datetime.now().isoformat())
        acknowledged_at = None
        if alert_id in self.alerts:
            current_status = self.alerts[alert_id].get("status", "GENERATED")
            created_at = self.alerts[alert_id].get("created_at", created_at)
            acknowledged_at = self.alerts[alert_id].get("acknowledged_at")

        loc = incident.get("location", {})
        road_name = loc.get("road_name") or loc.get("name") or incident.get("road_name", "Highway Corridor")
        
        # Match dispatches for this incident
        dispatches = [d for d in self.dispatch_log if d.get("target_incident") == inc_id]
        if dispatches:
            authorities = [d.get("service") for d in dispatches if d.get("service")]
        else:
            authorities = [
                "Highway Patrol & Traffic Enforcement",
                "Emergency Medical Services (EMS)"
            ]
            if incident.get("features", {}).get("fire_smoke"):
                authorities.append("Fire & Rescue Department")
            else:
                authorities.append("Roadside Assistance & Towing")

        alert_data = {
            "alert_id": alert_id,
            "incident_id": inc_id,
            "incident_type": incident.get("type", "unknown").upper(),
            "severity_label": incident.get("severity_label", "High"),
            "severity_score": incident.get("severity_score", 0),
            "camera_id": incident.get("camera_id", "CAM-01"),
            "road_name": road_name,
            "location": loc,
            "timestamp": incident.get("timestamp", datetime.now().strftime("%I:%M:%S %p")),
            "authorities": authorities,
            "status": current_status,  # "GENERATED" | "ACKNOWLEDGED" | "RESOLVED"
            "badge": "DISPATCH SIMULATED",
            "created_at": created_at,
            "acknowledged_at": acknowledged_at
        }
        self.alerts[alert_id] = alert_data
        return alert_data

    def get_alerts(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.alerts.values())

    def acknowledge_alert(self, alert_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            if alert_id in self.alerts:
                self.alerts[alert_id]["status"] = "ACKNOWLEDGED"
                self.alerts[alert_id]["acknowledged_at"] = datetime.now().isoformat()
                return self.alerts[alert_id]
            # Try by incident_id match
            for aid, a in self.alerts.items():
                if a.get("incident_id") == alert_id or aid == f"ALERT_{alert_id}":
                    a["status"] = "ACKNOWLEDGED"
                    a["acknowledged_at"] = datetime.now().isoformat()
                    return a
            return None

    def upsert_incident(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            inc_id = incident_data["incident_id"]
            if inc_id in self.incidents:
                existing = self.incidents[inc_id]
                existing.update(incident_data)
                if "timeline" not in existing:
                    existing["timeline"] = []
                existing["timeline"].append({
                    "timestamp": incident_data.get("timestamp", datetime.now().isoformat()),
                    "event": f"Updated: Severity {existing.get('severity_score', 0)} ({existing.get('severity_label', 'Unknown')})",
                    "features": incident_data.get("features", {})
                })
                self.incidents[inc_id] = existing
            else:
                incident_data["created_at"] = incident_data.get("timestamp", datetime.now().isoformat())
                incident_data["timeline"] = [{
                    "timestamp": incident_data.get("timestamp", datetime.now().isoformat()),
                    "event": f"Incident Detected: {incident_data.get('type', 'Unknown').upper()}",
                    "features": incident_data.get("features", {})
                }]
                self.incidents[inc_id] = incident_data

            self._recalculate_priorities()

            # Automatically generate or update alert for confirmed non-monitoring incidents
            inc_type = str(incident_data.get("type", "")).upper()
            if inc_type and inc_type != "MONITORING" and incident_data.get("severity_score", 0) > 0:
                self.generate_or_update_alert(self.incidents[inc_id])

            return self.incidents[inc_id]

    def _recalculate_priorities(self):
        sorted_keys = sorted(
            self.incidents.keys(),
            key=lambda k: (
                self.incidents[k].get("severity_score", 0),
                self.incidents[k].get("timestamp", "")
            ),
            reverse=True
        )
        self.active_order = sorted_keys
        for rank, inc_id in enumerate(self.active_order, start=1):
            self.incidents[inc_id]["priority_rank"] = rank

    def get_incident(self, incident_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self.incidents.get(incident_id)

    def get_all_active_sorted(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [self.incidents[k] for k in self.active_order if k in self.incidents]

    def add_dispatch(self, dispatch_entry: Dict[str, Any]):
        with self._lock:
            self.dispatch_log.insert(0, dispatch_entry)
            if len(self.dispatch_log) > 50:
                self.dispatch_log.pop()

    def get_dispatches(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.dispatch_log)

    def clear(self):
        with self._lock:
            self.incidents.clear()
            self.active_order.clear()
            self.dispatch_log.clear()
            self.alerts.clear()

global_incident_store = IncidentStore()
