import { describe, it, expect } from "vitest";
import { generatePermutationGroup } from "../src/shared/mathUtils/groups/permutations.ts";
import {
  bakeCatalogue,
  chooseRepresentations,
  classGeneratorsFor,
  parseGeneratorCodes,
  representationsFor,
  subgroupClassesFor,
  type GroupRow,
  type SubgroupRow,
  type TransitiveRow,
} from "./bake-groups.ts";
import type { CatalogueRepresentation } from "../src/generatorVisualizer/catalogue.ts";

const groupRow = (over: Partial<GroupRow> = {}): GroupRow => ({
  label: "12.1",
  order: 12,
  tex_name: "C_3:C_4",
  name: "C3:C4",
  permutation_degree: 7,
  number_subgroups: 8,
  number_subgroup_classes: 6,
  abelian: false,
  cyclic: false,
  nilpotent: false,
  solvable: true,
  simple: false,
  solvability_type: 6,
  nilpotency_class: -1,
  rank: 2,
  aut_tex: "D_6",
  aut_order: "12",
  perm_gens: "[129, 16, 840]",
  ...over,
});

const transitiveRow = (over: Partial<TransitiveRow> = {}): TransitiveRow => ({
  abstract_label: "12.1",
  nt_label: "12T5",
  n: 12,
  t: 5,
  prim: 0,
  gens: "[[[1, 8, 7, 2], [3, 6, 9, 12], [4, 11, 10, 5]], [[1, 5, 9], [2, 6, 10], [3, 7, 11], [4, 8, 12]], [[1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [6, 12]]]",
  ...over,
});

const subgroupRow = (
  ambient: string,
  short_label: string,
  subgroup_order: number,
  count: number,
  cyclic: boolean,
  normal: boolean,
  subgroup_tex: string,
  contains: string[],
): SubgroupRow => ({
  ambient,
  short_label,
  subgroup_order,
  count,
  cyclic,
  normal,
  subgroup_tex,
  contains,
});

/** gps_subgroup_data and gps_subgroup_search for ambient 12.1, as extracted. */
const subgroupRows = (): SubgroupRow[] => [
  subgroupRow("12.1", "12.a1.a1", 1, 1, true, true, "C_1", []),
  subgroupRow("12.1", "6.a1.a1", 2, 1, true, true, "C_2", ["12.a1.a1"]),
  subgroupRow("12.1", "4.a1.a1", 3, 1, true, true, "C_3", ["12.a1.a1"]),
  subgroupRow("12.1", "3.a1.a1", 4, 3, true, false, "C_4", ["6.a1.a1"]),
  subgroupRow("12.1", "2.a1.a1", 6, 1, true, true, "C_6", ["4.a1.a1", "6.a1.a1"]),
  subgroupRow("12.1", "1.a1.a1", 12, 1, false, true, "C_3:C_4", ["2.a1.a1", "3.a1.a1"]),
];

/** The same for A_4, whose C_2^2 is a non-cyclic proper class. */
const a4SubgroupRows = (): SubgroupRow[] => [
  subgroupRow("12.3", "12.a1.a1", 1, 1, true, true, "C_1", []),
  subgroupRow("12.3", "6.a1.a1", 2, 3, true, false, "C_2", ["12.a1.a1"]),
  subgroupRow("12.3", "4.a1.a1", 3, 4, true, false, "C_3", ["12.a1.a1"]),
  subgroupRow("12.3", "3.a1.a1", 4, 1, false, true, "C_2^2", ["6.a1.a1"]),
  subgroupRow("12.3", "1.a1.a1", 12, 1, false, true, "A_4", ["3.a1.a1", "4.a1.a1"]),
];

const a4Row = (): GroupRow =>
  groupRow({
    label: "12.3",
    tex_name: "A_4",
    name: "A4",
    permutation_degree: 4,
    number_subgroups: 10,
    number_subgroup_classes: 5,
    aut_tex: "S_4",
    aut_order: "24",
    perm_gens: "[4, 16, 7]",
  });

describe("parseGeneratorCodes", () => {
  it("reads the codes out of a Postgres array literal", () => {
    expect(parseGeneratorCodes("[129, 16, 840]")).toEqual(["129", "16", "840"]);
  });

  it("gives nothing for an empty literal", () => {
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
    expect(t?.generators[0]).toEqual([8, 1, 6, 11, 4, 9, 2, 7, 12, 5, 10, 3]);
    expect(t?.generators).toHaveLength(3);
    expect(t?.transitive).toBe(true);
  });

  it("calls a transitive representation of full degree regular, and a primitive one primitive", () => {
    const reps = representationsFor(groupRow(), [
      transitiveRow(),
      transitiveRow({ nt_label: "6T2", n: 6, t: 2, prim: 1, gens: "[[[1, 2, 3, 4, 5, 6]]]" }),
    ]);
    expect(reps.find((rep) => rep.id === "12T5")?.title).toContain("regular");
    expect(reps.find((rep) => rep.id === "6T2")?.title).toContain("primitive");
    expect(reps.find((rep) => rep.id === "6T2")?.primitive).toBe(true);
  });

  it("orders representations by degree", () => {
    const reps = representationsFor(groupRow(), [
      transitiveRow(),
      transitiveRow({ nt_label: "6T2", n: 6, t: 2, gens: "[[[1, 2, 3, 4, 5, 6]]]" }),
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
        t: 4,
        gens: "[[[1, 2, 3, 4, 5]], [[1, 2, 3]]]",
      }),
    ]);
    expect(reps.map((rep) => rep.id)).toEqual(["5T4"]);
  });

  it("keeps the minimal representation when it is intransitive at that degree", () => {
    const reps = representationsFor(groupRow(), [
      transitiveRow({ nt_label: "7T1", n: 7, t: 1, gens: "[[[1, 2, 3, 4, 5, 6, 7]]]" }),
    ]);
    expect(reps.map((rep) => rep.id)).toEqual(["perm-7", "7T1"]);
  });
});

describe("chooseRepresentations", () => {
  const rep = (id: string, degree: number, primitive = false): CatalogueRepresentation => ({
    id,
    title: id,
    degree,
    transitive: !id.startsWith("perm-"),
    primitive,
    generators: [],
    classGenerators: [],
  });

  it("keeps everything when the group is within the limit", () => {
    const reps = [rep("6T1", 6), rep("perm-8", 8), rep("12T2", 12), rep("24T1", 24)];
    expect(chooseRepresentations(reps, 4)).toEqual(reps);
  });

  it("keeps the minimal, the smallest transitive, the largest primitive and the largest", () => {
    const reps = [
      rep("6T1", 6),
      rep("6T2", 6),
      rep("perm-8", 8),
      rep("8T3", 8, true),
      rep("12T2", 12),
      rep("16T5", 16),
      rep("24T1", 24),
    ];
    expect(chooseRepresentations(reps, 4).map((r) => r.id)).toEqual([
      "6T1",
      "perm-8",
      "8T3",
      "24T1",
    ]);
  });

  it("does not list a representation twice when the roles coincide", () => {
    const reps = [
      rep("6T1", 6),
      rep("perm-8", 8),
      rep("12T2", 12),
      rep("16T5", 16),
      rep("24T1", 24, true),
    ];
    expect(chooseRepresentations(reps, 4).map((r) => r.id)).toEqual(["6T1", "perm-8", "24T1"]);
  });

  it("copes with a group whose minimal representation was a transitive one", () => {
    const reps = [
      rep("5T4", 5, true),
      rep("6T12", 6, true),
      rep("10T7", 10),
      rep("12T33", 12),
      rep("30T9", 30),
    ];
    expect(chooseRepresentations(reps, 4).map((r) => r.id)).toEqual(["5T4", "6T12", "30T9"]);
  });
});

describe("subgroupClassesFor", () => {
  const classes = subgroupClassesFor(subgroupRows());

  it("orders the classes by subgroup order", () => {
    expect(classes.map((c) => c.order)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(classes.map((c) => c.id)).toEqual([
      "12.a1.a1",
      "6.a1.a1",
      "4.a1.a1",
      "3.a1.a1",
      "2.a1.a1",
      "1.a1.a1",
    ]);
  });

  it("turns the labels a class contains into sorted indices", () => {
    expect(classes.map((c) => c.covers)).toEqual([[], [0], [0], [1], [1, 2], [3, 4]]);
  });

  it("carries the counts, flags and names through", () => {
    expect(classes[3]).toMatchObject({ count: 3, cyclic: true, normal: false, texName: "C_4" });
    expect(classes[5].displayName).toBe("C₃ ⋊ C₄");
  });

  it("refuses a class that contains a label it does not know", () => {
    const rows = subgroupRows();
    rows[1].contains = ["99.a1.a1"];
    expect(() => subgroupClassesFor(rows)).toThrow(/12\.1.*99\.a1\.a1/);
  });
});

describe("classGeneratorsFor", () => {
  const [minimal] = representationsFor(groupRow(), []);
  const classes = subgroupClassesFor(subgroupRows());
  const generators = classGeneratorsFor(minimal.generators, minimal.degree, classes, "12.1");

  it("gives one generator per cyclic class and none for the trivial one", () => {
    expect(generators.map((g) => g.length)).toEqual([0, 1, 1, 1, 1, 2]);
  });

  it("closes each generating set into a subgroup of the class's order", () => {
    classes.forEach((c, i) => {
      expect(generatePermutationGroup(generators[i], 7), c.id).toHaveLength(c.order);
    });
  });

  it("finds a generating set for a non-cyclic proper class", () => {
    const [a4] = representationsFor(a4Row(), []);
    const a4Classes = subgroupClassesFor(a4SubgroupRows());
    const a4Generators = classGeneratorsFor(a4.generators, 4, a4Classes, "12.3");
    expect(generatePermutationGroup(a4Generators[3], 4)).toHaveLength(4);
    expect(a4Generators[3].length).toBeGreaterThan(1);
  });

  it("names the representation when the lattice does not match LMFDB's", () => {
    const a4Classes = subgroupClassesFor(a4SubgroupRows());
    expect(() => classGeneratorsFor(minimal.generators, 7, a4Classes, "12.1 perm-7")).toThrow(
      /12\.1 perm-7/,
    );
  });
});

describe("bakeCatalogue", () => {
  const catalogue = bakeCatalogue(
    [groupRow(), a4Row()],
    [transitiveRow()],
    [...subgroupRows(), ...a4SubgroupRows()],
  );

  it("renders the display names from the TeX ones", () => {
    expect(catalogue.groups[0].displayName).toBe("C₃ ⋊ C₄");
    expect(catalogue.groups[0].autDisplayName).toBe("D₆");
    expect(catalogue.groups[0].autOrder).toBe(12);
  });

  it("gives a group only its own transitive representations", () => {
    expect(catalogue.groups[0].representations.map((rep) => rep.id)).toEqual(["perm-7", "12T5"]);
    expect(catalogue.groups[1].representations.map((rep) => rep.id)).toEqual(["perm-4"]);
  });

  it("writes class generators for every representation", () => {
    for (const group of catalogue.groups) {
      for (const rep of group.representations) {
        expect(rep.classGenerators, `${group.label} ${rep.id}`).toHaveLength(
          group.subgroups.classes.length,
        );
      }
    }
  });

  it("carries the extra group fields and the bounds", () => {
    expect(catalogue.groups[1]).toMatchObject({
      solvabilityType: 6,
      nilpotencyClass: -1,
      rank: 2,
      subgroups: { all: 10 },
    });
    expect(catalogue.bounds).toEqual({
      maxOrder: 360,
      maxSubgroupClasses: 32,
      maxDegree: 32,
      maxRepresentations: 4,
    });
  });

  it("refuses a group whose subgroup rows disagree with its class count", () => {
    expect(() =>
      bakeCatalogue([groupRow({ number_subgroup_classes: 7 })], [], subgroupRows()),
    ).toThrow(/12\.1.*6 subgroup rows.*7 classes/);
  });
});
