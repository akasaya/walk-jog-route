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
  const [selectedRoute, setSelectedRoute] = useState<RouteHistoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHistory()
      .then(setRoutes)
      .catch(() => setError("履歴の取得に失敗しました"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="screen">
      <div className="screen-header">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ‹ 戻る
        </button>
        <span className="screen-header__title">ルート履歴</span>
        <span style={{ width: "3rem" }} />
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="alert alert--info" aria-live="polite">読み込み中…</p>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div style={{ width: "40%", overflowY: "auto", borderRight: "1px solid var(--border)" }}>
            {routes.length === 0 ? (
              <p style={{ padding: "1rem", color: "var(--text)", fontSize: "0.9rem" }}>
                履歴がありません
              </p>
            ) : (
              routes.map((item) => (
                <RouteCard
                  key={item.route_id}
                  item={item}
                  selected={selectedRoute?.route_id === item.route_id}
                  onClick={() => setSelectedRoute(item)}
                />
              ))
            )}
          </div>
          <div style={{ flex: 1 }}>
            <RouteMap polyline={selectedRoute?.polyline} />
          </div>
        </div>
      )}
    </div>
  );
}
