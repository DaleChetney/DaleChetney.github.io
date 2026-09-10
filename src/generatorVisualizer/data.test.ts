import { describe, it, expect } from "vitest";
import {
  decodePermutation,
  generatePermutationGroup,
  permutationOrbits,
  permutationOrder,
} from "@shared/mathUtils/groups/permutations";
import { C3_C4 } from "./data";

describe("C3_C4", () => {
  it("has the LMFDB order statistics for 12.1", () => {
    // gps_groups.order_stats for 12.1: [[1,1],[2,1],[3,2],[4,6],[6,2]] — the
    // dicyclic signature, with a unique involution and six elements of order 4.
    for (const representation of C3_C4.representations) {
      const elements = generatePermutationGroup(representation.generators, representation.degree);
      const stats: Record<number, number> = {};
      for (const element of elements) {
        const order = permutationOrder(element);
        stats[order] = (stats[order] ?? 0) + 1;
      }
      expect(stats, representation.id).toEqual({ 1: 1, 2: 1, 3: 2, 4: 6, 6: 2 });
    }
  });

  it("is faithful in every representation", () => {
    for (const representation of C3_C4.representations) {
      const elements = generatePermutationGroup(representation.generators, representation.degree);
      expect(elements, representation.id).toHaveLength(C3_C4.order);
    }
  });

  it("stores generators of the declared degree", () => {
    for (const representation of C3_C4.representations) {
      for (const generator of representation.generators) {
        expect(generator).toHaveLength(representation.degree);
        expect([...generator].sort((a, b) => a - b)).toEqual(
          Array.from({ length: representation.degree }, (_, i) => i + 1),
        );
      }
    }
  });

  it("matches the LMFDB integer encoding where codes are recorded", () => {
    for (const representation of C3_C4.representations) {
      if (representation.generatorCodes === undefined) continue;
      const decoded = representation.generatorCodes.map((code) =>
        decodePermutation(code, representation.degree),
      );
      expect(decoded, representation.id).toEqual(representation.generators);
    }
  });

  it("agrees with each representation's declared transitivity", () => {
    for (const representation of C3_C4.representations) {
      const orbits = permutationOrbits(representation.generators, representation.degree);
      expect(orbits.length === 1, representation.id).toBe(representation.transitive);
    }
  });

  it("splits the degree 7 representation as 3 + 4", () => {
    const representation = C3_C4.representations[0];
    const orbits = permutationOrbits(representation.generators, representation.degree);
    expect(orbits.map((orbit) => orbit.length)).toEqual([3, 4]);
  });

  it("has a regular representation with no fixed points off the identity", () => {
    const regular = C3_C4.representations[1];
    const elements = generatePermutationGroup(regular.generators, regular.degree);
    const moved = elements.filter((element) => element.some((image, i) => image !== i + 1));
    expect(moved).toHaveLength(C3_C4.order - 1);
    for (const element of moved) {
      expect(element.every((image, i) => image !== i + 1)).toBe(true);
    }
  });

  it("uses unique representation ids", () => {
    const ids = C3_C4.representations.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
