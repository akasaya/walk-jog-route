import boto3

from backend.models.route import RouteHistoryItem, RouteWaypoints, WeatherData

_SYSTEM_PROMPT = """\
あなたは散歩・ジョギングルートの設計者です。
ユーザーの現在地・目標距離・過去のルート履歴・天気を考慮して、
今日のルートの経由地（緯度・経度）を提案してください。
過去に通行した方角・エリアとは異なるエリアを優先してください。
reasoning に選んだ理由を日本語で記述してください。\
"""

_TOOL_NAME = "route_waypoints"


def _build_history_summary(history: list[RouteHistoryItem]) -> str:
    if not history:
        return "なし"
    lines = [
        f"- {item.started_at[:10]} / {item.mode} / {item.distance_km}km"
        for item in history
    ]
    return "\n".join(lines)


def _build_weather_summary(weather: WeatherData | None) -> str:
    if weather is None:
        return "不明"
    return f"{weather.condition}、気温 {weather.temp_c}°C"


class AIService:
    def __init__(
        self,
        client=None,
        model: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ):
        self._client = client or boto3.client("bedrock-runtime", region_name="us-east-1")
        self._model = model

    def generate_waypoints(
        self,
        lat: float,
        lon: float,
        distance_km: float,
        mode: str,
        history: list[RouteHistoryItem],
        weather: WeatherData | None,
    ) -> RouteWaypoints:
        prompt = self._build_user_prompt(lat, lon, distance_km, mode, weather, history)
        response = self._client.converse(
            modelId=self._model,
            system=[{"text": _SYSTEM_PROMPT}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            toolConfig={
                "tools": [{
                    "toolSpec": {
                        "name": _TOOL_NAME,
                        "description": "提案する経由地リストと理由を返す",
                        "inputSchema": {"json": RouteWaypoints.model_json_schema()},
                    }
                }],
                "toolChoice": {"tool": {"name": _TOOL_NAME}},
            },
        )
        tool_input = response["output"]["message"]["content"][0]["toolUse"]["input"]
        return RouteWaypoints(**tool_input)

    def _build_user_prompt(
        self,
        lat: float,
        lon: float,
        distance_km: float,
        mode: str,
        weather: WeatherData | None,
        history: list[RouteHistoryItem],
    ) -> str:
        lat_r = round(lat, 1)
        lon_r = round(lon, 1)
        search_radius_km = round(distance_km / 4, 1)

        return f"""\
## コンテキスト
- 現在地: {lat_r}, {lon_r}
- 目標距離: {distance_km}km（モード: {mode}）
- 現在の天気: {_build_weather_summary(weather)}
- 過去ルート（直近 {len(history)} 件）:
{_build_history_summary(history)}

## 指示
- 現在地から {search_radius_km}km 程度の範囲内で経由地を 2〜3 点選ぶ
- 過去に通行した方角・エリアとは異なるエリアを優先する
- スタート地点に戻れる周回ルートになるよう経由地を配置する\
"""
