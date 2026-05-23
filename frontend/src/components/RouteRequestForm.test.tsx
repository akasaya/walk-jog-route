import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteRequestForm } from "./RouteRequestForm";

const LOCATION = { lat: 35.0, lon: 139.0 };
const noop = () => {};

describe("RouteRequestForm", () => {
  it("renders distance preset chips", () => {
    render(<RouteRequestForm currentLocation={LOCATION} onSubmit={noop} isLoading={false} />);
    expect(screen.getByRole("button", { name: "2km" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5km" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10km" })).toBeInTheDocument();
  });

  it("renders walk and jog mode buttons", () => {
    render(<RouteRequestForm currentLocation={LOCATION} onSubmit={noop} isLoading={false} />);
    expect(screen.getByRole("button", { name: /ウォーキング/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ジョギング/ })).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<RouteRequestForm currentLocation={LOCATION} onSubmit={noop} isLoading={false} />);
    expect(screen.getByRole("button", { name: /コースを提案/ })).toBeInTheDocument();
  });

  it("disables submit button while loading", () => {
    render(<RouteRequestForm currentLocation={LOCATION} onSubmit={noop} isLoading={true} />);
    expect(screen.getByRole("button", { name: /提案中/ })).toBeDisabled();
  });

  it("calls onSubmit with correct request on submit", () => {
    const onSubmit = vi.fn();
    render(<RouteRequestForm currentLocation={LOCATION} onSubmit={onSubmit} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /コースを提案/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      lat: 35.0,
      lon: 139.0,
      distance_km: 5,
      mode: "walk",
    });
  });

  it("switches mode to jog when jog button clicked", () => {
    const onSubmit = vi.fn();
    render(<RouteRequestForm currentLocation={LOCATION} onSubmit={onSubmit} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /ジョギング/ }));
    fireEvent.click(screen.getByRole("button", { name: /コースを提案/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mode: "jog" }));
  });

  it("shows manual lat/lon input when no currentLocation", () => {
    render(<RouteRequestForm currentLocation={null} onSubmit={noop} isLoading={false} />);
    expect(screen.getByLabelText(/緯度/)).toBeInTheDocument();
    expect(screen.getByLabelText(/経度/)).toBeInTheDocument();
  });

  it("hides manual input when currentLocation is provided", () => {
    render(<RouteRequestForm currentLocation={LOCATION} onSubmit={noop} isLoading={false} />);
    expect(screen.queryByLabelText(/緯度/)).not.toBeInTheDocument();
  });

  it("disables submit when manual input is empty and no location", () => {
    render(<RouteRequestForm currentLocation={null} onSubmit={noop} isLoading={false} />);
    expect(screen.getByRole("button", { name: /コースを提案/ })).toBeDisabled();
  });
});
