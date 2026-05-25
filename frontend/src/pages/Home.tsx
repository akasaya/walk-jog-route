import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { suggestRoute } from "../api/routes";
import { RouteMap } from "../components/RouteMap";
import { RouteRequestForm } from "../components/RouteRequestForm";
import { useGeolocation } from "../hooks/useGeolocation";
import type { Mode, RouteRequest, RouteSuggestionResponse } from "../types/route";

interface HomeProps {
  onStartRoute?: (suggestion: RouteSuggestionResponse, mode: Mode) => void;
  onGoHistory?: () => void;
}

export function Home({ onStartRoute, onGoHistory }: HomeProps) {
  const geo = useGeolocation();
  const [suggestion, setSuggestion] = useState<RouteSuggestionResponse | null>(null);
  const [lastMode, setLastMode] = useState<Mode>("walk");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<{ lat: number; lon: number } | null>(null);

  const geoLocation =
    geo.lat !== null && geo.lon !== null ? { lat: geo.lat, lon: geo.lon } : null;

  const currentLocation = selectedStart ?? geoLocation;

  const handleUseCurrentLocation = () => {
    geo.retry();
  };

  useEffect(() => {
    if (geoLocation) {
      setSelectedStart(geoLocation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.lat, geo.lon]);

  const handleLocationSelect = (lat: number, lon: number) => {
    setSelectedStart({ lat, lon });
    setSuggestion(null);
  };

  const handleSubmit = async (request: RouteRequest) => {
    setIsLoading(true);
    setError(null);
    setLastMode(request.mode);
    try {
      const result = await suggestRoute(request);
      setSuggestion(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError("入力値が正しくありません。");
      } else if (err instanceof ApiError && err.status === 503) {
        setError("サービスが一時的に利用できません。しばらくしてからお試しください。");
      } else {
        setError("エラーが発生しました。もう一度お試しください。");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="home-layout">
      <div className="home-sidebar">
        <div className="screen-header">
          <span className="screen-header__title">🗺 walk-jog-route</span>
          {onGoHistory && (
            <button type="button" className="btn-ghost" onClick={onGoHistory}>
              履歴
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn-ghost"
          onClick={handleUseCurrentLocation}
          disabled={geo.loading}
        >
          {geo.loading ? "取得中…" : "📍 現在地を使う"}
        </button>
        {geo.error === "denied" && (
          <div className="alert alert--error" role="alert">
            位置情報の許可が拒否されました。地図をクリックして起点を選んでください。
          </div>
        )}
        {!selectedStart && !geo.loading && !geo.error && (
          <div className="alert alert--info" aria-live="polite">
            地図をクリックして起点を選んでください
          </div>
        )}
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="home-sidebar__content">
          <div className="card">
            <RouteRequestForm
              currentLocation={currentLocation}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          </div>

          {suggestion && onStartRoute && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onStartRoute(suggestion, lastMode)}
            >
              ルートを開始 →
            </button>
          )}
        </div>
      </div>

      <div className="home-map">
        <RouteMap
          polyline={suggestion?.polyline}
          currentLocation={geoLocation}
          selectedStart={selectedStart}
          onLocationSelect={handleLocationSelect}
        />
      </div>
    </div>
  );
}
