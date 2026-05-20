import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { History } from "./History";

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

vi.mock("../api/routes", () => ({
  suggestRoute: vi.fn(),
  getHistory: vi.fn(),
  startRoute: vi.fn(),
  trackRoute: vi.fn(),
}));

import { getHistory } from "../api/routes";
import type { RouteHistoryItem } from "../types/route";

const MOCK_HISTORY: RouteHistoryItem[] = [
  {
    route_id: "r1",
    started_at: "2026-05-21T10:00:00Z",
    mode: "walk",
    distance_km: 5.0,
    has_track: true,
    polyline: "enc1",
  },
  {
    route_id: "r2",
    started_at: "2026-05-20T08:00:00Z",
    mode: "jog",
    distance_km: 3.0,
    has_track: false,
    polyline: "enc2",
  },
];

describe("History", () => {
  it("shows loading message initially", () => {
    vi.mocked(getHistory).mockReturnValue(new Promise(() => {}));
    render(<History onBack={vi.fn()} />);
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
  });

  it("shows route cards after fetch completes", async () => {
    vi.mocked(getHistory).mockResolvedValue(MOCK_HISTORY);
    render(<History onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/ウォーキング/)).toBeInTheDocument();
      expect(screen.getByText(/ジョギング/)).toBeInTheDocument();
    });
  });

  it("shows error message when fetch fails", async () => {
    vi.mocked(getHistory).mockRejectedValue(new Error("network error"));
    render(<History onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
  });

  it("shows polyline on map after selecting a route card", async () => {
    vi.mocked(getHistory).mockResolvedValue(MOCK_HISTORY);
    render(<History onBack={vi.fn()} />);
    await waitFor(() => screen.getByText(/ウォーキング/));

    expect(screen.queryByTestId("polyline")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/ウォーキング/).closest("button")!);

    expect(screen.getByTestId("polyline")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    vi.mocked(getHistory).mockResolvedValue(MOCK_HISTORY);
    const mockOnBack = vi.fn();
    render(<History onBack={mockOnBack} />);
    fireEvent.click(screen.getByRole("button", { name: /戻る/ }));
    expect(mockOnBack).toHaveBeenCalled();
  });
});
