// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { load, save } from "@shared/storage";

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns the fallback when the key is missing", () => {
    expect(load("missing", 123)).toBe(123);
  });

  it("round-trips a primitive", () => {
    save("count", 5);
    expect(load("count", 0)).toBe(5);
  });

  it("round-trips an object", () => {
    save("obj", { a: 1, b: [2, 3] });
    expect(load("obj", null)).toEqual({ a: 1, b: [2, 3] });
  });

  it("returns the fallback when stored JSON is corrupt", () => {
    localStorage.setItem("bad", "{not json");
    expect(load("bad", "default")).toBe("default");
  });
});
