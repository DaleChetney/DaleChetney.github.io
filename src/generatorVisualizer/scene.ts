import { equidistantColours } from "@shared/colours";
import { mount, preservingFocus, qs } from "@shared/dom";
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
import { actionArrows } from "./components/diagram/arrow";
import { renderPermutationDiagram, type Diagram } from "./components/diagram/permutationDiagram";
import {
  DEFAULT_TARGET_WIDTH,
  diagramWidthShare,
  layoutOrbits,
} from "./components/diagram/ringLayout";
import { layoutLattice, renderLattice, type LatticeDiagram } from "./components/lattice";
import { renderRepresentationRow } from "./components/representation-row";

/** How many generators a subgroup section will offer. */
const ELEMENT_LIMIT = 12;

/**
 * The width to lay the diagram out against: the stage is measured rather than
 * assumed, so the rings spread to the window the page is actually in.
 */
export const stageWidth = (): number => qs("#diagram").clientWidth || DEFAULT_TARGET_WIDTH;

/** Lay the rings out to the share of the panel this many of them have earned. */
const layoutDiagram = (orbits: readonly (readonly number[])[], targetWidth: number): Diagram =>
  layoutOrbits(orbits, targetWidth * diagramWidthShare(orbits.length));

/** What a scene tells the rest of the page when the reader alters its selection. */
export type SceneListener = () => void;

/**
 * One group in one representation: what it implies, what is chosen in it, and
 * the centre panel that draws both.
 *
 * The derivation is the expensive part — the subgroup lattice is computed from
 * the generators rather than read from the catalogue — so it happens once in the
 * constructor and then answers the questions the page asks while this group and
 * representation are on screen. The selection lives here too, because a chosen
 * key means nothing except as an index into this scene's palette; carrying one
 * scene's choices into another is `carrySelectionTo`, not a shared variable.
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

  #diagram: Diagram;
  readonly #latticeDiagram: LatticeDiagram;
  /**
   * Every choosable element, in a fixed order. A permutation generates exactly
   * one cyclic subgroup, so each appears once, and its position here orders the
   * selection for colouring — keeping that independent of click order.
   */
  readonly #palette: readonly Permutation[];
  /** Kept so the diagram can be laid out again when the window changes size. */
  readonly #orbits: number[][];
  readonly #lattice: SubgroupLattice;
  readonly #choices: ReadonlyMap<number, GeneratorChoices>;
  readonly #paletteRank: ReadonlyMap<string, number>;
  readonly #permutations: ReadonlyMap<string, Permutation>;
  readonly #classOfElement: ReadonlyMap<string, number>;

  /** Chosen element keys, per open class. A class with an empty set stays open. */
  #selection = new Map<number, Set<string>>();
  #colours = new Map<string, string>();
  #onChange: SceneListener = () => {};

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
    this.#palette = palette;
    this.#latticeDiagram = layoutLattice(lattice, group.order, group.displayName);
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

  classAt(classIndex: number): SubgroupClass {
    return this.#lattice.classes[classIndex];
  }

  choicesFor(classIndex: number): GeneratorChoices {
    return this.#choices.get(classIndex) ?? { elements: [], total: 0 };
  }

  // --- what is chosen in it --------------------------------------------------

  /** Classes with a section open, in the order the lattice offers them. */
  openClasses(): number[] {
    return this.selectableClasses.filter((classIndex) => this.#selection.has(classIndex));
  }

  /** Whether this element is currently being drawn. */
  isDrawn(key: string): boolean {
    return this.#colours.has(key);
  }

  /** The colour this element is drawn in, or null when it is not being drawn. */
  colourOf(key: string): string | null {
    return this.#colours.get(key) ?? null;
  }

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
    this.#colours = this.#spreadColours();
  }

  /** Open or close a class. Opening one draws its first generator. */
  toggleClass(classIndex: number): void {
    if (this.#selection.has(classIndex)) this.#selection.delete(classIndex);
    else this.#openClass(classIndex);
    this.#changed();
  }

  /** Draw or stop drawing one element of an already-open class. */
  toggleElement(key: string): void {
    const classIndex = this.#classOfElement.get(key);
    if (classIndex === undefined) return;
    const keys = this.#selection.get(classIndex);
    if (keys === undefined) return;
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    this.#changed();
  }

  #openClass(classIndex: number): void {
    const first = this.choicesFor(classIndex).elements[0];
    this.#selection.set(
      classIndex,
      new Set(first === undefined ? [] : [permutationKey(first.permutation)]),
    );
  }

  /**
   * Re-spread the colours, then tell the page. Colours follow the selection
   * rather than the drawing, so a panel can ask what colour an element is
   * without depending on which panel was drawn first.
   */
  #changed(): void {
    this.#colours = this.#spreadColours();
    this.#onChange();
  }

  // --- drawing it ------------------------------------------------------------

  /**
   * Lay the diagram out again for a stage of this width. The nodes keep their
   * size and the points spread, so this is a new layout rather than a scale.
   */
  relayout(targetWidth: number): void {
    this.#diagram = layoutDiagram(this.#orbits, targetWidth);
  }

  /**
   * Draw the centre panel: the group's name, the representations on offer, the
   * permutation diagram and the subgroup lattice.
   *
   * `onChange` is called whenever the reader alters the selection from here, and
   * is remembered for the toggles the drawn controls carry.
   */
  show(onChange: SceneListener, onSelectRepresentation: (id: string) => void): void {
    this.#onChange = onChange;

    qs("#group-name").textContent = this.group.displayName;
    const label = qs<HTMLAnchorElement>("#group-label");
    label.textContent = this.group.label;
    label.href = `https://www.lmfdb.org/Groups/Abstract/${this.group.label}`;

    mount(
      qs("#representation-row"),
      renderRepresentationRow(this.group.representations, {
        selected: this.representation.id,
        onSelect: onSelectRepresentation,
      }),
    );

    const drawn = new Set([...this.#colours.keys()].map((key) => this.#rankOf(key)));
    mount(
      qs("#diagram"),
      renderPermutationDiagram(
        this.#diagram,
        actionArrows(this.#diagram.points, this.#palette, drawn),
        (generator) => this.colourOf(permutationKey(this.#palette[generator])) ?? "currentColor",
      ),
    );

    preservingFocus(latticeFocus, () => {
      mount(
        qs("#lattice"),
        renderLattice(
          this.#latticeDiagram,
          {
            selected: new Set(this.#selection.keys()),
            completing: this.#completingClasses(),
            onToggle: (classIndex) => {
              this.toggleClass(classIndex);
            },
          },
          (classIndex) => this.#nodeColour(classIndex),
        ),
      );
    });
  }

  /**
   * A colour per drawn element, spread evenly over however many are drawn rather
   * than taken from a fixed list, so they stay as far apart as the count allows.
   */
  #spreadColours(): Map<string, string> {
    const keys = [...this.#selection.values()]
      .flatMap((keys) => [...keys])
      .sort((a, b) => this.#rankOf(a) - this.#rankOf(b));
    const scale = equidistantColours(keys.length);
    return new Map(keys.map((key, index) => [key, scale[index]]));
  }

  /** Colour of the first element chosen from a class, in the class's own order. */
  #nodeColour(classIndex: number): string | null {
    const keys = this.#selection.get(classIndex);
    if (keys === undefined || keys.size === 0) return null;
    const first = this.choicesFor(classIndex)
      .elements.map((choice) => permutationKey(choice.permutation))
      .find((key) => keys.has(key));
    return first === undefined ? null : this.colourOf(first);
  }

  /** Where an element sits in the palette, which is the order colours follow. */
  #rankOf(key: string): number {
    return this.#paletteRank.get(key) ?? 0;
  }

  #chosenPermutations(): Permutation[] {
    return [...this.#selection.values()]
      .flatMap((keys) => [...keys])
      .map((key) => this.#permutations.get(key) ?? []);
  }

  /**
   * Classes offering an element that would complete the selection into a
   * generating set. Existential over the class's elements rather than just its
   * first: which conjugate an element generates decides what it adds.
   */
  #completingClasses(): Set<number> {
    const completing = new Set<number>();
    const chosen = this.#chosenPermutations();
    const { degree } = this.representation;
    if (generatesWholeGroup(chosen, degree, this.group.order)) return completing;
    for (const classIndex of this.selectableClasses) {
      if (this.#selection.has(classIndex)) continue;
      const completes = this.choicesFor(classIndex).elements.some((choice) =>
        generatesWholeGroup([...chosen, choice.permutation], degree, this.group.order),
      );
      if (completes) completing.add(classIndex);
    }
    return completing;
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

/** Lattice nodes are identified by the class they stand for, which outlives a redraw. */
const latticeFocus = (active: Element): string | null => {
  const node = active.closest(".lattice-node[data-class]")?.getAttribute("data-class");
  return node == null ? null : `.lattice-node[data-class="${node}"]`;
};
