import { findIsomorphism } from "@shared/mathUtils/groups/isomorphism";
import { permutationOrbits, type Permutation } from "@shared/mathUtils/groups/permutations";
import {
  generatorElements,
  type GeneratorChoices,
} from "@shared/mathUtils/groups/generatorChoices";
import {
  computeSubgroupLattice,
  type SubgroupClass,
  type SubgroupLattice,
} from "@shared/mathUtils/groups/subgroupLattice";
import { generatesWholeGroup } from "@shared/mathUtils/groups/subgroups";
import type { CatalogueGroup, CatalogueRepresentation } from "./catalogue";
import type { Diagram } from "./components/diagram/permutationDiagram";
import { diagramWidthShare, layoutOrbits } from "./components/diagram/ringLayout";
import { elementKey } from "./components/elements-panel";
import { layoutLattice, type LatticeDiagram } from "./components/lattice";

/** How many generators a subgroup section will offer. */
const ELEMENT_LIMIT = 12;

/**
 * Chosen element keys, per selected subgroup class. A class present with an
 * empty set is open but contributes nothing to the drawing.
 */
export type GeneratorSelection = ReadonlyMap<number, ReadonlySet<string>>;

/** Lay the rings out to the share of the panel this many of them have earned. */
const layoutDiagram = (orbits: readonly (readonly number[])[], targetWidth: number): Diagram =>
  layoutOrbits(orbits, targetWidth * diagramWidthShare(orbits.length));

/**
 * Everything derived from one group in one representation.
 *
 * The derivation is the expensive part — the subgroup lattice is computed from
 * the generators rather than read from the catalogue — so it happens once per
 * group and representation, and the result answers the questions the page asks
 * while that pair is on screen. Which elements exist, which of them generate
 * what, and where they are drawn all follow from the pair and from nothing else.
 * What the reader has actually chosen does not live here: a selection is passed
 * in to the queries that need one, so switching representation can carry one
 * scene's selection into another.
 */
export class Scene {
  readonly group: CatalogueGroup;
  readonly representation: CatalogueRepresentation;
  readonly latticeDiagram: LatticeDiagram;

  /**
   * Classes a generator can be chosen from: a cyclic subgroup is exactly one
   * with elements lying in no smaller subgroup, and the trivial one offers
   * nothing.
   */
  readonly selectableClasses: readonly number[];

  /**
   * Every choosable element, in a fixed order. A permutation generates exactly
   * one cyclic subgroup, so each appears once, and its position here orders the
   * selection for colouring — keeping that independent of click order.
   */
  readonly palette: readonly Permutation[];

  #diagram: Diagram;
  /** Kept so the diagram can be laid out again when the window changes size. */
  readonly #orbits: number[][];
  readonly #lattice: SubgroupLattice;
  readonly #choices: ReadonlyMap<number, GeneratorChoices>;
  readonly #paletteRank: ReadonlyMap<string, number>;
  readonly #permutations: ReadonlyMap<string, Permutation>;
  readonly #classOfElement: ReadonlyMap<string, number>;

  constructor(group: CatalogueGroup, representation: CatalogueRepresentation, targetWidth: number) {
    const { generators, degree } = representation;
    const lattice = computeSubgroupLattice(generators, degree);
    const selectableClasses = lattice.classes
      .map((subgroupClass, index) => ({ subgroupClass, index }))
      .filter(({ subgroupClass }) => subgroupClass.cyclic && subgroupClass.order > 1)
      .map(({ index }) => index);
    const choices = new Map(
      selectableClasses.map((index) => [
        index,
        generatorElements(lattice.classes[index], ELEMENT_LIMIT),
      ]),
    );
    const palette = selectableClasses.flatMap(
      (index) => choices.get(index)?.elements.map((choice) => choice.permutation) ?? [],
    );
    const orbits = permutationOrbits(generators, degree);

    this.group = group;
    this.representation = representation;
    this.selectableClasses = selectableClasses;
    this.palette = palette;
    this.latticeDiagram = layoutLattice(lattice, group.order, group.displayName);
    this.#diagram = layoutDiagram(orbits, targetWidth);
    this.#orbits = orbits;
    this.#lattice = lattice;
    this.#choices = choices;
    this.#paletteRank = new Map(palette.map((permutation, i) => [elementKey(permutation), i]));
    this.#permutations = new Map(palette.map((p) => [elementKey(p), p]));
    this.#classOfElement = new Map(
      selectableClasses.flatMap((index) =>
        (choices.get(index)?.elements ?? []).map((choice): [string, number] => [
          elementKey(choice.permutation),
          index,
        ]),
      ),
    );
  }

  get diagram(): Diagram {
    return this.#diagram;
  }

  /**
   * Lay the diagram out again for a panel of this width. The nodes keep their
   * size and the points spread, so this is a new layout rather than a scale.
   */
  relayout(targetWidth: number): void {
    this.#diagram = layoutDiagram(this.#orbits, targetWidth);
  }

  classAt(classIndex: number): SubgroupClass {
    return this.#lattice.classes[classIndex];
  }

  choicesFor(classIndex: number): GeneratorChoices {
    return this.#choices.get(classIndex) ?? { elements: [], total: 0 };
  }

  /** The class an element was offered from, or undefined if it was not. */
  classOf(key: string): number | undefined {
    return this.#classOfElement.get(key);
  }

  /** Where an element sits in the palette, which is the order colours follow. */
  rankOf(key: string): number {
    return this.#paletteRank.get(key) ?? 0;
  }

  permutationsOf(keys: Iterable<string>): Permutation[] {
    return [...keys].map((key) => this.#permutations.get(key) ?? []);
  }

  /**
   * Classes offering an element that would complete `selection` into a
   * generating set. Existential over the class's elements rather than just its
   * first: which conjugate an element generates decides what it adds.
   */
  completingClasses(selection: GeneratorSelection): Set<number> {
    const completing = new Set<number>();
    const chosen = this.permutationsOf([...selection.values()].flatMap((keys) => [...keys]));
    const { degree } = this.representation;
    if (generatesWholeGroup(chosen, degree, this.group.order)) return completing;
    for (const classIndex of this.selectableClasses) {
      if (selection.has(classIndex)) continue;
      const completes = this.choicesFor(classIndex).elements.some((choice) =>
        generatesWholeGroup([...chosen, choice.permutation], degree, this.group.order),
      );
      if (completes) completing.add(classIndex);
    }
    return completing;
  }

  /**
   * `selection`, written in another representation of the same group, or null
   * when no isomorphism between the two could be found.
   *
   * The two representations share no correspondence between their generators, so
   * the elements have to be carried across an isomorphism computed for the
   * purpose. Which isomorphism is not canonical — any two differ by an
   * automorphism — but every one of them preserves what the selection is for:
   * subgroups keep their order, and a set that generated the group still does.
   *
   * An element outside the target class's offered generators is dropped, leaving
   * its section open and empty, the same as clearing it by hand.
   */
  carrySelectionTo(to: Scene, selection: GeneratorSelection): Map<number, Set<string>> | null {
    const isomorphism = findIsomorphism(
      this.representation.generators,
      this.representation.degree,
      to.representation.generators,
      to.representation.degree,
    );
    if (isomorphism === null) return null;

    /**
     * The class in `to` holding the image of this class's generator. A cyclic
     * subgroup is pinned down by any one of its generators, so following that
     * one element is enough to find the class again on the other side.
     */
    const mappedClass = (subgroupClass: SubgroupClass): number | undefined => {
      if (subgroupClass.generator === null) return undefined;
      const mapped = isomorphism.get(elementKey(subgroupClass.generator));
      if (mapped === undefined) return undefined;
      const key = elementKey(mapped);
      return to.selectableClasses.find((index) => {
        const candidate = to.classAt(index);
        return (
          candidate.order === subgroupClass.order &&
          candidate.conjugates.some((conjugate) =>
            conjugate.elements.some((element) => elementKey(element) === key),
          )
        );
      });
    };

    const carried = new Map<number, Set<string>>();
    for (const [classIndex, keys] of selection) {
      const target = mappedClass(this.classAt(classIndex));
      if (target === undefined) continue;
      const elements = [...keys]
        .map((key) => isomorphism.get(key))
        .filter((permutation) => permutation !== undefined)
        .map(elementKey)
        .filter((key) => to.classOf(key) === target);
      carried.set(target, new Set(elements));
    }
    return carried;
  }
}
