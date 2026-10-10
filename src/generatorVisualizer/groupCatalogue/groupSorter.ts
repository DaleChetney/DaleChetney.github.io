import { el } from "@shared/dom";
import { distinctPrimeCount, primeDivisorCount, primeFactorization } from "@shared/mathUtils/math";
import type { CatalogueGroup } from "./catalogue";

/** How the list can be ordered. Ties keep whatever order the list was already in. */
export type GroupSort =
  | "order"
  | "distinct-primes"
  | "prime-factors"
  | "label"
  | "rank"
  | "length"
  | "automorphisms"
  | "subgroups"
  | "subgroup-classes"
  | "smallest-prime";

type Comparator = (a: CatalogueGroup, b: CatalogueGroup) => number;

/** Ascending on a numeric key; `Infinity` keeps a missing value at the end. */
const byKey =
  (key: (group: CatalogueGroup) => number): Comparator =>
  (a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka === kb ? 0 : ka < kb ? -1 : 1;
  };

/** `12.9` before `12.10`: LMFDB labels compare on their numbers, not their text. */
const labels = new Intl.Collator("en", { numeric: true });

/** The trivial group has no prime factor; 1 keeps it first, as every other order-based key does. */
const smallestPrime = (n: number): number => primeFactorization(n)[0]?.[0] ?? 1;

/**
 * The length of the finest series the group has: rank when abelian, nilpotency
 * class when nilpotent, derived length when solvable. A group with none sorts last.
 */
const seriesLength = (group: CatalogueGroup): number =>
  group.abelian
    ? group.rank
    : group.nilpotent
      ? group.nilpotencyClass
      : group.solvable
        ? group.derivedLength
        : Infinity;

const COMPARATORS: Readonly<Record<GroupSort, Comparator>> = {
  order: byKey((group) => group.order),
  "distinct-primes": byKey((group) => distinctPrimeCount(group.order)),
  "prime-factors": byKey((group) => primeDivisorCount(group.order)),
  label: (a, b) => labels.compare(a.label, b.label),
  rank: byKey((group) => group.rank),
  length: byKey(seriesLength),
  automorphisms: byKey((group) => group.autOrder ?? Infinity),
  subgroups: byKey((group) => group.subgroups.all),
  "subgroup-classes": byKey((group) => group.subgroups.classes.length),
  "smallest-prime": byKey((group) => smallestPrime(group.order)),
};

/**
 * The catalogue in its current order, re-sorted one key at a time.
 *
 * Each sort is stable and starts from the previous one's result, so ties keep
 * the order they were already in: sorting by ω and then by Ω leaves ω breaking
 * Ω's ties, the way a table's column headers do. Labels are unique, so sorting
 * by label puts everything back in catalogue order however many sorts came
 * before it.
 */
export class GroupSorter {
  static readonly OPTIONS: readonly { value: GroupSort; name: string }[] = [
    { value: "label", name: "Sort by label" },
    { value: "order", name: "Sort by order" },
    { value: "distinct-primes", name: "Sort by distinct primes, ω" },
    { value: "prime-factors", name: "Sort by prime factors, Ω" },
    { value: "smallest-prime", name: "Sort by smallest prime factor" },
    { value: "rank", name: "Sort by rank" },
    { value: "length", name: "Sort by length" },
    { value: "automorphisms", name: "Sort by automorphisms" },
    { value: "subgroups", name: "Sort by number of subgroups" },
    { value: "subgroup-classes", name: "Sort by subgroup classes" },
  ];

  /** The groups in their current order; replaced, never reordered in place. */
  #groups: readonly CatalogueGroup[];

  /** The caller's array is copied on the first sort, never reordered. */
  constructor(groups: readonly CatalogueGroup[]) {
    this.#groups = groups;
  }

  get groups(): readonly CatalogueGroup[] {
    return this.#groups;
  }

  /** Re-sort by `sort`, letting the current order break its ties. */
  sortBy(sort: GroupSort): readonly CatalogueGroup[] {
    this.#groups = [...this.#groups].sort(COMPARATORS[sort]);
    return this.#groups;
  }

  static renderOptions(): HTMLOptionElement[] {
    return GroupSorter.OPTIONS.map((option) =>
      el("option", { value: option.value }, [option.name]),
    );
  }
}
