import { apiFetch } from "./client";
import type {
  RouteHistoryItem,
  RouteRequest,
  RouteSuggestionResponse,
  StartRouteRequest,
  StartRouteResponse,
  TrackRequest,
  TrackResponse,
} from "../types/route";

export async function suggestRoute(
  request: RouteRequest,
): Promise<RouteSuggestionResponse> {
  return apiFetch<RouteSuggestionResponse>("/routes/suggest", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getHistory(): Promise<RouteHistoryItem[]> {
  const data = await apiFetch<{ routes: RouteHistoryItem[] }>("/routes/history");
  return data.routes;
}

export async function startRoute(
  routeId: string,
  request: StartRouteRequest,
): Promise<StartRouteResponse> {
  return apiFetch<StartRouteResponse>(`/routes/${routeId}/start`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function trackRoute(
  routeId: string,
  request: TrackRequest,
): Promise<TrackResponse> {
  return apiFetch<TrackResponse>(`/routes/${routeId}/track`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}
