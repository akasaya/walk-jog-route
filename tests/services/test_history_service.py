"""HistoryService のユニットテスト (task 1.2)"""

from unittest.mock import MagicMock, patch

import pytest

from backend.models.route import TrackPoint
from backend.services.history import HistoryService


@pytest.fixture
def mock_table():
    return MagicMock()


@pytest.fixture
def service(mock_table):
    with patch("backend.services.history.boto3") as mock_boto3:
        mock_boto3.resource.return_value.Table.return_value = mock_table
        svc = HistoryService(table_name="test-table")
        svc._table = mock_table
        yield svc, mock_table


class TestSaveRoute:
    def test_save_route_puts_item_to_dynamodb(self, service):
        svc, table = service
        svc.save_route(
            user_id="user-1",
            route_id="route-abc",
            started_at="2026-05-19T10:00:00Z",
            polyline="encoded",
            distance_km=5.0,
            mode="walk",
            weather={"temp_c": 20.0, "condition": "晴れ"},
        )
        table.put_item.assert_called_once()
        call_args = table.put_item.call_args[1]["Item"]
        assert call_args["userId"] == "user-1"
        assert call_args["SK"].startswith("2026-05-19T10:00:00Z#")
        assert call_args["routeId"] == "route-abc"
        assert call_args["polyline"] == "encoded"

    def test_save_route_without_weather(self, service):
        svc, table = service
        svc.save_route(
            user_id="user-2",
            route_id="route-xyz",
            started_at="2026-05-19T11:00:00Z",
            polyline="poly2",
            distance_km=3.0,
            mode="jog",
            weather=None,
        )
        call_args = table.put_item.call_args[1]["Item"]
        assert "weather" not in call_args


class TestGetRecent:
    def test_get_recent_returns_list(self, service):
        svc, table = service
        table.query.return_value = {
            "Items": [
                {
                    "userId": "user-1",
                    "SK": "2026-05-19T10:00:00Z#route-abc",
                    "routeId": "route-abc",
                    "started_at": "2026-05-19T10:00:00Z",
                    "mode": "walk",
                    "distance_km": 5.0,
                    "polyline": "encoded",
                    "has_track": False,
                }
            ]
        }
        result = svc.get_recent(user_id="user-1", n=10)
        assert len(result) == 1
        assert result[0]["routeId"] == "route-abc"

    def test_get_recent_queries_with_scan_index_forward_false(self, service):
        svc, table = service
        table.query.return_value = {"Items": []}
        svc.get_recent(user_id="user-1", n=10)
        call_kwargs = table.query.call_args[1]
        assert call_kwargs["ScanIndexForward"] is False
        assert call_kwargs["Limit"] == 10

    def test_get_recent_uses_user_id_as_pk(self, service):
        svc, table = service
        table.query.return_value = {"Items": []}
        svc.get_recent(user_id="user-42", n=5)
        call_kwargs = table.query.call_args[1]
        expr_values = call_kwargs["KeyConditionExpression"].get_expression()["values"]
        assert "user-42" in expr_values

    def test_get_recent_returns_empty_list_when_no_items(self, service):
        svc, table = service
        table.query.return_value = {"Items": []}
        result = svc.get_recent(user_id="user-1", n=10)
        assert result == []


class TestUpdateTrack:
    def test_update_track_updates_item_in_dynamodb(self, service):
        svc, table = service
        points = [TrackPoint(lat=35.0, lon=139.0, timestamp="2026-05-19T10:05:00Z")]
        svc.update_track(
            user_id="user-1",
            route_id="route-abc",
            started_at="2026-05-19T10:00:00Z",
            points=points,
            status="completed",
        )
        table.update_item.assert_called_once()

    def test_update_track_sets_has_track_true(self, service):
        svc, table = service
        points = [TrackPoint(lat=35.0, lon=139.0, timestamp="2026-05-19T10:05:00Z")]
        svc.update_track(
            user_id="user-1",
            route_id="route-abc",
            started_at="2026-05-19T10:00:00Z",
            points=points,
            status="completed",
        )
        call_kwargs = table.update_item.call_args[1]
        expr_values = call_kwargs["ExpressionAttributeValues"]
        assert any(v is True for v in expr_values.values())
