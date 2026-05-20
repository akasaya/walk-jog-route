import { apiFetch } from "./client";
import type {
  RouteHistoryItem,
  RouteRequest,
  RouteSuggestionResponse,
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
