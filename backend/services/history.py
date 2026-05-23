from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

from backend.models.route import TrackPoint


def _floats_to_decimal(obj: object) -> object:
    """DynamoDB に渡す前に float を Decimal に変換する。"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _floats_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_floats_to_decimal(item) for item in obj]
    return obj


class HistoryService:
    def __init__(self, table_name: str = "walk-jog-routes"):
        self._table = boto3.resource("dynamodb").Table(table_name)

    def save_route(
        self,
        user_id: str,
        route_id: str,
        started_at: str,
        polyline: str,
        distance_km: float,
        mode: str,
        weather: dict | None,
    ) -> None:
        item: dict = {
            "userId": user_id,
            "SK": f"{started_at}#{route_id}",
            "routeId": route_id,
            "started_at": started_at,
            "polyline": polyline,
            "distance_km": Decimal(str(distance_km)),
            "mode": mode,
            "has_track": False,
        }
        if weather is not None:
            item["weather"] = _floats_to_decimal(weather)
        self._table.put_item(Item=item)

    def get_recent(self, user_id: str, n: int = 10) -> list[dict]:
        result = self._table.query(
            KeyConditionExpression=Key("userId").eq(user_id),
            ScanIndexForward=False,
            Limit=n,
        )
        return result.get("Items", [])

    def update_track(
        self,
        user_id: str,
        route_id: str,
        started_at: str,
        points: list[TrackPoint],
        status: str,
    ) -> None:
        serialized = [_floats_to_decimal(p.model_dump()) for p in points]
        self._table.update_item(
            Key={"userId": user_id, "SK": f"{started_at}#{route_id}"},
            UpdateExpression="SET #st = :status, track_points = list_append(if_not_exists(track_points, :empty), :pts), has_track = :ht",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={
                ":status": status,
                ":pts": serialized,
                ":empty": [],
                ":ht": True,
            },
        )
