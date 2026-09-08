-- Extracts that `bake-groups.ts` turns into public/groups.json.
--
-- Run both against LMFDB's read-only mirror and save the results as JSON Lines,
-- named groups.jsonl and transitive.jsonl in one directory. LMFDB's public API
-- at www.lmfdb.org/api/ answers the same questions but is rate limited behind a
-- captcha well before 526 groups, so this is a manual step rather than part of
-- the build.
--
-- The bounds below are the ones settled for the visualiser:
--   * order <= 60, plus non-abelian orders up to 120
--   * rank <= 4
--   * at most 22 subgroups up to automorphism (the escalation ceiling)
--   * minimal faithful permutation degree <= 32 (the node ceiling)
--   * elements stored as PC or Perm codes; the matrix encodings are out
-- Together these keep 526 groups.

-- groups.jsonl
--
-- perm_gens is cast to text on purpose. A degree-32 code has 36 digits, so
-- reading it as a JSON number would round it and decode to a different
-- permutation.
SELECT g.label, g."order"::int AS order, g.tex_name, g.name,
       g.permutation_degree, g.number_subgroups::int AS number_subgroups,
       g.number_subgroup_classes, g.number_subgroup_autclasses,
       g.abelian, g.cyclic, g.nilpotent, g.solvable, g.simple, g.rank,
       g.element_repr_type,
       g.representations->'Perm'->>'d' AS perm_degree,
       (g.representations->'Perm'->'gens')::text AS perm_gens
FROM gps_groups g
WHERE (g."order" <= 60 OR (g."order" <= 120 AND g.abelian = false))
  AND g.rank <= 4 AND g.number_subgroup_autclasses <= 22
  AND g.permutation_degree <= 32 AND g.element_repr_type IN ('PC','Perm')
ORDER BY g."order", g.counter;

-- transitive.jsonl
--
-- gps_transitive stores generators as cycle lists rather than codes, and only
-- reaches degree 47, so a group whose smallest transitive action is larger than
-- 32 simply has no row here. About half of the 526 are in that position.
WITH sel AS (
  SELECT label FROM gps_groups
  WHERE ("order" <= 60 OR ("order" <= 120 AND abelian = false))
    AND rank <= 4 AND number_subgroup_autclasses <= 22
    AND permutation_degree <= 32 AND element_repr_type IN ('PC','Perm')
)
SELECT t.abstract_label, t.label AS nt_label, t.n, t.t, t.gens::text AS gens
FROM gps_transitive t JOIN sel ON sel.label = t.abstract_label
WHERE t.n <= 32
ORDER BY t.abstract_label, t.n, t.t;
