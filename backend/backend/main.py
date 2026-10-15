"""
DPWH Cebu Infrastructure FastAPI Backend
========================================
Production-grade REST & Streaming API for the DPWH Cebu Infrastructure
Knowledge Graph, Analytics, and GraphRAG QA System.
"""

import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure project root and backend directory are in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.config import settings
from backend.services.neo4j_service import neo4j_service
from backend.api.router import api_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("backend.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup checks and graceful shutdown."""
    logger.info("=" * 60)
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info("=" * 60)

    # Database connectivity verification (non-blocking)
    try:
        ok, latency, err = neo4j_service.check_connection()
        if ok:
            logger.info(f"✅ Neo4j Aura connection established ({latency:.1f}ms).")
        else:
            logger.warning(f"⚠️ Neo4j connection not yet reachable: {err}")
            logger.warning("   (All endpoints will return degraded status or 404 until DB connects)")
    except Exception as e:
        logger.warning(f"⚠️ Could not verify Neo4j connection on startup: {e}")

    yield

    # Clean shutdown
    logger.info("Shutting down backend services...")
    neo4j_service.close()
    logger.info("Shutdown complete.")


def create_app() -> FastAPI:
    """Factory creating and configuring the FastAPI instance."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "RESTful API & GraphRAG QA engine for 4,370+ DPWH civil works projects "
            "across Cebu Province (2022 – Present). Features sub-20ms Cypher graph traversal, "
            "5-layer domain guardrails, instant Cypher analytics, and SSE real-time streaming."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # Configure CORS for modern web frontends (React, Next.js, Vue, Svelte)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount unified API routers
    app.include_router(api_router)

    # Root welcome & health overview
    @app.get("/", tags=["General"])
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "online",
            "docs": "/docs",
            "redoc": "/redoc",
            "endpoints": {
                "health": f"{settings.API_PREFIX}/health",
                "projects": f"{settings.API_PREFIX}/projects",
                "analytics": f"{settings.API_PREFIX}/analytics",
                "chat": f"{settings.API_PREFIX}/chat",
                "pipeline": f"{settings.API_PREFIX}/pipeline"
            }
        }

    # Global Exception Handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal Server Error",
                "message": str(exc) if settings.DEBUG else "An unexpected server error occurred."
            }
        )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
