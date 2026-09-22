import { load, save } from "@shared/storage";

/**
 * Wire a section's tabs so that one pane shows at a time.
 *
 * The tabs are the section's `role="tab"` buttons, each naming its pane by
 * `aria-controls`; the markup carries both, and this only switches between
 * them. The chosen tab is remembered under `storageKey` by its id, so a reload
 * opens where the reader left off, and a stored id no tab carries any more
 * falls back to the first.
 */
export const tabs = (section: HTMLElement, storageKey: string): void => {
  const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const paneOf = (tab: HTMLButtonElement): HTMLElement | null =>
    document.getElementById(tab.getAttribute("aria-controls") ?? "");

  const select = (chosen: HTMLButtonElement): void => {
    for (const tab of buttons) {
      const active = tab === chosen;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      const pane = paneOf(tab);
      if (pane !== null) pane.hidden = !active;
    }
  };

  const stored = load<string | null>(storageKey, null);
  select(buttons.find((tab) => tab.id === stored) ?? buttons[0]);

  for (const tab of buttons) {
    tab.addEventListener("click", () => {
      select(tab);
      save(storageKey, tab.id);
    });
  }
};
