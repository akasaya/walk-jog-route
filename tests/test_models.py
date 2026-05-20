"""Pydantic モデルのユニットテスト (task 1.1)"""

import pytest
from pydantic import ValidationError

from backend.models.route import (
    RouteRequest,
    RouteSuggestionResponse,
    RouteWaypoints,
    TrackPoint,
    TrackRequest,
    WaypointItem,
    WeatherData,
)


class TestRouteRequest:
    def test_route_request_valid_walk(self):
        req = RouteRequest(lat=35.0, lon=139.0, distance_km=5.0, mode="walk")
        assert req.lat == 35.0
        assert req.lon == 139.0
        assert req.distance_km == 5.0
        assert req.mode == "walk"

    def test_route_request_valid_jog(self):
        req = RouteRequest(lat=0.0, lon=0.0, distance_km=0.5, mode="jog")
        assert req.mode == "jog"

    def test_route_request_lat_too_large_raises(self):
        with pytest.raises(ValidationError):
            RouteRequest(lat=91.0, lon=139.0, distance_km=5.0, mode="walk")

    def test_route_request_lat_too_small_raises(self):
        with pytest.raises(ValidationError):
            RouteRequest(lat=-91.0, lon=139.0, distance_km=5.0, mode="walk")

    def test_route_request_lon_too_large_raises(self):
        with pytest.raises(ValidationError):
            RouteRequest(lat=35.0, lon=181.0, distance_km=5.0, mode="walk")

    def test_route_request_lon_too_small_raises(self):
        with pytest.raises(ValidationError):
            RouteRequest(lat=35.0, lon=-181.0, distance_km=5.0, mode="walk")

    def test_route_request_distance_below_minimum_raises(self):
        with pytest.raises(ValidationError):
            RouteRequest(lat=35.0, lon=139.0, distance_km=0.4, mode="walk")

    def test_route_request_distance_above_maximum_raises(self):
        with pytest.raises(ValidationError):
            RouteRequest(lat=35.0, lon=139.0, distance_km=50.1, mode="walk")

    def test_route_request_invalid_mode_raises(self):
        with pytest.raises(ValidationError):
            RouteRequest(lat=35.0, lon=139.0, distance_km=5.0, mode="run")

    def test_route_request_boundary_lat_90(self):
        req = RouteRequest(lat=90.0, lon=0.0, distance_km=1.0, mode="walk")
        assert req.lat == 90.0

    def test_route_request_boundary_lon_minus180(self):
        req = RouteRequest(lat=0.0, lon=-180.0, distance_km=1.0, mode="walk")
        assert req.lon == -180.0

    def test_route_request_boundary_distance_50(self):
        req = RouteRequest(lat=0.0, lon=0.0, distance_km=50.0, mode="jog")
        assert req.distance_km == 50.0


class TestWeatherData:
    def test_weather_data_valid(self):
        w = WeatherData(temp_c=20.5, condition="晴れ")
        assert w.temp_c == 20.5
        assert w.condition == "晴れ"

    def test_weather_data_negative_temp(self):
        w = WeatherData(temp_c=-5.0, condition="雪")
        assert w.temp_c == -5.0


class TestWaypointItem:
    def test_waypoint_item_valid(self):
        wp = WaypointItem(lat=35.0, lon=139.0)
        assert wp.lat == 35.0
        assert wp.lon == 139.0


class TestRouteWaypoints:
    def test_route_waypoints_valid(self):
        wps = RouteWaypoints(
            waypoints=[WaypointItem(lat=35.0, lon=139.0)],
            reasoning="公園を経由するルート",
        )
        assert len(wps.waypoints) == 1
        assert wps.reasoning == "公園を経由するルート"

    def test_route_waypoints_empty_list(self):
        wps = RouteWaypoints(waypoints=[], reasoning="")
        assert wps.waypoints == []


class TestRouteSuggestionResponse:
    def test_response_with_weather(self):
        resp = RouteSuggestionResponse(
            route_id="abc-123",
            polyline="encoded_polyline_string",
            distance_m=5000,
            estimated_minutes=60,
            waypoints=[WaypointItem(lat=35.0, lon=139.0)],
            weather=WeatherData(temp_c=22.0, condition="曇り"),
        )
        assert resp.route_id == "abc-123"
        assert resp.weather is not None
        assert resp.weather.temp_c == 22.0

    def test_response_without_weather(self):
        resp = RouteSuggestionResponse(
            route_id="xyz-999",
            polyline="poly",
            distance_m=1000,
            estimated_minutes=10,
            waypoints=[],
            weather=None,
        )
        assert resp.weather is None


class TestTrackRequest:
    def test_track_request_completed(self):
        req = TrackRequest(
            points=[TrackPoint(lat=35.0, lon=139.0, timestamp="2026-05-19T10:00:00Z")],
            status="completed",
            started_at="2026-05-19T09:00:00",
        )
        assert req.status == "completed"
        assert len(req.points) == 1

    def test_track_request_tracking(self):
        req = TrackRequest(points=[], status="tracking", started_at="2026-05-19T09:00:00")
        assert req.status == "tracking"

    def test_track_request_abandoned(self):
        req = TrackRequest(points=[], status="abandoned", started_at="2026-05-19T09:00:00")
        assert req.status == "abandoned"

    def test_track_request_invalid_status_raises(self):
        with pytest.raises(ValidationError):
            TrackRequest(points=[], status="unknown", started_at="2026-05-19T09:00:00")
