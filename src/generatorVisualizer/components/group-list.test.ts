// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { CatalogueGroup } from "../catalogue";
import { factorizationText, groupListCaption, renderGroupList } from "./group-list";

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
    expect(root.querySelectorAll(".group-row")).toHaveLength(groups.length);
    expect(root.querySelector('[data-label="32.13"]')).not.toBeNull();
  });

  it("shows the label and order alongside the name, since names collide", () => {
    const row = renderGroupList(groups, view).querySelector<HTMLElement>('[data-label="120.34"]');
    expect(row?.querySelector(".group-name")?.textContent).toBe("S₅");
    expect(row?.querySelector(".group-meta")?.textContent).toBe("120.34 · order 2³·3·5");
  });

  it("adds the nilpotency class when the group is nilpotent", () => {
    const row = renderGroupList(groups, view).querySelector<HTMLElement>('[data-label="32.13"]');
    expect(row?.querySelector(".group-meta")?.textContent).toBe("32.13 · order 2⁵ · nilpotency 2");
  });

  it("adds the derived length when the group is solvable but not nilpotent", () => {
    const row = renderGroupList(groups, view).querySelector<HTMLElement>('[data-label="12.3"]');
    expect(row?.querySelector(".group-meta")?.textContent).toBe(
      "12.3 · order 2²·3 · derived length 2",
    );
  });

  it("adds neither when the group is not solvable", () => {
    const row = renderGroupList(groups, view).querySelector<HTMLElement>('[data-label="60.5"]');
    expect(row?.querySelector(".group-meta")?.textContent).toBe("60.5 · order 2²·3·5");
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
