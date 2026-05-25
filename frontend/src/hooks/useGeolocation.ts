import { useCallback, useState } from "react";

type GeolocationError = "denied" | "timeout" | "unavailable" | null;

interface GeolocationState {
  lat: number | null;
  lon: number | null;
  error: GeolocationError;
  loading: boolean;
}

interface UseGeolocationResult extends GeolocationState {
  retry: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lon: null,
    error: null,
    loading: false,
  });

  const request = useCallback(() => {
    setState({ lat: null, lon: null, error: null, loading: true });

    if (!navigator.geolocation) {
      setState({ lat: null, lon: null, error: "unavailable", loading: false });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (err) => {
        const error: GeolocationError =
          err.code === GeolocationPositionError.PERMISSION_DENIED
            ? "denied"
            : err.code === GeolocationPositionError.TIMEOUT
              ? "timeout"
              : "unavailable";
        setState({ lat: null, lon: null, error, loading: false });
      },
      { timeout: 30_000, maximumAge: 60_000 },
    );
  }, []);

  return { ...state, retry: request };
}
