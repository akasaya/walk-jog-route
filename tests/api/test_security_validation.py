"""セキュリティ・バリデーション テスト（task 12.1, 12.2）

- 12.1: RouteRequest 入力範囲制約の境界値テスト
- 12.2: ログ出力の GPS 座標精度確認
"""
import logging
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.models.route import RouteSuggestionResponse, WaypointItem

client = TestClient(app)

MOCK_RESPONSE = RouteSuggestionResponse(
    route_id="test-id",
    polyline="encoded",
    distance_m=5000,
    estimated_minutes=60,
    waypoints=[WaypointItem(lat=35.1, lon=139.1)],
    weather=None,
)

VALID_BODY = {"lat": 35.0, "lon": 139.0, "distance_km": 5.0, "mode": "walk"}
HEADERS = {"X-User-Id": "user-123"}


def _suggest(body: dict) -> int:
    return client.post("/routes/suggest", json=body, headers=HEADERS).status_code


def _suggest_with_mock(body: dict) -> int:
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_svc.suggest = AsyncMock(return_value=MOCK_RESPONSE)
        return _suggest(body)


# ─── 12.1: 緯度バリデーション（lat: -90〜90） ────────────────────────────────

def test_lat_above_max_returns_422():
    assert _suggest({**VALID_BODY, "lat": 90.1}) == 422


def test_lat_below_min_returns_422():
    assert _suggest({**VALID_BODY, "lat": -90.1}) == 422


def test_lat_at_max_boundary_accepted():
    assert _suggest_with_mock({**VALID_BODY, "lat": 90.0}) == 200


def test_lat_at_min_boundary_accepted():
    assert _suggest_with_mock({**VALID_BODY, "lat": -90.0}) == 200


# ─── 12.1: 経度バリデーション（lon: -180〜180） ──────────────────────────────

def test_lon_above_max_returns_422():
    assert _suggest({**VALID_BODY, "lon": 180.1}) == 422


def test_lon_below_min_returns_422():
    assert _suggest({**VALID_BODY, "lon": -180.1}) == 422


def test_lon_at_max_boundary_accepted():
    assert _suggest_with_mock({**VALID_BODY, "lon": 180.0}) == 200


def test_lon_at_min_boundary_accepted():
    assert _suggest_with_mock({**VALID_BODY, "lon": -180.0}) == 200


# ─── 12.1: 距離バリデーション（distance_km: 0.5〜50） ────────────────────────

def test_distance_above_max_returns_422():
    assert _suggest({**VALID_BODY, "distance_km": 50.1}) == 422


def test_distance_below_min_returns_422():
    assert _suggest({**VALID_BODY, "distance_km": 0.4}) == 422


def test_distance_zero_returns_422():
    assert _suggest({**VALID_BODY, "distance_km": 0}) == 422


def test_distance_at_min_boundary_accepted():
    assert _suggest_with_mock({**VALID_BODY, "distance_km": 0.5}) == 200


def test_distance_at_max_boundary_accepted():
    assert _suggest_with_mock({**VALID_BODY, "distance_km": 50.0}) == 200


# ─── 12.1: モードバリデーション ──────────────────────────────────────────────

def test_invalid_mode_returns_422():
    assert _suggest({**VALID_BODY, "mode": "run"}) == 422


# ─── 12.2: ログ出力の GPS 座標精度 ───────────────────────────────────────────

def test_suggest_logs_rounded_coordinates_not_raw(caplog):
    """suggest_route のログに高精度座標が含まれず、1桁精度に丸めた値が含まれること。

    35.6894 → %.1f → 35.7
    139.6917 → %.1f → 139.7
    """
    # レートリミット衝突を避けるため専用ユーザーIDを使用
    log_test_headers = {"X-User-Id": "log-test-user"}
    with caplog.at_level(logging.INFO, logger="backend.routers.routes"):
        with patch("backend.routers.routes._route_service") as mock_svc:
            mock_svc.suggest = AsyncMock(return_value=MOCK_RESPONSE)
            client.post(
                "/routes/suggest",
                json={"lat": 35.6894, "lon": 139.6917, "distance_km": 5.0, "mode": "walk"},
                headers=log_test_headers,
            )

    assert "35.6894" not in caplog.text
    assert "139.6917" not in caplog.text
    assert "35.7" in caplog.text
    assert "139.7" in caplog.text
