import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePermutationGroup, permutationOrbits } from "@shared/mathUtils/groups/permutations";
import { byLabel, parseCatalogue } from "./catalogue";
import { C3_C4 } from "./data";

const catalogue = parseCatalogue(
  JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/groups.json"), "utf8")),
);
const groups = byLabel(catalogue);

describe("parseCatalogue", () => {
  it("rejects anything that is not a catalogue", () => {
    expect(() => parseCatalogue(null)).toThrow(TypeError);
    expect(() => parseCatalogue({ groups: [] })).toThrow(TypeError);
    expect(() => parseCatalogue({ bounds: {} })).toThrow(TypeError);
  });

  it("rejects a group with nothing to draw", () => {
    const group = { label: "12.1", order: 12, representations: [] };
    expect(() => parseCatalogue({ bounds: {}, groups: [group] })).toThrow(/12\.1/);
  });
});

describe("the baked catalogue", () => {
  it("holds every group inside the bounds", () => {
    expect(catalogue.groups).toHaveLength(526);
  });

  it("identifies groups by label, which display names do not", () => {
    const labels = catalogue.groups.map((group) => group.label);
    const names = new Set(catalogue.groups.map((group) => group.displayName));
    expect(new Set(labels).size).toBe(labels.length);
    // 97 groups share a name with another; the list has to show labels.
    expect(names.size).toBeLessThan(labels.length);
  });

  it("respects the bounds it records", () => {
    for (const group of catalogue.groups) {
      expect(group.order, group.label).toBeLessThanOrEqual(catalogue.bounds.maxOrder);
      if (group.order > catalogue.bounds.abelianMaxOrder) {
        expect(group.abelian, group.label).toBe(false);
      }
      expect(group.subgroups.autclasses, group.label).toBeLessThanOrEqual(
        catalogue.bounds.maxSubgroupsShown,
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

  it("escalates the subgroup rung by the counts", () => {
    const rungs = catalogue.groups.reduce<Record<string, number>>((counts, group) => {
      counts[group.subgroups.rung] = (counts[group.subgroups.rung] ?? 0) + 1;
      return counts;
    }, {});
    expect(rungs).toEqual({ all: 178, classes: 197, autclasses: 151 });
  });

  it("leaves about half the groups without a transitive representation", () => {
    const withTransitive = catalogue.groups.filter((group) =>
      group.representations.some((rep) => rep.transitive),
    );
    // gps_transitive stops at degree 47 and the node bound cuts it to 32, so a
    // group whose smallest transitive action is bigger has none to offer.
    expect(withTransitive.length).toBeGreaterThan(250);
    expect(withTransitive.length).toBeLessThan(catalogue.groups.length);
  });

  // The C_3:C_4 in data.ts was baked by hand and checked against LMFDB's own
  // pages, so it is an independent witness for the whole pipeline.
  it("reproduces the hand-baked C_3:C_4", () => {
    const baked = groups.get(C3_C4.label);
    expect(baked?.displayName).toBe(C3_C4.displayName);
    expect(baked?.texName).toBe(C3_C4.texName);
    expect(baked?.order).toBe(C3_C4.order);
    const minimal = baked?.representations.find((rep) => rep.id === "perm-7");
    expect(minimal?.generators).toEqual(C3_C4.representations[0].generators);
  });
});
