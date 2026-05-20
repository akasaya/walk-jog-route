import { useEffect, useState } from "react";
import { getHistory } from "../api/routes";
import { RouteCard } from "../components/RouteCard";
import { RouteMap } from "../components/RouteMap";
import type { RouteHistoryItem } from "../types/route";

interface HistoryProps {
  onBack: () => void;
}

export function History({ onBack }: HistoryProps) {
  const [routes, setRoutes] = useState<RouteHistoryItem[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteHistoryItem | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHistory()
      .then(setRoutes)
      .catch(() => setError("履歴の取得に失敗しました"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div
        style={{
          padding: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          borderBottom: "1px solid #eee",
        }}
      >
        <button type="button" onClick={onBack}>
          戻る
        </button>
        <span style={{ fontWeight: "bold" }}>ルート履歴</span>
      </div>

      {error && (
        <div role="alert" style={{ padding: "0.5rem", color: "red" }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <p style={{ padding: "0.5rem" }}>読み込み中...</p>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div
            style={{
              width: "40%",
              overflowY: "auto",
              borderRight: "1px solid #eee",
            }}
          >
            {routes.map((item) => (
              <RouteCard
                key={item.route_id}
                item={item}
                selected={selectedRoute?.route_id === item.route_id}
                onClick={() => setSelectedRoute(item)}
              />
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <RouteMap polyline={selectedRoute?.polyline} />
          </div>
        </div>
      )}
    </div>
  );
}
