// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const KEY = "generatorVisualizer.lastView";

/** Whether the page is on a narrow screen; jsdom has no matchMedia, so the tests decide. */
let narrow = false;

const html = readFileSync(resolve(import.meta.dirname, "index.html"), "utf8");

beforeAll(() => {
  const catalogue: unknown = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../../public/groups.json"), "utf8"),
  );
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: narrow, media: query }));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(catalogue) })),
  );
});

beforeEach(() => {
  localStorage.clear();
  narrow = false;
});

/** Open the page afresh, as a reload would, over whatever is stored. */
const load = async (): Promise<void> => {
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  vi.resetModules();
  await import("./main");
};

const nodeCount = (): number => document.querySelectorAll("#diagram .node").length;
const groupLabel = (): string => document.querySelector("#group-label")?.textContent ?? "";
const sectionLabels = (): string[] =>
  Array.from(document.querySelectorAll(".element-section h3"), (h3) => h3.firstChild?.textContent)
    .map((label) => label ?? "")
    .sort();
const checked = (): boolean[] =>
  Array.from(document.querySelectorAll<HTMLInputElement>(".element input"), (box) => box.checked);
const latticeNode = (label: string): SVGGElement => {
  const found = Array.from(document.querySelectorAll<SVGGElement>(".lattice-node")).find(
    (node) => node.querySelector("text")?.textContent === label,
  );
  if (found === undefined) throw new Error(`no lattice node labelled ${label}`);
  return found;
};

describe("starting the page", () => {
  it("opens C_3:C_4 on twelve points with two C_4 generators on a first visit", async () => {
    await load();
    expect(groupLabel()).toContain("12.1");
    expect(nodeCount()).toBe(12);
    expect(sectionLabels()).toEqual(["₃C₄"]);
    expect(checked().filter(Boolean)).toHaveLength(2);
    // Two C_4s from different conjugates generate the whole group.
    expect(document.querySelectorAll(".lattice-node.generating")).toHaveLength(1);
  });

  it("starts with both side panels collapsed on a narrow screen", async () => {
    const collapsed = (): boolean[] =>
      ["#panel-left", "#panel-right"].map(
        (id) => document.querySelector(id)?.classList.contains("collapsed") ?? false,
      );
    await load();
    expect(collapsed()).toEqual([false, false]);
    narrow = true;
    await load();
    expect(collapsed()).toEqual([true, true]);
  });

  it("opens on the group, representation and selection last looked at", async () => {
    await load();
    latticeNode("C₆").dispatchEvent(new MouseEvent("click"));
    document.querySelectorAll<HTMLInputElement>(".element input")[1]?.click();
    document.querySelector<HTMLElement>('[data-representation="perm-7"]')?.click();
    const before = { nodes: nodeCount(), sections: sectionLabels(), checked: checked() };
    expect(before.nodes).toBe(7);

    await load();
    expect({ nodes: nodeCount(), sections: sectionLabels(), checked: checked() }).toEqual(before);
  });

  it("opens on another group once it has been chosen", async () => {
    await load();
    document.querySelector<HTMLElement>('.group-row[data-label="6.1"]')?.click();
    await load();
    expect(groupLabel()).toContain("6.1");
  });

  it("opens as on a first visit when the stored group is not in the catalogue", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ group: "999.9", representation: "perm-7", selection: [] }),
    );
    await load();
    expect(groupLabel()).toContain("12.1");
    expect(nodeCount()).toBe(12);
  });

  it("opens as on a first visit when what is stored is not a view", async () => {
    localStorage.setItem(KEY, "{not json");
    await load();
    expect(nodeCount()).toBe(12);
    expect(sectionLabels()).toEqual(["₃C₄"]);
  });

  it("drops a stored element its class no longer offers, keeping the class open", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ group: "12.1", representation: "12T5", selection: [[4, ["stale"]]] }),
    );
    await load();
    expect(sectionLabels()).toEqual(["C₆"]);
    expect(checked().filter(Boolean)).toHaveLength(0);
  });
});
