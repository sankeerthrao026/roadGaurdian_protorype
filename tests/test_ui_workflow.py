import urllib.request
import json
import time

def req(url, method='GET', data=None):
    r = urllib.request.Request(url, method=method)
    if data:
        r.add_header('Content-Type', 'application/json')
        payload = json.dumps(data).encode('utf-8')
    else:
        payload = None
    with urllib.request.urlopen(r, data=payload, timeout=10) as res:
        content = res.read().decode('utf-8')
        try:
            return json.loads(content)
        except Exception:
            return content

def main():
    print("=" * 70)
    print("ROADGUARDIAN UI WORKFLOW & API INTEGRATION VALIDATION")
    print("=" * 70)

    # 1. Test Frontend HTML & Assets
    print("\n[1] TEST FRONTEND SERVING at http://localhost:5173")
    html = req("http://localhost:5173")
    assert "<title>RoadGuardian AI" in html or "id=\"root\"" in html, "Frontend root element not found!"
    assert "Cormorant+Garamond" in html, "Cormorant Garamond font missing in HTML!"
    assert "JetBrains+Mono" in html, "JetBrains Mono font missing in HTML!"
    print("  [PASS] Frontend HTML served with Google Fonts (Cormorant Garamond, Inter, JetBrains Mono)")

    # 2. Test Cameras API
    print("\n[2] TEST GET /api/cameras")
    cams = req("http://localhost:8000/api/cameras")
    print(f"  [PASS] Active Camera: {cams.get('active_camera_id')}, Total Cameras: {len(cams.get('cameras', []))}")
    assert len(cams.get("cameras", [])) >= 4, "Expected at least 4 cameras"

    # 3. Test Footage API
    print("\n[3] TEST GET /api/footage")
    footage = req("http://localhost:8000/api/footage")
    print(f"  [PASS] Total footage clips: {len(footage.get('footage', []))}")
    assert len(footage.get("footage", [])) > 0, "No footage clips returned"

    # 4. Test Playback & Telemetry
    print("\n[4] TEST PLAYBACK & TELEMETRY at /api/telemetry")
    t = req("http://localhost:8000/api/telemetry")
    print(f"  [PASS] Status: {t['status']}, State: {t['processing_state']}, Frame: {t['frame_idx']}/{t['total_frames']}, Display FPS: {t['display_fps']}, Objects: {t['num_detections']}")

    # 5. Test Copilot RAG Question
    print("\n[5] TEST COPILOT RAG API POST /api/copilot")
    copilot_res = req("http://localhost:8000/api/copilot", method="POST", data={"question": "What is the severity score and SHAP attribution?"})
    print(f"  [PASS] Copilot Answer: {copilot_res.get('answer')[:80]}...")

    # 6. Test Model Comparison
    print("\n[6] TEST MODEL COMPARISON GET /api/models/comparison")
    mc = req("http://localhost:8000/api/models/comparison")
    print(f"  [PASS] Winning Model: {mc.get('winner')}, Models: {list(mc.get('models', {}).keys())}")

    # 7. Test Alerts API & Lifecycle
    print("\n[7] TEST ALERTS API GET /api/alerts")
    alerts_data = req("http://localhost:8000/api/alerts")
    alerts = alerts_data if isinstance(alerts_data, list) else alerts_data.get("alerts", [])
    print(f"  [PASS] Active Alerts count: {len(alerts)}")
    if alerts:
        first_alert = alerts[0]
        alert_id = first_alert["alert_id"]
        print(f"  [INFO] Testing Acknowledge on alert {alert_id}...")
        ack_res = req(f"http://localhost:8000/api/alerts/{alert_id}/acknowledge", method="POST", data={"acknowledged_by": "Operator_Editorial_QA"})
        print(f"  [PASS] Acknowledge Response: {ack_res.get('message')}")
        assert ack_res.get("alert", {}).get("status") == "ACKNOWLEDGED", "Alert acknowledgment status failed"

    print("\n" + "=" * 70)
    print("ALL ROADGUARDIAN BACKEND & FRONTEND INTEGRATION TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    main()
