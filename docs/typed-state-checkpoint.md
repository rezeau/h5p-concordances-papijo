# Phase 2A-3 — typed saved state, accessibility and completion

Implemented locally. Source versions remain 1.0.0; 1.1.0 preparation is deferred.
No deployment, packaging, Git mutation, browser automation or external library,
Core/CMS/junction changes. The accepted 1.0.0 package is unchanged.

## Schema and compatibility

Dropdown schema 1, its field list, validator rules, canonical fingerprint input,
answer permutations and identities are preserved. A frozen fixture generated from
the published 1.0.0 state implementation verifies exact reserialization with both
absent and explicit dropdown mode. Schema-1 snapshots do not hydrate typed mode;
schema-2 snapshots do not hydrate dropdown. Mode is resolved from trusted runtime
Behaviour, not guessed from the snapshot.

Typed records have exactly version=2, answerMode=typed, fingerprint, setOrder,
category, locked, position, sets and results. Set tuples are:

~~~text
[id, raw text, accepted attempts, solved, checked feedback, last normalized submission]
~~~

The last submission is null before any Check; otherwise it is a nonempty normalized
plain-text key. This separate key preserves equivalent-answer blocking after an
incorrect Check, including editing away and returning to the same answer without
another Check. checked=false may therefore legitimately coexist with raw text
matching that key and a disabled Check. Raw spaces/capitalization/Unicode remain
exact; learner text is never HTML-decoded. Correctness decodes the authored Word
once, independently of its raw stored identity.

Typed cpj1 fingerprints hash canonical [2, typed, categoriesEnabled,
sortedRawSetRecords, [automatic-gaps, 1-or-3]]. Inactive distractors are excluded.
Word/Context/category edits and category enablement affect compatibility; authored
Set reordering does not. Category identities and saved order remain authoritative.
The cpj1 algorithm and existing interpretation markers were not changed.

## Validation and restoration

Strict validators reject unknown/dropdown-only/score fields, wrong mode/schema/hash,
non-data properties/accessors, malformed or duplicate identities/permutations,
invalid categories/positions/counts, impossible last-submission/feedback/solved
combinations, changed future/ineligible Sets, lock/results inconsistencies and
invalid string values. No arbitrary text length limit or HTML-looking-text ban.
Newlines are rejected because native single-line inputs strip them; other raw
plain-text contents are retained. A single Set/no distractors can have legitimate
wrong attempts. Validation never executes candidate accessors, mutates data or
partially repairs progress.

Hydration preserves partial, incorrect, equivalent-edited, genuinely changed,
changed-back, solved and completed states; raw text, feedback/gating, counts,
category, order, position and derived scores/results return without shuffle draws
or replayed actions. Input is created once and routine refresh retains its value
and caret. Initialization does not force focus or announce restored feedback.

## Accessibility and xAPI

The existing input label, progress/category descriptions, feedback association,
incorrect-input/correct-Context focus, Next focus and Retry category/input focus
passed focused DOM checks. Enter invokes one guarded Check, repeat and IME do not
submit, routine typing preserves selection. No keyboard/style refactor was needed.

Completion retains the existing aggregate contract. Live finishes at 2/1/0 scores
emit exactly once (including zero-score success). Completed restoration renders
results/revelation quietly and initializes the existing completion guard; repeated
attachment/refresh/Check adds no completed event. Retry clears the guard/session
and permits exactly one new completed event. No per-answer response events added.

## Exact Phase 2A-3 file changes (on top of the uncommitted Phase 2A-2 work)

- scripts/concordances-state.js — typed domain, schema 2, strict validation and mode dispatch.
- scripts/concordances-session.js — hydrate typed raw input/submission keys using validated state.
- scripts/h5p-concordances-papijo.js — enable typed restore/save via shared state APIs.
- semantics.json — remove obsolete persistence-incomplete Behaviour help.
- tests/concordances-state.test.cjs — schema-1 fixture, typed round-trip/fingerprint/rejection tests.
- tests/runtime.test.cjs — replace temporary persistence-boundary assertion and add hydration/completion tests.
- tests/fixtures/schema1-release-1.0.0.json — new published-format compatibility fixture.
- README.md; docs/editor-integration.md; docs/saved-state.md — current persistence contract.
- docs/typed-answer-checkpoint.md — mark its former limitation as historical.
- docs/typed-state-checkpoint.md — this report.

No parsing, alignment, reconstruction, gap matching/revelation, category filtering,
dropdown input behavior or xAPI reporting function was changed in Phase 2A-3.
The typed-specific state representation and hydration are the necessary changes.

## Verification

One relevant state/runtime selection:

~~~powershell
node --test tests/concordances-state.test.cjs --test-name-pattern='schema|typed|restoration|snapshots|canonical|strict' tests/runtime.test.cjs
~~~

Observed result: 23 passed, 0 failed, 0 skipped (10 state and 13 runtime checks).
No broad matrix, browser automation or repeated unrelated suite was run. Cases
include exact legacy snapshots, partial/incorrect/changed/solved/completed typed
round-trips, no restoration randomness, distractor independence, authored reordering,
category lock, cross-mode rejection, strict adversarial snapshots/accessors,
plain-text safety, normalization, focus/Enter/IME/caret, scoring, Retry and xAPI counts.

## Readiness and remaining limits

Ready for authorized Phase 2A-4 local Firefox acceptance. Check real editor mode
visibility and inactive distractor help; save/reopen typed partial and wrong inputs,
resume categories/order/results, input focus/IME/caret, quiet completed restoration
and one completion after Retry. Use both ordinary and three-column LancsBox Sets.
Verify absent/explicit dropdown retains existing host persistence.

DOM doubles are not a real browser or assistive-technology certification. State
persistence and LRS delivery remain host responsibilities. Compatibility hashes
are not cryptographic authentication. No release artifact or version bump was made.
STOPPED after Phase 2A-3, awaiting authorization for local Firefox acceptance.
