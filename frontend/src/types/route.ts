export type Mode = "walk" | "jog";

export interface RouteRequest {
  lat: number;
  lon: number;
  distance_km: number;
  mode: Mode;
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
