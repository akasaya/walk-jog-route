import os

import httpx

from backend.models.route import WaypointItem

_GRAPHHOPPER_URL = "https://graphhopper.com/api/1/route"


class RoutingService:
    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or os.environ.get("GRAPHHOPPER_API_KEY", "")

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
