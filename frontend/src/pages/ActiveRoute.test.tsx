import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveRoute } from "./ActiveRoute";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: () => <div data-testid="polyline" />,
  Marker: () => <div data-testid="marker" />,
  useMap: () => ({ fitBounds: vi.fn() }),
}));

vi.mock("@mapbox/polyline", () => ({
  default: { decode: () => [[35.0, 139.0]] as [number, number][] },
}));

vi.mock("../hooks/useRouteTracking", () => ({
  useRouteTracking: vi.fn(() => ({
    isTracking: false,
    isStarted: false,
    currentLocation: null,
    error: null,
    start: vi.fn(),
    complete: vi.fn(),
    abandon: vi.fn(),
  })),
}));

import { useRouteTracking } from "../hooks/useRouteTracking";
import type { RouteSuggestionResponse } from "../types/route";

const MOCK_SUGGESTION: RouteSuggestionResponse = {
  route_id: "r1",
  polyline: "encoded",
  distance_m: 5000,
  estimated_minutes: 60,
  waypoints: [{ lat: 35.1, lon: 139.1 }],
  weather: null,
};

describe("ActiveRoute", () => {
  it("renders the route map", () => {
    render(<ActiveRoute suggestion={MOCK_SUGGESTION} mode="walk" onFinish={vi.fn()} />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("shows start button before tracking begins", () => {
    render(<ActiveRoute suggestion={MOCK_SUGGESTION} mode="walk" onFinish={vi.fn()} />);
    expect(screen.getByRole("button", { name: /開始/ })).toBeInTheDocument();
  });

  it("shows complete and abandon buttons after tracking starts", () => {
    vi.mocked(useRouteTracking).mockReturnValue({
      isTracking: true,
      isStarted: true,
      currentLocation: { lat: 35.0, lon: 139.0 },
      error: null,
      start: vi.fn(),
      complete: vi.fn(),
      abandon: vi.fn(),
    });
    render(<ActiveRoute suggestion={MOCK_SUGGESTION} mode="walk" onFinish={vi.fn()} />);
    expect(screen.getByRole("button", { name: /完了/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /中断/ })).toBeInTheDocument();
  });

  it("calls start() when start button is clicked", () => {
    const mockStart = vi.fn();
    vi.mocked(useRouteTracking).mockReturnValue({
      isTracking: false,
      isStarted: false,
      currentLocation: null,
      error: null,
      start: mockStart,
      complete: vi.fn(),
      abandon: vi.fn(),
    });
    render(<ActiveRoute suggestion={MOCK_SUGGESTION} mode="walk" onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /開始/ }));
    expect(mockStart).toHaveBeenCalled();
  });

  it("calls onFinish after complete()", async () => {
    const mockComplete = vi.fn().mockResolvedValue(undefined);
    const mockOnFinish = vi.fn();
    vi.mocked(useRouteTracking).mockReturnValue({
      isTracking: true,
      isStarted: true,
      currentLocation: { lat: 35.0, lon: 139.0 },
      error: null,
      start: vi.fn(),
      complete: mockComplete,
      abandon: vi.fn(),
    });
    render(<ActiveRoute suggestion={MOCK_SUGGESTION} mode="walk" onFinish={mockOnFinish} />);
    fireEvent.click(screen.getByRole("button", { name: /完了/ }));
    await waitFor(() => expect(mockOnFinish).toHaveBeenCalled());
  });

  it("shows error message when tracking error occurs", () => {
    vi.mocked(useRouteTracking).mockReturnValue({
      isTracking: false,
      isStarted: true,
      currentLocation: null,
      error: "GPS利用不可",
      start: vi.fn(),
      complete: vi.fn(),
      abandon: vi.fn(),
    });
    render(<ActiveRoute suggestion={MOCK_SUGGESTION} mode="walk" onFinish={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("GPS");
  });

  it("displays distance and estimated time", () => {
    render(<ActiveRoute suggestion={MOCK_SUGGESTION} mode="walk" onFinish={vi.fn()} />);
    expect(screen.getByText(/5\.0.*km/)).toBeInTheDocument();
    expect(screen.getByText(/60.*分/)).toBeInTheDocument();
  });
});
