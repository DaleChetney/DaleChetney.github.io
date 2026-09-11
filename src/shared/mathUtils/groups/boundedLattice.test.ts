import { describe, it, expect } from "vitest";
import { subgroupBoundedLattice, subgroupEq } from "./boundedLattice";
import { subgroupOf } from "./subgroups";

// S_3 on three points.
const s3 = subgroupOf(
  [
    [2, 1, 3],
    [2, 3, 1],
  ],
  3,
);
const lattice = subgroupBoundedLattice(s3, 3);
const eq = subgroupEq.equals;

const a = subgroupOf([[2, 1, 3]], 3);
const b = subgroupOf([[3, 2, 1]], 3);
const c = subgroupOf([[2, 3, 1]], 3);

describe("subgroupEq", () => {
  it("compares by element set, not by how the subgroup was written", () => {
    expect(eq(c, subgroupOf([[3, 1, 2]], 3))).toBe(true);
    expect(eq(a, b)).toBe(false);
  });
});

describe("subgroupBoundedLattice", () => {
  it("has the trivial subgroup and the group as bounds", () => {
    expect(lattice.zero.elements).toEqual([[1, 2, 3]]);
    expect(eq(lattice.one, s3)).toBe(true);
  });

  it("is commutative", () => {
    expect(eq(lattice.join(a, b), lattice.join(b, a))).toBe(true);
    expect(eq(lattice.meet(a, b), lattice.meet(b, a))).toBe(true);
  });

  it("is associative", () => {
    expect(eq(lattice.join(lattice.join(a, b), c), lattice.join(a, lattice.join(b, c)))).toBe(true);
    expect(eq(lattice.meet(lattice.meet(a, b), c), lattice.meet(a, lattice.meet(b, c)))).toBe(true);
  });

  it("absorbs", () => {
    expect(eq(lattice.join(a, lattice.meet(a, b)), a)).toBe(true);
    expect(eq(lattice.meet(a, lattice.join(a, b)), a)).toBe(true);
  });

  it("has identities", () => {
    expect(eq(lattice.join(a, lattice.zero), a)).toBe(true);
    expect(eq(lattice.meet(a, lattice.one), a)).toBe(true);
  });

  it("says two transpositions generate the group, and one does not", () => {
    expect(eq(lattice.join(a, b), lattice.one)).toBe(true);
    expect(eq(lattice.join(a, lattice.zero), lattice.one)).toBe(false);
  });
});
