import { describe, it, expect } from "vitest";
import type { SubgroupClass } from "@shared/mathUtils/groups/subgroupLattice";
import { classLabel } from "./classLabel";

const make = (over: Partial<SubgroupClass>): SubgroupClass =>
  ({ order: 4, count: 1, cyclic: true, ...over }) as SubgroupClass;

describe("classLabel", () => {
  it("names a cyclic subgroup C_n", () => {
    expect(classLabel(make({ order: 6 }), 12, "G")).toBe("C₆");
  });

  it("uses the group's own name for the whole group", () => {
    expect(classLabel(make({ order: 12, cyclic: false }), 12, "C₃ ⋊ C₄")).toBe("C₃ ⋊ C₄");
  });

  it("prefixes the conjugate count, as LMFDB does", () => {
    expect(classLabel(make({ order: 4, count: 3 }), 12, "G")).toBe("₃C₄");
  });

  it("falls back to the order for an unnamed non-cyclic subgroup", () => {
    expect(classLabel(make({ order: 8, cyclic: false }), 16, "G")).toBe("8");
  });
});
