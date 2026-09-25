// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { CatalogueGroup } from "../catalogue";
import {
  type GroupSort,
  factorizationText,
  filterGroups,
  groupListCaption,
  renderFilterOptions,
  renderGroupList,
  renderSortOptions,
  solvabilityOptions,
  sortGroups,
} from "./group-list";

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
  rank: 2,
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
  group({ label: "60.5", name: "A5", displayName: "A₅", order: 60, solvabilityType: 13 }),
  group({ label: "12.2", name: "C12", displayName: "C₁₂", solvabilityType: 0 }),
  group({ label: "12.4", name: "D6", displayName: "D₆", solvabilityType: 6 }),
];

const labels = (matches: readonly CatalogueGroup[]): string[] =>
  matches.map((match) => match.label);

describe("filterGroups", () => {
  it("returns everything when no type is chosen", () => {
    expect(filterGroups(groups, null)).toHaveLength(6);
  });

  it("keeps only the groups of the chosen solvability type", () => {
    expect(labels(filterGroups(groups, 6))).toEqual(["12.1", "12.4"]);
    expect(labels(filterGroups(groups, 13))).toEqual(["60.5"]);
  });

  it("finds nothing for a type no group has", () => {
    expect(filterGroups(groups, 5)).toEqual([]);
  });
});

describe("solvabilityOptions", () => {
  it("lists the types present, in LMFDB's order, with their counts", () => {
    expect(solvabilityOptions(groups)).toEqual([
      { type: 0, name: "cyclic", count: 1 },
      { type: 3, name: "nilpotent and metacyclic, not abelian", count: 1 },
      { type: 6, name: "metacyclic, not nilpotent", count: 2 },
      { type: 8, name: "metabelian and monomial, not supersolvable", count: 1 },
      { type: 13, name: "not solvable", count: 1 },
    ]);
  });

  it("is empty for an empty catalogue", () => {
    expect(solvabilityOptions([])).toEqual([]);
  });
});

describe("renderFilterOptions", () => {
  it("offers everything first, then each type with its count", () => {
    const options = renderFilterOptions(solvabilityOptions(groups)).map((option) => [
      option.value,
      option.textContent,
    ]);
    expect(options).toHaveLength(6);
    expect(options[0]).toEqual(["", "All groups"]);
    expect(options[1]).toEqual(["0", "cyclic (1)"]);
    expect(options[3]).toEqual(["6", "metacyclic, not nilpotent (2)"]);
  });
});

describe("sortGroups", () => {
  const ofOrders = (...orders: number[]): CatalogueGroup[] =>
    orders.map((order, i) => group({ label: `${String(order)}.${String(i)}`, order }));
  const orders = (sorted: readonly CatalogueGroup[]): number[] => sorted.map((g) => g.order);
  // 30 = 2·3·5, 16 = 2⁴, 12 = 2²·3, 7 prime, 36 = 2²·3².
  const mixed = ofOrders(7, 12, 16, 30, 36);

  it("keeps order when sorting by order", () => {
    expect(orders(sortGroups(ofOrders(16, 7, 12), "order"))).toEqual([7, 12, 16]);
  });

  it("sorts by distinct primes", () => {
    expect(orders(sortGroups(mixed, "distinct-primes"))).toEqual([7, 16, 12, 36, 30]);
  });

  it("sorts by prime factors with multiplicity", () => {
    expect(orders(sortGroups(mixed, "prime-factors"))).toEqual([7, 12, 30, 16, 36]);
  });

  it("breaks ties by the order it was given, not by the group's order", () => {
    expect(orders(sortGroups(ofOrders(36, 16, 30, 12), "prime-factors"))).toEqual([30, 12, 36, 16]);
  });

  describe("stacked", () => {
    // 27 = 3³ shares Ω = 3 with 12 and 30, and ω = 1 with 7 and 16.
    const stacked = ofOrders(7, 12, 16, 27, 30, 36);
    const then = (first: GroupSort, second: GroupSort): number[] =>
      orders(sortGroups(sortGroups(stacked, first), second));

    it("lets the earlier sort break the later one's ties", () => {
      expect(then("distinct-primes", "prime-factors")).toEqual([7, 27, 12, 30, 16, 36]);
      expect(then("prime-factors", "distinct-primes")).toEqual([7, 27, 16, 12, 36, 30]);
    });

    it("comes back to plain order when sorted by order last", () => {
      expect(then("prime-factors", "order")).toEqual([7, 12, 16, 27, 30, 36]);
    });
  });

  it("keeps catalogue order among groups of the same order", () => {
    const twelves = [group({ label: "12.3" }), group({ label: "12.1" })];
    expect(labels(sortGroups(twelves, "prime-factors"))).toEqual(["12.3", "12.1"]);
  });

  it("leaves its input alone", () => {
    const input = ofOrders(16, 7);
    sortGroups(input, "order");
    expect(orders(input)).toEqual([16, 7]);
  });
});

describe("renderSortOptions", () => {
  it("offers order first, then ω and Ω", () => {
    expect(renderSortOptions().map((option) => option.value)).toEqual([
      "order",
      "distinct-primes",
      "prime-factors",
    ]);
  });
});

describe("factorizationText", () => {
  it.each([
    [1, "1"],
    [7, "7"],
    [12, "2²·3"],
    [16, "2⁴"],
    [360, "2³·3²·5"],
  ])("writes %i as %s", (n, expected) => {
    expect(factorizationText(n)).toBe(expected);
  });
});

describe("groupListCaption", () => {
  it("counts the whole catalogue when nothing is filtered out", () => {
    expect(groupListCaption(402, 402)).toBe("402 groups");
  });

  it("counts the matches otherwise", () => {
    expect(groupListCaption(3, 402)).toBe("3 of 402 groups");
  });
});

describe("renderGroupList", () => {
  const view = { selected: null as string | null, onSelect: () => {} };

  it("says so when nothing matches", () => {
    const root = renderGroupList([], view);
    expect(root.querySelector(".group-row")).toBeNull();
    expect(root.textContent).toContain("No group matches");
  });

  it("renders a row per group, tagged with its label", () => {
    const root = renderGroupList(groups, view);
    expect(root.querySelectorAll(".group-row")).toHaveLength(6);
    expect(root.querySelector('[data-label="32.13"]')).not.toBeNull();
  });

  it("shows the label and order alongside the name, since names collide", () => {
    const row = renderGroupList(groups, view).querySelector<HTMLElement>('[data-label="12.1"]');
    expect(row?.querySelector(".group-name")?.textContent).toBe("C₃ ⋊ C₄");
    expect(row?.querySelector(".group-meta")?.textContent).toBe("12.1 · order 12 = 2²·3");
  });

  it("adds the nilpotency class when the group is nilpotent", () => {
    const row = renderGroupList(groups, view).querySelector<HTMLElement>('[data-label="32.13"]');
    expect(row?.querySelector(".group-meta")?.textContent).toBe("32.13 · order 32 = 2⁵ · class 2");
  });

  it("marks the selected row", () => {
    const root = renderGroupList(groups, { ...view, selected: "12.3" });
    const selected = root.querySelectorAll(".group-row.selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute("data-label")).toBe("12.3");
    expect(selected[0].getAttribute("aria-current")).toBe("true");
  });

  it("selects the group it was clicked on", () => {
    const onSelect = vi.fn();
    const root = renderGroupList(groups, { ...view, onSelect });
    root.querySelector<HTMLElement>('[data-label="60.5"]')?.click();
    expect(onSelect).toHaveBeenCalledWith("60.5");
  });
});
