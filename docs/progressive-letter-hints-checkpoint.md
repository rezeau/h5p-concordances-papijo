# Phase 2B-3b — adaptive progressive letter hints

Local source only; version remains 1.0.0 / H5P Core API 1.28. No packaging,
deployment, Git mutation, publication, Core/CMS/other-library or CLI-junction change.

Phase 2B local Firefox acceptance has since been reported by the user. The
acceptance exercise below is retained as its checklist; future 1.1.0 package
installation and fractional WordPress My Results persistence remain unverified.

## Adaptive rules

The existing typed-only author checkbox remains disabled by default. First unlock
still requires two scored mistakes or exhaustion of finite free spelling warnings.
Unlimited warnings never exhaust. Unlocking alone neither reveals nor deducts.

On request, compare the once-decoded authored Word with the latest accepted Check
submission, using NFC, outer trimming and Unicode lowercase as in answer checking.
Never read live input for hint matching. Compare grapheme clusters from left to
right and count matching letter clusters. Accents and internal spaces/punctuation
remain significant. Visible revelation preserves the authored case and combining
sequences; spaces/punctuation remain visible and do not count as letters.

Reveal the matched prefix and its next letter, retaining all previous revelation.
When points remain, cap the revealed prefix at one fewer than all letter clusters.
If that gives no new letter, keep Hint disabled and charge nothing. Every actual
letter-revealing request counts once and costs 0.5 points, with score floor zero.
The existing incorrect-attempt penalties and score/completion reporting are intact.

After a hint, while points remain, require a new checked answer whose prefix is
longer than at the last hint request. A different but non-improving answer does
not unlock Hint. Existing blocked submissions do not update the checked answer or
counters. At zero points, require a new scored mistake since the previous hint;
then reveal at least one additional letter, or more when the new prefix warrants
it. Repeated clicks alone never advance. Full revelation does not solve the Set:
the learner still checks the exact target answer. Next starts a pristine Set;
Retry resets hints, warnings, attempts and scores.

## Explicit interpretations

- The full-answer cap uses attainable points before the hint request. A deduction
  that reaches zero does not reveal the last letter in that request.
- At positive points, a newly checked free-warning answer may satisfy prefix
  improvement; at zero, a free warning alone cannot unlock another hint.
- At zero, a new scored submission permits advancement beyond the previous reveal
  even if its prefix is shorter. Otherwise a non-improving answer could never
  advance toward full revelation under the zero-point exception.
- Punctuation and internal spaces are significant when comparing the prefix,
  matching ordinary answer normalization; they are not silently stripped.

## State, accessibility and rendering

Schema 5 retains its strict wrapper and uses a new adaptive fingerprint domain.
Each Set entry is [identity, requestHistory]. Each history entry is
[scoredIncorrectAttempts, totalIncorrectAndWarningSubmissions, matchedPrefix,
revealedLetters] at that request. Count and progression derive from the history.
Validation checks bounds, monotonic submissions/warnings/revelation, first unlock,
prefix improvement or a new scored submission, no positive-score full revelation,
and consistency with the latest checked prefix where that answer is still known.
Future/ineligible Sets cannot have hint history. Malformed or obsolete fixed-hint
schema-5 states are rejected; no migration is introduced. Schemas 1/2/4 and their
fingerprints are unchanged for hint-disabled content.

Restoration reconstructs the same revealed text and progression quietly, with no
new checking, deduction, focus movement, announcement or completion event. Safe
textContent rendering, theme inheritance, live input, existing KWIC rendering and
the established localized hint announcement remain in use. The localized
hintAfterRequest description now explains prefix improvement and the zero-point
scored-submission condition. Locked explanations remain screen-reader-only.

## Exact files changed for the adaptive correction

- scripts/concordances-session.js — prefix comparison, adaptive request/gating.
- scripts/concordances-state.js — adaptive schema-5 history validation/restoration.
- scripts/h5p-concordances-papijo.js — updated default accessible description.
- semantics.json — corresponding translatable description.
- tests/runtime.test.cjs — replace fixed-revelation tests with adaptive checks.
- README.md — current adaptive behavior.
- docs/progressive-letter-hints-checkpoint.md — this report.

## Focused verification

```powershell
node --test --test-name-pattern="adaptive hints|schema-1 published fixture|typed schema 2 preserves|warning allowance schema 4" tests/runtime.test.cjs tests/concordances-state.test.cjs
```

7 tests passed, 0 failed, 0 skipped: four adaptive checks and three unchanged
schema-1/2/4 checks. Covers the supplied fresco prefixes, live-input isolation,
no-charge masking, prefix-improvement gating, blocked repeats, both penalty values,
the transition to zero, new scored submissions at zero, full revelation without
completion, fractional scores, Unicode normalization/graphemes, safe rendering,
Retry, Next, quiet active/completed restoration and invalid history rejection.
No broad suite or browser automation.

## Firefox acceptance exercise

Use typed mode with hints enabled and half-point mistake penalties, target fresco,
Context FRESCOes. With Regular mistake, submit frost then frosted: Hint becomes
available. Edit live input to fresc without checking, then request Hint: it must
show fre___, using the checked frosted, not live input. A new frosting submission
can itself bring attainable score to zero; it may then unlock under the exception,
but subsequent Hint clicks must wait for another scored submission.

For a positive-score run, use Warn with allowance 1: submit aresco and request
Hint (f_____). Submit mosaic: no new hint. Submit frisco: Hint unlocks and reveals
fre___. Now points are zero, but another scored submission is still required.
Continue with distinct wrong answers between hints until fresco is visible;
the Set remains unsolved until fresco is checked. Save/reopen through genuine host
persistence mid-flow: reveal position and gating must restore without announcement.
Finish, Next and Retry; verify fresh hint state. In another fresh run, fresoc
unlocks the free-warning hint as fresc_; checking fresc while points remain must
not expose the final o or charge another hint.

Remaining limitation: automated DOM checks do not establish Firefox visual,
screen-reader or genuine host persistence acceptance. The subsequent user-reported
local Firefox acceptance does not establish fractional host persistence.
