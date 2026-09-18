import subprocess
import sys
import time
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"


def start_all():
    print("=" * 40)
    print("ROADGUARDIAN AI")
    print("=" * 40)
    print()
    print("Backend:")
    print("  http://localhost:8000")
    print()
    print("API Docs:")
    print("  http://localhost:8000/docs")
    print()
    print("Frontend:")
    print("  http://localhost:5173")
    print()
    print("=" * 40)
    print()

    # 1. FastAPI backend
    venv_py_win = BASE_DIR / ".venv" / "Scripts" / "python.exe"
    venv_py_unix = BASE_DIR / ".venv" / "bin" / "python"
    if os.name == "nt" and venv_py_win.exists():
        py_exec = str(venv_py_win)
    elif venv_py_unix.exists():
        py_exec = str(venv_py_unix)
    else:
        py_exec = sys.executable

    api_cmd = [
        py_exec, "-m", "uvicorn",
        "api.app:app",
        "--host", "0.0.0.0",
        "--port", "8000",
    ]
    api_process = subprocess.Popen(api_cmd, cwd=str(BASE_DIR))

    # 2. React/Vite frontend
    vite_cmd = (
        ["npx.cmd", "vite", "--port", "5173"]
        if os.name == "nt"
        else ["npx", "vite", "--port", "5173"]
    )
    frontend_process = subprocess.Popen(vite_cmd, cwd=str(FRONTEND_DIR))

    print("Both processes are running.")
    print("Press Ctrl+C to stop.\n")

    # 3. Stay alive — video processing completion does NOT terminate this loop
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down RoadGuardian AI servers...")
    finally:
        try:
            api_process.terminate()
            api_process.wait(timeout=3)
        except Exception:
            pass
        try:
            frontend_process.terminate()
            frontend_process.wait(timeout=3)
        except Exception:
            pass
        print("Stopped.")


if __name__ == "__main__":
    start_all()
