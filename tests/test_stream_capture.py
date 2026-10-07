import urllib.request
import json
import time
import cv2
import numpy as np

def grab_stream_frame():
    req = urllib.request.Request("http://localhost:8000/api/stream/CAM-01")
    with urllib.request.urlopen(req, timeout=5) as resp:
        stream_bytes = b""
        for _ in range(50):
            chunk = resp.read(4096)
            if not chunk:
                break
            stream_bytes += chunk
            start = stream_bytes.find(b"\xff\xd8")
            end = stream_bytes.find(b"\xff\xd9")
            if start != -1 and end != -1 and end > start:
                jpeg_bytes = stream_bytes[start:end+2]
                img_arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
                return cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
    return None

def get_telemetry():
    with urllib.request.urlopen("http://localhost:8000/api/telemetry") as r:
        return json.loads(r.read().decode())

def main():
    print("=" * 60)
    print("LIVE STREAM FRAME CAPTURE & PIXEL VERIFICATION")
    print("=" * 60)

    for i in range(5):
        telem = get_telemetry()
        f_idx = telem.get("frame_idx", 0)
        total = telem.get("total_frames", 0)
        status = telem.get("status", "UNKNOWN")
        dets = telem.get("num_detections", 0)
        
        img = grab_stream_frame()
        if img is not None:
            filename = f"d:/dev_classroom/roadGaurdian_prototype/live_stream_{i}.jpg"
            cv2.imwrite(filename, img)
            print(f"Sample {i+1} -> Frame: {f_idx}/{total} | Status: {status} | Objects: {dets} | Mean Brightness: {img.mean():.2f} | Min: {img.min()} | Max: {img.max()} | Saved: live_stream_{i}.jpg")
        time.sleep(2)

if __name__ == "__main__":
    main()
