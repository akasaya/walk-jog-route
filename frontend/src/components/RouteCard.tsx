import type { RouteHistoryItem } from "../types/route";

interface RouteCardProps {
  item: RouteHistoryItem;
  selected: boolean;
  onClick: () => void;
}

const MODE_LABEL: Record<string, string> = {
  walk: "ウォーキング",
  jog: "ジョギング",
};

export function RouteCard({ item, selected, onClick }: RouteCardProps) {
  const date = new Date(item.started_at);
  const dateLabel = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "0.75rem",
        borderBottom: "1px solid #eee",
        background: selected ? "#eff6ff" : "transparent",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: "0.85rem", color: "#666" }}>{dateLabel}</div>
      <div>
        {MODE_LABEL[item.mode] ?? item.mode}{" "}
        {item.distance_km.toFixed(1)} km
      </div>
      <div style={{ fontSize: "0.85rem" }}>
        {item.has_track ? "実績あり" : "実績なし"}
      </div>
    </button>
  );
}
