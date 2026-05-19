"""WeatherService の単体テスト (task 2.2)"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.weather import WeatherService


@pytest.fixture
def service():
    return WeatherService()


class TestGetCurrentWeather:
    @pytest.mark.asyncio
    async def test_returns_weather_data_on_success(self, service):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "current": {
                "temperature_2m": 22.5,
                "weathercode": 0,
                "windspeed_10m": 5.0,
            }
        }
        with patch("backend.services.weather.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await service.get_current_weather(lat=35.0, lon=139.0)

        assert result is not None
        assert result.temp_c == 22.5
        assert isinstance(result.condition, str)
        assert len(result.condition) > 0

    @pytest.mark.asyncio
    async def test_weathercode_0_maps_to_sunny(self, service):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "current": {"temperature_2m": 20.0, "weathercode": 0, "windspeed_10m": 0}
        }
        with patch("backend.services.weather.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await service.get_current_weather(lat=35.0, lon=139.0)

        assert result is not None
        assert "晴" in result.condition

    @pytest.mark.asyncio
    async def test_weathercode_61_maps_to_rain(self, service):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "current": {"temperature_2m": 15.0, "weathercode": 61, "windspeed_10m": 10}
        }
        with patch("backend.services.weather.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await service.get_current_weather(lat=35.0, lon=139.0)

        assert result is not None
        assert "雨" in result.condition

    @pytest.mark.asyncio
    async def test_returns_none_on_http_error(self, service):
        import httpx

        with patch("backend.services.weather.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                side_effect=httpx.HTTPStatusError(
                    "500", request=MagicMock(), response=MagicMock()
                )
            )
            mock_client_cls.return_value = mock_client

            result = await service.get_current_weather(lat=35.0, lon=139.0)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_connection_error(self, service):
        import httpx

        with patch("backend.services.weather.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                side_effect=httpx.ConnectError("connection refused")
            )
            mock_client_cls.return_value = mock_client

            result = await service.get_current_weather(lat=35.0, lon=139.0)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_timeout(self, service):
        import httpx

        with patch("backend.services.weather.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            mock_client_cls.return_value = mock_client

            result = await service.get_current_weather(lat=35.0, lon=139.0)

        assert result is None

    @pytest.mark.asyncio
    async def test_calls_open_meteo_with_correct_params(self, service):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "current": {"temperature_2m": 18.0, "weathercode": 3, "windspeed_10m": 7}
        }
        with patch("backend.services.weather.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            await service.get_current_weather(lat=35.6, lon=139.7)

        call_args = mock_client.get.call_args
        url = call_args[0][0]
        assert "open-meteo.com" in url
        params = call_args[1].get("params", {}) or call_args[0][1] if len(call_args[0]) > 1 else {}
        # URL か params のどちらかに座標が含まれること
        assert "35.6" in str(call_args) or 35.6 in str(call_args)
