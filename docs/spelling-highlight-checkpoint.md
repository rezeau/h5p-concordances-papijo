# Phase 2B-2d — highlighted free-warning feedback

Local source only. Versions remain 1.0.0. No package, deployment, Git mutation,
release, Core/CMS/other-library change or CLI-junction alteration. No progressive
hints. Warning rules, detector/thresholds, scoring, schemas/fingerprints and
completion-reporting code are unchanged.

## Reference inspection

No installed library with the exact machine name FillintheBlanksPapiJo was found
in the inspected local project/CLI/WordPress library inventories. The available
Papi Jo implementation is H5P.AdvancedBlanksPapiJo (Advanced fill the blanks papi Jo).
Its blank.ts getSpellingMistakeMessage and spelling-mistake CSS were inspected
read-only: it marks added/mistaken characters with spans and represents missing
characters using markers. Only this presentation technique was adapted. Its HTML
insertion/diff dependency/tooltip architecture were not copied; there is no new
runtime dependency and no reference-library modification.

## Presentation and edit mapping

The existing feedback area contains one block-level span line, localized with
spellingWarningAnswer: Check your spelling: @answer. Its learner-answer span uses
text nodes and styled spans. No corrected target or missing target character is
shown. The editable input remains untouched.

A renderer-only helper first asks the unchanged detector whether this is a valid
minor error. The normalized code-point mismatch identifies the edit. It maps
positions back to the original submitted text using whole-grapheme ranges, keeping
capitalization, accents, decomposed Unicode and outer spaces unchanged:

- Substitution: emphasize/underline the substituted character.
- Insertion: emphasize/underline the extra character.
- Adjacent transposition: emphasize/underline both swapped characters.
- Deletion: insert an empty, aria-hidden dotted-underline marker at the approximate
  omission position, never the missing character.

Underline and bold emphasis accompany the theme-aware error color. Deletion markers
have a small visual width but contain no text. For repeated characters, the first
valid mismatch alignment is used; edit positions can be non-unique. A defensive
mapping-length mismatch falls back to unaltered plain text rather than inventing
positions. Exact/ordinary incorrect feedback and KWIC/LancsBox views are unchanged.

## Safety, accessibility and restoration

All learner text uses createTextNode/textContent; no innerHTML or learner entity
decoding. A malicious-looking non-minor value is rendered literally without any
invented highlight. The live announcement is one plain sentence, e.g. Check your
spelling: fresoc. Decorative spans have no roles/individual announcements; the
empty omission marker is aria-hidden. Existing feedback association, native input
focus, Enter/repeat/IME and caret rules remain in use.

The line is reconstructed from current/restored raw typed text and the once-decoded
authored Word. Its announcement string is display-only, never serialized. Restored
feedback is visible while the existing refresh path clears the live region; no
completion is emitted. Tests verify identical snapshots before/after restoration.

## Exact files changed in this checkpoint

- scripts/concordances-renderer.js — renderSpellingWarning display helper.
- scripts/h5p-concordances-papijo.js — warning rendering/live plain-text announcement.
- semantics.json — translatable submitted-answer warning template.
- styles/h5p-concordances-papijo.css — answer line, emphasized error and omission styles.
- tests/concordances-renderer.test.cjs — edit positions, Unicode and safe text.
- tests/runtime.test.cjs — announcement/restoration/counts and updated warning expectations.
- tests/metadata.test.cjs — localization completeness.
- docs/spelling-highlight-checkpoint.md — this report.

Earlier local checkpoint edits remain in place.

## Verification

~~~powershell
node --test --test-name-pattern='spelling feedback highlights|highlighted spelling warning|exact correct feedback|spelling warning announces|Firefox fresco reproduction|localization covers' tests/concordances-renderer.test.cjs tests/runtime.test.cjs tests/metadata.test.cjs
~~~

6 passed, 0 failed, 0 skipped. Covers all four edit types, beginning/end omission,
original case/outer spaces, decomposed accents and astral characters, safe learner
markup/entity text, one plain announcement, input focus/value, no premature target
revelation, zero scored attempts, quiet identical-state restoration, Retry and
existing warning/exact/mistake/dropdown paths. No broad suite or browser automation.

## One Firefox acceptance test

Use typed mode, Warn, Word fresco, Context FRESCOes, with a fresh attempt for each
sample (only one free warning is allowed per Set). Submit fresoc: expect Check your
spelling: fresoc with oc underlined/emphasized, unchanged input, zero scored attempts,
input focus and unrevealed _____es. In fresh sessions compare frescp (p), frescco
(extra c) and fresc (empty marker after c, no o shown). Where persistence is available,
resume the warned fresoc attempt: the same highlight should return without a live
announcement/new completion. Correct to fresco and verify the usual original-text
revelation and first-scored-attempt 2/2. Listen to warning speech if using a screen
reader; decorative markup must not repeat the answer.

Browser styling/assistive speech and real host persistence still require this manual
acceptance. The earlier WordPress fractional My Results limitation is unaffected.
STOPPED after Phase 2B-2d, awaiting authorization and manual acceptance.
