-- Extracts that `bake-groups.ts` turns into public/groups.json.
--
-- Run all four against LMFDB's read-only mirror and save the results as JSON
-- Lines, named groups.jsonl, transitive.jsonl, subgroups.jsonl and
-- cyclic-aut.jsonl, in one directory. LMFDB's public API at www.lmfdb.org/api/
-- answers the same questions but is rate limited behind a captcha well before
-- 400 groups, so this is a manual step rather than part of the build.
--
-- The bounds below are the ones settled for the visualiser:
--   * 2 <= order <= 360 (the trivial group has nothing to draw)
--   * every subgroup known to LMFDB
--   * at most 32 conjugacy classes of subgroups (the node ceiling)
--   * minimal faithful permutation degree <= 32 (the point ceiling)
--   * a transitive representation of degree <= 32 to offer
-- Together these keep 402 groups. The bake then caps each group at four
-- representations.
--
-- Subgroup generators are deliberately not extracted: LMFDB writes them in the
-- group's own element encoding (PC codes for most of these groups), which
-- cannot be turned into permutations from the extract. The bake computes them.

-- groups.jsonl
--
-- perm_gens is cast to text on purpose. A degree-32 code has 36 digits, so
-- reading it as a JSON number would round it and decode to a different
-- permutation. aut_order is cast for the same reason.
SELECT g.label, g."order"::int AS order, g.tex_name, g.name,
       g.permutation_degree, g.number_subgroups::int AS number_subgroups,
       g.number_subgroup_classes,
       g.abelian, g.cyclic, g.nilpotent, g.solvable, g.simple,
       g.solvability_type, g.nilpotency_class, g.derived_length, g.rank,
       g.aut_tex, g.aut_order::text AS aut_order,
       g.representations->'Perm'->>'d' AS perm_degree,
       (g.representations->'Perm'->'gens')::text AS perm_gens
FROM gps_groups g
WHERE g."order" BETWEEN 2 AND 360
  AND g.all_subgroups_known
  AND g.number_subgroup_classes <= 32
  AND g.permutation_degree <= 32
  AND EXISTS (SELECT 1 FROM gps_transitive t WHERE t.abstract_label = g.label AND t.n <= 32)
ORDER BY g."order", g.counter;

-- transitive.jsonl
--
-- gps_transitive stores generators as cycle lists rather than codes.
WITH sel AS (
  SELECT label FROM gps_groups g
  WHERE g."order" BETWEEN 2 AND 360
    AND g.all_subgroups_known
    AND g.number_subgroup_classes <= 32
    AND g.permutation_degree <= 32
    AND EXISTS (SELECT 1 FROM gps_transitive t WHERE t.abstract_label = g.label AND t.n <= 32)
)
SELECT t.abstract_label, t.label AS nt_label, t.n, t.t, t.prim, t.gens::text AS gens
FROM gps_transitive t JOIN sel ON sel.label = t.abstract_label
WHERE t.n <= 32
ORDER BY t.abstract_label, t.n, t.t;

-- subgroups.jsonl
--
-- One row per conjugacy class of subgroups. `contains` lists the classes
-- immediately below, which is the cover relation the lattice is drawn from.
WITH sel AS (
  SELECT label FROM gps_groups g
  WHERE g."order" BETWEEN 2 AND 360
    AND g.all_subgroups_known
    AND g.number_subgroup_classes <= 32
    AND g.permutation_degree <= 32
    AND EXISTS (SELECT 1 FROM gps_transitive t WHERE t.abstract_label = g.label AND t.n <= 32)
)
SELECT d.ambient, d.short_label, s.subgroup_order::int AS subgroup_order,
       d.count::int AS count, s.cyclic, s.normal, s.subgroup_tex, d.contains
FROM gps_subgroup_data d
JOIN gps_subgroup_search s ON s.label = d.label
JOIN sel ON sel.label = d.ambient
ORDER BY d.ambient, s.subgroup_order, d.short_label;

-- cyclic-aut.jsonl
--
-- Aut(C_n)'s generators for every order a cyclic subgroup class has in the
-- groups above. None of those classes has order over 32 today; the catalogue
-- test "offers automorphisms for every order a cyclic subgroup class has" fails
-- if a change of bounds lets one in, and this bound must then rise with it. Each
-- entry is the image of the group's single generator, which for a cyclic group
-- is the exponent the automorphism raises it to.
SELECT "order"::int AS order, aut_gens::text AS aut_gens
FROM gps_groups
WHERE cyclic AND "order" <= 32
ORDER BY "order";
