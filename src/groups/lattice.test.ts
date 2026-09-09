// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { decodePermutation } from "@shared/permutations";
import { computeSubgroupLattice, type SubgroupClass } from "@shared/subgroups";
import {
  classLabel,
  LATTICE_REFERENCE_WIDTH,
  latticeWidthShare,
  layoutLattice,
  renderLattice,
} from "./lattice";

const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
const lattice = computeSubgroupLattice(generators, 7);
const diagram = layoutLattice(lattice, 12, "C₃ ⋊ C₄");
const nodeOfOrder = (order: number) => {
  const node = diagram.nodes.find((n) => lattice.classes[n.index].order === order);
  if (node === undefined) throw new Error(`no node of order ${order}`);
  return node;
};

describe("classLabel", () => {
  const make = (over: Partial<SubgroupClass>): SubgroupClass =>
    ({ order: 4, count: 1, cyclic: true, ...over }) as SubgroupClass;

  it("names a cyclic subgroup C_n", () => {
    expect(classLabel(make({ order: 6 }), 12, "G")).toBe("C₆");
  });

  it("uses the group's own name for the whole group", () => {
    expect(classLabel(make({ order: 12, cyclic: false }), 12, "C₃ ⋊ C₄")).toBe("C₃ ⋊ C₄");
  });

  it("prefixes the conjugate count, as LMFDB does", () => {
    expect(classLabel(make({ order: 4, count: 3 }), 12, "G")).toBe("₃C₄");
  });

  it("falls back to the order for an unnamed non-cyclic subgroup", () => {
    expect(classLabel(make({ order: 8, cyclic: false }), 16, "G")).toBe("8");
  });
});

describe("layoutLattice", () => {
  it("places one node per class and one line per cover", () => {
    expect(diagram.nodes).toHaveLength(6);
    expect(diagram.edges).toHaveLength(7);
  });

  it("puts the trivial subgroup at the bottom and the group at the top", () => {
    const ys = diagram.nodes.map((n) => n.y);
    expect(nodeOfOrder(1).y).toBe(Math.max(...ys));
    expect(nodeOfOrder(12).y).toBe(Math.min(...ys));
  });

  it("levels by prime divisors, not by order", () => {
    // C_4 and C_6 both have two prime divisors, so they share a row despite
    // having different orders.
    expect(nodeOfOrder(4).y).toBe(nodeOfOrder(6).y);
    expect(nodeOfOrder(2).y).toBe(nodeOfOrder(3).y);
  });

  it("orders each row by subgroup order ascending", () => {
    expect(nodeOfOrder(2).x).toBeLessThan(nodeOfOrder(3).x);
    expect(nodeOfOrder(4).x).toBeLessThan(nodeOfOrder(6).x);
  });

  it("marks the cyclic subgroups above the trivial one selectable", () => {
    for (const order of [2, 3, 4, 6]) {
      expect(nodeOfOrder(order).selectable, `order ${order}`).toBe(true);
    }
    expect(nodeOfOrder(1).selectable).toBe(false);
    expect(nodeOfOrder(12).selectable).toBe(false);
  });

  it("keeps every node inside the reported bounds", () => {
    for (const node of diagram.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(diagram.width);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(diagram.height);
    }
  });
});

describe("latticeWidthShare", () => {
  it("gives the whole allowance to a lattice at the reference width", () => {
    expect(latticeWidthShare(LATTICE_REFERENCE_WIDTH)).toBe(1);
  });

  it("never asks for more than the allowance", () => {
    expect(latticeWidthShare(LATTICE_REFERENCE_WIDTH * 3)).toBe(1);
  });

  it("asks for a share in proportion to the width, so the scale is constant", () => {
    // Two lattices at half and a fifth of the reference: the drawn width falls
    // in the same proportion as the layout width, which is what leaves a node
    // the same size in both.
    expect(latticeWidthShare(LATTICE_REFERENCE_WIDTH / 2)).toBeCloseTo(0.5);
    expect(latticeWidthShare(LATTICE_REFERENCE_WIDTH / 5)).toBeCloseTo(0.2);
  });
});

describe("renderLattice", () => {
  const view = (over: Partial<Parameters<typeof renderLattice>[1]> = {}) =>
    renderLattice(
      diagram,
      { selected: new Set(), completing: new Set(), onToggle: () => {}, ...over },
      () => null,
    );

  it("draws every node and cover", () => {
    const root = view();
    expect(root.querySelectorAll(".lattice-node")).toHaveLength(6);
    expect(root.querySelectorAll(".lattice-edges line")).toHaveLength(7);
  });

  it("takes only the share of its allowance its width has earned", () => {
    // C_3:C_4's lattice is two columns wide, so it uses a fifth of the room a
    // ten-column one would, rather than stretching to fill it.
    const share = latticeWidthShare(diagram.width);
    expect(diagram.columns).toBe(2);
    expect(share).toBeLessThan(0.3);
    expect(view().style.width).toBe(`${(share * 100).toFixed(2)}%`);
  });

  it("scales every lattice alike, whatever its shape", () => {
    // Drawn width over layout width is the scale, and so the size of a node.
    const wide = layoutLattice(lattice, 12, "C₃ ⋊ C₄");
    wide.width = LATTICE_REFERENCE_WIDTH / 2;
    const scale = (d: typeof diagram) => latticeWidthShare(d.width) / d.width;
    expect(scale(wide)).toBeCloseTo(scale(diagram), 10);
  });

  it("exposes selectable nodes as buttons and the rest as plain", () => {
    const root = view();
    expect(root.querySelectorAll('.lattice-node[role="button"]')).toHaveLength(4);
    expect(root.querySelectorAll(".lattice-node.fixed")).toHaveLength(2);
  });

  it("marks the selected and completing nodes", () => {
    const root = view({
      selected: new Set([nodeOfOrder(4).index]),
      completing: new Set([nodeOfOrder(3).index]),
    });
    expect(root.querySelector(`[data-class="${nodeOfOrder(4).index}"]`)?.classList).toContain(
      "selected",
    );
    expect(root.querySelector(`[data-class="${nodeOfOrder(3).index}"]`)?.classList).toContain(
      "completing",
    );
  });

  it("toggles on click", () => {
    const onToggle = vi.fn();
    const root = view({ onToggle });
    root
      .querySelector<SVGGElement>(`[data-class="${nodeOfOrder(6).index}"]`)
      ?.dispatchEvent(new MouseEvent("click"));
    expect(onToggle).toHaveBeenCalledWith(nodeOfOrder(6).index);
  });

  it("does not make the trivial subgroup or the whole group clickable", () => {
    const onToggle = vi.fn();
    const root = view({ onToggle });
    for (const order of [1, 12]) {
      root
        .querySelector<SVGGElement>(`[data-class="${nodeOfOrder(order).index}"]`)
        ?.dispatchEvent(new MouseEvent("click"));
    }
    expect(onToggle).not.toHaveBeenCalled();
  });
});
