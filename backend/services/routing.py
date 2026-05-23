import functools
import os

import boto3
import httpx

from backend.models.route import WaypointItem

_GRAPHHOPPER_URL = "https://graphhopper.com/api/1/route"


@functools.lru_cache(maxsize=1)
def _resolve_api_key() -> str:
    key = os.environ.get("GRAPHHOPPER_API_KEY", "")
    if key:
        return key
    secret_name = os.environ.get("GRAPHHOPPER_API_KEY_SECRET", "")
    if not secret_name:
        return ""
    client = boto3.client("secretsmanager", region_name="ap-northeast-1")
    return client.get_secret_value(SecretId=secret_name)["SecretString"]


class RoutingService:
    async def generate_round_trip(
        self,
        origin_lat: float,
        origin_lon: float,
        target_distance_m: int,
        profile: str,
        seed: int = 0,
    ) -> tuple[str, int, int]:
        """GraphHopper の round_trip アルゴリズムで周回ルートを生成する。
        起点に必ず戻り、指定距離に近いルートを返す。
        """
        params: list[tuple[str, str | int | float | bool | None]] = [
            ("point", f"{origin_lat},{origin_lon}"),
            ("profile", profile),
            ("algorithm", "round_trip"),
            ("round_trip.distance", target_distance_m),
            ("round_trip.seed", seed),
            ("key", self._api_key),
        ]
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(_GRAPHHOPPER_URL, params=params)
            response.raise_for_status()
            data = response.json()

        path = data["paths"][0]
        polyline: str = path["points"]
        distance_m: int = int(path["distance"])
        estimated_minutes: int = int(path["time"] / 60_000)
        return polyline, distance_m, estimated_minutes


    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or _resolve_api_key()

    async def generate_route(
        self,
        origin_lat: float,
        origin_lon: float,
        waypoints: list[WaypointItem],
        profile: str,
        target_distance_m: int,
    ) -> tuple[str, int, int]:
        """
        GraphHopper Routing API で周回ルートを生成する。
        実距離が目標の ±20% を超えかつ waypoints が 2 点以上の場合、
        末尾 waypoint を 1 点除いて 1 回だけ再試行する。
        Returns: (encoded_polyline, actual_distance_m, estimated_minutes)
        """
        polyline, distance_m, estimated_minutes = await self._call_api(
            origin_lat, origin_lon, waypoints, profile
        )

        tolerance = target_distance_m * 0.2
        if abs(distance_m - target_distance_m) > tolerance and len(waypoints) > 1:
            pruned = waypoints[:-1]
            polyline, distance_m, estimated_minutes = await self._call_api(
                origin_lat, origin_lon, pruned, profile
            )

        return polyline, distance_m, estimated_minutes

    async def _call_api(
        self,
        origin_lat: float,
        origin_lon: float,
        waypoints: list[WaypointItem],
        profile: str,
    ) -> tuple[str, int, int]:
        params: list[tuple[str, str | int | float | bool | None]] = [
            ("point", f"{origin_lat},{origin_lon}")
        ]
        for wp in waypoints:
            params.append(("point", f"{wp.lat},{wp.lon}"))
        params.append(("point", f"{origin_lat},{origin_lon}"))
        params.extend([("profile", profile), ("key", self._api_key)])

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(_GRAPHHOPPER_URL, params=params)
            response.raise_for_status()
            data = response.json()

        path = data["paths"][0]
        polyline: str = path["points"]
        distance_m: int = int(path["distance"])
        estimated_minutes: int = int(path["time"] / 60_000)
        return polyline, distance_m, estimated_minutes
