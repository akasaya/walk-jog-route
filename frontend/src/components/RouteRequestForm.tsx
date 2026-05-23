import { useState, type FormEvent } from "react";
import type { RouteRequest } from "../types/route";

interface RouteRequestFormProps {
  currentLocation: { lat: number; lon: number } | null;
  onSubmit: (request: RouteRequest) => void;
  isLoading: boolean;
}

const DISTANCE_OPTIONS = [2, 3, 5, 8, 10];

export function RouteRequestForm({ currentLocation, onSubmit, isLoading }: RouteRequestFormProps) {
  const [distanceKm, setDistanceKm] = useState(5);
  const [mode, setMode] = useState<"walk" | "jog">("walk");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  const showManualInput = !currentLocation;
  const canSubmit = !isLoading && (!showManualInput || (manualLat !== "" && manualLon !== ""));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const lat = currentLocation ? currentLocation.lat : parseFloat(manualLat);
    const lon = currentLocation ? currentLocation.lon : parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon)) return;
    onSubmit({ lat, lon, distance_km: distanceKm, mode });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {showManualInput && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <div>
            <label className="form-label" htmlFor="manual-lat">緯度</label>
            <input
              id="manual-lat"
              className="input-field"
              type="number"
              step="any"
              placeholder="35.6895"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="manual-lon">経度</label>
            <input
              id="manual-lon"
              className="input-field"
              type="number"
              step="any"
              placeholder="139.6917"
              value={manualLon}
              onChange={(e) => setManualLon(e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <span className="form-label">距離</span>
        <div className="chip-group">
          {DISTANCE_OPTIONS.map((km) => (
            <button
              key={km}
              type="button"
              className={`chip${distanceKm === km ? " chip--active" : ""}`}
              onClick={() => setDistanceKm(km)}
            >
              {km}km
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="form-label">モード</span>
        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-btn${mode === "walk" ? " mode-btn--active" : ""}`}
            aria-pressed={mode === "walk"}
            onClick={() => setMode("walk")}
          >
            🚶 ウォーキング
          </button>
          <button
            type="button"
            className={`mode-btn${mode === "jog" ? " mode-btn--active" : ""}`}
            aria-pressed={mode === "jog"}
            onClick={() => setMode("jog")}
          >
            🏃 ジョギング
          </button>
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        {isLoading ? "提案中…" : "コースを提案"}
      </button>
    </form>
  );
}
