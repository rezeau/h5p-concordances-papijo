# Phase 2B-2b — two spelling policies only

Local source checkpoint. Version declarations remain 1.0.0. No deployment,
packaging, Git mutation, release, progressive hints, Core/CMS/other-library changes
or CLI junction alteration. Earlier uncommitted checkpoint work remains in place.

## Final editor and runtime

Minor spelling errors has exactly Warn the learner (one free warning per Set),
and Treat as a regular mistake (default). It remains typed-only via ShowWhen,
with nullWhenHidden=false to preserve the value on temporary dropdown switches.
Other hidden Behaviour controls remain hidden.

Both policies require an exact normalized answer to solve a Set. The shared
one-edit Unicode detector is unchanged and used for Warn. One free warning retains
the input, announces spellingWarning, returns focus and records warning use without
increasing scored attempts. Equivalent variants remain gated. Further minor errors
are ordinary scored mistakes. Earlier attempts are retained and both 1/0.5-point
penalties apply unchanged. Retry clears usage/counts and completed restoration stays
quiet. Dropdown behavior is unchanged.

Removed: minor-error success, typo-solved Sets, typo-triggered revelation/completion,
accepted-spelling feedback derivation, its full localization string and accept-only
state rules/tests. The feedback helper hasAcceptedSpellingError no longer exists.
No replacement warning panel or success exception was added. Exact answers retain
ordinary Correct feedback and original source revelation.

## Compatibility and obsolete content

Missing, unknown and obsolete accept authoring values all resolve to mistake,
including direct session creation. They never resolve to Warn. Old values are not
rewritten or migrated; runtime behavior is strict.

Schema 1 and strict typed schema 2 are unchanged. Schema 3 remains exclusively for
Warn, with the existing spelling-policy/warn fingerprint marker and the same root
fields/eight-element tuples. Warn solved rows now use the same exact-answer rules
that Warn already required. Strict validators retain accessor/type/order/category/
count/feedback/lock/completion and pristine-future-row checks.

Before removal, tests/fixtures/spelling-policy-2b2.json captured an authentic Warn
snapshot (after a scored mistake and free warning) and an obsolete accept snapshot.
The fixture verifies the old Warn fingerprint, exact reserialization, warning usage,
counts and gating. The obsolete accept snapshot is rejected for absent, explicit
mistake, warn, obsolete accept and unknown authoring values. No schema conversion
or migration is attempted. Default penalty and half-point schema-2 compatibility
remain covered by existing tests.

## Exact files changed in Phase 2B-2b

- semantics.json — remove accept option and obsolete feedback localization.
- scripts/concordances-utils.js — resolve only warn or mistake; detector unchanged.
- scripts/concordances-session.js — remove typo-correct branch; require exact success.
- scripts/concordances-state.js — schema 3 only for Warn, remove accept validation.
- scripts/h5p-concordances-papijo.js — remove accepted-spelling feedback/helper.
- tests/metadata.test.cjs — exact two-option/default/localization assertions.
- tests/concordances-session.test.cjs — remove accept success expectations.
- tests/concordances-state.test.cjs — Warn-only coverage and legacy snapshot compatibility.
- tests/runtime.test.cjs — remove obsolete feedback/success tests; add strict fallback checks.
- tests/fixtures/spelling-policy-2b2.json — new pre-removal compatibility/rejection fixture.
- README.md; docs/editor-integration.md; docs/saved-state.md — current two-policy contract.
- docs/typed-spelling-checkpoint.md — replace obsolete three-policy instructions.
- docs/accepted-spelling-feedback-checkpoint.md — mark withdrawn behavior without obsolete instructions.
- docs/two-spelling-policies-checkpoint.md — this report.

## Focused verification

One run:

~~~powershell
node --test --test-name-pattern='two-policy|spelling|schema-1 published|typed penalty compatibility|typed strict validation|exact correct feedback|typed Enter|localization covers' tests/concordances-utils.test.cjs tests/concordances-session.test.cjs tests/concordances-state.test.cjs tests/runtime.test.cjs tests/metadata.test.cjs
~~~

16 passed, 0 failed, 0 skipped. Includes exact two choices/default/visibility,
unknown/obsolete strict fallback, obsolete snapshot rejection, authentic Warn
fingerprint/snapshot preservation, free warning then scored mistakes, exact success,
both penalties, equivalent-answer gating, strict schema-2 and published schema-1
compatibility, unchanged detector, warning focus/announcement/restoration/Retry,
quiet completed restoration and Enter/IME guards. No broad suite or browser automation.

## Manual CLI readiness

Ready for authorized Firefox acceptance. Confirm only two editor choices; fresh
content defaults to Regular mistake. In Warn mode, Word fresco with FRESCOes and
input fresoc must warn without solving/counting; equivalent input remains blocked.
A different second typo counts as incorrect, and exact fresco then solves with
the chosen penalty. Retry renews one warning. Save/reload a Warn state where host
persistence is available to verify retained usage/gating and quiet completed restore.
Old accept-configured content must now count its typo as incorrect; its obsolete
accept progress must start clean. Check dropdown and exact-answer feedback as usual.

No browser acceptance is claimed. WordPress fractional My Results remains the
separately documented host limitation. STOPPED after Phase 2B-2b, awaiting authorization.
