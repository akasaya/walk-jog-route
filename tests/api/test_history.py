"""GET /routes/history の統合テスト (task 7.1)"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)
HEADERS = {"X-User-Id": "user-123"}

MOCK_HISTORY = [
    {
        "userId": "user-123",
        "SK": "2026-05-19T09:00:00#r1",
        "routeId": "r1",
        "started_at": "2026-05-19T09:00:00",
        "mode": "walk",
        "distance_km": 4.0,
        "has_track": False,
        "polyline": "enc1",
    },
    {
        "userId": "user-123",
        "SK": "2026-05-18T08:00:00#r2",
        "routeId": "r2",
        "started_at": "2026-05-18T08:00:00",
        "mode": "jog",
        "distance_km": 8.0,
        "has_track": True,
        "polyline": "enc2",
    },
]


def test_history_returns_200():
    with patch("backend.routers.history._history_service") as mock_hist:
        mock_hist.get_recent = MagicMock(return_value=MOCK_HISTORY)
        response = client.get("/routes/history", headers=HEADERS)
    assert response.status_code == 200


def test_history_returns_list():
    with patch("backend.routers.history._history_service") as mock_hist:
        mock_hist.get_recent = MagicMock(return_value=MOCK_HISTORY)
        response = client.get("/routes/history", headers=HEADERS)
    data = response.json()
    assert isinstance(data["routes"], list)
    assert len(data["routes"]) == 2


def test_history_item_has_required_fields():
    with patch("backend.routers.history._history_service") as mock_hist:
        mock_hist.get_recent = MagicMock(return_value=MOCK_HISTORY)
        response = client.get("/routes/history", headers=HEADERS)
    item = response.json()["routes"][0]
    for field in ["route_id", "started_at", "mode", "distance_km", "has_track", "polyline"]:
        assert field in item


def test_history_empty_returns_empty_list():
    with patch("backend.routers.history._history_service") as mock_hist:
        mock_hist.get_recent = MagicMock(return_value=[])
        response = client.get("/routes/history", headers=HEADERS)
    assert response.json()["routes"] == []
