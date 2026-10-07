import os
from pathlib import Path
from config.settings import VIDEOS_DIR, BASE_DIR

class VideoManager:
    """
    Manages real road/highway CCTV video files.
    Resolves local video files from car_accidents/ or configured paths.
    Fails loudly with FileNotFoundError if real video file is missing.
    """

    @staticmethod
    def ensure_video_directory():
        VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_video_path(cls, camera_id: str, configured_path: str) -> str:
        cls.ensure_video_directory()
        candidate = Path(configured_path)
        if candidate.is_absolute() and candidate.exists() and candidate.is_file():
            return str(candidate.resolve())

        search_dirs = [
            VIDEOS_DIR,
            BASE_DIR / "car_accidents",
            BASE_DIR.parent / "car_accidents",
            Path.cwd() / "car_accidents",
            BASE_DIR,
        ]

        # 1. Direct relative check
        fallback = BASE_DIR / configured_path
        if fallback.exists() and fallback.is_file():
            return str(fallback.resolve())

        # 2. Check candidate name in search dirs
        filename = candidate.name
        variations = [
            filename,
            filename.replace(" ", "_"),
            filename.replace("_", " "),
        ]

        for sdir in search_dirs:
            if not sdir.exists():
                continue
            for var in variations:
                target = sdir / var
                if target.exists() and target.is_file():
                    return str(target.resolve())
            for f in sdir.iterdir():
                if f.is_file() and f.name.lower() in [v.lower() for v in variations]:
                    return str(f.resolve())

        raise FileNotFoundError(
            f"Real video not found for {camera_id} at '{configured_path}'. "
            f"Check that the file exists in car_accidents/ and cameras.json points to it correctly."
        )
