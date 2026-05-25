import uuid

from backend.models.route import (
    RouteRequest,
    RouteSuggestionResponse,
)
from backend.services.history import HistoryService
from backend.services.routing import RoutingService
from backend.services.weather import WeatherService


class RouteService:
    def __init__(
        self,
        weather_service: WeatherService,
        history_service: HistoryService,
        routing_service: RoutingService,
    ):
        self._weather = weather_service
        self._history = history_service
        self._routing = routing_service

    async def suggest(self, request: RouteRequest, user_id: str) -> RouteSuggestionResponse:
        weather = await self._weather.get_current_weather(request.lat, request.lon)

        target_distance_m = int(request.distance_km * 1000)
        # user_id ごとに異なるルートを生成するシード（同じユーザーは毎回少し違うルート）
        seed = hash(user_id) % 100

        if request.route_type == "one_way":
            polyline, distance_m, estimated_minutes = await self._routing.generate_one_way(
                request.lat, request.lon, target_distance_m, "foot", seed
            )
        else:
            polyline, distance_m, estimated_minutes = await self._routing.generate_round_trip(
                request.lat, request.lon, target_distance_m, "foot", seed
            )

        return RouteSuggestionResponse(
            route_id=str(uuid.uuid4()),
            polyline=polyline,
            distance_m=distance_m,
            estimated_minutes=estimated_minutes,
            waypoints=[],
            weather=weather,
        )
