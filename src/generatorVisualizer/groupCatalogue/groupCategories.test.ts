// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { CatalogueGroup } from "./catalogue";
import {
  ABELIAN_SIMPLE,
  GROUP_CATEGORIES,
  NON_ABELIAN_SIMPLE,
  categoryOptions,
  filterGroups,
  groupCategory,
  renderFilterOptions,
} from "./groupCategories";

const group = (over: Partial<CatalogueGroup> = {}): CatalogueGroup => ({
  label: "12.1",
  name: "C3:C4",
  texName: "C_3:C_4",
  displayName: "C₃ ⋊ C₄",
  order: 12,
  abelian: false,
  cyclic: false,
  nilpotent: false,
  solvable: true,
  simple: false,
  solvabilityType: 6,
  nilpotencyClass: -1,
  derivedLength: 2,
  rank: 2,
  autLabel: "12.4",
  autTexName: "D_6",
  autDisplayName: "D₆",
  autOrder: 12,
  subgroups: { all: 8, classes: [] },
  representations: [],
  ...over,
});

const groups = [
  group(),
  group({ label: "12.3", name: "A4", displayName: "A₄", texName: "A_4", solvabilityType: 8 }),
  group({
    label: "32.13",
    name: "C8:C4",
    displayName: "C₈ ⋊ C₄",
    order: 32,
    nilpotent: true,
    nilpotencyClass: 2,
    solvabilityType: 3,
  }),
  group({
    label: "60.5",
    name: "A5",
    displayName: "A₅",
    order: 60,
    solvable: false,
    simple: true,
    solvabilityType: 13,
  }),
  group({ label: "12.2", name: "C12", displayName: "C₁₂", solvabilityType: 0 }),
  group({ label: "12.4", name: "D6", displayName: "D₆", solvabilityType: 6 }),
  group({
    label: "5.1",
    name: "C5",
    displayName: "C₅",
    order: 5,
    abelian: true,
    simple: true,
    solvabilityType: 0,
  }),
  group({
    label: "120.34",
    name: "S5",
    displayName: "S₅",
    order: 120,
    solvable: false,
    solvabilityType: 13,
  }),
];

const labels = (matches: readonly CatalogueGroup[]): string[] =>
  matches.map((match) => match.label);

describe("groupCategory", () => {
  it("is LMFDB's solvability type for a group that is not simple", () => {
    expect(groupCategory(group({ solvabilityType: 8 }))).toBe(8);
  });

  it("takes the abelian simple groups out of the cyclic ones", () => {
    expect(groupCategory(group({ abelian: true, simple: true, solvabilityType: 0 }))).toBe(
      ABELIAN_SIMPLE,
    );
  });

  it("takes the non-abelian simple groups out of the non-solvable ones", () => {
    expect(groupCategory(group({ simple: true, solvabilityType: 13 }))).toBe(NON_ABELIAN_SIMPLE);
  });
});

describe("GROUP_CATEGORIES", () => {
  it("offers each code once", () => {
    const codes = GROUP_CATEGORIES.map((category) => category.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("puts each simple category beside the one it came out of", () => {
    const codes = GROUP_CATEGORIES.map((category) => category.code);
    expect(codes.slice(0, 2)).toEqual([ABELIAN_SIMPLE, 0]);
    expect(codes.slice(-2)).toEqual([13, NON_ABELIAN_SIMPLE]);
  });
});

describe("filterGroups", () => {
  it("returns everything when no category is chosen", () => {
    expect(filterGroups(groups, null)).toHaveLength(groups.length);
  });

  it("keeps only the groups of the chosen category", () => {
    expect(labels(filterGroups(groups, 6))).toEqual(["12.1", "12.4"]);
  });

  it("keeps the simple groups out of the categories they were taken from", () => {
    expect(labels(filterGroups(groups, 0))).toEqual(["12.2"]);
    expect(labels(filterGroups(groups, 13))).toEqual(["120.34"]);
    expect(labels(filterGroups(groups, ABELIAN_SIMPLE))).toEqual(["5.1"]);
    expect(labels(filterGroups(groups, NON_ABELIAN_SIMPLE))).toEqual(["60.5"]);
  });

  it("finds nothing for a category no group is in", () => {
    expect(filterGroups(groups, 5)).toEqual([]);
  });
});

describe("categoryOptions", () => {
  it("lists the categories present, in the dropdown's order, with their counts", () => {
    expect(categoryOptions(groups)).toEqual([
      { code: ABELIAN_SIMPLE, name: "simple and abelian", count: 1 },
      { code: 0, name: "cyclic, not simple", count: 1 },
      { code: 3, name: "nilpotent and metacyclic", count: 1 },
      { code: 6, name: "metacyclic, not nilpotent", count: 2 },
      { code: 8, name: "metabelian and monomial", count: 1 },
      { code: 13, name: "not solvable or simple", count: 1 },
      { code: NON_ABELIAN_SIMPLE, name: "simple, not abelian", count: 1 },
    ]);
  });

  it("is empty for an empty catalogue", () => {
    expect(categoryOptions([])).toEqual([]);
  });
});

describe("renderFilterOptions", () => {
  it("offers everything first, then each category with its count", () => {
    const options = renderFilterOptions(categoryOptions(groups)).map((option) => [
      option.value,
      option.textContent,
    ]);
    expect(options).toHaveLength(8);
    expect(options[0]).toEqual(["", "All groups"]);
    expect(options[1]).toEqual([String(ABELIAN_SIMPLE), "simple and abelian (1)"]);
    expect(options[2]).toEqual(["0", "cyclic, not simple (1)"]);
    expect(options[4]).toEqual(["6", "metacyclic, not nilpotent (2)"]);
  });
});
