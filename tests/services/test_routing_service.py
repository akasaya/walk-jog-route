"""RoutingService の単体テスト (task 4.4)"""

from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

from backend.models.route import WaypointItem
from backend.services.routing import RoutingService

# ダミー座標（テスト用の架空の値）
TEST_ORIGIN_LAT = 35.0
TEST_ORIGIN_LON = 139.0
TEST_WAYPOINTS = [
    WaypointItem(lat=35.1, lon=139.1),
    WaypointItem(lat=35.2, lon=139.2),
]


def _make_gh_response(distance_m: float, time_ms: int, polyline: str = "encoded_poly"):
    """GraphHopper レスポンスを模倣するモック"""
    mock = MagicMock()
    mock.raise_for_status = MagicMock()
    mock.json.return_value = {
        "paths": [{"points": polyline, "distance": distance_m, "time": time_ms}]
    }
    return mock


@pytest.fixture
def service():
    return RoutingService(api_key="test-key")


def _patch_client(responses: list):
    """httpx.AsyncClient を差し替え、responses を順番に返すパッチを返す"""
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(side_effect=responses)
    patcher = patch("backend.services.routing.httpx.AsyncClient", return_value=mock_client)
    return patcher, mock_client


class TestGenerateRoute:
    @pytest.mark.asyncio
    async def test_returns_tuple_of_polyline_distance_minutes(self, service):
        patcher, _ = _patch_client([_make_gh_response(5000, 3_600_000)])
        with patcher:
            result = await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert isinstance(result, tuple)
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_returns_polyline_string(self, service):
        patcher, _ = _patch_client([_make_gh_response(5000, 3_600_000, "poly_abc")])
        with patcher:
            polyline, _, _ = await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert polyline == "poly_abc"

    @pytest.mark.asyncio
    async def test_returns_actual_distance_m(self, service):
        patcher, _ = _patch_client([_make_gh_response(4800, 3_600_000)])
        with patcher:
            _, distance_m, _ = await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert distance_m == 4800

    @pytest.mark.asyncio
    async def test_builds_round_trip_points(self, service):
        """API 呼び出し時に起点が先頭と末尾に含まれること（周回ルート）"""
        patcher, mock_client = _patch_client([_make_gh_response(5000, 3_600_000)])
        with patcher:
            await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        call_kwargs = mock_client.get.call_args
        params = call_kwargs[1].get("params", [])
        point_values = [v for k, v in params if k == "point"]
        assert point_values[0] == f"{TEST_ORIGIN_LAT},{TEST_ORIGIN_LON}"
        assert point_values[-1] == f"{TEST_ORIGIN_LAT},{TEST_ORIGIN_LON}"

    @pytest.mark.asyncio
    async def test_calls_graphhopper_url(self, service):
        patcher, mock_client = _patch_client([_make_gh_response(5000, 3_600_000)])
        with patcher:
            await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        url = mock_client.get.call_args[0][0]
        assert "graphhopper.com" in url


class TestEstimatedMinutes:
    @pytest.mark.asyncio
    async def test_estimated_minutes_is_time_ms_divided_by_60000(self, service):
        patcher, _ = _patch_client([_make_gh_response(5000, 3_600_000)])
        with patcher:
            _, _, estimated_minutes = await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert estimated_minutes == 60  # 3_600_000 / 60_000 = 60

    @pytest.mark.asyncio
    async def test_estimated_minutes_is_integer(self, service):
        patcher, _ = _patch_client([_make_gh_response(5000, 90_000)])
        with patcher:
            _, _, estimated_minutes = await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert isinstance(estimated_minutes, int)
        assert estimated_minutes == 1  # 90_000 / 60_000 = 1.5 → int = 1


class TestRetryLogic:
    @pytest.mark.asyncio
    async def test_no_retry_when_distance_within_20_percent(self, service):
        """距離が ±20% 以内ならリトライしない"""
        patcher, mock_client = _patch_client([_make_gh_response(5000, 3_600_000)])
        with patcher:
            await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert mock_client.get.call_count == 1

    @pytest.mark.asyncio
    async def test_retries_once_when_distance_too_large(self, service):
        """距離が 20% 超過したとき 1 回だけリトライする"""
        first_resp = _make_gh_response(7000, 4_200_000)  # 5000 の +40%
        second_resp = _make_gh_response(5200, 3_700_000)
        patcher, mock_client = _patch_client([first_resp, second_resp])
        with patcher:
            await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert mock_client.get.call_count == 2

    @pytest.mark.asyncio
    async def test_retries_once_when_distance_too_small(self, service):
        """距離が 20% 未満のときも 1 回リトライする"""
        first_resp = _make_gh_response(3000, 2_000_000)  # 5000 の -40%
        second_resp = _make_gh_response(4200, 3_000_000)
        patcher, mock_client = _patch_client([first_resp, second_resp])
        with patcher:
            await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert mock_client.get.call_count == 2

    @pytest.mark.asyncio
    async def test_retry_uses_one_fewer_waypoint(self, service):
        """リトライ時に waypoints を 1 点間引いた状態で呼び出す"""
        first_resp = _make_gh_response(7000, 4_200_000)
        second_resp = _make_gh_response(5200, 3_700_000)
        patcher, mock_client = _patch_client([first_resp, second_resp])
        with patcher:
            await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        first_call_params = mock_client.get.call_args_list[0][1]["params"]
        second_call_params = mock_client.get.call_args_list[1][1]["params"]
        first_points = [v for k, v in first_call_params if k == "point"]
        second_points = [v for k, v in second_call_params if k == "point"]
        # 2 waypoints → 4 points (origin + 2 wps + origin)
        # 1 waypoint  → 3 points (origin + 1 wp + origin)
        assert len(second_points) == len(first_points) - 1

    @pytest.mark.asyncio
    async def test_no_retry_when_single_waypoint(self, service):
        """経由地が 1 点のときは間引けないのでリトライしない"""
        single_wp = [WaypointItem(lat=35.1, lon=139.1)]
        patcher, mock_client = _patch_client([_make_gh_response(9000, 5_000_000)])
        with patcher:
            await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                single_wp, "foot",
                target_distance_m=5000,
            )
        assert mock_client.get.call_count == 1

    @pytest.mark.asyncio
    async def test_returns_retry_result_when_first_out_of_range(self, service):
        """リトライ結果を返す（1 回目の結果ではなく）"""
        first_resp = _make_gh_response(7000, 4_200_000, "poly_first")
        second_resp = _make_gh_response(5200, 3_700_000, "poly_retry")
        patcher, _ = _patch_client([first_resp, second_resp])
        with patcher:
            polyline, distance_m, _ = await service.generate_route(
                TEST_ORIGIN_LAT, TEST_ORIGIN_LON,
                TEST_WAYPOINTS, "foot",
                target_distance_m=5000,
            )
        assert polyline == "poly_retry"
        assert distance_m == 5200
