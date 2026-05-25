export type Mode = "walk" | "jog";
export type RouteType = "loop" | "one_way";

export interface RouteRequest {
  lat: number;
  lon: number;
  distance_km: number;
  mode: Mode;
  route_type: RouteType;
}

export interface WaypointItem {
  lat: number;
  lon: number;
}

export interface WeatherData {
  temp_c: number;
  condition: string;
}

export interface RouteSuggestionResponse {
  route_id: string;
  polyline: string;
  distance_m: number;
  estimated_minutes: number;
  waypoints: WaypointItem[];
  weather: WeatherData | null;
}

export interface RouteHistoryItem {
  route_id: string;
  started_at: string;
  mode: Mode;
  distance_km: number;
  has_track: boolean;
  polyline: string;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: string;
}

export interface StartRouteRequest {
  polyline: string;
  distance_km: number;
  mode: Mode;
  weather: WeatherData | null;
}

export interface StartRouteResponse {
  route_id: string;
  started_at: string;
}

export interface TrackRequest {
  started_at: string;
  points: TrackPoint[];
  status: "tracking" | "completed" | "abandoned";
}

export interface TrackResponse {
  saved_count: number;
}
