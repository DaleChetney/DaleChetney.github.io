// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { CatalogueGroup, CatalogueSubgroupClass } from "../catalogue";
import { GroupSorter, type GroupSort } from "./groupSorter";

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

const ofOrders = (...orders: number[]): CatalogueGroup[] =>
  orders.map((order, i) => group({ label: `${String(order)}.${String(i)}`, order }));
const orders = (sorted: readonly CatalogueGroup[]): number[] => sorted.map((g) => g.order);
const labels = (sorted: readonly CatalogueGroup[]): string[] => sorted.map((g) => g.label);
const sorted = (
  groups: readonly CatalogueGroup[],
  ...sorts: GroupSort[]
): readonly CatalogueGroup[] => {
  const sorter = new GroupSorter(groups);
  for (const sort of sorts) sorter.sortBy(sort);
  return sorter.groups;
};

/** `n` placeholder subgroup classes; only their count matters to the sort. */
const classes = (n: number): CatalogueSubgroupClass[] =>
  Array.from({ length: n }, () => ({
    id: "",
    order: 1,
    count: 1,
    cyclic: true,
    normal: true,
    texName: "",
    displayName: "",
    covers: [],
  }));

describe("GroupSorter", () => {
  // 30 = 2·3·5, 16 = 2⁴, 12 = 2²·3, 7 prime, 36 = 2²·3².
  const mixed = ofOrders(7, 12, 16, 30, 36);

  it("starts in the order it was given", () => {
    expect(orders(new GroupSorter(ofOrders(16, 7)).groups)).toEqual([16, 7]);
  });

  it("sorts by order", () => {
    expect(orders(sorted(ofOrders(16, 7, 12), "order"))).toEqual([7, 12, 16]);
  });

  it("sorts by distinct primes", () => {
    expect(orders(sorted(mixed, "distinct-primes"))).toEqual([7, 16, 12, 36, 30]);
  });

  it("sorts by prime factors with multiplicity", () => {
    expect(orders(sorted(mixed, "prime-factors"))).toEqual([7, 12, 30, 16, 36]);
  });

  it("sorts labels by their numbers, not their text", () => {
    const shuffled = ["12.10", "9.2", "12.9", "12.1"].map((label) => group({ label }));
    expect(labels(sorted(shuffled, "label"))).toEqual(["9.2", "12.1", "12.9", "12.10"]);
  });

  it("sorts by rank", () => {
    const ranked = [3, 1, 2].map((rank) => group({ label: `r${String(rank)}`, rank }));
    expect(labels(sorted(ranked, "rank"))).toEqual(["r1", "r2", "r3"]);
  });

  it("sorts by length: rank, nilpotency class or derived length, whichever applies", () => {
    const lengths = [
      group({ label: "S5", solvable: false, derivedLength: 0 }),
      group({ label: "derived-3", derivedLength: 3 }),
      group({ label: "class-2", nilpotent: true, nilpotencyClass: 2, derivedLength: 2 }),
      group({ label: "rank-1", abelian: true, nilpotent: true, nilpotencyClass: 1, rank: 1 }),
      group({ label: "rank-3", abelian: true, nilpotent: true, nilpotencyClass: 1, rank: 3 }),
    ];
    expect(labels(sorted(lengths, "length"))).toEqual([
      "rank-1",
      "class-2",
      "derived-3",
      "rank-3",
      "S5",
    ]);
  });

  it("sorts by automorphism group order, unknown last", () => {
    const auts = [group({ label: "a", autOrder: null }), group({ label: "b", autOrder: 48 })];
    auts.push(group({ label: "c", autOrder: 2 }));
    expect(labels(sorted(auts, "automorphisms"))).toEqual(["c", "b", "a"]);
  });

  it("sorts by number of subgroups", () => {
    const counted = [10, 4, 6].map((all) =>
      group({ label: `s${String(all)}`, subgroups: { all, classes: [] } }),
    );
    expect(labels(sorted(counted, "subgroups"))).toEqual(["s4", "s6", "s10"]);
  });

  it("sorts by subgroup classes, not subgroups", () => {
    const counted = [
      group({ label: "many-subgroups", subgroups: { all: 20, classes: classes(3) } }),
      group({ label: "many-classes", subgroups: { all: 10, classes: classes(5) } }),
    ];
    expect(labels(sorted(counted, "subgroup-classes"))).toEqual(["many-subgroups", "many-classes"]);
  });

  it("sorts by smallest prime factor, the trivial group first", () => {
    expect(orders(sorted(ofOrders(25, 9, 1, 15, 4), "smallest-prime"))).toEqual([1, 4, 9, 15, 25]);
  });

  it("breaks ties by the order it was given, not by the group's order", () => {
    expect(orders(sorted(ofOrders(36, 16, 30, 12), "prime-factors"))).toEqual([30, 12, 36, 16]);
  });

  describe("stacked", () => {
    // 27 = 3³ shares Ω = 3 with 12 and 30, and ω = 1 with 7 and 16.
    const stacked = ofOrders(7, 12, 16, 27, 30, 36);

    it("lets the earlier sort break the later one's ties", () => {
      expect(orders(sorted(stacked, "distinct-primes", "prime-factors"))).toEqual([
        7, 27, 12, 30, 16, 36,
      ]);
      expect(orders(sorted(stacked, "prime-factors", "distinct-primes"))).toEqual([
        7, 27, 16, 12, 36, 30,
      ]);
    });

    it("comes back to plain order when sorted by order last", () => {
      expect(orders(sorted(stacked, "prime-factors", "order"))).toEqual([7, 12, 16, 27, 30, 36]);
    });

    it("comes back to catalogue order when sorted by label last", () => {
      const twelves = ["12.3", "12.1", "12.4"].map((label) => group({ label }));
      expect(labels(sorted(twelves, "rank", "prime-factors", "label"))).toEqual([
        "12.1",
        "12.3",
        "12.4",
      ]);
    });
  });

  it("keeps catalogue order among groups of the same order", () => {
    const twelves = [group({ label: "12.3" }), group({ label: "12.1" })];
    expect(labels(sorted(twelves, "prime-factors"))).toEqual(["12.3", "12.1"]);
  });

  it("returns what it now holds", () => {
    const sorter = new GroupSorter(ofOrders(16, 7));
    expect(sorter.sortBy("order")).toBe(sorter.groups);
  });

  it("leaves its input alone", () => {
    const input = ofOrders(16, 7);
    new GroupSorter(input).sortBy("order");
    expect(orders(input)).toEqual([16, 7]);
  });

  it("offers label first, then the order-based keys, then the structural ones", () => {
    expect(GroupSorter.renderOptions().map((option) => option.value)).toEqual([
      "label",
      "order",
      "distinct-primes",
      "prime-factors",
      "smallest-prime",
      "rank",
      "length",
      "automorphisms",
      "subgroups",
      "subgroup-classes",
    ]);
  });

  it("names each option", () => {
    const names = GroupSorter.renderOptions().map((option) => option.textContent);
    expect(names).toContain("Sort by smallest prime factor");
    expect(names).toContain("Sort by number of subgroups");
  });
});
