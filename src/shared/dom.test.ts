// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { qs, el, mount } from "@shared/dom";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("qs", () => {
  it("returns the matching element", () => {
    document.body.innerHTML = `<div id="x"></div>`;
    expect(qs("#x").id).toBe("x");
  });
  it("throws when nothing matches", () => {
    expect(() => qs("#nope")).toThrow();
  });
});

describe("el", () => {
  it("assigns properties and appends children", () => {
    const node = el("a", { href: "https://example.com/", className: "link" }, ["click me"]);
    expect(node.tagName).toBe("A");
    expect(node.getAttribute("href")).toBe("https://example.com/");
    expect(node.className).toBe("link");
    expect(node.textContent).toBe("click me");
  });
});

describe("mount", () => {
  it("replaces existing children", () => {
    document.body.innerHTML = `<div id="root"><span>old</span></div>`;
    mount(qs("#root"), el("span", {}, ["new"]));
    expect(qs("#root").textContent).toBe("new");
  });
});
