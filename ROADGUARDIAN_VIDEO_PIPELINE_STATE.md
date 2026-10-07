# RoadGuardian Video Pipeline State

## Browser URL
http://localhost:5173

## Source Video
d:\dev_classroom\roadGaurdian_prototype\car_accidents\car_crash.mp4

## Source Frame Test
- Frame 1: shape=(720, 1280, 3), mean=57.00, min=57, max=58 (Title card)
- Frame 100: shape=(720, 1280, 3), mean=79.50, min=0, max=255 (Active road scene)
- Frame 200: shape=(720, 1280, 3), mean=110.41, min=0, max=255 (Active multi-lane highway)
- Frame 500: shape=(720, 1280, 3), mean=110.75, min=0, max=255 (Car crash sequence)
- Frame 800: shape=(720, 1280, 3), mean=110.48, min=0, max=255 (Post-collision scene)
- Frame 1366: shape=(720, 1280, 3), mean=0.00, min=0, max=5 (Outro black fadeout)

## YOLO Input Test
- Extracted Frame: 640x360x3 uint8, min=0, max=255, mean=79.53 (Valid road image)

## Annotated Frame Test
- Output Frame: 640x360x3 uint8, min=0, max=255, mean=74.95 (Real road image + YOLO bounding boxes + tracking trajectories + HUD)

## Encoded JPEG Test
- cv2.imencode result: True, length=30,255 bytes, SOI magic header \xff\xd8 present, decoded back with mean=74.87

## MJPEG Test
- Endpoint: GET http://localhost:8000/api/stream/CAM-01
- Content-Type: multipart/x-mixed-replace; boundary=frame
- Live stream chunk capture: shape=(360, 640, 3), mean brightness=96.91, min=0, max=255 (Live road footage streaming at ~25 FPS)

## Frontend Rendering Test
- Component: CameraView.tsx -> <MJPEGStream streamUrl={streamBaseUrl} />
- Live frames decoded by browser: Active road video visible with bounding boxes and live frame counter.

## Exact Root Cause
1. `car_crash.mp4` has 1367 frames where frames 1300-1367 fade out to pure black (`mean = 0.00`).
2. On startup, `CameraWorker` played through all 1367 frames in the background within 45s. Upon reaching EOF, it locked into `ENDED` state and held the last frame (which was solid black).
3. When the user opened the UI, the stream delivered that held final black frame (Frame 1367/1367).
4. `restart()` was relying on `cap.set(POS_FRAMES, 0)` without re-initializing the capture, which left the stream frozen on Windows DirectShow/MSMF backends.
5. In `CameraView.tsx`, `handleFootageChange` had an equality guard that prevented triggering footage swap if the dropdown item was default-selected.

## Fix
1. Updated `CameraWorker.restart()` to call `_init_capture()`, immediately reading frame 1, resetting state, and setting `status = "PLAYING"`.
2. Updated `CameraWorker._run_loop()` to seamlessly loop the video back to frame 0 on EOF, ensuring the CCTV camera continues live monitoring rather than freezing on the black outro frame.
3. Streamlined BGR frame handling directly in `get_frame_and_meta()` and `gen_mjpeg_frames()`.
4. Removed the redundant `selectedFootageId` equality guard in `CameraView.tsx` so selecting any footage executes the swap and restart immediately.
5. Set CAM-01 default source video in `config/cameras.json` to `car_accidents/car_crash.mp4`.

## Browser Visual Verification
PASS

## Final Status
VIDEO VISIBLY PLAYING: PASS
