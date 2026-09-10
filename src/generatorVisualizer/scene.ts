import { equidistantColors } from "@shared/colors";
import {
  generatorElements,
  type GeneratorChoices,
} from "@shared/mathUtils/groups/generatorChoices";
import { findIsomorphism } from "@shared/mathUtils/groups/isomorphism";
import {
  permutationKey,
  permutationOrbits,
  type Permutation,
} from "@shared/mathUtils/groups/permutations";
import {
  computeSubgroupLattice,
  type SubgroupClass,
  type SubgroupLattice,
} from "@shared/mathUtils/groups/subgroupLattice";
import { generatesWholeGroup } from "@shared/mathUtils/groups/subgroups";
import type { CatalogueGroup, CatalogueRepresentation } from "./catalogue";
import type { Diagram } from "./components/diagram/permutationDiagram";
import { diagramWidthShare, layoutOrbits } from "./components/diagram/ringLayout";
import { layoutLattice, type LatticeDiagram } from "./components/lattice";

/** How many generators a subgroup section will offer. */
const ELEMENT_LIMIT = 12;

/** Lay the rings out to the share of the panel this many of them have earned. */
const layoutDiagram = (orbits: readonly (readonly number[])[], targetWidth: number): Diagram =>
  layoutOrbits(orbits, targetWidth * diagramWidthShare(orbits.length));

/**
 * One group in one representation, and what is currently chosen in it.
 *
 * The derivation is the expensive part — the subgroup lattice is computed from
 * the generators rather than read from the catalogue — so it happens once in the
 * constructor and then answers the questions the panels ask while this group and
 * representation are on screen. The selection lives here too, because a chosen
 * key means nothing except as an index into this scene's palette; carrying one
 * scene's choices into another is `carrySelectionTo`, not a shared variable.
 *
 * Nothing here touches the page. A scene says what is true and what is chosen;
 * drawing that is the panels' business, and a toggle reports no further than the
 * selection — main.ts is what decides a change means a redraw.
 */
export class Scene {
  readonly group: CatalogueGroup;
  readonly representation: CatalogueRepresentation;

  /**
   * Classes a generator can be chosen from: a cyclic subgroup is exactly one
   * with elements lying in no smaller subgroup, and the trivial one offers
   * nothing.
   */
  readonly selectableClasses: readonly number[];

  /**
   * Every choosable element, in a fixed order. A permutation generates exactly
   * one cyclic subgroup, so each appears once, and its position here orders the
   * selection for coloring — keeping that independent of click order. The
   * diagram draws one arrow set per entry, which is what an index into it means.
   */
  readonly palette: readonly Permutation[];

  /** This scene's subgroup lattice as a Hasse diagram, laid out. */
  readonly latticeDiagram: LatticeDiagram;

  #diagram: Diagram;
  /** Kept so the diagram can be laid out again when the window changes size. */
  readonly #orbits: number[][];
  readonly #lattice: SubgroupLattice;
  readonly #choices: ReadonlyMap<number, GeneratorChoices>;
  readonly #paletteRank: ReadonlyMap<string, number>;
  readonly #permutations: ReadonlyMap<string, Permutation>;
  readonly #classOfElement: ReadonlyMap<string, number>;

  /** Chosen element keys, per open class. A class with an empty set stays open. */
  #selection = new Map<number, Set<string>>();
  #colors = new Map<string, string>();

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
    this.#paletteRank = new Map(palette.map((permutation, i) => [permutationKey(permutation), i]));
    this.#permutations = new Map(palette.map((p) => [permutationKey(p), p]));
    this.#classOfElement = new Map(
      selectableClasses.flatMap((index) =>
        (choices.get(index)?.elements ?? []).map((choice): [string, number] => [
          permutationKey(choice.permutation),
          index,
        ]),
      ),
    );
  }

  // --- what the scene offers -------------------------------------------------

  /** Where the points of the permutation domain sit, and on what canvas. */
  get diagram(): Diagram {
    return this.#diagram;
  }

  classAt(classIndex: number): SubgroupClass {
    return this.#lattice.classes[classIndex];
  }

  choicesFor(classIndex: number): GeneratorChoices {
    return this.#choices.get(classIndex) ?? { elements: [], total: 0 };
  }

  /**
   * Lay the diagram out again for a stage of this width. The nodes keep their
   * size and the points spread, so this is a new layout rather than a scale.
   */
  relayout(targetWidth: number): void {
    this.#diagram = layoutDiagram(this.#orbits, targetWidth);
  }

  // --- what is chosen in it --------------------------------------------------

  /** Classes with a section open, in the order the lattice offers them. */
  openClasses(): number[] {
    return this.selectableClasses.filter((classIndex) => this.#selection.has(classIndex));
  }

  /** Palette entries currently being drawn, as indices into `palette`. */
  drawnGenerators(): Set<number> {
    return new Set([...this.#colors.keys()].map((key) => this.#rankOf(key)));
  }

  /** Whether this element is currently being drawn. */
  isDrawn(key: string): boolean {
    return this.#colors.has(key);
  }

  /** The color this element is drawn in, or null when it is not being drawn. */
  colorOf(key: string): string | null {
    return this.#colors.get(key) ?? null;
  }

  /** The color a palette entry's arrows take; an undrawn one inherits the text color. */
  generatorColor(generator: number): string {
    return this.colorOf(permutationKey(this.palette[generator])) ?? "currentColor";
  }

  /** Color of the first element chosen from a class, in the class's own order. */
  nodeColor(classIndex: number): string | null {
    const keys = this.#selection.get(classIndex);
    if (keys === undefined || keys.size === 0) return null;
    const first = this.choicesFor(classIndex)
      .elements.map((choice) => permutationKey(choice.permutation))
      .find((key) => keys.has(key));
    return first === undefined ? null : this.colorOf(first);
  }

  /**
   * The classes whose chosen elements together generate the whole group, or
   * nothing while they do not yet. An open class with nothing chosen from it
   * has contributed nothing, so it is not among them.
   */
  generatingClasses(): Set<number> {
    if (!this.#generatesGroup()) return new Set();
    return new Set(
      [...this.#selection].filter(([, keys]) => keys.size > 0).map(([classIndex]) => classIndex),
    );
  }

  /**
   * Classes offering an element that would complete the selection into a
   * generating set; empty once it is one. Existential over the class's
   * elements rather than just its first: which conjugate an element generates
   * decides what it adds, so an open class is still completing while another
   * of its conjugates would finish the job.
   */
  completingClasses(): Set<number> {
    const completing = new Set<number>();
    if (this.#generatesGroup()) return completing;
    const chosen = this.#chosenPermutations();
    const { degree } = this.representation;
    for (const classIndex of this.selectableClasses) {
      const completes = this.choicesFor(classIndex).elements.some((choice) =>
        generatesWholeGroup([...chosen, choice.permutation], degree, this.group.order),
      );
      if (completes) completing.add(classIndex);
    }
    return completing;
  }

  // --- choosing --------------------------------------------------------------

  /**
   * Open the scene. With a selection carried over from another representation it
   * adopts that; otherwise it opens one class so the diagram is never bare.
   */
  open(carried: Map<number, Set<string>> | null): void {
    if (carried !== null) {
      this.#selection = carried;
    } else {
      this.#selection = new Map();
      const last = this.selectableClasses[this.selectableClasses.length - 1];
      if (last !== undefined) this.#openClass(last);
    }
    this.#recolor();
  }

  /** Open or close a class. Opening one draws its first generator. */
  toggleClass(classIndex: number): void {
    if (this.#selection.has(classIndex)) this.#selection.delete(classIndex);
    else this.#openClass(classIndex);
    this.#recolor();
  }

  /** Draw or stop drawing one element of an already-open class. */
  toggleElement(key: string): void {
    const classIndex = this.#classOfElement.get(key);
    if (classIndex === undefined) return;
    const keys = this.#selection.get(classIndex);
    if (keys === undefined) return;
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    this.#recolor();
  }

  #openClass(classIndex: number): void {
    const first = this.choicesFor(classIndex).elements[0];
    this.#selection.set(
      classIndex,
      new Set(first === undefined ? [] : [permutationKey(first.permutation)]),
    );
  }

  /**
   * A color per drawn element, spread evenly over however many are drawn rather
   * than taken from a fixed list, so they stay as far apart as the count allows.
   *
   * Re-spread whenever the selection changes rather than when anything is drawn,
   * so that a panel asking what color an element is never depends on which
   * panel was drawn first.
   */
  #recolor(): void {
    const keys = this.#chosenKeys().sort((a, b) => this.#rankOf(a) - this.#rankOf(b));
    const scale = equidistantColors(keys.length);
    this.#colors = new Map(keys.map((key, index) => [key, scale[index]]));
  }

  #generatesGroup(): boolean {
    return generatesWholeGroup(
      this.#chosenPermutations(),
      this.representation.degree,
      this.group.order,
    );
  }

  #chosenKeys(): string[] {
    return [...this.#selection.values()].flatMap((keys) => [...keys]);
  }

  #chosenPermutations(): Permutation[] {
    return this.#chosenKeys().map((key) => this.#permutations.get(key) ?? []);
  }

  /** Where an element sits in the palette, which is the order colors follow. */
  #rankOf(key: string): number {
    return this.#paletteRank.get(key) ?? 0;
  }

  // --- moving between scenes -------------------------------------------------

  /**
   * This scene's selection, written in another representation of the same group,
   * or null when no isomorphism between the two could be found.
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
  carrySelectionTo(to: Scene): Map<number, Set<string>> | null {
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
      const mapped = isomorphism.get(permutationKey(subgroupClass.generator));
      if (mapped === undefined) return undefined;
      const key = permutationKey(mapped);
      return to.selectableClasses.find((index) => {
        const candidate = to.classAt(index);
        return (
          candidate.order === subgroupClass.order &&
          candidate.conjugates.some((conjugate) =>
            conjugate.elements.some((element) => permutationKey(element) === key),
          )
        );
      });
    };

    const carried = new Map<number, Set<string>>();
    for (const [classIndex, keys] of this.#selection) {
      const target = mappedClass(this.classAt(classIndex));
      if (target === undefined) continue;
      const elements = [...keys]
        .map((key) => isomorphism.get(key))
        .filter((permutation) => permutation !== undefined)
        .map(permutationKey)
        .filter((key) => to.#classOfElement.get(key) === target);
      carried.set(target, new Set(elements));
    }
    return carried;
  }
}
