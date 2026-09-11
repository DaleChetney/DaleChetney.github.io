import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodePermutation,
  permutationFromCycles,
  permutationOrbits,
  type Permutation,
} from "../src/shared/mathUtils/groups/permutations.ts";
import { computeSubgroupLattice } from "../src/shared/mathUtils/groups/subgroupLattice.ts";
import { minimalGeneratingSet } from "../src/shared/mathUtils/groups/subgroups.ts";
import { texToUnicode } from "../src/shared/mathUtils/groups/tex.ts";
import type {
  Catalogue,
  CatalogueBounds,
  CatalogueGroup,
  CatalogueRepresentation,
  CatalogueSubgroupClass,
} from "../src/generatorVisualizer/catalogue.ts";
import { matchSubgroupClasses } from "./matchSubgroupClasses.ts";

/**
 * Turn the three LMFDB extracts named in `lmfdb-extract.sql` into the
 * catalogue the site ships. Run it by hand when the bounds change:
 *
 *     node scripts/bake-groups.ts <dir with the .jsonl extracts>
 *
 * The extracts are not committed. LMFDB's public API is rate limited behind a
 * captcha, so this cannot fetch for itself; the SQL alongside says exactly what
 * to run against the read-only mirror to reproduce them.
 *
 * The subgroup lattice is LMFDB's, but the generators of each class are
 * computed here: LMFDB writes its own in an element encoding the page cannot
 * decode, so each representation's lattice is computed from its generators and
 * matched to LMFDB's classes, and one generating set per class is kept.
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
  abelian: boolean;
  cyclic: boolean;
  nilpotent: boolean;
  solvable: boolean;
  simple: boolean;
  solvability_type: number;
  nilpotency_class: number;
  rank: number;
  aut_tex: string | null;
  /** As text: Aut(G) can outgrow a double even when G does not. */
  aut_order: string | null;
  /** `representations.Perm.gens` as raw text, so 36-digit codes keep their digits. */
  perm_gens: string | null;
}

/** A row of the gps_transitive extract. */
export interface TransitiveRow {
  abstract_label: string;
  nt_label: string;
  n: number;
  t: number;
  prim: number;
  gens: string;
}

/** A row of the subgroup extract: one conjugacy class of subgroups. */
export interface SubgroupRow {
  ambient: string;
  short_label: string;
  subgroup_order: number;
  count: number;
  cyclic: boolean;
  normal: boolean;
  subgroup_tex: string;
  /** Short labels of the classes immediately below. */
  contains: string[];
}

const BOUNDS: CatalogueBounds = {
  maxOrder: 360,
  maxSubgroupClasses: 32,
  maxDegree: 32,
  maxRepresentations: 4,
};

const fail = (message: string): never => {
  throw new Error(message);
};

/**
 * The generator codes, as digit strings.
 *
 * `JSON.parse` is not safe here: a degree-32 code has 36 digits and would come
 * back as a rounded double, decoding to the wrong permutation.
 */
export const parseGeneratorCodes = (raw: string | null): string[] =>
  raw === null ? [] : (raw.match(/\d+/g) ?? []);

const representationTitle = (
  degree: number,
  order: number,
  ntLabel?: string,
  primitive = false,
): string => {
  const kind = degree === order ? "regular" : primitive ? "primitive" : "transitive";
  return ntLabel === undefined
    ? `Minimal faithful — degree ${String(degree)}`
    : `${ntLabel} — ${kind}, degree ${String(degree)}`;
};

const transitiveRepresentation = (row: TransitiveRow, order: number): CatalogueRepresentation => {
  const cycles = JSON.parse(row.gens) as number[][][];
  const primitive = row.prim === 1;
  return {
    id: row.nt_label,
    title: representationTitle(row.n, order, row.nt_label, primitive),
    degree: row.n,
    transitive: true,
    primitive,
    generators: cycles.map((generator) => [...permutationFromCycles(generator, row.n)]),
    classGenerators: [],
  };
};

const minimalRepresentation = (row: GroupRow): CatalogueRepresentation => {
  const degree = row.permutation_degree;
  const generators = parseGeneratorCodes(row.perm_gens).map((code) => [
    ...decodePermutation(code, degree),
  ]);
  return {
    id: `perm-${String(degree)}`,
    title: representationTitle(degree, row.order),
    degree,
    // A minimal faithful representation is often intransitive; the orbits say.
    transitive: permutationOrbits(generators, degree).length === 1,
    // Primitivity is only recorded for the transitive rows, and a minimal
    // faithful representation that is transitive gives way to the named one.
    primitive: false,
    generators,
    classGenerators: [],
  };
};

/**
 * Every representation on offer, by degree, before the cap.
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

/** The `t` of an `nTt` label. */
const transitiveIndex = (rep: CatalogueRepresentation): number =>
  Number(/T(\d+)$/.exec(rep.id)?.[1] ?? 0);

/**
 * At most `limit` representations: when a group has more, the minimal
 * faithful one, the smallest transitive one, the largest primitive one and the
 * largest transitive one. Ties on degree go to the smaller `t`.
 */
export const chooseRepresentations = (
  representations: readonly CatalogueRepresentation[],
  limit: number,
): CatalogueRepresentation[] => {
  if (representations.length <= limit) return [...representations];
  const transitive = representations.filter((rep) => !rep.id.startsWith("perm-"));
  const ascending = [...transitive].sort(
    (a, b) => a.degree - b.degree || transitiveIndex(a) - transitiveIndex(b),
  );
  const descending = [...transitive].sort(
    (a, b) => b.degree - a.degree || transitiveIndex(a) - transitiveIndex(b),
  );
  const chosen = [
    representations.find((rep) => rep.id.startsWith("perm-")),
    ascending[0],
    descending.find((rep) => rep.primitive),
    descending[0],
  ].filter((rep) => rep !== undefined);
  return [...new Map(chosen.map((rep) => [rep.id, rep])).values()].sort(
    (a, b) => a.degree - b.degree,
  );
};

/** LMFDB's classes for one group, ordered by subgroup order, with covers as indices. */
export const subgroupClassesFor = (rows: readonly SubgroupRow[]): CatalogueSubgroupClass[] => {
  const sorted = [...rows].sort(
    (a, b) => a.subgroup_order - b.subgroup_order || a.short_label.localeCompare(b.short_label),
  );
  const index = new Map(sorted.map((row, i) => [row.short_label, i]));
  return sorted.map((row) => ({
    id: row.short_label,
    order: row.subgroup_order,
    count: row.count,
    cyclic: row.cyclic,
    normal: row.normal,
    texName: row.subgroup_tex,
    displayName: texToUnicode(row.subgroup_tex),
    covers: row.contains
      .map(
        (label) =>
          index.get(label) ?? fail(`${row.ambient}: ${row.short_label} contains unknown ${label}`),
      )
      .sort((a, b) => a - b),
  }));
};

/**
 * A generating set for one representative of each of LMFDB's classes, in the
 * representation given: its lattice is computed, matched class for class, and
 * a generating set (one element for a cyclic class, none for the trivial one)
 * kept for each.
 */
export const classGeneratorsFor = (
  generators: readonly Permutation[],
  degree: number,
  classes: readonly CatalogueSubgroupClass[],
  where: string,
): Permutation[][] => {
  const lattice = computeSubgroupLattice(generators, degree);
  const computed = lattice.classes.map((c, i) => ({
    order: c.order,
    count: c.count,
    cyclic: c.cyclic,
    covers: lattice.covers[i],
  }));
  let matching: number[];
  try {
    matching = matchSubgroupClasses(computed, classes);
  } catch (error) {
    return fail(`${where}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result: Permutation[][] = classes.map(() => []);
  lattice.classes.forEach((c, i) => {
    result[matching[i]] =
      c.order === 1
        ? []
        : c.generator !== null
          ? [[...c.generator]]
          : minimalGeneratingSet(c.representative, degree).map((g) => [...g]);
  });
  return result;
};

const groupBy = <T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
};

export const bakeGroup = (
  row: GroupRow,
  transitive: readonly TransitiveRow[],
  subgroups: readonly SubgroupRow[],
): CatalogueGroup => {
  const classes = subgroupClassesFor(subgroups);
  if (classes.length !== row.number_subgroup_classes) {
    fail(
      `${row.label}: ${String(classes.length)} subgroup rows, LMFDB counts ${String(row.number_subgroup_classes)} classes`,
    );
  }
  const representations = chooseRepresentations(
    representationsFor(row, transitive),
    BOUNDS.maxRepresentations,
  ).map((rep) => ({
    ...rep,
    classGenerators: classGeneratorsFor(
      rep.generators,
      rep.degree,
      classes,
      `${row.label} ${rep.id}`,
    ),
  }));

  return {
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
    solvabilityType: row.solvability_type,
    nilpotencyClass: row.nilpotency_class,
    rank: row.rank,
    autTexName: row.aut_tex,
    autDisplayName: row.aut_tex === null ? null : texToUnicode(row.aut_tex),
    autOrder: row.aut_order === null ? null : Number(row.aut_order),
    subgroups: { all: row.number_subgroups, classes },
    representations,
  };
};

export const bakeCatalogue = (
  groups: readonly GroupRow[],
  transitive: readonly TransitiveRow[],
  subgroups: readonly SubgroupRow[],
): Catalogue => {
  const transitiveByGroup = groupBy(transitive, (row) => row.abstract_label);
  const subgroupsByGroup = groupBy(subgroups, (row) => row.ambient);
  return {
    bounds: BOUNDS,
    groups: groups.map((row) =>
      bakeGroup(row, transitiveByGroup.get(row.label) ?? [], subgroupsByGroup.get(row.label) ?? []),
    ),
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
  const started = performance.now();
  const catalogue = bakeCatalogue(
    readJsonl<GroupRow>(resolve(extractDir, "groups.jsonl")),
    readJsonl<TransitiveRow>(resolve(extractDir, "transitive.jsonl")),
    readJsonl<SubgroupRow>(resolve(extractDir, "subgroups.jsonl")),
  );
  writeFileSync(outFile, `${JSON.stringify(catalogue)}\n`);
  const representations = catalogue.groups.reduce((n, g) => n + g.representations.length, 0);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  process.stdout.write(
    `${String(catalogue.groups.length)} groups, ${String(representations)} representations -> ${outFile} in ${seconds}s\n`,
  );
};

if (process.argv[1]?.endsWith("bake-groups.ts")) main();
