import { useState } from "react";
import { ApiError } from "../api/client";
import { suggestRoute } from "../api/routes";
import { RouteMap } from "../components/RouteMap";
import { RouteRequestForm } from "../components/RouteRequestForm";
import { useGeolocation } from "../hooks/useGeolocation";
import type { RouteRequest, RouteSuggestionResponse } from "../types/route";

export function Home() {
  const geo = useGeolocation();
  const [suggestion, setSuggestion] = useState<RouteSuggestionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLocation =
    geo.lat !== null && geo.lon !== null ? { lat: geo.lat, lon: geo.lon } : null;

  const handleSubmit = async (request: RouteRequest) => {
    setIsLoading(true);
    setError(null);
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {geo.loading && (
        <p aria-live="polite" style={{ padding: "0.5rem" }}>
          位置情報を取得中...
        </p>
      )}
      {geo.error === "denied" && (
        <p role="alert" style={{ padding: "0.5rem", color: "orange" }}>
          位置情報の許可が必要です。手動で座標を入力してください。
        </p>
      )}
      {error && (
        <div role="alert" style={{ padding: "0.5rem", color: "red" }}>
          {error}
        </div>
      )}

      <RouteRequestForm
        currentLocation={currentLocation}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />

      <div style={{ flex: 1 }}>
        <RouteMap
          polyline={suggestion?.polyline}
          currentLocation={currentLocation}
        />
      </div>
    </div>
  );
}
