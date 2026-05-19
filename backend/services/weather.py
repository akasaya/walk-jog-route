import logging

import httpx

from backend.models.route import WeatherData

logger = logging.getLogger(__name__)

# WMO Weather Interpretation Codes → 日本語
_WMO_CODE_MAP: dict[int, str] = {
    0: "晴れ",
    1: "概ね晴れ",
    2: "一部曇り",
    3: "曇り",
    45: "霧",
    48: "霧",
    51: "霧雨",
    53: "霧雨",
    55: "霧雨",
    61: "雨",
    63: "雨",
    65: "大雨",
    71: "雪",
    73: "雪",
    75: "大雪",
    77: "雪",
    80: "にわか雨",
    81: "にわか雨",
    82: "強いにわか雨",
    85: "にわか雪",
    86: "にわか雪",
    95: "雷雨",
    96: "激しい雷雨",
    99: "激しい雷雨",
}

_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _weathercode_to_condition(code: int) -> str:
    return _WMO_CODE_MAP.get(code, "不明")


class WeatherService:
    async def get_current_weather(
        self, lat: float, lon: float
    ) -> WeatherData | None:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    _OPEN_METEO_URL,
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "temperature_2m,weathercode,windspeed_10m",
                        "timezone": "auto",
                    },
                )
                response.raise_for_status()
                data = response.json()
                current = data["current"]
                return WeatherData(
                    temp_c=current["temperature_2m"],
                    condition=_weathercode_to_condition(current["weathercode"]),
                )
        except Exception:
            logger.warning(
                "Open-Meteo request failed for area=%.1f,%.1f", lat, lon
            )
            return None
