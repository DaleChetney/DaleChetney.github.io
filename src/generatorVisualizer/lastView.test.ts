// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadLastView, saveLastView, type LastView } from "./lastView";

const KEY = "generatorVisualizer.lastView";

describe("lastView", () => {
  beforeEach(() => localStorage.clear());

  it("has nothing to offer when nothing is stored", () => {
    expect(loadLastView()).toBeNull();
  });

  it("round-trips what was saved", () => {
    const view: LastView = { group: "12.1", representation: "12T5", selection: [[3, ["a", "b"]]] };
    saveLastView(view);
    expect(loadLastView()).toEqual(view);
  });

  it("has nothing to offer without a group and a representation", () => {
    localStorage.setItem(KEY, JSON.stringify({ group: "12.1" }));
    expect(loadLastView()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify([1, 2]));
    expect(loadLastView()).toBeNull();
  });

  it("keeps the group and representation of a view whose selection is not one", () => {
    for (const selection of ["all", [[3, "a"]], [["3", ["a"]]], [[3]]]) {
      localStorage.setItem(
        KEY,
        JSON.stringify({ group: "12.1", representation: "12T5", selection }),
      );
      expect(loadLastView()).toEqual({ group: "12.1", representation: "12T5", selection: null });
    }
  });
});
