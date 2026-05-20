import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteCard } from "./RouteCard";
import type { RouteHistoryItem } from "../types/route";

const MOCK_ITEM: RouteHistoryItem = {
  route_id: "r1",
  started_at: "2026-05-21T10:00:00Z",
  mode: "walk",
  distance_km: 5.0,
  has_track: true,
  polyline: "encoded",
};

describe("RouteCard", () => {
  it("displays walk mode as ウォーキング", () => {
    render(<RouteCard item={MOCK_ITEM} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText(/ウォーキング/)).toBeInTheDocument();
  });

  it("displays jog mode as ジョギング", () => {
    render(
      <RouteCard
        item={{ ...MOCK_ITEM, mode: "jog" }}
        selected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/ジョギング/)).toBeInTheDocument();
  });

  it("displays distance", () => {
    render(<RouteCard item={MOCK_ITEM} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText(/5\.0.*km/)).toBeInTheDocument();
  });

  it("displays 実績あり when has_track is true", () => {
    render(<RouteCard item={MOCK_ITEM} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText(/実績あり/)).toBeInTheDocument();
  });

  it("displays 実績なし when has_track is false", () => {
    render(
      <RouteCard
        item={{ ...MOCK_ITEM, has_track: false }}
        selected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/実績なし/)).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const mockClick = vi.fn();
    render(<RouteCard item={MOCK_ITEM} selected={false} onClick={mockClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockClick).toHaveBeenCalled();
  });

  it("sets aria-pressed=true when selected", () => {
    render(<RouteCard item={MOCK_ITEM} selected={true} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("sets aria-pressed=false when not selected", () => {
    render(<RouteCard item={MOCK_ITEM} selected={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
