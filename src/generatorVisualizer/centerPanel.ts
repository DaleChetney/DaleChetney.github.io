import { mount, preservingFocus, qs } from "@shared/dom";
import { actionArrows } from "./components/diagram/arrow";
import { renderPermutationDiagram } from "./components/diagram/permutationDiagram";
import { DEFAULT_TARGET_WIDTH } from "./components/diagram/ringLayout";
import { renderLattice } from "./components/lattice";
import { renderRepresentationRow } from "./components/representation-row";
import type { Scene } from "./scene";

/**
 * The width to lay a diagram out against: the stage is measured rather than
 * assumed, so the rings spread to the window the page is actually in. A stage
 * that has not been laid out yet reports zero, hence the fallback.
 */
export const stageWidth = (): number => qs("#diagram").clientWidth || DEFAULT_TARGET_WIDTH;

/** Lattice nodes are identified by the class they stand for, which outlives a redraw. */
const latticeFocus = (active: Element): string | null => {
  const node = active.closest(".lattice-node[data-class]")?.getAttribute("data-class");
  return node == null ? null : `.lattice-node[data-class="${node}"]`;
};

/** Diagram nodes likewise, by the point they stand for. */
const diagramFocus = (active: Element): string | null => {
  const node = active.closest(".diagram .node[data-point]")?.getAttribute("data-point");
  return node == null ? null : `.diagram .node[data-point="${node}"]`;
};

export interface CenterPanelHandlers {
  /** A subgroup class was opened or closed from the lattice. */
  onToggleClass: (classIndex: number) => void;
  /** A point of the diagram was clicked, to be swapped with another. */
  onPickPoint: (point: number) => void;
  /** Another representation of the same group was asked for. */
  onSelectRepresentation: (id: string) => void;
}

/**
 * The centre panel: the group's name, the representations on offer, the
 * permutation diagram, and the subgroup lattice beneath it.
 *
 * It holds no state. Everything it draws is a question asked of the scene at
 * draw time, so the two never disagree; what the reader does here is reported
 * back rather than acted on.
 */
export class CenterPanel {
  readonly #handlers: CenterPanelHandlers;

  constructor(handlers: CenterPanelHandlers) {
    this.#handlers = handlers;
  }

  show(scene: Scene): void {
    this.#showHeading(scene);
    this.#showDiagram(scene);
    this.#showLattice(scene);
  }

  #showHeading(scene: Scene): void {
    qs("#group-name").textContent = scene.group.displayName;
    const label = qs<HTMLAnchorElement>("#group-label");
    label.textContent = scene.group.label;
    label.href = `https://www.lmfdb.org/Groups/Abstract/${scene.group.label}`;

    mount(
      qs("#representation-row"),
      renderRepresentationRow(scene.group.representations, {
        selected: scene.representation.id,
        onSelect: this.#handlers.onSelectRepresentation,
      }),
    );
  }

  /**
   * One node per point, and an arrow `p -> g(p)` for each element being drawn.
   * A picked point, waiting to be swapped with the next one clicked, is marked.
   */
  #showDiagram(scene: Scene): void {
    const { diagram } = scene;
    preservingFocus(diagramFocus, () => {
      mount(
        qs("#diagram"),
        renderPermutationDiagram(
          diagram,
          actionArrows(diagram.points, scene.palette),
          (generator) => scene.generatorColor(generator),
          { picked: scene.picked, onPick: this.#handlers.onPickPoint },
        ),
      );
    });
  }

  /**
   * The Hasse diagram, with the open classes marked, the class the selection
   * generates so far outlined with the covers beneath it colored to match, the
   * classes that would complete the selection into a generating set outlined
   * dashed, and once it is one, the classes it was drawn from outlined instead.
   */
  #showLattice(scene: Scene): void {
    preservingFocus(latticeFocus, () => {
      mount(
        qs("#lattice"),
        renderLattice(scene.latticeDiagram, {
          selected: new Set(scene.openClasses()),
          completing: scene.completingClasses(),
          generating: scene.generatingClasses(),
          joinOfSelected: scene.joinOfSelected(),
          generated: scene.generatedClasses(),
          onToggle: this.#handlers.onToggleClass,
        }),
      );
    });
  }
}
