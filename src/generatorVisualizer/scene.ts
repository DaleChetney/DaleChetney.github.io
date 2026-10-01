import { equidistantColors } from "@shared/colors";
import { subgroupBoundedLattice, subgroupEq } from "@shared/mathUtils/groups/boundedLattice";
import { classPoset, type ClassPoset } from "@shared/mathUtils/groups/classPoset";
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
  conjugatesOf,
  identityKey,
  subgroupOf,
  type Subgroup,
} from "@shared/mathUtils/groups/subgroups";
import type { BoundedLattice } from "fp-ts/BoundedLattice";
import type { CatalogueGroup, CatalogueRepresentation, CatalogueSubgroupClass } from "./catalogue";
import { NODE_RADIUS, type PlacedPoint } from "./components/diagram/node";
import type { Diagram, PlacedRing } from "./components/diagram/permutationDiagram";
import type { DiagramPoint } from "./components/diagram/ringDrag";
import type { RingSplit } from "./components/diagram/ringControls";
import {
  diagramWidthShare,
  layoutOrbits,
  ringCounts,
  ringRates,
  stepRings,
} from "./components/diagram/ringLayout";
import { layoutLattice, type LatticeDiagram } from "./components/lattice";

/** How many generators a subgroup section will offer. */
const ELEMENT_LIMIT = 12;

/** Room left between one class's element ranks and the next's. */
const RANKS_PER_CLASS = 1000;

/** Lay the rings out to the share of the panel this many of them have earned. */
const layoutDiagram = (
  orbits: readonly (readonly number[])[],
  targetWidth: number,
  rings: readonly number[],
  turns: readonly (readonly number[])[],
): Diagram => layoutOrbits(orbits, targetWidth * diagramWidthShare(orbits.length), rings, turns);

/** A class's conjugate subgroups, and their identities for membership tests. */
interface ConjugacyClass {
  subgroups: readonly Subgroup[];
  keys: ReadonlySet<string>;
}

/**
 * One group in one representation, and what is currently chosen in it.
 *
 * The subgroup lattice is read from the catalogue, not computed: the classes,
 * their covers and one generating set per class in this representation. What
 * a class actually contains — its conjugate subgroups and the elements that
 * generate them — is computed the first time it is asked for, so opening a
 * class costs one conjugation orbit and nothing is paid for classes never
 * opened. The selection lives here too, because a chosen key means nothing
 * except as an element of this representation; carrying one scene's choices
 * into another is `carrySelectionTo`, not a shared variable.
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

  /** This scene's subgroup lattice as a Hasse diagram, laid out. */
  readonly latticeDiagram: LatticeDiagram;

  #diagram: Diagram;
  /** The stage width the diagram was last laid out against. */
  #targetWidth: number;
  /**
   * The slots the diagram is laid out from: one ring per orbit, a point per
   * slot. Starts as the orbits themselves and changes only when the reader
   * swaps two points, so laying out again for a new width keeps the
   * arrangement.
   */
  readonly #arrangement: number[][];
  /**
   * How many concentric rings each orbit is drawn as. A swap keeps every
   * orbit's size, so it never leaves a count that no longer divides.
   */
  readonly #rings: number[];
  /**
   * How far each ring of each orbit has turned, in whole turns, the outermost
   * ring first. Every ring has one, a single ring included, so any ring can be
   * turned on its own as well as by playing its orbit.
   */
  readonly #turns: number[][];
  /** The orbits whose rings are turning. */
  readonly #playing = new Set<number>();
  /** The orbits whose nodes have been unlocked, to be dragged anywhere. */
  readonly #unlocked = new Set<number>();
  /**
   * Where a node of an unlocked orbit has been dragged to, kept relative to
   * its orbit's centre so it moves with the orbit when the diagram is laid
   * out again. A node not yet dragged sits where its ring puts it.
   */
  readonly #freed = new Map<number, DiagramPoint>();
  /** The ring a drag has hold of, which playing passes by; null while none is held. */
  #held: PlacedRing | null = null;
  /** A point picked to be swapped, waiting on the second; null while none is. */
  #picked: number | null = null;
  readonly #classes: readonly CatalogueSubgroupClass[];
  readonly #poset: ClassPoset;
  readonly #lattice: BoundedLattice<Subgroup>;

  // Computed on demand, per class, and kept.
  readonly #conjugacyClasses = new Map<number, ConjugacyClass>();
  readonly #choices = new Map<number, GeneratorChoices>();
  /** Every element offered so far, by key; filled as classes are opened. */
  readonly #permutations = new Map<string, Permutation>();
  readonly #classOfElement = new Map<string, number>();
  /** Where an element sits in the color order: its class, then its position in it. */
  readonly #elementRank = new Map<string, number>();

  /** Chosen element keys, per open class. A class with an empty set stays open. */
  #selection = new Map<number, Set<string>>();
  #colors = new Map<string, string>();
  /** The join of the chosen elements' subgroups, recomputed when the selection changes. */
  #generated: Subgroup;

  constructor(group: CatalogueGroup, representation: CatalogueRepresentation, targetWidth: number) {
    const { generators, degree } = representation;
    const classes = group.subgroups.classes;
    const orbits = permutationOrbits(generators, degree);

    this.group = group;
    this.representation = representation;
    this.selectableClasses = classes.flatMap((c, index) =>
      c.cyclic && c.order > 1 ? [index] : [],
    );
    this.latticeDiagram = layoutLattice(classes, group.order, group.displayName);
    this.#rings = orbits.map(() => 1);
    this.#turns = orbits.map(() => [0]);
    this.#diagram = layoutDiagram(orbits, targetWidth, this.#rings, this.#turns);
    this.#targetWidth = targetWidth;
    this.#arrangement = orbits;
    this.#classes = classes;
    this.#poset = classPoset(classes.map((c) => c.covers));
    this.#lattice = subgroupBoundedLattice(subgroupOf(generators, degree), degree);
    this.#generated = this.#lattice.zero;
  }

  // --- what the scene offers -------------------------------------------------

  /** Where the points of the permutation domain sit, and on what canvas. */
  get diagram(): Diagram {
    return this.#diagram;
  }

  classAt(classIndex: number): CatalogueSubgroupClass {
    return this.#classes[classIndex];
  }

  /**
   * The generators a cyclic class offers, grouped by the conjugate each
   * generates. Computed the first time the class is asked about: the baked
   * generator closes into one representative, whose orbit under conjugation
   * by the group's generators is the rest of the class.
   */
  choicesFor(classIndex: number): GeneratorChoices {
    const known = this.#choices.get(classIndex);
    if (known !== undefined) return known;
    if (!this.selectableClasses.includes(classIndex)) return { elements: [], total: 0 };

    const choices = generatorElements(
      this.#classes[classIndex].order,
      this.#conjugacyClass(classIndex).subgroups,
      ELEMENT_LIMIT,
    );
    choices.elements.forEach((choice, position) => {
      const key = permutationKey(choice.permutation);
      this.#permutations.set(key, choice.permutation);
      this.#classOfElement.set(key, classIndex);
      this.#elementRank.set(key, classIndex * RANKS_PER_CLASS + position);
    });
    this.#choices.set(classIndex, choices);
    return choices;
  }

  /**
   * Lay the diagram out again for a stage of this width. The nodes keep their
   * size and the points spread, so this is a new layout rather than a scale.
   */
  relayout(targetWidth: number): void {
    this.#targetWidth = targetWidth;
    this.#diagram = this.#placeFreed(
      layoutDiagram(this.#arrangement, targetWidth, this.#rings, this.#turns),
    );
  }

  /**
   * Move every dragged node of an unlocked orbit to where it was dropped,
   * kept on the canvas: a diagram laid out narrower than when it was dropped
   * would otherwise leave it out of sight.
   */
  #placeFreed(diagram: Diagram): Diagram {
    if (this.#freed.size === 0) return diagram;
    const clamp = (value: number, size: number): number =>
      Math.min(Math.max(value, NODE_RADIUS), size - NODE_RADIUS);
    const points = diagram.points.map((placed): PlacedPoint => {
      const ring = diagram.rings.find((r) => r.points.includes(placed.point));
      const offset = this.#freed.get(placed.point);
      if (ring === undefined || offset === undefined || !this.#unlocked.has(ring.orbit)) {
        return placed;
      }
      return {
        point: placed.point,
        x: clamp(ring.cx + offset.x, diagram.width),
        y: clamp(ring.cy + offset.y, diagram.height),
      };
    });
    return { ...diagram, points };
  }

  /** Whether any orbit's rings are turning. */
  get turning(): boolean {
    return this.#playing.size > 0;
  }

  /**
   * Start an orbit's rings turning, or stop them. An unlocked orbit's nodes
   * are wherever they were dragged, so it has no rings to turn.
   */
  togglePlay(orbit: number): void {
    if (this.#playing.has(orbit)) this.#playing.delete(orbit);
    else if (!this.#unlocked.has(orbit)) this.#playing.add(orbit);
  }

  /** Whether an orbit's nodes are held to its rings, rather than free to be dragged anywhere. */
  isLocked(orbit: number): boolean {
    return !this.#unlocked.has(orbit);
  }

  /**
   * Unlock an orbit, so its nodes can be dragged anywhere, or lock it again.
   * Unlocking stops it turning. Locking sends every node back to where its
   * ring puts it unturned, as splitting the orbit afresh would.
   */
  toggleLock(orbit: number): void {
    if (this.#unlocked.has(orbit)) {
      this.#unlocked.delete(orbit);
      this.#resetOrbit(orbit);
    } else {
      this.#unlocked.add(orbit);
      this.#playing.delete(orbit);
    }
    this.relayout(this.#targetWidth);
  }

  /**
   * Put a node of an unlocked orbit at this place in the diagram. A node of a
   * locked orbit stays on its ring, and so does one not drawn.
   */
  movePoint(point: number, to: DiagramPoint): void {
    const ring = this.ringOf(point);
    if (ring === undefined || !this.#unlocked.has(ring.orbit)) return;
    this.#freed.set(point, { x: to.x - ring.cx, y: to.y - ring.cy });
    this.relayout(this.#targetWidth);
  }

  /** Where a point is drawn now, or nothing for a point not drawn. */
  pointAt(point: number): DiagramPoint | undefined {
    const placed = this.#diagram.points.find((p) => p.point === point);
    return placed === undefined ? undefined : { x: placed.x, y: placed.y };
  }

  /** Every ring of an orbit back to unturned, and every node of it back on its ring. */
  #resetOrbit(orbit: number): void {
    this.#turns[orbit] = Array.from({ length: this.#rings[orbit] }, () => 0);
    for (const point of this.#arrangement[orbit]) this.#freed.delete(point);
  }

  /**
   * Turn every orbit that is playing on by this many turns of its innermost
   * ring; each ring outside it turns a fixed share as far as the one inside it.
   * A ring held by a drag stays where the pointer has it.
   */
  turnBy(turns: number): void {
    for (const orbit of this.#playing) {
      const rates = ringRates(this.#rings[orbit]);
      this.#turns[orbit] = this.#turns[orbit].map((turned, ring) =>
        this.#isHeld(orbit, ring) ? turned : turned + turns * rates[ring],
      );
    }
    this.relayout(this.#targetWidth);
  }

  /**
   * Take hold of the ring a point is on, to be turned by a drag: playing its
   * orbit passes it by until it is let go, and then it carries on from where
   * it was left. Gives the ring, or nothing for a point not drawn.
   */
  grabRing(point: number): PlacedRing | undefined {
    this.#held = this.ringOf(point) ?? null;
    return this.#held ?? undefined;
  }

  /** Let go of the ring held by a drag. */
  letGoRing(): void {
    this.#held = null;
  }

  #isHeld(orbit: number, ring: number): boolean {
    return this.#held?.orbit === orbit && this.#held.ring === ring;
  }

  /** The ring a point is drawn on: which orbit, which ring of it, and its centre. */
  ringOf(point: number): PlacedRing | undefined {
    return this.#diagram.rings.find((placed) => placed.points.includes(point));
  }

  /**
   * Turn one ring of an orbit on by this many turns, clockwise, leaving the
   * orbit's other rings where they are.
   */
  turnRing(orbit: number, ring: number, turns: number): void {
    this.#turns[orbit][ring] += turns;
    this.relayout(this.#targetWidth);
  }

  /** How many orbits the diagram draws, split or not. */
  get orbitCount(): number {
    return this.#arrangement.length;
  }

  /** Every orbit, how it is split into concentric rings now, and how else it could be. */
  ringSplits(): RingSplit[] {
    return this.#arrangement.map((slots, orbit) => ({
      orbit,
      size: slots.length,
      rings: this.#rings[orbit],
      counts: ringCounts(slots.length),
      playing: this.#playing.has(orbit),
      locked: this.isLocked(orbit),
    }));
  }

  /**
   * Split an orbit into the next number of rings up or down that divides it.
   * The rings are new, so each starts from where it would lie unturned, and
   * any node dragged off them is put back on.
   */
  stepRings(orbit: number, step: 1 | -1): void {
    this.#rings[orbit] = stepRings(this.#arrangement[orbit].length, this.#rings[orbit], step);
    this.#resetOrbit(orbit);
    this.relayout(this.#targetWidth);
  }

  // --- rearranging it --------------------------------------------------------

  /** The point picked to be swapped, or null while none is. */
  get picked(): number | null {
    return this.#picked;
  }

  /**
   * A node was clicked. The first click picks a point; a second on the same
   * point lets it go; a second on another swaps the two points' slots, which
   * may lie on different rings — a slot is a position, not a membership. A
   * node dragged off its ring is a slot too, so the two trade those places.
   */
  pickPoint(point: number): void {
    if (this.#picked === null) {
      this.#picked = point;
      return;
    }
    const other = this.#picked;
    this.#picked = null;
    if (other === point) return;
    this.#swapSlots(other, point);
    this.relayout(this.#targetWidth);
  }

  #swapSlots(a: number, b: number): void {
    const slotOf = (point: number): [number, number] => {
      for (const [ring, slots] of this.#arrangement.entries()) {
        const slot = slots.indexOf(point);
        if (slot !== -1) return [ring, slot];
      }
      throw new Error(`point ${point} is not in the diagram`);
    };
    const [ringA, slotA] = slotOf(a);
    const [ringB, slotB] = slotOf(b);
    this.#arrangement[ringA][slotA] = b;
    this.#arrangement[ringB][slotB] = a;
    const [freedA, freedB] = [this.#freed.get(a), this.#freed.get(b)];
    this.#freed.delete(a);
    this.#freed.delete(b);
    if (freedA !== undefined) this.#freed.set(b, freedA);
    if (freedB !== undefined) this.#freed.set(a, freedB);
  }

  // --- what is chosen in it --------------------------------------------------

  /** Classes with a section open, in the order the lattice offers them. */
  openClasses(): number[] {
    return this.selectableClasses.filter((classIndex) => this.#selection.has(classIndex));
  }

  /**
   * The elements being drawn, in color order. The diagram draws one arrow set
   * per entry, which is what an index into it means.
   */
  get palette(): Permutation[] {
    // Colors are assigned in rank order, so the map's insertion order is it.
    return [...this.#colors.keys()].map((key) => this.#permutations.get(key) ?? []);
  }

  /** Whether this element is currently being drawn. */
  isDrawn(key: string): boolean {
    return this.#colors.has(key);
  }

  /** The color this element is drawn in, or null when it is not being drawn. */
  colorOf(key: string): string | null {
    return this.#colors.get(key) ?? null;
  }

  /** The color a palette entry's arrows take. */
  generatorColor(generator: number): string {
    return this.colorOf(permutationKey(this.palette[generator])) ?? "currentColor";
  }

  /**
   * The classes whose chosen elements together generate the whole group, or
   * nothing while they do not yet. An open class with nothing chosen from it
   * has contributed nothing, so it is not among them.
   */
  generatingClasses(): Set<number> {
    if (!this.#isWhole(this.#generated)) return new Set();
    return new Set(
      [...this.#selection].filter(([, keys]) => keys.size > 0).map(([classIndex]) => classIndex),
    );
  }

  /**
   * The class of the join of the chosen elements' subgroups, which is what
   * the selection generates so far; null while nothing is chosen. The trivial
   * subgroup is what nothing generates, but marking it would suggest a
   * selection where there is none.
   */
  joinOfSelected(): number | null {
    if (this.#chosenKeys().length === 0) return null;
    return this.#classOf(this.#generated);
  }

  /**
   * The sublattice generated so far: every class with a conjugate inside the
   * join of the selected subgroups, which is the down-set of the join's class,
   * the class itself included. Empty while nothing is chosen; everything once
   * the group is generated.
   */
  generatedClasses(): ReadonlySet<number> {
    const join = this.joinOfSelected();
    return join === null ? new Set() : this.#poset.downSet(join);
  }

  /**
   * Classes offering an element that would complete the selection into a
   * generating set; empty once it is one. Existential over the class's
   * conjugates rather than just its representative: which conjugate an
   * element generates decides what it adds, so an open class is still
   * completing while another of its conjugates would finish the job. Only one
   * element per conjugate needs trying, since what a generator adds depends
   * only on the subgroup it generates.
   */
  completingClasses(): Set<number> {
    const completing = new Set<number>();
    if (this.#isWhole(this.#generated)) return completing;
    for (const classIndex of this.selectableClasses) {
      const completes = this.#conjugacyClass(classIndex).subgroups.some((conjugate) =>
        this.#isWhole(this.#lattice.join(this.#generated, conjugate)),
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
    this.#selectionChanged();
  }

  /** Open or close a class. Opening one draws its first generator. */
  toggleClass(classIndex: number): void {
    if (this.#selection.has(classIndex)) this.#selection.delete(classIndex);
    else this.#openClass(classIndex);
    this.#selectionChanged();
  }

  /** Draw or stop drawing one element of an already-open class. */
  toggleElement(key: string): void {
    const classIndex = this.#classOfElement.get(key);
    if (classIndex === undefined) return;
    const keys = this.#selection.get(classIndex);
    if (keys === undefined) return;
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    this.#selectionChanged();
  }

  #openClass(classIndex: number): void {
    const first = this.choicesFor(classIndex).elements[0];
    this.#selection.set(
      classIndex,
      new Set(first === undefined ? [] : [permutationKey(first.permutation)]),
    );
  }

  /**
   * Recompute what follows from the selection: the subgroup it generates, and
   * a color per drawn element, spread evenly over however many are drawn
   * rather than taken from a fixed list, so they stay as far apart as the
   * count allows. Done here rather than when anything is drawn, so that a
   * panel asking what color an element is never depends on which panel was
   * drawn first.
   */
  #selectionChanged(): void {
    const keys = this.#chosenKeys().sort((a, b) => this.#rankOf(a) - this.#rankOf(b));
    const scale = equidistantColors(keys.length);
    this.#colors = new Map(keys.map((key, index) => [key, scale[index]]));
    // The join over the chosen elements' cyclic subgroups, from the bottom up.
    this.#generated = keys
      .map((key) => subgroupOf([this.#permutations.get(key) ?? []], this.representation.degree))
      .reduce((joined, cyclic) => this.#lattice.join(joined, cyclic), this.#lattice.zero);
  }

  #isWhole(subgroup: Subgroup): boolean {
    return subgroupEq.equals(subgroup, this.#lattice.one);
  }

  /** The class a concrete subgroup belongs to, looked for among the classes of its order. */
  #classOf(subgroup: Subgroup): number {
    const key = identityKey(subgroup);
    const found = this.#classes.findIndex(
      (c, index) =>
        c.order === subgroup.elements.length && this.#conjugacyClass(index).keys.has(key),
    );
    if (found === -1) {
      throw new Error(
        `${this.group.label} ${this.representation.id}: no class holds a subgroup of order ${String(subgroup.elements.length)}`,
      );
    }
    return found;
  }

  #conjugacyClass(classIndex: number): ConjugacyClass {
    const known = this.#conjugacyClasses.get(classIndex);
    if (known !== undefined) return known;
    const { generators, degree } = this.representation;
    const representative = subgroupOf(this.representation.classGenerators[classIndex], degree);
    const subgroups = conjugatesOf(representative, generators);
    const conjugacyClass = { subgroups, keys: new Set(subgroups.map(identityKey)) };
    this.#conjugacyClasses.set(classIndex, conjugacyClass);
    return conjugacyClass;
  }

  #chosenKeys(): string[] {
    return [...this.#selection.values()].flatMap((keys) => [...keys]);
  }

  /** Where an element sits in the palette, which is the order colors follow. */
  #rankOf(key: string): number {
    return this.#elementRank.get(key) ?? 0;
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
     * The class in `to` holding the image of this class's baked generator. A
     * cyclic subgroup is pinned down by any one of its generators, so following
     * that one element is enough to find the class again on the other side.
     */
    const mappedClass = (classIndex: number): number | undefined => {
      const [generator] = this.representation.classGenerators[classIndex];
      if (generator === undefined) return undefined;
      const mapped = isomorphism.get(permutationKey(generator));
      if (mapped === undefined) return undefined;
      const image = identityKey(subgroupOf([mapped], to.representation.degree));
      const order = this.#classes[classIndex].order;
      return to.selectableClasses.find(
        (index) => to.classAt(index).order === order && to.#conjugacyClass(index).keys.has(image),
      );
    };

    const carried = new Map<number, Set<string>>();
    for (const [classIndex, keys] of this.#selection) {
      const target = mappedClass(classIndex);
      if (target === undefined) continue;
      // Opening the class on the other side is what registers its elements.
      to.choicesFor(target);
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
