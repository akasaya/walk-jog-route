"""AIService の単体テスト (task 3.3) - Bedrock Converse API"""

from unittest.mock import MagicMock

import pytest

from backend.models.route import RouteHistoryItem, RouteWaypoints, WaypointItem, WeatherData
from backend.services.ai import AIService


def _make_converse_response(waypoints=None, reasoning="テスト理由"):
    """Bedrock Converse API のレスポンスを模倣するモック"""
    return {
        "output": {
            "message": {
                "content": [{
                    "toolUse": {
                        "name": "route_waypoints",
                        "input": {
                            "waypoints": [
                                {"lat": w.lat, "lon": w.lon}
                                for w in (waypoints or [WaypointItem(lat=35.1, lon=139.1)])
                            ],
                            "reasoning": reasoning,
                        },
                    }
                }]
            }
        }
    }


@pytest.fixture
def mock_client():
    return MagicMock()


@pytest.fixture
def service(mock_client):
    return AIService(client=mock_client)


class TestGenerateWaypoints:
    def test_returns_route_waypoints_type(self, service, mock_client):
        mock_client.converse.return_value = _make_converse_response()

        result = service.generate_waypoints(
            lat=35.0, lon=139.0, distance_km=5.0, mode="walk",
            history=[], weather=None,
        )

        assert isinstance(result, RouteWaypoints)

    def test_returns_waypoints_from_response(self, service, mock_client):
        expected_wps = [WaypointItem(lat=35.2, lon=139.2), WaypointItem(lat=35.3, lon=139.3)]
        mock_client.converse.return_value = _make_converse_response(waypoints=expected_wps)

        result = service.generate_waypoints(
            lat=35.0, lon=139.0, distance_km=5.0, mode="walk",
            history=[], weather=None,
        )

        assert result.waypoints == expected_wps

    def test_calls_converse_with_model(self, service, mock_client):
        mock_client.converse.return_value = _make_converse_response()

        service.generate_waypoints(
            lat=35.0, lon=139.0, distance_km=5.0, mode="walk",
            history=[], weather=None,
        )

        call_kwargs = mock_client.converse.call_args[1]
        assert "modelId" in call_kwargs

    def test_calls_converse_with_tool_config(self, service, mock_client):
        mock_client.converse.return_value = _make_converse_response()

        service.generate_waypoints(
            lat=35.0, lon=139.0, distance_km=5.0, mode="walk",
            history=[], weather=None,
        )

        call_kwargs = mock_client.converse.call_args[1]
        assert "toolConfig" in call_kwargs
        tool_choice = call_kwargs["toolConfig"]["toolChoice"]
        assert "tool" in tool_choice


class TestPromptTemplate:
    def _get_user_prompt(self, mock_client, **kwargs):
        """generate_waypoints 呼び出し後の user メッセージ内容を取得"""
        mock_client.converse.return_value = _make_converse_response()
        defaults = dict(lat=35.6789, lon=139.7654, distance_km=5.0, mode="walk",
                        history=[], weather=None)
        defaults.update(kwargs)
        service = AIService(client=mock_client)
        service.generate_waypoints(**defaults)  # type: ignore[arg-type]
        messages = mock_client.converse.call_args[1]["messages"]
        return messages[0]["content"][0]["text"]

    def test_prompt_does_not_contain_raw_lat(self, mock_client):
        """生座標（小数4桁以上）がプロンプトに含まれないこと (security rule 7.4)"""
        prompt = self._get_user_prompt(mock_client, lat=35.6789, lon=139.7654)
        assert "35.6789" not in prompt

    def test_prompt_contains_rounded_lat(self, mock_client):
        """丸めた座標（1桁精度）はプロンプトに含まれること"""
        prompt = self._get_user_prompt(mock_client, lat=35.6789, lon=139.7654)
        assert "35.7" in prompt or "35.6" in prompt

    def test_prompt_contains_distance_km(self, mock_client):
        prompt = self._get_user_prompt(mock_client, distance_km=8.5)
        assert "8.5" in prompt

    def test_prompt_contains_mode(self, mock_client):
        prompt = self._get_user_prompt(mock_client, mode="jog")
        assert "jog" in prompt or "ジョグ" in prompt or "ジョギング" in prompt

    def test_prompt_contains_weather_when_provided(self, mock_client):
        weather = WeatherData(temp_c=22.5, condition="晴れ")
        prompt = self._get_user_prompt(mock_client, weather=weather)
        assert "22.5" in prompt or "晴れ" in prompt

    def test_prompt_contains_history_when_provided(self, mock_client):
        history = [
            RouteHistoryItem(
                route_id="r1", started_at="2026-05-19T09:00:00Z",
                mode="walk", distance_km=4.0, has_track=True, polyline="abc",
            )
        ]
        prompt = self._get_user_prompt(mock_client, history=history)
        assert "2026-05-19" in prompt or "4.0" in prompt or "walk" in prompt

    def test_converse_has_system_message(self, service, mock_client):
        mock_client.converse.return_value = _make_converse_response()
        service.generate_waypoints(
            lat=35.0, lon=139.0, distance_km=5.0, mode="walk",
            history=[], weather=None,
        )
        call_kwargs = mock_client.converse.call_args[1]
        assert "system" in call_kwargs
        assert len(call_kwargs["system"]) > 0
