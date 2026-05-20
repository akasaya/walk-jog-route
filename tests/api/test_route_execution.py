"""ルート実行 API のテスト (task 6.1, 6.2)"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

HEADERS = {"X-User-Id": "user-123"}
START_BODY = {
    "polyline": "encoded_poly",
    "distance_km": 5.0,
    "mode": "walk",
    "weather": {"temp_c": 20.0, "condition": "晴れ"},
}
TRACK_BODY = {
    "points": [
        {"lat": 35.0, "lon": 139.0, "timestamp": "2026-05-20T09:01:00"},
        {"lat": 35.01, "lon": 139.01, "timestamp": "2026-05-20T09:02:00"},
    ],
    "status": "tracking",
    "started_at": "2026-05-20T09:00:00",
}


def test_start_route_returns_201():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.save_route = MagicMock()
        response = client.post("/routes/test-route-id/start", json=START_BODY, headers=HEADERS)
    assert response.status_code == 201


def test_start_route_response_contains_route_id():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.save_route = MagicMock()
        response = client.post("/routes/test-route-id/start", json=START_BODY, headers=HEADERS)
    assert response.json()["route_id"] == "test-route-id"


def test_start_route_response_contains_started_at():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.save_route = MagicMock()
        response = client.post("/routes/test-route-id/start", json=START_BODY, headers=HEADERS)
    data = response.json()
    assert "started_at" in data
    assert "T" in data["started_at"]  # ISO8601 形式


def test_track_route_returns_200():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.update_track = MagicMock()
        response = client.post("/routes/test-route-id/track", json=TRACK_BODY, headers=HEADERS)
    assert response.status_code == 200


def test_track_route_returns_saved_count():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.update_track = MagicMock()
        response = client.post("/routes/test-route-id/track", json=TRACK_BODY, headers=HEADERS)
    assert response.json()["saved_count"] == 2


def test_track_route_invalid_status_returns_422():
    invalid_body = {**TRACK_BODY, "status": "invalid_status"}
    response = client.post("/routes/test-route-id/track", json=invalid_body, headers=HEADERS)
    assert response.status_code == 422
