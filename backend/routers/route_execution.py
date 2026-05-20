from datetime import datetime, timezone

from fastapi import APIRouter, Header

from backend.models.route import (
    StartRouteRequest,
    StartRouteResponse,
    TrackRequest,
    TrackResponse,
)
from backend.services.history import HistoryService

router = APIRouter()

# 遅延初期化: テスト時にモジュール読み込みで DynamoDB 接続が走らないようにする
_history_service: HistoryService | None = None


def _get_history_service() -> HistoryService:
    global _history_service
    if _history_service is None:
        _history_service = HistoryService()
    return _history_service


@router.post("/routes/{route_id}/start", response_model=StartRouteResponse, status_code=201)
async def start_route(
    route_id: str,
    body: StartRouteRequest,
    x_user_id: str = Header(default="anonymous"),
) -> StartRouteResponse:
    started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    weather_dict = body.weather.model_dump() if body.weather else None
    _get_history_service().save_route(
        user_id=x_user_id,
        route_id=route_id,
        started_at=started_at,
        polyline=body.polyline,
        distance_km=body.distance_km,
        mode=body.mode,
        weather=weather_dict,
    )
    return StartRouteResponse(route_id=route_id, started_at=started_at)


@router.post("/routes/{route_id}/track", response_model=TrackResponse, status_code=200)
async def track_route(
    route_id: str,
    body: TrackRequest,
    x_user_id: str = Header(default="anonymous"),
) -> TrackResponse:
    _get_history_service().update_track(
        user_id=x_user_id,
        route_id=route_id,
        started_at=body.started_at,
        points=body.points,
        status=body.status,
    )
    return TrackResponse(saved_count=len(body.points))
