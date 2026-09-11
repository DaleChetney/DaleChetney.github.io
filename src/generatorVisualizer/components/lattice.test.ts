// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { CatalogueSubgroupClass } from "../catalogue";
import { layoutLattice, renderLattice } from "./lattice";

/** C_3:C_4's six classes as the catalogue bakes them. */
const classes: CatalogueSubgroupClass[] = [
  { id: "12.a1.a1", order: 1, count: 1, cyclic: true, normal: true, covers: [] },
  { id: "6.a1.a1", order: 2, count: 1, cyclic: true, normal: true, covers: [0] },
  { id: "4.a1.a1", order: 3, count: 1, cyclic: true, normal: true, covers: [0] },
  { id: "3.a1.a1", order: 4, count: 3, cyclic: true, normal: false, covers: [1] },
  { id: "2.a1.a1", order: 6, count: 1, cyclic: true, normal: true, covers: [1, 2] },
  { id: "1.a1.a1", order: 12, count: 1, cyclic: false, normal: true, covers: [3, 4] },
].map((c) => ({ ...c, texName: `C_${c.order}`, displayName: `C${c.order}` }));
const diagram = layoutLattice(classes, 12, "C₃ ⋊ C₄");
const nodeOfOrder = (order: number) => {
  const node = diagram.nodes.find((n) => classes[n.index].order === order);
  if (node === undefined) throw new Error(`no node of order ${order}`);
  return node;
};

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

  it("marks the whole group and nothing else", () => {
    expect(diagram.nodes.filter((node) => node.whole)).toEqual([nodeOfOrder(12)]);
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

describe("renderLattice", () => {
  const view = (over: Partial<Parameters<typeof renderLattice>[1]> = {}) =>
    renderLattice(diagram, {
      selected: new Set(),
      completing: new Set(),
      generating: new Set(),
      generated: new Set(),
      onToggle: () => {},
      ...over,
    });

  /** Percentage of its allowance a lattice of this layout width is drawn at. */
  const drawnPercent = (width: number): number =>
    Number(
      renderLattice(
        { ...diagram, width },
        {
          selected: new Set(),
          completing: new Set(),
          generating: new Set(),
          generated: new Set(),
          onToggle: () => {},
        },
      ).style.width.replace("%", ""),
    );

  it("draws every node and cover", () => {
    const root = view();
    expect(root.querySelectorAll(".lattice-node")).toHaveLength(6);
    expect(root.querySelectorAll(".lattice-edges line")).toHaveLength(7);
  });

  it("takes only the share of its allowance its width has earned", () => {
    // C_3:C_4's lattice is two columns wide, so it uses a fifth of the room a
    // ten-column one would, rather than stretching to fill it.
    expect(diagram.columns).toBe(2);
    expect(drawnPercent(diagram.width)).toBeLessThan(30);
  });

  it("never asks for more than the whole allowance", () => {
    expect(drawnPercent(5_000)).toBe(100);
    expect(drawnPercent(50_000)).toBe(100);
  });

  it("scales every lattice alike, whatever its shape", () => {
    // Drawn share over layout width is the scale, and so the size of a node.
    // Holding it constant is what leaves a two-column lattice drawing its nodes
    // at the size a ten-column one does, instead of stretching to fill.
    // Four places, not more: the width is written as a percentage rounded to
    // two, so that is all the precision the drawn element carries.
    const scale = (width: number) => drawnPercent(width) / width;
    expect(scale(300)).toBeCloseTo(scale(600), 4);
    expect(scale(300)).toBeCloseTo(scale(900), 4);
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

  it("marks the generating classes, and with them the whole group", () => {
    expect(view().querySelectorAll(".lattice-node.generating")).toHaveLength(0);
    const root = view({ generating: new Set([nodeOfOrder(4).index, nodeOfOrder(6).index]) });
    const marked = Array.from(root.querySelectorAll(".lattice-node.generating")).map((node) =>
      Number(node.getAttribute("data-class")),
    );
    expect(marked.sort()).toEqual(
      [nodeOfOrder(4).index, nodeOfOrder(6).index, nodeOfOrder(12).index].sort(),
    );
  });

  it("marks the generated nodes", () => {
    const generated = new Set([nodeOfOrder(1).index, nodeOfOrder(2).index, nodeOfOrder(4).index]);
    const root = view({ generated });
    const marked = Array.from(root.querySelectorAll(".lattice-node.generated")).map((node) =>
      Number(node.getAttribute("data-class")),
    );
    expect(new Set(marked)).toEqual(generated);
  });

  it("labels a node by its class", () => {
    const root = view();
    expect(root.querySelector(`[data-class="${nodeOfOrder(4).index}"] text`)?.textContent).toBe(
      "₃C4",
    );
    expect(root.querySelector(`[data-class="${nodeOfOrder(12).index}"] text`)?.textContent).toBe(
      "C₃ ⋊ C₄",
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
