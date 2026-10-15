"""
Common Response Models
======================
Standardized response wrappers and health status models.
"""

from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone

T = TypeVar("T")


class StandardResponse(BaseModel, Generic[T]):
    """Standardized wrapper for API responses."""
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[T] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ServiceHealth(BaseModel):
    """Health information for a specific dependency."""
    status: str = Field(description="'healthy', 'degraded', or 'unhealthy'")
    reachable: bool
    latency_ms: Optional[float] = None
    message: Optional[str] = None


class SystemHealthResponse(BaseModel):
    """Comprehensive system health diagnostics."""
    status: str = Field(description="Overall health: 'healthy', 'degraded', or 'unhealthy'")
    version: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    neo4j: ServiceHealth
    llm: ServiceHealth
    environment: str = Field(default="production")
