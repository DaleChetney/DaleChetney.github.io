import { mount, preservingFocus, qs } from "@shared/dom";
import { actionArrows } from "./components/diagram/arrow";
import { moveDiagram, renderPermutationDiagram } from "./components/diagram/permutationDiagram";
import { renderRingControls } from "./components/diagram/ringControls";
import { toDiagram, type DiagramPoint } from "./components/diagram/ringDrag";
import { DEFAULT_TARGET_WIDTH } from "./components/diagram/ringLayout";
import { renderLattice } from "./components/lattice";
import { renderRepresentationRow } from "./components/representation-row";
import type { Scene, Stage } from "./scene";
import type { Settings } from "./settings";

/**
 * A screen this narrow is a phone's: the diagram fills the panel, and the
 * stylesheet's rule under the same query stacks and trims what is below it.
 */
export const NARROW_SCREEN = "(max-width: 700px)";

/**
 * What to lay a diagram out against: the stage is measured rather than
 * assumed, so the rings spread to the window the page is actually in, and on a
 * narrow screen they fill it. A stage that has not been laid out yet reports
 * zero width, hence the fallback.
 */
export const stage = (): Stage => ({
  width: qs("#diagram").clientWidth || DEFAULT_TARGET_WIDTH,
  fill: window.matchMedia(NARROW_SCREEN).matches,
});

/**
 * Where a pointer at these client coordinates sits in the drawn diagram's own
 * coordinates, or null while there is no diagram on screen to measure.
 */
export const diagramPointAt = (clientX: number, clientY: number): DiagramPoint | null => {
  const drawn = document.querySelector<SVGSVGElement>("#diagram svg");
  return drawn === null ? null : toDiagram(drawn, clientX, clientY);
};

/** Lattice nodes are identified by the class they stand for, which outlives a redraw. */
const latticeFocus = (active: Element): string | null => {
  const node = active.closest(".lattice-node[data-class]")?.getAttribute("data-class");
  return node == null ? null : `.lattice-node[data-class="${node}"]`;
};

/**
 * Ring steppers by the orbit and direction they step, which a redraw keeps;
 * lock, play and center buttons by their orbit alone.
 */
const ringFocus = (active: Element): string | null => {
  for (const kind of ["ring-lock", "ring-play", "ring-center"]) {
    const orbit = active.closest(`.${kind}[data-orbit]`)?.getAttribute("data-orbit");
    if (orbit != null) return `.${kind}[data-orbit="${orbit}"]`;
  }
  const button = active.closest(".ring-step[data-orbit][data-step]");
  if (button === null) return null;
  const orbit = button.getAttribute("data-orbit") ?? "";
  const step = button.getAttribute("data-step") ?? "";
  return `.ring-step[data-orbit="${orbit}"][data-step="${step}"]`;
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
  /** An orbit was asked to split into more concentric rings, or fewer. */
  onStepRings: (orbit: number, step: 1 | -1) => void;
  /** An orbit's rings were asked to start turning, or to stop. */
  onTogglePlay: (orbit: number) => void;
  /** An orbit's nodes were asked to be unlocked, or locked again. */
  onToggleLock: (orbit: number) => void;
  /** A node was asked to be put at an orbit's center, or back on its rings. */
  onToggleCenter: (orbit: number) => void;
  /**
   * A node was held long enough to drag — its ring round, or in an unlocked
   * orbit the node itself — the pointer at these client coordinates.
   */
  onDragStart: (point: number, clientX: number, clientY: number) => void;
  /** The pointer moved during a drag. */
  onDragMove: (clientX: number, clientY: number) => void;
  /** The drag ended. */
  onDragEnd: () => void;
}

/**
 * The centre panel: the group's name and automorphism group, the representations
 * on offer, the permutation diagram, and the subgroup lattice beneath it with
 * the ring controls beside it.
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

  /** Draw the scene, the way the settings say to. */
  show(scene: Scene, settings: Settings): void {
    this.#showHeading(scene);
    this.#showDiagram(scene, settings);
    this.#showRingControls(scene);
    this.#showLattice(scene);
  }

  /**
   * Move the diagram already drawn to where the scene now places its points,
   * without redrawing it: this runs every frame while the rings turn, and a
   * redraw would drop any click on a node that straddled a frame.
   */
  turn(scene: Scene, settings: Settings): void {
    const drawn = document.querySelector<SVGSVGElement>("#diagram svg");
    if (drawn !== null) moveDiagram(drawn, scene.diagram.points, settings.arrowCurvature);
  }

  #showHeading(scene: Scene): void {
    qs("#group-name").textContent = scene.group.displayName;
    // Every group in the catalogue has one, but LMFDB leaves the column nullable.
    const aut = scene.group.autDisplayName;
    qs("#group-aut").textContent = aut === null ? "" : `Aut(G) ≅ ${aut}`;
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
  #showDiagram(scene: Scene, settings: Settings): void {
    const { diagram } = scene;
    preservingFocus(diagramFocus, () => {
      mount(
        qs("#diagram"),
        renderPermutationDiagram(
          diagram,
          actionArrows(diagram.points, scene.palette),
          (generator) => scene.generatorColor(generator),
          {
            picked: scene.picked,
            onPick: this.#handlers.onPickPoint,
            curvature: settings.arrowCurvature,
            onDragStart: this.#handlers.onDragStart,
            onDragMove: this.#handlers.onDragMove,
            onDragEnd: this.#handlers.onDragEnd,
          },
        ),
      );
    });
  }

  /** A stepper, with its lock, play and center buttons, for each orbit. */
  #showRingControls(scene: Scene): void {
    preservingFocus(ringFocus, () => {
      qs("#ring-controls").replaceChildren(
        renderRingControls(scene.ringSplits(), scene.orbitCount, {
          onStep: this.#handlers.onStepRings,
          onTogglePlay: this.#handlers.onTogglePlay,
          onToggleLock: this.#handlers.onToggleLock,
          onToggleCenter: this.#handlers.onToggleCenter,
        }),
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
