"""
Health & Diagnostic Endpoints
=============================
Monitors uptime and connectivity to Neo4j and Ollama LLM.
"""

from fastapi import APIRouter
from backend.config import settings
from backend.models.common import SystemHealthResponse, ServiceHealth
from backend.services.neo4j_service import neo4j_service
from backend.services.llm_service import llm_service

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])


@router.get("", response_model=SystemHealthResponse, summary="System Health Overview")
async def get_system_health():
    """Return overall health status across database and AI endpoints."""
    neo_ok, neo_lat, neo_err = neo4j_service.check_connection()
    llm_ok, llm_lat, llm_err = await llm_service.check_connection()

    if neo_ok and llm_ok:
        overall = "healthy"
    elif neo_ok or llm_ok:
        overall = "degraded"
    else:
        overall = "unhealthy"

    return SystemHealthResponse(
        status=overall,
        version=settings.APP_VERSION,
        neo4j=ServiceHealth(
            status="healthy" if neo_ok else "unreachable",
            reachable=neo_ok,
            latency_ms=neo_lat,
            message=neo_err or "Connected to Neo4j Knowledge Graph"
        ),
        llm=ServiceHealth(
            status="healthy" if llm_ok else "unreachable",
            reachable=llm_ok,
            latency_ms=llm_lat,
            message=llm_err or f"LLM model '{settings.LLM_MODEL}' online"
        ),
        environment="development" if settings.DEBUG else "production"
    )


@router.get("/neo4j", response_model=ServiceHealth, summary="Neo4j Connectivity Check")
async def check_neo4j_health():
    """Ping Neo4j Aura database and return round-trip latency."""
    ok, lat, err = neo4j_service.check_connection()
    return ServiceHealth(
        status="healthy" if ok else "unreachable",
        reachable=ok,
        latency_ms=lat,
        message=err or "Neo4j Aura operational"
    )


@router.get("/llm", response_model=ServiceHealth, summary="LLM Connectivity Check")
async def check_llm_health():
    """Ping local Ollama or cloud endpoint and return latency."""
    ok, lat, err = await llm_service.check_connection()
    return ServiceHealth(
        status="healthy" if ok else "unreachable",
        reachable=ok,
        latency_ms=lat,
        message=err or f"Connected to {settings.LLM_MODEL}"
    )
