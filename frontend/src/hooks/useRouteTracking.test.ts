import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiRoutes from "../api/routes";
import { useRouteTracking } from "./useRouteTracking";

vi.mock("../api/routes", () => ({
  suggestRoute: vi.fn(),
  getHistory: vi.fn(),
  startRoute: vi.fn(),
  trackRoute: vi.fn(),
}));

const MOCK_OPTIONS = {
  routeId: "route-1",
  polyline: "encoded",
  distanceKm: 5,
  mode: "walk" as const,
  weather: null,
};

describe("useRouteTracking", () => {
  let capturedPositionCb: ((pos: GeolocationPosition) => void) | null = null;
  let mockClearWatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedPositionCb = null;
    mockClearWatch = vi.fn();
    const mockWatchPosition = vi.fn(
      (successCb: (pos: GeolocationPosition) => void) => {
        capturedPositionCb = successCb;
        return 42;
      },
    );

    Object.defineProperty(globalThis.navigator, "geolocation", {
      value: { watchPosition: mockWatchPosition, clearWatch: mockClearWatch },
      writable: true,
      configurable: true,
    });

    vi.mocked(apiRoutes.startRoute).mockResolvedValue({
      route_id: "route-1",
      started_at: "2026-05-21T10:00:00Z",
    });
    vi.mocked(apiRoutes.trackRoute).mockResolvedValue({ saved_count: 0 });
  });

  it("initializes with isTracking=false and isStarted=false", () => {
    const { result } = renderHook(() => useRouteTracking(MOCK_OPTIONS));
    expect(result.current.isTracking).toBe(false);
    expect(result.current.isStarted).toBe(false);
    expect(result.current.currentLocation).toBeNull();
  });

  it("calls startRoute and starts watchPosition when start() is called", async () => {
    const { result } = renderHook(() => useRouteTracking(MOCK_OPTIONS));
    await act(async () => {
      await result.current.start();
    });
    expect(apiRoutes.startRoute).toHaveBeenCalledWith("route-1", {
      polyline: "encoded",
      distance_km: 5,
      mode: "walk",
      weather: null,
    });
    expect(result.current.isStarted).toBe(true);
    expect(result.current.isTracking).toBe(true);
  });

  it("updates currentLocation when watchPosition fires a position", async () => {
    const { result } = renderHook(() => useRouteTracking(MOCK_OPTIONS));
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      capturedPositionCb!({
        coords: { latitude: 35.1, longitude: 139.1, accuracy: 10 },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    expect(result.current.currentLocation).toEqual({ lat: 35.1, lon: 139.1 });
  });

  it("flushes buffer to trackRoute when buffer reaches FLUSH_SIZE", async () => {
    const { result } = renderHook(() => useRouteTracking(MOCK_OPTIONS));
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      for (let i = 0; i < 5; i++) {
        capturedPositionCb!({
          coords: { latitude: 35.0 + i * 0.001, longitude: 139.0, accuracy: 10 },
          timestamp: Date.now() + i * 1000,
        } as GeolocationPosition);
      }
    });
    await vi.waitFor(() => {
      expect(apiRoutes.trackRoute).toHaveBeenCalledWith(
        "route-1",
        expect.objectContaining({
          status: "tracking",
          started_at: "2026-05-21T10:00:00Z",
        }),
      );
    });
  });

  it("calls clearWatch and trackRoute with completed on complete()", async () => {
    const { result } = renderHook(() => useRouteTracking(MOCK_OPTIONS));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.complete();
    });
    expect(mockClearWatch).toHaveBeenCalledWith(42);
    expect(apiRoutes.trackRoute).toHaveBeenCalledWith(
      "route-1",
      expect.objectContaining({ status: "completed" }),
    );
    expect(result.current.isTracking).toBe(false);
  });

  it("calls trackRoute with abandoned on abandon()", async () => {
    const { result } = renderHook(() => useRouteTracking(MOCK_OPTIONS));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.abandon();
    });
    expect(apiRoutes.trackRoute).toHaveBeenCalledWith(
      "route-1",
      expect.objectContaining({ status: "abandoned" }),
    );
    expect(result.current.isTracking).toBe(false);
  });
});
