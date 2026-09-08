import { mount, qs } from "@shared/dom";
import { permutationOrbits, type Permutation } from "@shared/permutations";
import { computeSubgroupLattice, generatesWholeGroup } from "@shared/subgroups";
import { C3_C4 } from "./data";
import { actionArrows, layoutOrbits } from "./layout";
import { layoutLattice, renderLattice } from "./lattice";
import { renderDiagram } from "./render";

const group = C3_C4;
// The left panel will choose this; until it exists, show the minimal faithful one.
const representation = group.representations[0];
const degree = representation.degree;
const diagram = layoutOrbits(permutationOrbits(representation.generators, degree));

const lattice = computeSubgroupLattice(representation.generators, degree);
const latticeDiagram = layoutLattice(lattice, group.order, group.displayName);

/**
 * Generators are chosen by clicking cyclic subgroups: a cyclic subgroup is
 * exactly one that has elements lying in no smaller subgroup, so its generator
 * is what a generating set would draw on. The trivial subgroup offers nothing.
 */
const selectableClasses = lattice.classes
  .map((subgroupClass, index) => ({ subgroupClass, index }))
  .filter(({ subgroupClass }) => subgroupClass.cyclic && subgroupClass.order > 1)
  .map(({ index }) => index);

/** Position in the generator palette, which fixes each class's arrow colour. */
const generatorIndex = (classIndex: number): number => selectableClasses.indexOf(classIndex);

const generators: Permutation[] = selectableClasses.map(
  (classIndex) => lattice.classes[classIndex].generator ?? [],
);

const generatorFor = (classIndex: number): Permutation =>
  lattice.classes[classIndex].generator ?? [];

/** Class indices whose generators are currently drawn. */
const selected = new Set<number>([selectableClasses[selectableClasses.length - 1]]);

/**
 * Classes that would turn the current selection into a generating set: those
 * whose join with everything already chosen is the whole group. Once the
 * selection generates the group, nothing is outstanding and none are marked.
 */
const completingClasses = (): Set<number> => {
  const chosen = [...selected].map(generatorFor);
  const completing = new Set<number>();
  if (generatesWholeGroup(chosen, degree, group.order)) return completing;
  for (const classIndex of selectableClasses) {
    if (selected.has(classIndex)) continue;
    if (generatesWholeGroup([...chosen, generatorFor(classIndex)], degree, group.order)) {
      completing.add(classIndex);
    }
  }
  return completing;
};

const stage = qs("#diagram");
const latticeHost = qs("#lattice");

const draw = (): void => {
  const drawn = new Set([...selected].map(generatorIndex));
  mount(stage, renderDiagram(diagram, actionArrows(diagram, generators, drawn)));
  mount(
    latticeHost,
    renderLattice(
      latticeDiagram,
      { selected, completing: completingClasses(), onToggle: toggle },
      generatorIndex,
    ),
  );
};

const toggle = (classIndex: number): void => {
  if (selected.has(classIndex)) selected.delete(classIndex);
  else selected.add(classIndex);
  draw();
};

qs("#group-name").textContent = group.displayName;
qs("#group-label").textContent = `LMFDB ${group.label}`;
qs("#representation-title").textContent = representation.title;

draw();
