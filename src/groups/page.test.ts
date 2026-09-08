// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { C3_C4 } from "./data";

// main.ts reaches into index.html by id and throws if one is missing, which no
// type check can see. Running it against the real markup pins the two together.
beforeAll(async () => {
  const html = readFileSync(resolve(import.meta.dirname, "index.html"), "utf8");
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  await import("./main");
});

const latticeNode = (label: string): SVGGElement => {
  const found = Array.from(document.querySelectorAll<SVGGElement>(".lattice-node")).find(
    (node) => node.querySelector("text")?.textContent === label,
  );
  if (found === undefined) throw new Error(`no lattice node labelled ${label}`);
  return found;
};

const arrowCount = (): number => document.querySelectorAll("#diagram .edges path").length;
const completing = (): string[] =>
  Array.from(document.querySelectorAll(".lattice-node.completing text")).map(
    (text) => text.textContent ?? "",
  );

describe("groups page", () => {
  it("mounts both diagrams", () => {
    expect(document.querySelector("#diagram svg")).not.toBeNull();
    expect(document.querySelector("#lattice svg")).not.toBeNull();
  });

  it("draws a node for every point of the default representation", () => {
    expect(document.querySelectorAll("#diagram .node")).toHaveLength(
      C3_C4.representations[0].degree,
    );
  });

  it("names the group", () => {
    expect(document.querySelector("#group-name")?.textContent).toBe(C3_C4.displayName);
    expect(document.querySelector("#group-label")?.textContent).toContain(C3_C4.label);
  });

  it("labels the lattice the way LMFDB does", () => {
    const labels = Array.from(document.querySelectorAll(".lattice-node text")).map(
      (text) => text.textContent,
    );
    expect(labels.sort()).toEqual(["C₁", "C₂", "C₃", "C₆", "C₃ ⋊ C₄", "₃C₄"].sort());
  });

  it("starts with one cyclic subgroup selected and its arrows drawn", () => {
    expect(document.querySelectorAll(".lattice-node.selected")).toHaveLength(1);
    expect(arrowCount()).toBeGreaterThan(0);
  });

  it("marks only C_4 as completing the selection of C_6", () => {
    // <C_6, C_4> is the whole group; C_2 and C_3 both lie inside C_6.
    expect(latticeNode("C₆").classList).toContain("selected");
    expect(completing()).toEqual(["₃C₄"]);
  });

  it("draws more arrows and clears the prompt once a generating set is chosen", () => {
    const before = arrowCount();
    latticeNode("₃C₄").dispatchEvent(new MouseEvent("click"));
    expect(document.querySelectorAll(".lattice-node.selected")).toHaveLength(2);
    expect(arrowCount()).toBeGreaterThan(before);
    // <C_6, C_4> generates, so nothing is outstanding.
    expect(completing()).toEqual([]);
  });

  it("re-marks what is missing when the selection drops back", () => {
    latticeNode("C₆").dispatchEvent(new MouseEvent("click"));
    expect(document.querySelectorAll(".lattice-node.selected")).toHaveLength(1);
    expect(completing().sort()).toEqual(["C₃", "C₆"]);
  });

  it("ignores clicks on the trivial subgroup and the whole group", () => {
    const before = document.querySelectorAll(".lattice-node.selected").length;
    latticeNode("C₁").dispatchEvent(new MouseEvent("click"));
    latticeNode("C₃ ⋊ C₄").dispatchEvent(new MouseEvent("click"));
    expect(document.querySelectorAll(".lattice-node.selected")).toHaveLength(before);
  });
});
