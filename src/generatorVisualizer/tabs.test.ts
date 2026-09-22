// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { tabs } from "./tabs";

const KEY = "test.tab";

const fixture = (): { section: HTMLElement; tab: (id: string) => HTMLButtonElement } => {
  document.body.innerHTML = `
    <section id="panel">
      <div role="tablist">
        <button role="tab" id="tab-a" aria-controls="pane-a">A</button>
        <button role="tab" id="tab-b" aria-controls="pane-b">B</button>
      </div>
      <div id="pane-a" role="tabpanel"></div>
      <div id="pane-b" role="tabpanel"></div>
    </section>`;
  const section = document.querySelector<HTMLElement>("#panel");
  if (section === null) throw new Error("fixture missing");
  return {
    section,
    tab: (id) => {
      const found = document.querySelector<HTMLButtonElement>(`#${id}`);
      if (found === null) throw new Error(`no tab ${id}`);
      return found;
    },
  };
};

const shown = (): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>("[role=tabpanel]"))
    .filter((pane) => !pane.hidden)
    .map((pane) => pane.id);
const selected = (): string[] =>
  Array.from(document.querySelectorAll('[role=tab][aria-selected="true"]')).map((tab) => tab.id);

describe("tabs", () => {
  beforeEach(() => localStorage.clear());

  it("opens on the first tab when nothing is stored", () => {
    const { section } = fixture();
    tabs(section, KEY);
    expect(shown()).toEqual(["pane-a"]);
    expect(selected()).toEqual(["tab-a"]);
  });

  it("opens on the stored tab", () => {
    localStorage.setItem(KEY, JSON.stringify("tab-b"));
    const { section } = fixture();
    tabs(section, KEY);
    expect(shown()).toEqual(["pane-b"]);
    expect(selected()).toEqual(["tab-b"]);
  });

  it("falls back to the first tab when the stored one is gone", () => {
    localStorage.setItem(KEY, JSON.stringify("tab-z"));
    const { section } = fixture();
    tabs(section, KEY);
    expect(shown()).toEqual(["pane-a"]);
  });

  it("switches on click and remembers it", () => {
    const { section, tab } = fixture();
    tabs(section, KEY);
    tab("tab-b").click();
    expect(shown()).toEqual(["pane-b"]);
    expect(selected()).toEqual(["tab-b"]);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify("tab-b"));
    tab("tab-a").click();
    expect(shown()).toEqual(["pane-a"]);
  });

  it("keeps the unselected tabs out of the tab order", () => {
    const { section, tab } = fixture();
    tabs(section, KEY);
    expect(tab("tab-a").tabIndex).toBe(0);
    expect(tab("tab-b").tabIndex).toBe(-1);
  });
});
