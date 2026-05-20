import { useCallback, useRef, useState } from "react";
import { startRoute, trackRoute } from "../api/routes";
import type { Mode, TrackPoint, WeatherData } from "../types/route";

const FLUSH_SIZE = 5;

interface UseRouteTrackingOptions {
  routeId: string;
  polyline: string;
  distanceKm: number;
  mode: Mode;
  weather: WeatherData | null;
}

export interface UseRouteTrackingResult {
  isTracking: boolean;
  isStarted: boolean;
  currentLocation: { lat: number; lon: number } | null;
  error: string | null;
  start: () => Promise<void>;
  complete: () => Promise<void>;
  abandon: () => Promise<void>;
}

export function useRouteTracking({
  routeId,
  polyline,
  distanceKm,
  mode,
  weather,
}: UseRouteTrackingOptions): UseRouteTrackingResult {
  const [isTracking, setIsTracking] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const bufferRef = useRef<TrackPoint[]>([]);
  const startedAtRef = useRef<string>("");

  const flush = useCallback(
    async (status: "tracking" | "completed" | "abandoned") => {
      const points = bufferRef.current;
      bufferRef.current = [];
      if (points.length === 0 && status === "tracking") return;
      try {
        await trackRoute(routeId, {
          started_at: startedAtRef.current,
          points,
          status,
        });
      } catch {
        // flush errors are non-fatal
      }
    },
    [routeId],
  );

  const start = useCallback(async () => {
    try {
      const response = await startRoute(routeId, {
        polyline,
        distance_km: distanceKm,
        mode,
        weather,
      });
      startedAtRef.current = response.started_at;
      setIsStarted(true);
      setIsTracking(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const point: TrackPoint = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: new Date(position.timestamp).toISOString(),
          };
          setCurrentLocation({ lat: point.lat, lon: point.lon });
          bufferRef.current.push(point);
          if (bufferRef.current.length >= FLUSH_SIZE) {
            void flush("tracking");
          }
        },
        (err) => {
          setError(err.message);
          setIsTracking(false);
        },
        { enableHighAccuracy: true },
      );
    } catch {
      setError("ルートの開始に失敗しました");
    }
  }, [routeId, polyline, distanceKm, mode, weather, flush]);

  const stop = useCallback(
    async (status: "completed" | "abandoned") => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      await flush(status);
      setIsTracking(false);
    },
    [flush],
  );

  const complete = useCallback(() => stop("completed"), [stop]);
  const abandon = useCallback(() => stop("abandoned"), [stop]);

  return { isTracking, isStarted, currentLocation, error, start, complete, abandon };
}
