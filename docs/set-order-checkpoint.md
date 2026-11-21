# Phase 2C: Configurable Set order

Local source checkpoint; Firefox acceptance of Phase 2C, including editor
placement, has since been reported by the user. Library version remains
1.0.0 and H5P Core API remains 1.28.

The Behavioural settings group now offers Set order: Shuffle Sets (default) or
Keep author-defined order. The editor setting is behaviour.setOrder, with values
shuffle and author. A minimal parameter-normalization bridge passes a valid new
value to the existing internal activity.setOrder path; otherwise it retains the
legacy activity.setOrder value. If both are present, a valid behaviour value wins.
Missing settings retain Shuffle. Ordering and fingerprint code are unchanged by
this placement correction; no state migration is needed.

Category eligibility is unchanged. Eligible authored indices are filtered first,
then ordered by the run's fixed permutation. Shuffle prepares that permutation
with the existing random draws; author mode uses editor indices. Answer choices
still shuffle independently. Retry uses the existing fresh-session path, resetting
the category to All and applying the selected ordering policy again.

## State compatibility

Schemas 1, 2, 4 and 5 are unchanged; no migration is introduced. Missing/explicit
Shuffle preserve existing fingerprints. Author mode adds a set-order marker to
the canonical fingerprint. Switching policy therefore starts a fresh attempt.

Authored Set order remains excluded from fingerprints, retaining the existing
acceptance of snapshots after editor reordering. An accepted snapshot restores
its saved permutation in either mode without shuffle draws. In author mode,
Retry then uses the current editor order. Existing strict permutation and
interaction validation remains unchanged; it does not reject a previously valid
saved run merely because its order differs from the current editor order.

## Files changed for this phase

- semantics.json
- scripts/concordances-session.js
- scripts/concordances-state.js
- scripts/h5p-concordances-papijo.js (editor placement compatibility bridge)
- tests/set-order.test.cjs (new)
- tests/runtime.test.cjs (focused ordering and editor bridge tests)
- docs/set-order-checkpoint.md (new)

Other pre-existing workspace changes were left in place.

## Focused verification

Initial implementation: all passed, 9 tests total:

- node --test tests/set-order.test.cjs: 3 tests covering editor/default behavior,
  category eligibility and sequence stability, state schemas 1/2/4/5, restored
  position/order, policy changes and invalid permutations.
- node --test --test-name-pattern="Set order runtime" tests/runtime.test.cjs:
  1 test covering actual runtime restoration and repeated Retry with deterministic
  Shuffle draws and author order.
- node --test --test-name-pattern="canonical fingerprints|stable Set/answer/category|automatic-only fingerprints" tests/concordances-state.test.cjs:
  3 existing compatibility tests.
- node --test --test-name-pattern="manifest identifies|semantics have valid" tests/metadata.test.cjs:
  2 existing metadata tests, including version 1.0.0 and Core API 1.28.
- npm run check:syntax: passed for all five runtime scripts.

No broad suite or browser automation was run. No packaging, deployment,
publication, Git mutation, other-library/Core/CMS or CLI-junction change was made.

Editor placement correction: 7 focused tests passed:

- node --test tests/set-order.test.cjs: 3 tests; now checks the setting occurs
  exactly once, within behaviour, with unchanged name, default and choices.
- node --test --test-name-pattern="Set order" tests/runtime.test.cjs: 2 tests;
  verifies the new editor path through categories/restoration/Retry, identical
  snapshots and fingerprints across legacy/new paths for schemas 1/2/4/5,
  restoration without shuffle draws, and explicit behaviour-value precedence.
- node --test --test-name-pattern="manifest identifies|semantics have valid" tests/metadata.test.cjs:
  2 tests, including version 1.0.0 and Core API 1.28.
- npm run check:syntax: passed.

## Firefox acceptance sequence (now reported accepted)

This local-source acceptance does not certify a future 1.1.0 package installation.

Confirm Set order appears once in Behavioural settings. Check both editor
choices, category selection, navigation, reload restoration
and Retry in Firefox. Confirm Shuffle remains the default for an existing
activity without the setting and for a newly created activity. Include an
author-mode run restored after editor reordering: its saved order should remain
fixed until Retry, which should use the current editor order.
