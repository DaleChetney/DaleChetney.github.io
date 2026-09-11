// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { CatalogueGroup } from "../catalogue";
import { filterGroups, groupListCaption, renderGroupList } from "./group-list";

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
  group({ label: "12.3", name: "A4", displayName: "A₄", texName: "A_4" }),
  group({ label: "32.13", name: "C8:C4", displayName: "C₈ ⋊ C₄", order: 32 }),
  group({ label: "60.5", name: "A5", displayName: "A₅", order: 60 }),
];

const labels = (matches: readonly CatalogueGroup[]): string[] =>
  matches.map((match) => match.label);

describe("filterGroups", () => {
  it("returns everything for an empty query", () => {
    expect(filterGroups(groups, "")).toHaveLength(4);
    expect(filterGroups(groups, "   ")).toHaveLength(4);
  });

  it("matches on the label", () => {
    expect(labels(filterGroups(groups, "12."))).toEqual(["12.1", "12.3"]);
    expect(labels(filterGroups(groups, "60.5"))).toEqual(["60.5"]);
  });

  it("matches on the ASCII name, whatever the case", () => {
    expect(labels(filterGroups(groups, "a5"))).toEqual(["60.5"]);
    expect(labels(filterGroups(groups, "C8:C4"))).toEqual(["32.13"]);
  });

  it("matches on the rendered name", () => {
    expect(labels(filterGroups(groups, "A₄"))).toEqual(["12.3"]);
  });

  it("requires every term to match", () => {
    expect(labels(filterGroups(groups, "a 12"))).toEqual(["12.3"]);
    expect(filterGroups(groups, "a4 60")).toEqual([]);
  });

  it("finds nothing when nothing matches", () => {
    expect(filterGroups(groups, "zzz")).toEqual([]);
  });
});

describe("groupListCaption", () => {
  it("counts the whole catalogue when nothing is filtered out", () => {
    expect(groupListCaption(526, 526)).toBe("526 groups");
  });

  it("counts the matches otherwise", () => {
    expect(groupListCaption(3, 526)).toBe("3 of 526 groups");
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
    expect(root.querySelectorAll(".group-row")).toHaveLength(4);
    expect(root.querySelector('[data-label="32.13"]')).not.toBeNull();
  });

  it("shows the label and order alongside the name, since names collide", () => {
    const row = renderGroupList(groups, view).querySelector<HTMLElement>('[data-label="32.13"]');
    expect(row?.querySelector(".group-name")?.textContent).toBe("C₈ ⋊ C₄");
    expect(row?.querySelector(".group-meta")?.textContent).toBe("32.13 · order 32");
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
