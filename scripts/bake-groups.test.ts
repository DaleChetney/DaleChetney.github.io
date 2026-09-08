import { describe, it, expect } from "vitest";
import {
  bakeCatalogue,
  parseGeneratorCodes,
  representationsFor,
  subgroupRung,
  type GroupRow,
  type TransitiveRow,
} from "./bake-groups.ts";

const groupRow = (over: Partial<GroupRow> = {}): GroupRow => ({
  label: "12.1",
  order: 12,
  tex_name: "C_3:C_4",
  name: "C3:C4",
  permutation_degree: 7,
  number_subgroups: 8,
  number_subgroup_classes: 6,
  number_subgroup_autclasses: 6,
  abelian: false,
  cyclic: false,
  nilpotent: false,
  solvable: true,
  simple: false,
  perm_gens: "[129, 16, 840]",
  ...over,
});

const transitiveRow = (over: Partial<TransitiveRow> = {}): TransitiveRow => ({
  abstract_label: "12.1",
  nt_label: "12T5",
  n: 12,
  gens: "[[[1, 8, 7, 2], [3, 6, 9, 12], [4, 11, 10, 5]]]",
  ...over,
});

describe("parseGeneratorCodes", () => {
  it("reads the codes out of a Postgres array literal", () => {
    expect(parseGeneratorCodes("[129, 16, 840]")).toEqual(["129", "16", "840"]);
  });

  it("gives nothing for the group with no permutation representation", () => {
    expect(parseGeneratorCodes(null)).toEqual([]);
    expect(parseGeneratorCodes("[]")).toEqual([]);
  });

  // The reason this is not JSON.parse: a degree-32 code has 36 digits, and
  // reading it as a number rounds it into a different permutation.
  it("keeps every digit of a code too long for a double", () => {
    const code = "263121961682809333227690318495744000";
    expect(parseGeneratorCodes(`[${code}]`)).toEqual([code]);
    expect(String(JSON.parse(`[${code}]`)[0])).not.toBe(code);
  });
});

describe("subgroupRung", () => {
  it("shows every subgroup when there are few enough", () => {
    expect(subgroupRung(8, 6, 22)).toBe("all");
    expect(subgroupRung(22, 22, 22)).toBe("all");
  });

  it("falls back to conjugacy classes", () => {
    expect(subgroupRung(23, 22, 22)).toBe("classes");
  });

  it("falls back again to automorphism classes", () => {
    expect(subgroupRung(608, 146, 22)).toBe("autclasses");
  });
});

describe("representationsFor", () => {
  it("decodes the minimal faithful representation", () => {
    const [minimal] = representationsFor(groupRow(), []);
    expect(minimal.id).toBe("perm-7");
    expect(minimal.degree).toBe(7);
    // (2 3)(4 5 6 7), (4 6)(5 7), (1 2 3)
    expect(minimal.generators).toEqual([
      [1, 3, 2, 5, 6, 7, 4],
      [1, 2, 3, 6, 7, 4, 5],
      [2, 3, 1, 4, 5, 6, 7],
    ]);
  });

  it("marks an intransitive minimal representation as such", () => {
    // C_3:C_4 at degree 7 has orbits {1,2,3} and {4,5,6,7}.
    expect(representationsFor(groupRow(), [])[0].transitive).toBe(false);
  });

  it("turns a transitive row's cycles into one-line form", () => {
    const reps = representationsFor(groupRow(), [transitiveRow()]);
    const t = reps.find((rep) => rep.id === "12T5");
    expect(t?.generators).toEqual([[8, 1, 6, 11, 4, 9, 2, 7, 12, 5, 10, 3]]);
    expect(t?.transitive).toBe(true);
  });

  it("calls a transitive representation of full degree regular", () => {
    const reps = representationsFor(groupRow(), [transitiveRow()]);
    expect(reps.find((rep) => rep.id === "12T5")?.title).toContain("regular");
  });

  it("orders representations by degree", () => {
    const reps = representationsFor(groupRow(), [
      transitiveRow(),
      transitiveRow({ nt_label: "6T2", n: 6, gens: "[[[1, 2, 3, 4, 5, 6]]]" }),
    ]);
    expect(reps.map((rep) => rep.degree)).toEqual([6, 7, 12]);
  });

  it("drops the minimal representation when a transitive one already is it", () => {
    // A_5's minimal faithful representation is the transitive 5T4, so offering
    // both would list the same action twice, once without a name.
    const a5 = groupRow({
      label: "60.5",
      order: 60,
      tex_name: "A_5",
      name: "A5",
      permutation_degree: 5,
      perm_gens: "[33, 30]",
    });
    const reps = representationsFor(a5, [
      transitiveRow({
        abstract_label: "60.5",
        nt_label: "5T4",
        n: 5,
        gens: "[[[1, 2, 3, 4, 5]], [[1, 2, 3]]]",
      }),
    ]);
    expect(reps.map((rep) => rep.id)).toEqual(["5T4"]);
  });

  it("keeps the minimal representation when it is intransitive at that degree", () => {
    const reps = representationsFor(groupRow(), [
      transitiveRow({ nt_label: "7T1", n: 7, gens: "[[[1, 2, 3, 4, 5, 6, 7]]]" }),
    ]);
    expect(reps.map((rep) => rep.id)).toEqual(["perm-7", "7T1"]);
  });
});

describe("bakeCatalogue", () => {
  const catalogue = bakeCatalogue(
    [
      groupRow(),
      groupRow({
        label: "12.3",
        tex_name: "A_4",
        name: "A4",
        permutation_degree: 4,
        perm_gens: "[4, 16, 7]",
      }),
    ],
    [transitiveRow()],
  );

  it("renders the display name from the TeX one", () => {
    expect(catalogue.groups[0].displayName).toBe("C₃ ⋊ C₄");
  });

  it("gives a group only its own transitive representations", () => {
    expect(catalogue.groups[0].representations.map((rep) => rep.id)).toEqual(["perm-7", "12T5"]);
    expect(catalogue.groups[1].representations.map((rep) => rep.id)).toEqual(["perm-4"]);
  });

  it("carries the bounds it was baked to", () => {
    expect(catalogue.bounds.maxDegree).toBe(32);
    expect(catalogue.bounds.maxArrows).toBe(128);
  });
});
