import type { RouteHistoryItem } from "../types/route";

interface RouteCardProps {
  item: RouteHistoryItem;
  selected: boolean;
  onClick: () => void;
}

const MODE_LABEL: Record<string, string> = {
  walk: "🚶 ウォーキング",
  jog: "🏃 ジョギング",
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
        padding: "0.75rem 1rem",
        borderBottom: "1px solid var(--border)",
        background: selected ? "var(--accent-bg)" : "transparent",
        borderLeft: selected ? "3px solid var(--accent)" : "3px solid transparent",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.95rem", color: "var(--text-h)", fontWeight: selected ? 600 : 400 }}>
          {MODE_LABEL[item.mode] ?? item.mode}
        </span>
        <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-h)" }}>
          {item.distance_km.toFixed(1)} km
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text)" }}>{dateLabel}</span>
        <span style={{
          fontSize: "0.75rem",
          color: item.has_track ? "var(--accent)" : "var(--text)",
          fontWeight: item.has_track ? 600 : 400,
        }}>
          {item.has_track ? "✓ 実績あり" : "実績なし"}
        </span>
      </div>
    </button>
  );
}
