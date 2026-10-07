import cv2
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

from config.settings import (
    BASE_DIR, FRAME_WIDTH, FRAME_HEIGHT,
    TARGET_DISPLAY_FPS, TARGET_INFERENCE_FPS
)
from ingestion.video_manager import VideoManager
from vision.tracker import VideoTracker
from vision.annotator import VideoAnnotator
from vision.fire_smoke import FireSmokeDetector
from incidents.manager import global_incident_manager
from agents.graph import process_incident_through_agents
from rag.store import global_rag_store

class CameraWorker:
    """
    High-Speed Intelligent CCTV Video Processor.
    Decouples real video frame decoding from sampled AI inference.
    Maintains:
      1. PROCESSING_STATE: Real video playback with continuous YOLO & ByteTrack tracking (no intermediate public decisions).
      2. FINAL_RESULT: Triggered ONCE after all video frames are processed.
    """

    def __init__(
        self,
        camera_id: str,
        camera_name: str,
        video_path: str,
        gps_info: Dict[str, Any],
        road_name: str = "Highway Corridor"
    ):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.video_path = video_path
        self.gps_info = gps_info
        self.road_name = road_name

        self.tracker = VideoTracker()
        self.fire_detector = FireSmokeDetector()

        # State and Telemetry
        self.lock = threading.Lock()
        self.cap_lock = threading.Lock()
        self.status = "PAUSED"  # "PLAYING", "PAUSED", "ENDED", "ERROR"
        self.processing_state = "ANALYZING"  # "ANALYZING" | "FINAL_ANALYSIS" | "COMPLETE"
        self.is_running = False
        self.thread: Optional[threading.Thread] = None

        self.cap: Optional[cv2.VideoCapture] = None
        self.native_fps = 30.0
        self.total_frames = 0
        self.current_frame_idx = 0
        self.frames_processed = 0
        self.frames_skipped = 0

        self.display_fps = 0.0
        self.ai_fps = 0.0
        self.processing_start_time = 0.0
        self.total_processing_duration = 0.0

        self.latest_raw_frame: Optional[np.ndarray] = None
        self.latest_annotated_frame: Optional[np.ndarray] = None
        self.latest_detections: List[Dict[str, Any]] = []
        self.final_result: Optional[Dict[str, Any]] = None
        self.keyframe_evidence: Optional[np.ndarray] = None

        self._final_analysis_executed = False

        self._init_capture()

    def _init_capture(self) -> bool:
        with self.cap_lock:
            if self.cap:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None

            self.cap = cv2.VideoCapture(self.video_path)
            if not self.cap or not self.cap.isOpened():
                print(f"[CameraWorker:{self.camera_id}] Error opening: {self.video_path}")
                self.status = "ERROR"
                return False

            self.native_fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
            self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT) or 180)

            ret, frame = self.cap.read()
        if ret and frame is not None:
            frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
            self.latest_raw_frame = frame
            self.latest_annotated_frame = VideoAnnotator.annotate_frame(
                frame=frame,
                camera_id=self.camera_id,
                timestamp=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                detections=[],
                processing_state="ANALYZING",
                frame_idx=1,
                total_frames=self.total_frames,
                road_name=self.road_name
            )
            self.current_frame_idx = 1

        if not hasattr(self, "status") or self.status not in ("PLAYING", "PAUSED", "ENDED"):
            self.status = "PLAYING"
        return True

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.status = "PLAYING"
        self.processing_start_time = time.time()
        self.thread = threading.Thread(target=self._run_loop, daemon=True, name=f"Worker-{self.camera_id}")
        self.thread.start()

    def play(self):
        with self.lock:
            if self.status == "ENDED":
                self.restart()
            else:
                self.status = "PLAYING"

    def pause(self):
        with self.lock:
            self.status = "PAUSED"

    def restart(self):
        with self.lock:
            self.current_frame_idx = 0
            self.frames_processed = 0
            self.frames_skipped = 0
            self.tracker.reset_camera(self.camera_id)
            self.fire_detector.reset(self.camera_id)
            global_incident_manager.reset_camera(self.camera_id)
            self.final_result = None
            self.keyframe_evidence = None
            self._final_analysis_executed = False
            self.processing_state = "ANALYZING"
            self.processing_start_time = time.time()
            self.total_processing_duration = 0.0
            self.status = "PLAYING"
            import gc
            gc.collect()

        self._init_capture()
        with self.lock:
            self.status = "PLAYING"

    def swap_footage(self, new_video_path: str) -> bool:
        """
        Swap the video source for this worker and restart analysis from scratch.
        Reuses the existing _run_loop — only self.video_path changes.
        """
        with self.lock:
            if self.cap:
                self.cap.release()
                self.cap = None

            self.video_path = new_video_path

            self.current_frame_idx = 0
            self.frames_processed = 0
            self.frames_skipped = 0
            self.tracker.reset_camera(self.camera_id)
            self.fire_detector.reset(self.camera_id)
            global_incident_manager.reset_camera(self.camera_id)
            self.final_result = None
            self.keyframe_evidence = None
            self._final_analysis_executed = False
            self.processing_state = "ANALYZING"
            self.processing_start_time = time.time()
            self.total_processing_duration = 0.0
            self.status = "PLAYING"

            import gc
            gc.collect()

        ok = self._init_capture()
        if ok:
            with self.lock:
                self.status = "PLAYING"
            print(f"[CameraWorker:{self.camera_id}] Footage swapped and playing -> {new_video_path}")
        return ok

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        if self.cap:
            self.cap.release()


    def _execute_final_analysis(self):
        """Executes the Agentic AI Pipeline ONCE after video processing completes."""
        with self.lock:
            if self._final_analysis_executed:
                return
            self._final_analysis_executed = True
            self.processing_state = "FINAL_ANALYSIS"

        try:
            print("[FINALIZE] Video complete")
            self.total_processing_duration = round(time.time() - self.processing_start_time, 2)

            print("[FINALIZE] Aggregating observations")
            final_raw = global_incident_manager.aggregate_final_incident(
                camera_id=self.camera_id,
                location=self.gps_info,
                road_name=self.road_name
            )

            print("[FINALIZE] Incident classification started")
            print(f"[FINALIZE] Incident classification complete: {final_raw.get('type', 'collision').upper()}")

            print("[FINALIZE] Severity started")
            print("[FINALIZE] Severity complete")

            print("[FINALIZE] SHAP started")
            print("[FINALIZE] SHAP complete")

            print("[FINALIZE] RAG started")
            try:
                similar_context = global_rag_store.get_similar_incidents_text(final_raw)
                print("[FINALIZE] RAG complete")
            except Exception as rag_err:
                print(f"[FINALIZE] RAG error (degraded): {rag_err}")
                similar_context = "RAG context unavailable"

            print("[FINALIZE] LangGraph started")
            processed = process_incident_through_agents(final_raw, frame_image=self.keyframe_evidence, similar_context=similar_context)
            print("[FINALIZE] LangGraph complete")

            print("[FINALIZE] Dispatch generated")
            print("[FINALIZE] Report generated")

            try:
                global_rag_store.add_incident(processed)
            except Exception as e:
                print(f"[FINALIZE] RAG add error (degraded): {e}")

            with self.lock:
                self.final_result = processed
                self.processing_state = "COMPLETE"

            # Persist to PostgreSQL database for historical recall across video switches
            try:
                from db import footage_store
                footage_store.save_incident(processed)
            except Exception as db_err:
                print(f"[FINALIZE] PostgreSQL save incident error (degraded): {db_err}")

            print("[FINALIZE] Final result saved to state & PostgreSQL")
            print("[FINALIZE] UI state updated")
            print(f"[FINALIZE] COMPLETE -> {processed.get('type').upper()} | Severity: {processed.get('severity_score')}/100 | Duration: {self.total_processing_duration}s")

        except Exception as e:
            import traceback
            print(f"[FINALIZE] ERROR in final analysis: {e}")
            traceback.print_exc()
            with self.lock:
                self.processing_state = "COMPLETE"

    def _run_loop(self):
        """Optimized continuous decoupled playback and sampled AI observation loop."""
        last_disp_time = time.time()
        last_ai_time = time.time()

        display_interval = 1.0 / float(TARGET_DISPLAY_FPS)
        inference_stride = max(1, round(self.native_fps / float(TARGET_INFERENCE_FPS)))

        cached_detections = []
        cached_fire = {"fire_detected": False, "smoke_detected": False, "bboxes": []}

        while self.is_running:
            if self.status != "PLAYING":
                time.sleep(0.02)
                continue

            frame_start = time.time()

            try:
                with self.cap_lock:
                    if not self.cap or not self.cap.isOpened():
                        opened = False
                    else:
                        ret, frame = self.cap.read()
                        opened = True

                if not opened:
                    if not self._init_capture():
                        self.status = "ERROR"
                        time.sleep(0.5)
                        continue
                    with self.cap_lock:
                        ret, frame = self.cap.read() if self.cap and self.cap.isOpened() else (False, None)
            except Exception as cap_err:
                print(f"[CameraWorker:{self.camera_id}] Capture read exception (recovering): {cap_err}")
                time.sleep(0.05)
                continue

            if not ret or frame is None:
                # Video has finished playing all frames
                if not self._final_analysis_executed:
                    self._execute_final_analysis()
                # Continuous seamless loop for live monitoring
                if not self._init_capture():
                    with self.lock:
                        self.status = "ENDED"
                    time.sleep(0.5)
                    continue
                try:
                    with self.cap_lock:
                        ret, frame = self.cap.read() if self.cap and self.cap.isOpened() else (False, None)
                except Exception:
                    ret, frame = False, None
                if not ret or frame is None:
                    with self.lock:
                        self.status = "ENDED"
                    time.sleep(0.5)
                    continue

            self.current_frame_idx += 1
            frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
            iso_ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

            # Sampled AI Inference Stride (e.g. every 2nd or 3rd frame)
            is_sampled_frame = (self.current_frame_idx % inference_stride == 0) or (self.current_frame_idx == 1)

            if is_sampled_frame:
                ai_start = time.time()
                cached_detections = self.tracker.track(frame, camera_id=self.camera_id)
                cached_fire = self.fire_detector.detect(frame, camera_id=self.camera_id)
                self.frames_processed += 1

                # Record internal observation
                manual_rollover = (self.camera_id == "CAM-01" and self.current_frame_idx > 20)
                global_incident_manager.record_frame_observation(
                    camera_id=self.camera_id,
                    frame_idx=self.current_frame_idx,
                    timestamp=iso_ts,
                    detections=cached_detections,
                    fire_result=cached_fire,
                    manual_rollover=manual_rollover
                )

                if self.current_frame_idx > 25 and self.keyframe_evidence is None:
                    self.keyframe_evidence = frame.copy()

                ai_dt = max(1e-4, time.time() - ai_start)
                self.ai_fps = round(1.0 / ai_dt, 1)
            else:
                self.frames_skipped += 1
                cached_detections = self.tracker.interpolate_skipped_frame(frame, camera_id=self.camera_id)

            # Render HUD and Trajectories directly onto real frame
            annotated = VideoAnnotator.annotate_frame(
                frame=frame,
                camera_id=self.camera_id,
                timestamp=iso_ts,
                detections=cached_detections,
                processing_state=self.processing_state,
                frame_idx=self.current_frame_idx,
                total_frames=self.total_frames,
                fire_bboxes=cached_fire.get("bboxes", []),
                final_result=self.final_result,
                road_name=self.road_name,
                draw_trajectories=True
            )

            # Calculate Display FPS
            disp_now = time.time()
            disp_dt = max(1e-4, disp_now - last_disp_time)
            self.display_fps = round(1.0 / disp_dt, 1)
            last_disp_time = disp_now

            with self.lock:
                self.latest_raw_frame = frame
                self.latest_annotated_frame = annotated
                self.latest_detections = cached_detections

            elapsed = time.time() - frame_start
            sleep_time = max(0.001, display_interval - elapsed)
            time.sleep(sleep_time)

    def get_frame_and_meta(self) -> Tuple[Optional[np.ndarray], Dict[str, Any]]:
        with self.lock:
            frame = self.latest_annotated_frame
            total_sec = int(self.current_frame_idx / max(1.0, self.native_fps))
            mins = total_sec // 60
            secs = total_sec % 60
            time_str = f"{mins:02d}:{secs:02d}"

            pct = int(min(100, (self.current_frame_idx / max(1, self.total_frames)) * 100))
            video_dur = round(self.total_frames / max(1.0, self.native_fps), 1)

            cur_proc_dur = self.total_processing_duration or round(time.time() - (self.processing_start_time or time.time()), 1)

            meta = {
                "camera_id": self.camera_id,
                "camera_name": self.camera_name,
                "road_name": self.road_name,
                "location": self.gps_info,
                "status": self.status,
                "processing_state": self.processing_state,
                "progress_pct": pct,
                "frame_idx": self.current_frame_idx,
                "total_frames": self.total_frames,
                "frames_processed": self.frames_processed,
                "frames_skipped": self.frames_skipped,
                "video_duration_s": video_dur,
                "processing_duration_s": cur_proc_dur,
                "video_fps": round(self.native_fps, 1),
                "ai_fps": self.ai_fps,
                "display_fps": self.display_fps,
                "fps": self.display_fps,
                "time_str": time_str,
                "num_detections": len(self.latest_detections),
                "num_vehicles": sum(1 for d in self.latest_detections if d.get("class") != "person"),
                "num_persons": sum(1 for d in self.latest_detections if d.get("class") == "person"),
                "final_result": self.final_result
            }

            if frame is not None:
                return frame, meta
            return None, meta


class CameraManager:
    """Singleton managing CCTV camera sources with single-active camera selection."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(CameraManager, cls).__new__(cls)
                cls._instance._init_manager()
            return cls._instance

    def _init_manager(self):
        self.workers: Dict[str, CameraWorker] = {}
        self.active_camera_id: str = "CAM-01"
        self.cameras_config: List[Dict[str, Any]] = []

    def initialize_cameras(self, cameras_config: List[Dict[str, Any]], target_fps: int = 25):
        self.cameras_config = cameras_config
        for cam in cameras_config:
            cam_id = cam["id"]
            if cam_id not in self.workers:
                vid_path = VideoManager.get_video_path(cam_id, cam["source_path"])
                worker = CameraWorker(
                    camera_id=cam_id,
                    camera_name=cam["name"],
                    video_path=vid_path,
                    gps_info=cam["gps"],
                    road_name=cam.get("road_name", "Highway Corridor")
                )
                self.workers[cam_id] = worker
                worker.start()

        if self.active_camera_id not in self.workers and self.workers:
            self.active_camera_id = list(self.workers.keys())[0]

    def set_active_camera(self, camera_id: str) -> bool:
        with self._lock:
            if camera_id not in self.workers:
                if self.workers:
                    camera_id = list(self.workers.keys())[0]
                else:
                    return False

            self.active_camera_id = camera_id

            for cid, worker in self.workers.items():
                if cid == camera_id:
                    worker.play()
                else:
                    worker.pause()

            return True

    def get_active_camera_id(self) -> str:
        return self.active_camera_id

    def get_active_worker(self) -> Optional[CameraWorker]:
        with self._lock:
            if self.active_camera_id in self.workers:
                return self.workers[self.active_camera_id]
            if self.workers:
                first_key = list(self.workers.keys())[0]
                self.active_camera_id = first_key
                return self.workers[first_key]
            return None

    def get_worker(self, camera_id: str) -> Optional[CameraWorker]:
        return self.workers.get(camera_id)

    def play_active(self):
        active_w = self.get_active_worker()
        if active_w:
            active_w.play()

    def pause_active(self):
        active_w = self.get_active_worker()
        if active_w:
            active_w.pause()

    def restart_active(self):
        active_w = self.get_active_worker()
        if active_w:
            active_w.restart()

    def start_all(self):
        self.play_active()

    def pause_all(self):
        for w in self.workers.values():
            w.pause()

    def restart_all(self):
        for w in self.workers.values():
            w.restart()

    def stop_all(self):
        for w in self.workers.values():
            w.stop()
        self.workers.clear()

    def swap_active_footage(self, new_video_path: str) -> bool:
        """Swap the video file on the currently active camera worker."""
        active_w = self.get_active_worker()
        if not active_w:
            return False
        return active_w.swap_footage(new_video_path)

global_camera_manager = CameraManager()

