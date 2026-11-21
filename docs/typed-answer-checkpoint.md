# Phase 2A-2 — optional typed answers, local source checkpoint

Historical checkpoint: its persistence limitation is superseded by
[Phase 2A-3](typed-state-checkpoint.md).

Implemented locally without changing 1.0.0 version declarations or the published
package. No Git mutation, packaging, deployment, browser automation or external
library/Core/CMS/junction changes were performed.

## Authoring and learner behavior

behaviour.answerMode is a standard select: dropdown (default) or typed. Missing
and unsupported runtime values resolve to dropdown. Behaviour exposes the mode
setting while enableRetry/enableSolutionsButton remain individually hidden at
their existing paths. Distractor text is retained; editor help explains inactivity
in typed mode. The session does not access distractors or build/shuffle a pool
when typed; only the existing Set permutation is prepared.

A native labelled text input shares the answer-control interface, Check button,
feedback and focus paths. It disables autocomplete, spellcheck and automatic
capitalization using native attributes. Input events retain exact raw text and
update availability without attempts, scoring or submitted-feedback announcements.
Refresh assigns the input value only when different, preserving the caret and
selection during typing/composition. The same input survives refresh/Next/Retry.

Enter prevents form submission and invokes the existing guarded Check. Repeated
keydown, isComposing, active composition and legacy keyCode 229 are ignored.
Equivalent repeated submissions cannot increment attempts. Native button activation
continues to use the same checking path.

## Matching, scores and lifecycle

Typed comparison applies existing NFC/outer trim/Unicode lowercase normalization.
Accents and internal spaces remain significant; inflected forms are rejected.
Only the authored Word receives the existing four-escape decoding, once. Learner
input is never HTML-decoded. Raw authored data/identities remain unchanged.

Whitespace-only input cannot be checked. The session records the normalized last
submitted typed key. Equivalent case/outer-space/canonical-Unicode edits do not
re-enable Check, including editing away and back to that submitted value. A
 genuinely different nonempty answer enables Check. Selection changes do not score.

The existing checkAnswer path owns attempts, category locking, correctness and
feedback. First/second/third-or-later correct attempts yield 2/1/0 units. Tests
cover zero through three wrong answers and a single Set without distractors.
Next, final result rendering, Retry and original-source revelation are reused.
Retry clears typed values/counts/feedback/results and unlocks categories while
preparing a fresh Set order. Existing completion reporting remains shared; no
answer-specific xAPI payload was added. Typed live completion has a basic guard
check here; comprehensive restoration/xAPI verification is deferred.

Ordinary/LancsBox parsing, normalization, gap matching/alignment, reconstruction
and original spelling/capitalization revelation were not modified.

## Explicit persistence limitation

**Typed saved-state persistence is NOT complete.** Typed registration skips
previousState; the Question serializer returns {} and the state serializer also
refuses typed sessions. No typed input is placed in schema 1. The session rejects
a supplied validated-state argument when its mode is typed. Schema-1 validation,
fingerprints and dropdown restoration are unchanged.

Reload starts a fresh typed attempt. Consequently, no cross-reload completion
suppression is promised for typed mode at this checkpoint; this depends on schema-2
restoration in Phase 2A-3. There is no typed fingerprint domain yet. These limits
are documented in editor help, README and the saved-state guide.

## Files changed

Production:
- semantics.json — answer mode, hidden lifecycle fields, help and typed instructions.
- scripts/concordances-utils.js — shared resolveAnswerMode helper only.
- scripts/concordances-session.js — typed raw input/last-submission key and shared checking.
- scripts/concordances-renderer.js — native input and generic answerControl handle.
- scripts/h5p-concordances-papijo.js — defaults, events, shared refresh/reset/focus and state guards.
- scripts/concordances-state.js — refuse typed schema-1 serialization only.
- styles/h5p-concordances-papijo.css — reuse control/focus rules for input.

Tests:
- tests/concordances-session.test.cjs.
- tests/runtime.test.cjs.
- tests/metadata.test.cjs.
- tests/helpers/dom.cjs — native-input value/selection model for caret checks.

Documentation:
- README.md; docs/editor-integration.md; docs/saved-state.md.
- docs/typed-answer-checkpoint.md (this report).

## Focused verification

One relevant selection, no broad suite:

~~~powershell
node --test --test-name-pattern='typed|answer mode|ordinary/LancsBox|Word/category|category punctuation|semantic|lifecycle|localization|browser entry|activity includes' tests/concordances-session.test.cjs tests/runtime.test.cjs tests/metadata.test.cjs
~~~

17 passed, 0 failed, 0 skipped. Cases cover default dropdown/explicit mode,
semantics/localization, typed control/labels, normalization and punctuation,
inflections, empty input, equivalent-answer gating, 2/1/0 scoring, Enter/repeat/
IME, caret retention, inactive distractors/no pool shuffle, category lock, Next,
results/Retry and schema-1 isolation. Existing ordinary/LancsBox dropdown lifecycle,
restoration, safe punctuation and fingerprint checks pass. Declared scripts also
pass the existing syntax check in this selection. DOM doubles do not establish
real browser caret, native editor or assistive-technology acceptance.

## Required Phase 2A-3 work

Implement typed-only schema 2, distinct mode-aware fingerprinting, strict validation
and restoration for partial/incorrect/changed/solved/completed answers. Preserve
schema-1 dropdown fingerprints, pool order and restoration exactly. Reject
cross-mode attempts safely. Restore typed raw values, submission gating, category,
Set order/counts/results without shuffle draws or replayed actions. Verify completed
restoration is quiet and Retry allows one new completion. Strengthen accessibility,
keyboard/IME and xAPI regressions before authorized Firefox deployment in Phase 2A-4.

STOPPED after Phase 2A-2. Version 1.1.0 preparation remains deferred until acceptance.
