import { qs } from "@shared/dom";
import { load, save } from "@shared/storage";

/**
 * Wire a side panel's toggle button so the panel folds down to a strip.
 *
 * The section carries a `collapsed` class that the stylesheet turns into the
 * narrower grid column; the button's `aria-expanded` mirrors it. The state is
 * remembered under `storageKey` so a reload keeps the layout the reader chose.
 *
 * `startCollapsed` folds it on load whatever was stored, as a narrow screen
 * wants, leaving the stored choice for the next wider one.
 */
export const collapsiblePanel = (
  section: HTMLElement,
  storageKey: string,
  startCollapsed = false,
): void => {
  const toggle = qs<HTMLButtonElement>(".panel-toggle", section);
  const apply = (collapsed: boolean): void => {
    section.classList.toggle("collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
  };
  apply(startCollapsed || load(storageKey, false));
  toggle.addEventListener("click", () => {
    const collapsed = !section.classList.contains("collapsed");
    apply(collapsed);
    save(storageKey, collapsed);
  });
};
