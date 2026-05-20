import { RouteMap } from "../components/RouteMap";
import { useRouteTracking } from "../hooks/useRouteTracking";
import type { Mode, RouteSuggestionResponse } from "../types/route";

interface ActiveRouteProps {
  suggestion: RouteSuggestionResponse;
  mode: Mode;
  onFinish: () => void;
}

export function ActiveRoute({ suggestion, mode, onFinish }: ActiveRouteProps) {
  const tracking = useRouteTracking({
    routeId: suggestion.route_id,
    polyline: suggestion.polyline,
    distanceKm: suggestion.distance_m / 1000,
    mode,
    weather: suggestion.weather,
  });

  const handleComplete = async () => {
    await tracking.complete();
    onFinish();
  };

  const handleAbandon = async () => {
    await tracking.abandon();
    onFinish();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {tracking.error && (
        <div role="alert" style={{ padding: "0.5rem", color: "red" }}>
          {tracking.error}
        </div>
      )}

      <div style={{ padding: "0.5rem" }}>
        <span>{(suggestion.distance_m / 1000).toFixed(1)} km</span>
        {" / "}
        <span>{suggestion.estimated_minutes} 分</span>
      </div>

      <div style={{ flex: 1 }}>
        <RouteMap
          polyline={suggestion.polyline}
          currentLocation={tracking.currentLocation}
        />
      </div>

      <div style={{ padding: "0.5rem", display: "flex", gap: "0.5rem" }}>
        {!tracking.isStarted ? (
          <button type="button" onClick={tracking.start}>
            開始
          </button>
        ) : (
          <>
            <button type="button" onClick={handleComplete}>
              完了
            </button>
            <button type="button" onClick={handleAbandon}>
              中断
            </button>
          </>
        )}
      </div>
    </div>
  );
}
