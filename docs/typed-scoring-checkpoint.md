# Phase 2B-1 — configurable typed scoring

Local source checkpoint. Source versions remain 1.0.0; the accepted public package
and release are unchanged. WordPress deployment/host persistence remain deferred.
No Git mutation, packaging, deployment, browser automation or CLI junction changes.

## Edit setting and score rule

behaviour.typedPenalty is a select labelled Points deducted per incorrect attempt:
1 point (default), or 0.5 point. The existing ShowWhen widget shows it only when
answerMode=typed; nullWhenHidden=false retains its authored value when hidden.
Missing/unsupported values resolve to 1; numeric 0.5 and the editor string 0.5
resolve to half-point scoring only in typed mode. Dropdown always uses penalty 1.
Previously hidden Retry/solution controls remain hidden.

A solved Set earns max(0, 2 - penalty × (accepted attempts - 1)); an unsolved Set
earns zero. Maximum remains 2 per eligible Set. Typed half-point scores are
2, 1.5, 1, 0.5, 0, then zero; default/dropdown remain 2, 1, 0. Unlimited attempts,
normalized incorrect-resubmission gating and editing-without-attempts are unchanged.
The session shares its existing attempt/count/result logic. Fresh and restored
sessions, including Retry, receive the effective penalty.

## Fractions, Question and xAPI

Scores remain JavaScript numbers measured in points, not scaled integer units.
Halves are exactly representable, and the formula/sums introduce no rounding.
Existing per-Set cells stringify units as e.g. 1.5/2; totals stringify as e.g.
3.5/4. getScore returns the numeric total, getMaxScore remains 2 × eligible count.
No renderer or xAPI reporting-function change was needed.

Read-only inspection confirmed the installed H5P Core setScoredResult helper
copies raw/max numbers without integer coercion; its scaled ratio rounding is
already replaced by this activity's existing raw/max calculation. The subclass
uses its own results table rather than an integer-only score-bar workaround.
The existing aggregate completion contract, including success at zero score,
remains. No extra per-answer events or alternate point scale were introduced.

**Host limitation:** the installed WordPress H5P admin ajax_results handler reads
score using FILTER_VALIDATE_INT and writes it using %d. It therefore cannot be
claimed to preserve fractional My Results scores. This was inspected read-only;
no request, database mutation, plugin/Core patch or incompatible integer-rescaling
workaround was performed. Native activity results and emitted xAPI preserve the
fractions, but WordPress My Results compatibility needs separately authorized
resolution before a fractional-score host release. LRS/other-host processing is
not certified here. Manual CLI acceptance alone cannot establish that compatibility.

## Saved state

Dropdown schema 1, canonical input and fingerprints remain unchanged, even if an
inactive typedPenalty value is present. Typed schema 2 retains exactly its prior
root fields, Set tuples and strict validator. Scores remain derived, not stored.

Missing/explicit one-point penalty preserve the Phase 2A-3 typed canonical payload
byte-for-byte. Only a resolved half-point penalty appends [typed-penalty, 0.5]
to the typed canonical array before the unchanged cpj1 hash. Distractors remain
excluded. Each direction of a penalty change rejects saved attempts rather than
recomputing scores under a different rule; no migration/rewrite is needed.
Partial, incorrect, changed, solved and completed half-point states restore with
the same counts/inputs/gating and derived scores. Completed restoration is quiet;
Retry creates a fresh scoring attempt and allows one new completion.

## Exact files changed in Phase 2B-1

- semantics.json — conditional scoring selector.
- scripts/concordances-utils.js — shared resolveTypedPenalty helper.
- scripts/concordances-session.js — effective penalty and numeric scoring formula.
- scripts/concordances-state.js — half-point fingerprint domain and penalty-aware hydration.
- scripts/h5p-concordances-papijo.js — resolved default and fresh/Retry propagation.
- tests/concordances-session.test.cjs — full score sequences, clamping and gating.
- tests/concordances-state.test.cjs — legacy typed domain and half-point compatibility.
- tests/runtime.test.cjs — fractions in results/getters/xAPI, completed restore and Retry.
- tests/metadata.test.cjs — selector defaults/visibility and hidden lifecycle fields.
- README.md; docs/editor-integration.md; docs/saved-state.md.
- docs/typed-scoring-checkpoint.md — this report.

No parsing/alignment/revelation, answer normalization/input/Enter/IME code,
category semantics, dropdown pool logic, schema validation rules, published version
metadata or host files were changed. Earlier uncommitted Phase 2A work remains.

## Focused verification

One targeted run:

~~~powershell
node --test --test-name-pattern='penalty|schema-1 published|typed strict|typed completed restoration|answer mode is visible|ordinary/LancsBox' tests/concordances-session.test.cjs tests/concordances-state.test.cjs tests/runtime.test.cjs tests/metadata.test.cjs
~~~

9 passed, 0 failed, 0 skipped. Includes missing/explicit default 1, complete
half-point sequence/clamping, equivalent wrong-answer gating, no edit attempts,
per-Set fractions, fractional and integer totals, getScore/getMaxScore, raw/max/
scaled xAPI, penalty-specific partial/incorrect/changed/solved/completed restoration,
quiet completed restoration, Retry and one new completion. Existing dropdown
ordinary/LancsBox workflow, published schema-1 fixture and strict schema-2
malformed-state rejection remain covered. No broad suite or repeated browser run.

## Manual CLI Firefox acceptance readiness

Ready for an authorized manual CLI check; no deployment/reload was performed.
1. Confirm Behaviour shows the penalty only in typed mode and defaults to 1;
   switch modes and verify unrelated lifecycle controls remain hidden.
2. Use typed mode, no distractors, and two Sets such as One/ONE and Two/TWO.
   Choose 0.5. Answer one Set correctly on its second accepted Check and the other
   on its third: expect per-Set 1.5/2 and 1/2, total 2.5/4. Editing or equivalent
   incorrect input must not add attempts.
3. Retry to verify first/fourth/fifth correct attempts yield 2/0.5/0, with maximum
   2 per Set and no negative scores. Check the local completed xAPI raw/max/scaled.
4. Exercise host-supported save/resume for partial, wrong and completed attempts
   if available. Completed restoration must be quiet. Changing penalty must start
   fresh; leaving it at 1 must accept prior typed schema-2 snapshots.
5. Verify dropdown stays 2/1/0 and retains schema-1 progress even if an inactive
   half-point setting remains stored. Retry must clear all attempt scores/counts.

Source-level restoration tests do not establish host persistence. WordPress
fractional My Results remains a known blocker independent of the CLI checks.
STOPPED after Phase 2B-1, awaiting manual acceptance authorization.
