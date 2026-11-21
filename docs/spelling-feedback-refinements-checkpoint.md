# Phase 2B-2g — spelling feedback refinements

Local source checkpoint after the user's six successful Phase 2B-2f Firefox checks.
No scoring/detector/state-schema/fingerprint or checking-flow changes. Source versions
remain 1.0.0. No Git mutation, package/deployment/publication, Core/CMS/other-library
or CLI-junction changes. No progressive hints or unrelated features.

## Exhaustion feedback

The Question shell derives exhaustion from the current submitted incorrect feedback,
typed/Warn mode, finite allowance consumed, a new normalized answer absent from
warning history, and eligibility under the unchanged one-edit detector. It uses the
existing feedback textContent and live-region announcement, with translatable
spellingWarningsExhausted:

Incorrect — You have used all your free spelling warnings.

The session has already counted this as an ordinary scored error. No warning count,
history, attempt rule or penalty is changed. Input remains editable/focused and
Context remains hidden. Unrelated incorrect answers retain ordinary feedback and
Unlimited cannot meet the exhaustion condition. Editing clears submitted feedback
under existing rules; checking a different answer re-derives the correct message.
Repeated warned answers remain blocked by the existing history gate.

The same derivation reconstructs exhausted feedback after valid restoration, while
the existing refresh path leaves the live region empty. No exhaustion flag or other
persisted data was added. The completion-reporting function is untouched.

## Missing-letter underscore

The display-only warning renderer inserts exactly one underscore text node inside
a styled span at the existing normalized-code-point-to-original-grapheme omission
position. The span shares the theme-aware spelling-error color, bold and underline;
the previous dotted-border/width rule was removed. Learner characters, capitalization,
outer spaces, decomposed accents and astral code points remain intact. No missing
letter or corrected target is inserted, and the editable input is unchanged.
Substitution/insertion/transposition mapping is unchanged.

The visual underscore is aria-hidden. A visually hidden localized sentence,
a11y.missingLetter (A letter is missing.), supplies the missing-letter meaning in
static/restored feedback. The existing live region announces the raw submitted
answer plus that sentence once, rather than reading decorative underscores/spans.
All learner output uses text nodes/spans, never HTML interpolation or entity decoding.
Focus, keyboard, Enter/IME and caret handling are unchanged.

Restored active warning feedback uses the same rendering and accessibility text,
without Check, new announcements or completion. Tests assert identical serialized
state before/after restoration. Schemas 1/2/4 and all fingerprint rules are untouched;
previously retired development schemas remain retired.

## Exact files changed in this checkpoint

- scripts/h5p-concordances-papijo.js — derived exhaustion feedback/announcement and localized missing-letter propagation.
- scripts/concordances-renderer.js — underscore and accessible missing-letter sentence.
- semantics.json — spellingWarningsExhausted and a11y.missingLetter localization fields.
- styles/h5p-concordances-papijo.css — remove faint dot; underscore uses existing error styling.
- tests/runtime.test.cjs — exhaustion/ordinary/Unlimited/gating/scoring and quiet underscore restoration.
- tests/concordances-renderer.test.cjs — revised omission expectations and Unicode omission cases.
- tests/metadata.test.cjs — localization expectations.
- docs/spelling-feedback-refinements-checkpoint.md — this report.

Earlier uncommitted work is preserved. No session, state-validator or detector
implementation was modified in this checkpoint.

## Focused verification

~~~powershell
node --test --test-name-pattern='exhaustion feedback|missing-letter underscore|spelling feedback highlights|highlighted spelling warning|localization covers' tests/runtime.test.cjs tests/concordances-renderer.test.cjs tests/metadata.test.cjs
~~~

6 passed, 0 failed, 0 skipped. Tests cover finite exhaustion with both penalties,
ordinary unrelated errors, Unlimited, blocked warned answers, unmodified warning
history/counts, input focus/editability, preserved scores, no answer revelation,
quiet identical-state restoration, safe rendering and Unicode/grapheme mapping.
Existing substitution/insertion/transposition cases also pass. No broad suite or
browser automation was run.

## One Firefox acceptance sequence

Use a fresh typed/Warn activity: Word fresco, Context FRESCOes, default allowance 2.
Submit freco: expect visible Check your spelling: fre_co, unchanged editable freco,
input focus and no scored attempt. A screen reader should report that a letter is
missing without naming it. Where host storage is available, save/reload now: expect
the same underscore quietly, with the warning count retained.

Submit fresoc for the second free warning, then frescp: expect exactly the new
exhaustion message, one scored mistake and unchanged warning count/history. Submit
mosaic next: ordinary Incorrect. Return to FRECO: Check remains blocked. In a fresh
Unlimited attempt, the same new typos must remain free warnings without exhaustion.
Correcting to fresco must retain normal original revelation and the selected
penalty's score. This is one sequential manual acceptance exercise, not an automated
browser run.

Remaining limits: real browser styling/assistive speech and host persistence remain
manual checks. The existing WordPress integer-only My Results limitation for fractional
scores is unaffected. The existing edit-position projection fallback and spelling
thresholds remain unchanged. STOPPED for Firefox acceptance.
