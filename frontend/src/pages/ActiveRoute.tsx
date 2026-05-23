import { RouteMap } from "../components/RouteMap";
import { useRouteTracking } from "../hooks/useRouteTracking";
import type { Mode, RouteSuggestionResponse } from "../types/route";

interface ActiveRouteProps {
  suggestion: RouteSuggestionResponse;
  mode: Mode;
  onFinish: () => void;
}

const MODE_ICON: Record<Mode, string> = { walk: "🚶", jog: "🏃" };

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
    <div className="screen">
      <div className="screen-header">
        <span className="screen-header__title">
          {MODE_ICON[mode]} ルート中
        </span>
      </div>

      {tracking.error && (
        <div className="alert alert--error" role="alert">
          {tracking.error}
        </div>
      )}

      <div style={{ padding: "0.75rem 1rem" }}>
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-card__label">距離</p>
            <p className="stat-card__value">{(suggestion.distance_m / 1000).toFixed(1)} km</p>
          </div>
          <div className="stat-card">
            <p className="stat-card__label">目安時間</p>
            <p className="stat-card__value">{suggestion.estimated_minutes} 分</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <RouteMap
          polyline={suggestion.polyline}
          currentLocation={tracking.currentLocation}
        />
      </div>

      <div style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.5rem" }}>
        {!tracking.isStarted ? (
          <>
            <button type="button" className="btn-outline" onClick={onFinish}>
              キャンセル
            </button>
            <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={tracking.start}>
              開始
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-outline" onClick={handleAbandon}>
              中断
            </button>
            <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleComplete}>
              完了
            </button>
          </>
        )}
      </div>
    </div>
  );
}
