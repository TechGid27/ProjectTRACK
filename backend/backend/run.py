"""
Backend Server Runner
=====================
Convenient startup script for running FastAPI with Uvicorn.

Usage:
    python backend/run.py
    python backend/run.py --port 8080 --reload
"""

import sys
import argparse
from pathlib import Path
import uvicorn

# Ensure repository root is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.config import settings


def main():
    parser = argparse.ArgumentParser(description="Run DPWH Cebu Knowledge Graph FastAPI Backend")
    parser.add_argument("--host", default=settings.HOST, help="Host address to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=settings.PORT, help="Port to bind (default: 8000)")
    parser.add_argument("--reload", action="store_true", default=True, help="Enable auto-reload on code change")
    args = parser.parse_args()

    print("\n" + "=" * 65)
    print(f"🚀 Starting {settings.APP_NAME}")
    print(f"🌐 Local URL:    http://localhost:{args.port}")
    print(f"📖 Swagger Docs: http://localhost:{args.port}/docs")
    print(f"📑 Redoc:        http://localhost:{args.port}/redoc")
    print("=" * 65 + "\n")

    uvicorn.run(
        "backend.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload
    )


if __name__ == "__main__":
    main()
