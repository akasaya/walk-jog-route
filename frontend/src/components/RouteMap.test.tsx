import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteMap } from "./RouteMap";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: ({ positions }: { positions: [number, number][] }) => (
    <div data-testid="polyline" data-positions={JSON.stringify(positions)} />
  ),
  Marker: ({ position }: { position: [number, number] }) => (
    <div data-testid="marker" data-position={JSON.stringify(position)} />
  ),
  useMap: () => ({ fitBounds: vi.fn() }),
}));

vi.mock("@mapbox/polyline", () => ({
  default: {
    decode: (_encoded: string) =>
      [[35.0, 139.0], [35.1, 139.1], [35.0, 139.0]] as [number, number][],
  },
}));

describe("RouteMap", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("renders map container when online", () => {
    render(<RouteMap />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("shows offline message when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<RouteMap />);
    expect(screen.getByRole("alert")).toHaveTextContent("地図を表示できません");
    expect(screen.queryByTestId("map-container")).not.toBeInTheDocument();
  });

  it("renders polyline when polyline prop is provided", () => {
    render(<RouteMap polyline="encoded_string" />);
    expect(screen.getByTestId("polyline")).toBeInTheDocument();
  });

  it("does not render polyline when no polyline prop", () => {
    render(<RouteMap />);
    expect(screen.queryByTestId("polyline")).not.toBeInTheDocument();
  });

  it("renders current location marker when provided", () => {
    render(<RouteMap currentLocation={{ lat: 35.0, lon: 139.0 }} />);
    expect(screen.getByTestId("marker")).toBeInTheDocument();
  });

  it("does not render marker when no currentLocation", () => {
    render(<RouteMap />);
    expect(screen.queryByTestId("marker")).not.toBeInTheDocument();
  });
});
