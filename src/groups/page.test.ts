// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { C3_C4 } from "./data";

// main.ts reaches into index.html by id and throws if one is missing, which no
// type check can see. Running it against the real markup pins the two together.
beforeAll(async () => {
  const html = readFileSync(resolve(import.meta.dirname, "index.html"), "utf8");
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  await import("./main");
});

describe("groups page", () => {
  it("mounts a diagram", () => {
    expect(document.querySelector("#diagram svg")).not.toBeNull();
  });

  it("draws a node for every point of the default representation", () => {
    expect(document.querySelectorAll("#diagram .node")).toHaveLength(
      C3_C4.representations[0].degree,
    );
  });

  it("names the group", () => {
    expect(document.querySelector("#group-name")?.textContent).toBe(C3_C4.displayName);
    expect(document.querySelector("#group-label")?.textContent).toContain(C3_C4.label);
  });

  it("offers a toggle per generator", () => {
    expect(document.querySelectorAll("#generators .generator")).toHaveLength(
      C3_C4.representations[0].generators.length,
    );
  });

  it("starts with one generator drawn", () => {
    const checked = document.querySelectorAll("#generators input:checked");
    expect(checked).toHaveLength(1);
    expect(document.querySelectorAll("#diagram .edges path").length).toBeGreaterThan(0);
  });

  it("redraws when a generator is toggled", () => {
    const before = document.querySelectorAll("#diagram .edges path").length;
    const input = document.querySelector<HTMLInputElement>(
      "#generators .generator:last-child input",
    );
    input?.click();
    const after = document.querySelectorAll("#diagram .edges path").length;
    expect(after).toBeGreaterThan(before);
  });
});
