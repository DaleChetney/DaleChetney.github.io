import { el, mount, qs } from "@shared/dom";
import { formatPermutation, permutationOrbits } from "@shared/permutations";
import { C3_C4 } from "./data";
import { actionArrows, layoutOrbits } from "./layout";
import { generatorColour, renderDiagram } from "./render";

const group = C3_C4;
// The left panel will choose this; until it exists, show the minimal faithful one.
const representation = group.representations[0];
const diagram = layoutOrbits(permutationOrbits(representation.generators, representation.degree));

/** Indices into `representation.generators` whose arrows are drawn. */
const selected = new Set<number>([0]);

const stage = qs("#diagram");
const draw = (): void => {
  mount(stage, renderDiagram(diagram, actionArrows(diagram, representation.generators, selected)));
};

const generatorToggle = (index: number): HTMLElement => {
  const input = el("input", { type: "checkbox", checked: selected.has(index) });
  input.addEventListener("change", () => {
    if (input.checked) selected.add(index);
    else selected.delete(index);
    draw();
  });

  const swatch = el("span", { className: "swatch" });
  swatch.style.background = generatorColour(index);

  return el("label", { className: "generator" }, [
    input,
    swatch,
    el("code", {}, [formatPermutation(representation.generators[index])]),
  ]);
};

qs("#group-name").textContent = group.displayName;
qs("#group-label").textContent = `LMFDB ${group.label}`;
qs("#representation-title").textContent = representation.title;

mount(
  qs("#generators"),
  el(
    "div",
    { className: "generator-list" },
    representation.generators.map((_, index) => generatorToggle(index)),
  ),
);

draw();
