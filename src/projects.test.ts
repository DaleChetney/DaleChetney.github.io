import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { projects } from "./projects";

const srcDir = import.meta.dirname;
const RESERVED = new Set(["shared"]);

describe("projects manifest", () => {
  it("has unique slugs", () => {
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every slug has a route folder with an index.html", () => {
    for (const { slug } of projects) {
      expect(existsSync(resolve(srcDir, slug, "index.html"))).toBe(true);
    }
  });

  it("every route folder appears in the manifest", () => {
    const routeFolders = readdirSync(srcDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !RESERVED.has(entry.name))
      .map((entry) => entry.name);
    const slugs = new Set(projects.map((p) => p.slug));
    for (const folder of routeFolders) {
      expect(slugs.has(folder)).toBe(true);
    }
  });
});
