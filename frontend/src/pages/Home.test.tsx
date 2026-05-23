import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: () => <div data-testid="polyline" />,
  Marker: () => <div data-testid="marker" />,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));

vi.mock("@mapbox/polyline", () => ({
  default: { decode: () => [[35.0, 139.0]] as [number, number][] },
}));

vi.mock("../hooks/useGeolocation", () => ({
  useGeolocation: vi.fn(() => ({
    lat: 35.0,
    lon: 139.0,
    error: null,
    loading: false,
    retry: vi.fn(),
  })),
}));

vi.mock("../api/routes", () => ({
  suggestRoute: vi.fn(),
}));

import { useGeolocation } from "../hooks/useGeolocation";
import { suggestRoute } from "../api/routes";
import type { RouteSuggestionResponse } from "../types/route";

const MOCK_SUGGESTION: RouteSuggestionResponse = {
  route_id: "r1",
  polyline: "encoded",
  distance_m: 5000,
  estimated_minutes: 60,
  waypoints: [{ lat: 35.1, lon: 139.1 }],
  weather: null,
};

describe("Home", () => {
  it("renders route request form", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: /コースを提案/ })).toBeInTheDocument();
  });

  it("shows location loading message when geolocation is loading", () => {
    vi.mocked(useGeolocation).mockReturnValue({
      lat: null, lon: null, error: null, loading: true, retry: vi.fn(),
    });
    render(<Home />);
    expect(screen.getByText(/位置情報を取得中/)).toBeInTheDocument();
  });

  it("shows denied message when geolocation is denied", () => {
    vi.mocked(useGeolocation).mockReturnValue({
      lat: null, lon: null, error: "denied", loading: false, retry: vi.fn(),
    });
    render(<Home />);
    expect(screen.getByRole("alert")).toHaveTextContent(/位置情報の許可/);
  });

  it("shows polyline on map after successful suggestion", async () => {
    vi.mocked(useGeolocation).mockReturnValue({
      lat: 35.0, lon: 139.0, error: null, loading: false, retry: vi.fn(),
    });
    vi.mocked(suggestRoute).mockResolvedValue(MOCK_SUGGESTION);
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /コースを提案/ }));
    await waitFor(() => expect(screen.getByTestId("polyline")).toBeInTheDocument());
  });

  it("shows error banner when API returns error", async () => {
    vi.mocked(useGeolocation).mockReturnValue({
      lat: 35.0, lon: 139.0, error: null, loading: false, retry: vi.fn(),
    });
    vi.mocked(suggestRoute).mockRejectedValue(new Error("503"));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /コースを提案/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
  });

  it("disables submit button while loading", async () => {
    vi.mocked(useGeolocation).mockReturnValue({
      lat: 35.0, lon: 139.0, error: null, loading: false, retry: vi.fn(),
    });
    let resolvePromise!: (v: RouteSuggestionResponse) => void;
    vi.mocked(suggestRoute).mockReturnValue(new Promise((r) => { resolvePromise = r; }));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /コースを提案/ }));
    expect(screen.getByRole("button", { name: /提案中/ })).toBeDisabled();
    resolvePromise(MOCK_SUGGESTION);
  });
});
