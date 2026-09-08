import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodePermutation,
  permutationFromCycles,
  permutationOrbits,
} from "../src/shared/permutations.ts";
import { texToUnicode } from "../src/shared/tex.ts";
import type {
  Catalogue,
  CatalogueBounds,
  CatalogueGroup,
  CatalogueRepresentation,
  SubgroupRung,
} from "../src/groups/catalogue.ts";

/**
 * Turn the two LMFDB extracts named in `lmfdb-extract.sql` into the catalogue
 * the site ships. Run it by hand when the bounds change:
 *
 *     node scripts/bake-groups.ts <dir with the .jsonl extracts>
 *
 * The extracts are not committed. LMFDB's public API is rate limited behind a
 * captcha, so this cannot fetch for itself; the SQL alongside says exactly what
 * to run against the read-only mirror to reproduce them.
 */

/** A row of the gps_groups extract, before any of it is decoded. */
export interface GroupRow {
  label: string;
  order: number;
  tex_name: string;
  name: string;
  permutation_degree: number;
  number_subgroups: number;
  number_subgroup_classes: number;
  number_subgroup_autclasses: number;
  abelian: boolean;
  cyclic: boolean;
  nilpotent: boolean;
  solvable: boolean;
  simple: boolean;
  /** `representations.Perm.gens` as raw text, so 36-digit codes keep their digits. */
  perm_gens: string | null;
}

/** A row of the gps_transitive extract. */
export interface TransitiveRow {
  abstract_label: string;
  nt_label: string;
  n: number;
  gens: string;
}

export const BOUNDS: CatalogueBounds = {
  maxOrder: 120,
  abelianMaxOrder: 60,
  maxDegree: 32,
  maxSubgroupsShown: 22,
  maxRank: 4,
  maxArrows: 128,
};

/**
 * The generator codes, as digit strings.
 *
 * `JSON.parse` is not safe here: a degree-32 code has 36 digits and would come
 * back as a rounded double, decoding to the wrong permutation.
 */
export const parseGeneratorCodes = (raw: string | null): string[] =>
  raw === null ? [] : (raw.match(/\d+/g) ?? []);

/** Which rung of the subgroup diagram this group's count allows. */
export const subgroupRung = (all: number, classes: number, limit: number): SubgroupRung =>
  all <= limit ? "all" : classes <= limit ? "classes" : "autclasses";

const representationTitle = (degree: number, order: number, ntLabel?: string): string => {
  const kind = degree === order ? "regular" : "transitive";
  return ntLabel === undefined
    ? `Minimal faithful — degree ${degree}`
    : `${ntLabel} — ${kind}, degree ${degree}`;
};

const transitiveRepresentation = (row: TransitiveRow, order: number): CatalogueRepresentation => {
  const cycles = JSON.parse(row.gens) as number[][][];
  return {
    id: row.nt_label,
    title: representationTitle(row.n, order, row.nt_label),
    degree: row.n,
    transitive: true,
    generators: cycles.map((generator) => [...permutationFromCycles(generator, row.n)]),
  };
};

const minimalRepresentation = (row: GroupRow): CatalogueRepresentation => {
  const degree = row.permutation_degree;
  const generators = parseGeneratorCodes(row.perm_gens).map((code) => [
    ...decodePermutation(code, degree),
  ]);
  return {
    id: `perm-${degree}`,
    title: representationTitle(degree, row.order),
    degree,
    // A minimal faithful representation is often intransitive; the orbits say.
    transitive: permutationOrbits(generators, degree).length === 1,
    generators,
  };
};

/**
 * The representations to offer, by degree.
 *
 * A minimal faithful representation that happens to be transitive is dropped
 * when LMFDB also records a transitive group of that degree: they are the same
 * action, and the transitive one carries a name worth showing.
 */
export const representationsFor = (
  row: GroupRow,
  transitive: readonly TransitiveRow[],
): CatalogueRepresentation[] => {
  const fromTransitive = transitive.map((t) => transitiveRepresentation(t, row.order));
  const minimal = minimalRepresentation(row);
  const covered = minimal.transitive && fromTransitive.some((rep) => rep.degree === minimal.degree);
  return [...(covered ? [] : [minimal]), ...fromTransitive].sort((a, b) => a.degree - b.degree);
};

export const bakeCatalogue = (
  groups: readonly GroupRow[],
  transitive: readonly TransitiveRow[],
): Catalogue => {
  const byGroup = new Map<string, TransitiveRow[]>();
  for (const row of transitive) {
    byGroup.set(row.abstract_label, [...(byGroup.get(row.abstract_label) ?? []), row]);
  }

  return {
    bounds: BOUNDS,
    groups: groups.map((row): CatalogueGroup => ({
      label: row.label,
      name: row.name,
      texName: row.tex_name,
      displayName: texToUnicode(row.tex_name),
      order: row.order,
      abelian: row.abelian,
      cyclic: row.cyclic,
      nilpotent: row.nilpotent,
      solvable: row.solvable,
      simple: row.simple,
      subgroups: {
        all: row.number_subgroups,
        classes: row.number_subgroup_classes,
        autclasses: row.number_subgroup_autclasses,
        rung: subgroupRung(
          row.number_subgroups,
          row.number_subgroup_classes,
          BOUNDS.maxSubgroupsShown,
        ),
      },
      representations: representationsFor(row, byGroup.get(row.label) ?? []),
    })),
  };
};

const readJsonl = <T>(path: string): T[] =>
  readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as T);

const main = (): void => {
  const [extractDir, outFile = "public/groups.json"] = process.argv.slice(2);
  if (extractDir === undefined) {
    throw new Error("usage: node scripts/bake-groups.ts <extract dir> [out file]");
  }
  const catalogue = bakeCatalogue(
    readJsonl<GroupRow>(resolve(extractDir, "groups.jsonl")),
    readJsonl<TransitiveRow>(resolve(extractDir, "transitive.jsonl")),
  );
  writeFileSync(outFile, `${JSON.stringify(catalogue)}\n`);
  const representations = catalogue.groups.reduce((n, g) => n + g.representations.length, 0);
  process.stdout.write(
    `${String(catalogue.groups.length)} groups, ${String(representations)} representations -> ${outFile}\n`,
  );
};

if (process.argv[1]?.endsWith("bake-groups.ts")) main();
