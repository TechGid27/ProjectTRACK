"""
Unified API Router
==================
Mounts all modular sub-routers under the `/api` prefix.
"""

from fastapi import APIRouter

from backend.api.health import router as health_router
from backend.api.projects import router as projects_router
from backend.api.analytics import router as analytics_router
from backend.api.chat import router as chat_router
from backend.api.pipeline import router as pipeline_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(projects_router)
api_router.include_router(analytics_router)
api_router.include_router(chat_router)
api_router.include_router(pipeline_router)
