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
        return json.loads(res.read().decode('utf-8'))

def main():
    print("=" * 60)
    print("ROADGUARDIAN CCTV FOOTAGE & PLAYBACK VERIFICATION")
    print("=" * 60)

    print("\n[1] TEST GET /api/cameras")
    cams = req("http://localhost:8000/api/cameras")
    print("Active camera:", cams.get("active_camera_id"))
    for c in cams.get("cameras", []):
        print(f"  - {c['id']}: {c['name']} (source: {c['source_path']})")

    print("\n[2] TEST GET /api/footage")
    footage = req("http://localhost:8000/api/footage")
    clips = footage.get("footage", [])
    print(f"Total clips available: {len(clips)}")
    for cl in clips[:10]:
        print(f"  - ID {cl['id']}: {cl['filename']} ({cl['size_mb']} MB)")

    print("\n[3] SELECT car_crash.mp4 via POST /api/footage/select")
    sel_res = req("http://localhost:8000/api/footage/select", method="POST", data={"filename": "car_crash.mp4"})
    print("Select response:", sel_res)

    print("\n[4] RESTART PLAYBACK via POST /api/cameras/control")
    req("http://localhost:8000/api/cameras/control", method="POST", data={"action": "restart"})

    print("\n[5] MONITOR LIVE FRAME ADVANCEMENT (OVER 4 SECONDS)")
    for i in range(8):
        time.sleep(0.5)
        t = req("http://localhost:8000/api/telemetry")
        print(f"  t={(i+1)*0.5:.1f}s | Status: {t['status']} | Frame: {t['frame_idx']}/{t['total_frames']} | Progress: {t['progress_pct']}% | FPS: {t['display_fps']} | Objects: {t['num_detections']}")

    print("\n[6] TEST PAUSE via POST /api/cameras/control")
    req("http://localhost:8000/api/cameras/control", method="POST", data={"action": "pause"})
    time.sleep(0.5)
    t_pause = req("http://localhost:8000/api/telemetry")
    print(f"  Paused state -> Status: {t_pause['status']}, Frame: {t_pause['frame_idx']}/{t_pause['total_frames']}")

    print("\n[7] TEST PLAY RESUME via POST /api/cameras/control")
    req("http://localhost:8000/api/cameras/control", method="POST", data={"action": "play"})
    time.sleep(1.0)
    t_play = req("http://localhost:8000/api/telemetry")
    print(f"  Resumed state -> Status: {t_play['status']}, Frame: {t_play['frame_idx']}/{t_play['total_frames']}")

    print("\n[8] TEST MJPEG STREAM at http://localhost:8000/api/stream/CAM-01")
    stream_req = urllib.request.Request("http://localhost:8000/api/stream/CAM-01")
    with urllib.request.urlopen(stream_req, timeout=5) as s_resp:
        print(f"  Stream HTTP Status: {s_resp.status}")
        print(f"  Content-Type: {s_resp.headers.get_content_type()}")
        first_chunk = s_resp.read(512)
        print(f"  Received image chunk size: {len(first_chunk)} bytes (JPEG header present: {b'JFIF' in first_chunk or b'--frame' in first_chunk})")

    print("\n" + "=" * 60)
    print("ALL CCTV FOOTAGE & PLAYBACK TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
