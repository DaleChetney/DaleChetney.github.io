import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePermutationGroup, permutationOrbits } from "@shared/mathUtils/groups/permutations";
import { byLabel, parseCatalogue } from "./catalogue";

const catalogue = parseCatalogue(
  JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/groups.json"), "utf8")),
);
const groups = byLabel(catalogue);

/** A group the parser should accept, to be broken one field at a time. */
const wellFormed = () => ({
  label: "2.1",
  order: 2,
  subgroups: {
    all: 2,
    classes: [
      { id: "2.a1.a1", order: 1 },
      { id: "1.a1.a1", order: 2 },
    ],
  },
  representations: [{ id: "2T1", classGenerators: [[], [[2, 1]]] }],
});

describe("parseCatalogue", () => {
  it("rejects anything that is not a catalogue", () => {
    expect(() => parseCatalogue(null)).toThrow(TypeError);
    expect(() => parseCatalogue({ groups: [] })).toThrow(TypeError);
    expect(() => parseCatalogue({ bounds: {} })).toThrow(TypeError);
  });

  it("accepts a well-formed group", () => {
    expect(() => parseCatalogue({ bounds: {}, groups: [wellFormed()] })).not.toThrow();
  });

  it("rejects a group with nothing to draw", () => {
    const group = { ...wellFormed(), representations: [] };
    expect(() => parseCatalogue({ bounds: {}, groups: [group] })).toThrow(/2\.1/);
  });

  it("rejects a group without its subgroup classes", () => {
    const group = { ...wellFormed(), subgroups: { all: 2 } };
    expect(() => parseCatalogue({ bounds: {}, groups: [group] })).toThrow(/subgroup classes/);
  });

  it("rejects subgroup classes that do not end at the whole group", () => {
    const group = wellFormed();
    group.subgroups.classes.pop();
    expect(() => parseCatalogue({ bounds: {}, groups: [group] })).toThrow(/whole group/);
  });

  it("rejects a representation without generators for every class", () => {
    const group = wellFormed();
    group.representations[0].classGenerators.pop();
    expect(() => parseCatalogue({ bounds: {}, groups: [group] })).toThrow(/every class/);
  });
});

describe("the baked catalogue", () => {
  it("holds every group inside the bounds", () => {
    expect(catalogue.groups).toHaveLength(402);
  });

  it("identifies groups by label, which display names do not", () => {
    const labels = catalogue.groups.map((group) => group.label);
    const names = new Set(catalogue.groups.map((group) => group.displayName));
    expect(new Set(labels).size).toBe(labels.length);
    // Several groups share a name with another; the list has to show labels.
    expect(names.size).toBeLessThan(labels.length);
  });

  it("respects the bounds it records", () => {
    for (const group of catalogue.groups) {
      expect(group.order, group.label).toBeLessThanOrEqual(catalogue.bounds.maxOrder);
      expect(group.subgroups.classes.length, group.label).toBeLessThanOrEqual(
        catalogue.bounds.maxSubgroupClasses,
      );
      expect(group.representations.length, group.label).toBeLessThanOrEqual(
        catalogue.bounds.maxRepresentations,
      );
      for (const rep of group.representations) {
        expect(rep.degree, `${group.label} ${rep.id}`).toBeLessThanOrEqual(
          catalogue.bounds.maxDegree,
        );
      }
    }
  });

  it("names each representation of a group distinctly", () => {
    for (const group of catalogue.groups) {
      const ids = group.representations.map((rep) => rep.id);
      expect(new Set(ids).size, group.label).toBe(ids.length);
    }
  });

  // The decoding is the part with the most room to be quietly wrong, and this
  // is the check that catches it: a mis-decoded generator almost never closes
  // up into a group of the right order.
  it("has generators that close into a group of the recorded order", () => {
    for (const group of catalogue.groups) {
      for (const rep of group.representations) {
        const elements = generatePermutationGroup(rep.generators, rep.degree);
        expect(elements, `${group.label} ${rep.id}`).toHaveLength(group.order);
      }
    }
  });

  it("marks a representation transitive exactly when it has one orbit", () => {
    for (const group of catalogue.groups) {
      for (const rep of group.representations) {
        const orbits = permutationOrbits(rep.generators, rep.degree);
        expect(rep.transitive, `${group.label} ${rep.id}`).toBe(orbits.length === 1);
      }
    }
  });

  it("puts each group's representations in order of degree", () => {
    for (const group of catalogue.groups) {
      const degrees = group.representations.map((rep) => rep.degree);
      expect(
        [...degrees].sort((a, b) => a - b),
        group.label,
      ).toEqual(degrees);
    }
  });

  it("gives every group a transitive representation", () => {
    for (const group of catalogue.groups) {
      expect(
        group.representations.some((rep) => rep.transitive),
        group.label,
      ).toBe(true);
    }
  });

  it("orders the subgroup classes from the trivial one to the whole group", () => {
    for (const group of catalogue.groups) {
      const orders = group.subgroups.classes.map((c) => c.order);
      expect(orders[0], group.label).toBe(1);
      expect(orders[orders.length - 1], group.label).toBe(group.order);
      expect(
        [...orders].sort((a, b) => a - b),
        group.label,
      ).toEqual(orders);
      // Covers point strictly downward, so the lattice reads top to bottom.
      group.subgroups.classes.forEach((c, i) => {
        for (const lower of c.covers) expect(lower, `${group.label} ${c.id}`).toBeLessThan(i);
      });
    }
  });

  it("counts the subgroups class by class", () => {
    for (const group of catalogue.groups) {
      const total = group.subgroups.classes.reduce((n, c) => n + c.count, 0);
      expect(total, group.label).toBe(group.subgroups.all);
    }
  });

  // The class generators are computed and then matched to LMFDB's classes, so
  // this is the check that the matching did not cross wires: every stored
  // generating set closes into a subgroup of its class's order.
  it("has class generators that close into a subgroup of the class's order", () => {
    for (const group of catalogue.groups) {
      for (const rep of group.representations) {
        group.subgroups.classes.forEach((c, i) => {
          const generators = rep.classGenerators[i];
          expect(generators.length, `${group.label} ${rep.id} ${c.id}`).toBe(
            c.order === 1 ? 0 : c.cyclic ? 1 : generators.length,
          );
          const elements = generatePermutationGroup(generators, rep.degree);
          expect(elements, `${group.label} ${rep.id} ${c.id}`).toHaveLength(c.order);
        });
      }
    }
  });

  // Transcribed by hand from https://www.lmfdb.org/Groups/Abstract/12.1, so it
  // is an independent witness for the whole pipeline: a bake that drifts in
  // naming, ordering or decoding stops matching a page nobody generated.
  it("reproduces LMFDB's own page for C_3:C_4", () => {
    const baked = groups.get("12.1");
    expect(baked?.displayName).toBe("C₃ ⋊ C₄");
    expect(baked?.texName).toBe("C_3:C_4");
    expect(baked?.order).toBe(12);
    expect(baked?.autDisplayName).toBe("D₆");
    expect(baked?.autOrder).toBe(12);
    // The minimal faithful action has degree 7, splitting as 3 + 4.
    const minimal = baked?.representations.find((rep) => rep.id === "perm-7");
    expect(minimal?.generators).toEqual([
      [1, 3, 2, 5, 6, 7, 4], // (2 3)(4 5 6 7)
      [1, 2, 3, 6, 7, 4, 5], // (4 6)(5 7)
      [2, 3, 1, 4, 5, 6, 7], // (1 2 3)
    ]);
    // Six classes of subgroups, C_4 the only one with conjugates.
    expect(baked?.subgroups.classes.map((c) => [c.displayName, c.count])).toEqual([
      ["C₁", 1],
      ["C₂", 1],
      ["C₃", 1],
      ["C₄", 3],
      ["C₆", 1],
      ["C₃ ⋊ C₄", 1],
    ]);
    // C_6 covers C_2 and C_3; the whole group covers C_4 and C_6.
    expect(baked?.subgroups.classes.map((c) => c.covers)).toEqual([
      [],
      [0],
      [0],
      [1],
      [1, 2],
      [3, 4],
    ]);
  });
});
