import { useState } from "react";
import type { RouteRequest } from "../types/route";

interface RouteRequestFormProps {
  currentLocation: { lat: number; lon: number } | null;
  onSubmit: (request: RouteRequest) => void;
  isLoading: boolean;
}

export function RouteRequestForm({ currentLocation, onSubmit, isLoading }: RouteRequestFormProps) {
  const [distanceKm, setDistanceKm] = useState(5);
  const [mode, setMode] = useState<"walk" | "jog">("walk");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  const showManualInput = !currentLocation;
  const canSubmit = !isLoading && (!showManualInput || (manualLat !== "" && manualLon !== ""));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = currentLocation ? currentLocation.lat : parseFloat(manualLat);
    const lon = currentLocation ? currentLocation.lon : parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon)) return;
    onSubmit({ lat, lon, distance_km: distanceKm, mode });
  };

  return (
    <form onSubmit={handleSubmit}>
      {showManualInput && (
        <div>
          <label>
            緯度
            <input
              type="number"
              step="any"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
            />
          </label>
          <label>
            経度
            <input
              type="number"
              step="any"
              value={manualLon}
              onChange={(e) => setManualLon(e.target.value)}
            />
          </label>
        </div>
      )}

      <label>
        距離: {distanceKm}km
        <input
          type="range"
          min={0.5}
          max={50}
          step={0.5}
          value={distanceKm}
          onChange={(e) => setDistanceKm(parseFloat(e.target.value))}
        />
      </label>

      <div>
        <button
          type="button"
          onClick={() => setMode("walk")}
          aria-pressed={mode === "walk"}
        >
          ウォーキング
        </button>
        <button
          type="button"
          onClick={() => setMode("jog")}
          aria-pressed={mode === "jog"}
        >
          ジョギング
        </button>
      </div>

      <button type="submit" disabled={!canSubmit}>
        {isLoading ? "提案中..." : "コースを提案"}
      </button>
    </form>
  );
}
