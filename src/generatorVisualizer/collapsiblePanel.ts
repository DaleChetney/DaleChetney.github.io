import { qs } from "@shared/dom";
import { load, save } from "@shared/storage";

/**
 * Wire a side panel's toggle button so the panel folds down to a strip.
 *
 * The section carries a `collapsed` class that the stylesheet turns into the
 * narrower grid column; the button's `aria-expanded` mirrors it. The state is
 * remembered under `storageKey` so a reload keeps the layout the reader chose.
 */
export const collapsiblePanel = (section: HTMLElement, storageKey: string): void => {
  const toggle = qs<HTMLButtonElement>(".panel-toggle", section);
  const apply = (collapsed: boolean): void => {
    section.classList.toggle("collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
  };
  apply(load(storageKey, false));
  toggle.addEventListener("click", () => {
    const collapsed = !section.classList.contains("collapsed");
    apply(collapsed);
    save(storageKey, collapsed);
  });
};
