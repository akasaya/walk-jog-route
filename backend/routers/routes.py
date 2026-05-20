import asyncio
import logging

import httpx
from fastapi import APIRouter, Header, HTTPException, Request

from backend.limiter import limiter
from backend.models.route import RouteRequest, RouteSuggestionResponse
from backend.services.ai import AIService
from backend.services.history import HistoryService
from backend.services.route import RouteService
from backend.services.routing import RoutingService
from backend.services.weather import WeatherService

logger = logging.getLogger(__name__)

router = APIRouter()

# 遅延初期化: テスト時にモジュール読み込みで DynamoDB 接続が走らないようにする
_route_service: RouteService | None = None


def _get_route_service() -> RouteService:
    global _route_service
    if _route_service is None:
        _route_service = RouteService(
            weather_service=WeatherService(),
            history_service=HistoryService(),
            ai_service=AIService(),
            routing_service=RoutingService(),
        )
    return _route_service


@router.post("/routes/suggest", response_model=RouteSuggestionResponse, status_code=200)
@limiter.limit("10/minute")
async def suggest_route(
    request: Request,
    body: RouteRequest,
    x_user_id: str = Header(default="anonymous"),
) -> RouteSuggestionResponse:
    logger.info(
        "Route suggestion request: area=%.1f,%.1f dist=%.1fkm mode=%s",
        body.lat,
        body.lon,
        body.distance_km,
        body.mode,
    )
    svc = _get_route_service()
    try:
        return await asyncio.wait_for(svc.suggest(body, x_user_id), timeout=28.0)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="Request timed out")
    except (httpx.TimeoutException, httpx.HTTPStatusError):
        raise HTTPException(status_code=503, detail="External service unavailable")
    except Exception:
        logger.exception("Unexpected error in suggest_route")
        raise HTTPException(status_code=503, detail="Service unavailable")
