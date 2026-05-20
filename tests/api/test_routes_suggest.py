"""POST /routes/suggest の統合テスト (task 5.2, 5.4)"""

import asyncio
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.route import RouteSuggestionResponse, WaypointItem, WeatherData

client = TestClient(app)

VALID_BODY = {"lat": 35.0, "lon": 139.0, "distance_km": 5.0, "mode": "walk"}

MOCK_RESPONSE = RouteSuggestionResponse(
    route_id="test-route-id",
    polyline="encoded_poly",
    distance_m=5000,
    estimated_minutes=60,
    waypoints=[WaypointItem(lat=35.1, lon=139.1)],
    weather=WeatherData(temp_c=20.0, condition="晴れ"),
)


def test_suggest_route_returns_200():
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_svc.suggest = AsyncMock(return_value=MOCK_RESPONSE)
        response = client.post(
            "/routes/suggest",
            json=VALID_BODY,
            headers={"X-User-Id": "user-123"},
        )
    assert response.status_code == 200


def test_suggest_route_response_contains_polyline():
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_svc.suggest = AsyncMock(return_value=MOCK_RESPONSE)
        response = client.post(
            "/routes/suggest",
            json=VALID_BODY,
            headers={"X-User-Id": "user-123"},
        )
    data = response.json()
    assert data["polyline"] == "encoded_poly"


def test_suggest_route_invalid_lat_returns_422():
    response = client.post(
        "/routes/suggest",
        json={"lat": 999.0, "lon": 139.0, "distance_km": 5.0, "mode": "walk"},
        headers={"X-User-Id": "user-123"},
    )
    assert response.status_code == 422


def test_suggest_route_invalid_lon_returns_422():
    response = client.post(
        "/routes/suggest",
        json={"lat": 35.0, "lon": 999.0, "distance_km": 5.0, "mode": "walk"},
        headers={"X-User-Id": "user-123"},
    )
    assert response.status_code == 422


def test_suggest_route_distance_too_small_returns_422():
    response = client.post(
        "/routes/suggest",
        json={"lat": 35.0, "lon": 139.0, "distance_km": 0.1, "mode": "walk"},
        headers={"X-User-Id": "user-123"},
    )
    assert response.status_code == 422


def test_suggest_route_external_service_error_returns_503():
    mock_request = httpx.Request("GET", "https://example.com")
    mock_resp = httpx.Response(500, request=mock_request)
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_svc.suggest = AsyncMock(
            side_effect=httpx.HTTPStatusError("error", request=mock_request, response=mock_resp)
        )
        response = client.post(
            "/routes/suggest",
            json=VALID_BODY,
            headers={"X-User-Id": "user-123"},
        )
    assert response.status_code == 503


def test_suggest_route_timeout_returns_503():
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_svc.suggest = AsyncMock(side_effect=asyncio.TimeoutError())
        response = client.post(
            "/routes/suggest",
            json=VALID_BODY,
            headers={"X-User-Id": "user-123"},
        )
    assert response.status_code == 503
