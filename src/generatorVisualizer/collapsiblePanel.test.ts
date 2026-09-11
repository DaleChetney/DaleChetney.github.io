// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { collapsiblePanel } from "./collapsiblePanel";

const KEY = "test.panel";

const panel = (): { section: HTMLElement; toggle: HTMLButtonElement } => {
  document.body.innerHTML = `
    <section id="panel">
      <button class="panel-toggle"></button>
      <h2>Title</h2>
    </section>`;
  const section = document.querySelector<HTMLElement>("#panel");
  const toggle = document.querySelector<HTMLButtonElement>(".panel-toggle");
  if (section === null || toggle === null) throw new Error("fixture missing");
  return { section, toggle };
};

describe("collapsiblePanel", () => {
  beforeEach(() => localStorage.clear());

  it("starts expanded when nothing is stored", () => {
    const { section, toggle } = panel();
    collapsiblePanel(section, KEY);
    expect(section.classList.contains("collapsed")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("starts collapsed when storage says so", () => {
    localStorage.setItem(KEY, "true");
    const { section, toggle } = panel();
    collapsiblePanel(section, KEY);
    expect(section.classList.contains("collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("collapses on click and remembers it", () => {
    const { section, toggle } = panel();
    collapsiblePanel(section, KEY);
    toggle.click();
    expect(section.classList.contains("collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem(KEY)).toBe("true");
  });

  it("expands again on a second click", () => {
    const { section, toggle } = panel();
    collapsiblePanel(section, KEY);
    toggle.click();
    toggle.click();
    expect(section.classList.contains("collapsed")).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("false");
  });
});
