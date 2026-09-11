import { describe, it, expect } from "vitest";
import { classLabel } from "./classLabel";

const make = (order: number, count: number, displayName: string) => ({
  order,
  count,
  displayName,
});

describe("classLabel", () => {
  it("names a subgroup as LMFDB does", () => {
    expect(classLabel(make(6, 1, "C₆"), 12, "G")).toBe("C₆");
    expect(classLabel(make(8, 1, "D₄"), 16, "G")).toBe("D₄");
  });

  it("uses the group's own name for the whole group", () => {
    expect(classLabel(make(12, 1, "C₃ ⋊ C₄"), 12, "C₃ ⋊ C₄")).toBe("C₃ ⋊ C₄");
  });

  it("prefixes the conjugate count, as LMFDB does", () => {
    expect(classLabel(make(4, 3, "C₄"), 12, "G")).toBe("₃C₄");
  });
});
