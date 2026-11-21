# Phase 2B-3a — progressive hint setting and first unlocking only

Local source checkpoint after reported Firefox acceptance of Phases 2B-2f/2g.
Version declarations remain 1.0.0 and the published package is unchanged. No
packaging, deployment, Git mutation, publication, Core/CMS/other-library change or
CLI-junction alteration. No letter revelation, hint scoring or hint-state persistence.

## Author setting

behaviour.enableProgressiveHints is a standard boolean defaulting to false, labelled
Enable progressive letter hints in Typed answer mode. Its description is exactly:
Allow learners to request progressive letter hints after making incorrect attempts.
Each hint reduces the available score by 0.5 points.

ShowWhen requires answerMode=typed and nullWhenHidden=false retains the checkbox
when switching temporarily to dropdown. Only boolean true enables it at runtime;
missing/invalid values disable it. Dropdown ignores it. Existing hidden lifecycle
controls remain hidden. The deduction described is future 3b behavior, not an
active scoring feature in this checkpoint.

## Learner control and accessibility

Only typed/enabled activities register a Hint button using Question.addButton;
read-only inspection confirms the installed themed Question implementation creates
an H5P Components button. The button is always disabled (native disabled plus
aria-disabled) and never has an active hint action in 3a.

The initial visible explanation states either two scored incorrect attempts, or
that condition plus exhausting finite spelling warnings. It is static text near
the answer and linked through aria-describedby from both answer and Hint controls;
no mouse tooltip is required. The explanation uses a note role without introducing
another live announcement. Input/native keyboard/focus/IME handling is unchanged.

When unlocked, the button is hidden and the explanatory text becomes the clear
noninteractive Hint available status. No enabled no-op button is presented. Once
the Set is solved both the button and status are hidden. Next displays the incoming
Set's locked control, and Retry resets it through the existing fresh session.

## Unlocking

Availability derives solely from current Set state:
- Typed + Regular mistake: at least two scored incorrect attempts.
- Typed + Warn: at least two scored incorrect attempts OR finite warnings exhausted.
- Typed + Warn + Unlimited: only at least two scored incorrect attempts.

Free warnings do not increment scored attempts. Existing blocked-repeat gating is
untouched, so repeated normalized answers cannot unlock by adding attempts. The
condition is monotonic while the Set remains unsolved. Category semantics and
navigation remain unchanged. No extra counters or persistent hint fields exist.
If existing attempts/warning counts are restored, availability is re-derived; this
is not persistence of requested hints. Completed restoration remains on the existing
quiet path.

## Scope retained for Phase 2B-3b (design only)

Implement first-letter then first-three-letter revelation, followed by additional
letters without a fixed two-hint limit. Skip spaces/punctuation when counting
letters. While attainable points remain, require a new scored incorrect attempt
after each requested hint. Once attainable score reaches zero, permit further
hints without extra attempts, up to complete answer revelation. Each requested
hint deducts 0.5 with floor zero; zero-score solving remains valid. Hint actions,
score effects and saved-state design belong to that later checkpoint and were not
implemented here.

## Exact files changed in this checkpoint

- semantics.json — checkbox, ShowWhen and four Hint UI localization strings.
- scripts/h5p-concordances-papijo.js — effective boolean default, themed disabled
  button, derived first-hint availability and solved/reset visibility.
- scripts/concordances-renderer.js — optional visible explanatory note and answer association.
- tests/runtime.test.cjs — Hint button capture in existing Question double and focused behavior tests.
- tests/metadata.test.cjs — checkbox/default/visibility/localization checks.
- README.md; docs/editor-integration.md — current preparatory scope.
- docs/progressive-hint-configuration-checkpoint.md — this report.

Session/scoring/state modules, detector/highlighting/underscore, stylesheet, schemas
1/2/4, fingerprints, xAPI and KWIC/LancsBox parsing/rendering were not changed.
Earlier uncommitted development work is preserved.

## Focused verification

~~~powershell
node --test --test-name-pattern='progressive hint|answer mode is visible|localization covers' tests/runtime.test.cjs tests/metadata.test.cjs
~~~

7 passed, 0 failed, 0 skipped. Covers disabled/missing/invalid/dropdown absence,
checkbox semantics/hidden values, disabled button and description association,
strict two-attempt unlocking, finite allowances 1/2/3, Unlimited and free/repeated
submissions, available status without a live action, later attempts retaining
availability, solved hiding, Next's fresh Set and Retry. Tests also verify unchanged
score/maximum and no serialized hint fields. No broad tests or browser automation.

## One manual Firefox acceptance sequence

Enable the checkbox in typed mode with Regular mistake. Confirm a visible disabled
Hint button and readable locked explanation. Submit two genuinely different wrong
answers: after the first it stays locked; after the second the button disappears
and noninteractive Hint available appears. No letters or hint score deductions
should appear. Solve, use Next on a second Set, and verify a fresh locked control;
finish and Retry to verify reset.

In the same acceptance exercise, switch to Warn/default allowance 2 on a fresh
attempt: two distinct free warnings should unlock despite zero scored attempts.
A repeated warned answer must not count. With Unlimited, free warnings alone must
not unlock; two scored unrelated mistakes must. Switch to dropdown or disable the
checkbox: the whole Hint control must be absent. Check native keyboard/screen-reader
access to the visible explanation. Author selection must survive mode switching.

Remaining limits: DOM doubles are not visual or assistive-speech acceptance. The
preparatory control provides no letters/action or hint cost/persistence until 3b.
STOPPED after Phase 2B-3a, awaiting manual acceptance/authorization.
