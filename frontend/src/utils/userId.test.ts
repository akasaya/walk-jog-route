import { beforeEach, describe, expect, it } from "vitest";
import { getUserId } from "./userId";

describe("getUserId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a string", () => {
    expect(typeof getUserId()).toBe("string");
  });

  it("returns the same id on second call", () => {
    const first = getUserId();
    const second = getUserId();
    expect(first).toBe(second);
  });

  it("generates a valid UUID format", () => {
    const id = getUserId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
