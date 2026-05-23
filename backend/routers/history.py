from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.models.route import RouteHistoryItem
from backend.services.history import HistoryService

router = APIRouter()

_history_service: HistoryService | None = None


def _get_history_service() -> HistoryService:
    global _history_service
    if _history_service is None:
        _history_service = HistoryService()
    return _history_service


class HistoryResponse(BaseModel):
    routes: list[RouteHistoryItem]


@router.get("/routes/history", response_model=HistoryResponse)
async def get_history(
    x_user_id: str = Header(default="anonymous"),
) -> HistoryResponse:
    items = _get_history_service().get_recent(user_id=x_user_id, n=20)
    routes = [
        RouteHistoryItem(
            route_id=item["routeId"],
            started_at=item["started_at"],
            mode=item["mode"],
            distance_km=float(item["distance_km"]),
            has_track=item.get("has_track", False),
            polyline=item["polyline"],
        )
        for item in items
    ]
    return HistoryResponse(routes=routes)
