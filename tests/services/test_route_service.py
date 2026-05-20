"""RouteService の単体テスト (task 5.1)"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.models.route import (
    RouteHistoryItem,
    RouteRequest,
    RouteSuggestionResponse,
    RouteWaypoints,
    WaypointItem,
    WeatherData,
)
from backend.services.route import RouteService

TEST_REQUEST = RouteRequest(lat=35.0, lon=139.0, distance_km=5.0, mode="walk")
TEST_USER_ID = "user-abc"

MOCK_WEATHER = WeatherData(temp_c=20.0, condition="晴れ")
MOCK_HISTORY_DICTS = [
    {
        "route_id": "r1",
        "started_at": "2026-05-19T09:00:00",
        "mode": "walk",
        "distance_km": 4.0,
        "has_track": False,
        "polyline": "enc1",
    }
]
MOCK_WAYPOINTS = RouteWaypoints(
    waypoints=[WaypointItem(lat=35.1, lon=139.1)],
    reasoning="テスト理由",
)


@pytest.fixture
def services():
    weather_svc = MagicMock()
    weather_svc.get_current_weather = AsyncMock(return_value=MOCK_WEATHER)

    history_svc = MagicMock()
    history_svc.get_recent = MagicMock(return_value=MOCK_HISTORY_DICTS)

    ai_svc = MagicMock()
    ai_svc.generate_waypoints = MagicMock(return_value=MOCK_WAYPOINTS)

    routing_svc = MagicMock()
    routing_svc.generate_route = AsyncMock(return_value=("encoded_poly", 5000, 60))

    return weather_svc, history_svc, ai_svc, routing_svc


@pytest.fixture
def route_service(services):
    weather_svc, history_svc, ai_svc, routing_svc = services
    return RouteService(
        weather_service=weather_svc,
        history_service=history_svc,
        ai_service=ai_svc,
        routing_service=routing_svc,
    )


@pytest.mark.asyncio
async def test_suggest_returns_route_suggestion_response(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert isinstance(result, RouteSuggestionResponse)


@pytest.mark.asyncio
async def test_suggest_polyline_matches_routing_service(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.polyline == "encoded_poly"


@pytest.mark.asyncio
async def test_suggest_distance_m_matches_routing_service(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.distance_m == 5000


@pytest.mark.asyncio
async def test_suggest_estimated_minutes_matches_routing_service(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.estimated_minutes == 60


@pytest.mark.asyncio
async def test_suggest_weather_included_in_response(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.weather == MOCK_WEATHER


@pytest.mark.asyncio
async def test_suggest_route_id_is_uuid_string(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    uuid.UUID(result.route_id)  # raises ValueError if invalid


@pytest.mark.asyncio
async def test_suggest_weather_none_when_weather_service_returns_none(services):
    weather_svc, history_svc, ai_svc, routing_svc = services
    weather_svc.get_current_weather = AsyncMock(return_value=None)
    svc = RouteService(
        weather_service=weather_svc,
        history_service=history_svc,
        ai_service=ai_svc,
        routing_service=routing_svc,
    )
    result = await svc.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.weather is None


@pytest.mark.asyncio
async def test_suggest_calls_routing_with_target_distance_m(services):
    weather_svc, history_svc, ai_svc, routing_svc = services
    svc = RouteService(
        weather_service=weather_svc,
        history_service=history_svc,
        ai_service=ai_svc,
        routing_service=routing_svc,
    )
    await svc.suggest(TEST_REQUEST, TEST_USER_ID)
    routing_svc.generate_route.assert_called_once()
    call_args = routing_svc.generate_route.call_args
    assert call_args.args[4] == 5000  # target_distance_m = 5.0km * 1000
