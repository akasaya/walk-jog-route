import asyncio
import uuid

from backend.models.route import (
    RouteHistoryItem,
    RouteRequest,
    RouteSuggestionResponse,
)
from backend.services.ai import AIService
from backend.services.history import HistoryService
from backend.services.routing import RoutingService
from backend.services.weather import WeatherService


class RouteService:
    def __init__(
        self,
        weather_service: WeatherService,
        history_service: HistoryService,
        ai_service: AIService,
        routing_service: RoutingService,
    ):
        self._weather = weather_service
        self._history = history_service
        self._ai = ai_service
        self._routing = routing_service

    async def suggest(self, request: RouteRequest, user_id: str) -> RouteSuggestionResponse:
        weather = await self._weather.get_current_weather(request.lat, request.lon)

        history_dicts = await asyncio.to_thread(self._history.get_recent, user_id, 10)
        history = [RouteHistoryItem(**item) for item in history_dicts]

        waypoints_result = await asyncio.to_thread(
            self._ai.generate_waypoints,
            request.lat,
            request.lon,
            request.distance_km,
            request.mode,
            history,
            weather,
        )

        target_distance_m = int(request.distance_km * 1000)
        polyline, distance_m, estimated_minutes = await self._routing.generate_route(
            request.lat,
            request.lon,
            waypoints_result.waypoints,
            "foot",
            target_distance_m,
        )

        return RouteSuggestionResponse(
            route_id=str(uuid.uuid4()),
            polyline=polyline,
            distance_m=distance_m,
            estimated_minutes=estimated_minutes,
            waypoints=waypoints_result.waypoints,
            weather=weather,
        )
