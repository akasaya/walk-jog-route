from typing import Literal

from pydantic import BaseModel, Field


class RouteRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    distance_km: float = Field(ge=0.5, le=50)
    mode: Literal["walk", "jog"]


class WeatherData(BaseModel):
    temp_c: float
    condition: str


class WaypointItem(BaseModel):
    lat: float
    lon: float


class RouteWaypoints(BaseModel):
    """Claude API 構造化出力スキーマ"""

    waypoints: list[WaypointItem]
    reasoning: str


class RouteSuggestionResponse(BaseModel):
    route_id: str
    polyline: str
    distance_m: int
    estimated_minutes: int
    waypoints: list[WaypointItem]
    weather: WeatherData | None


class RouteHistoryItem(BaseModel):
    route_id: str
    started_at: str
    mode: Literal["walk", "jog"]
    distance_km: float
    has_track: bool
    polyline: str


class TrackPoint(BaseModel):
    lat: float
    lon: float
    timestamp: str


class TrackRequest(BaseModel):
    points: list[TrackPoint]
    status: Literal["tracking", "completed", "abandoned"]
    started_at: str  # ISO8601 — POST /start のレスポンスから取得


class StartRouteRequest(BaseModel):
    polyline: str
    distance_km: float = Field(ge=0.5, le=50)
    mode: Literal["walk", "jog"]
    weather: WeatherData | None = None


class StartRouteResponse(BaseModel):
    route_id: str
    started_at: str  # ISO8601


class TrackResponse(BaseModel):
    saved_count: int
