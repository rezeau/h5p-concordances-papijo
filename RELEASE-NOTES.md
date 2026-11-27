# H5P.ConcordancesPapiJo 1.1.6 — prepared for WordPress acceptance

- Adds the standard H5P rich-text Task description editor, with backward
  compatibility for existing plain-text, multiline and empty introductions.
- Adds the Tutorial and Examples link to Papi Jo's H5P WordPress site at the
  top of the content editor, preserving the established informational markup.
- Retains the internal `introduction` field name; no `upgrades.js` is needed.
- Uses standard H5P semantic HTML sanitization and the existing Question section
  and introduction styling. No scoring or saved-state changes.

Both editor improvements have passed maintainer-reported H5P CLI manual acceptance.
The release package awaits manual WordPress acceptance; no deployment or publication.

---

# H5P.ConcordancesPapiJo 1.1.5 — approved for release

- Adds learner-choice answer mode alongside the unchanged fixed dropdown and typed modes.
- Compact native Select word / Type word and optional category selectors share a
  wrapping row with Start. Start finalizes both selections and removes setup controls.
- Typed scoring penalty, spelling warnings and hints retain authored settings and
  apply only to typed attempts. Session/scoring/hint algorithms are unchanged.
- Retry and parent reset return to selection with editable previous defaults;
  parent reset remains independent of Retry and does not move focus.
- Version-1 learner-answer-mode envelopes preserve selection and active attempts,
  nesting existing schemas, schema-5 hints and Results-page visibility unchanged.
  Fully validated legacy fixed-mode attempts resume in their saved mode; invalid
  states return to selection. Fixed modes reject learner-choice envelopes.
- Completion and xAPI remain tied to final correct submission, not Results navigation.
- Fixes the reproduced inactive Check-button lifecycle failure after learner Start:
  instance-scoped child-list observation acquires reinserted/replaced Question buttons,
  retains owned detached references and synchronizes Check, Hint and Next disabled/ARIA
  states. Observers disconnect on root replacement and activity destruction; stale
  callbacks are ignored. No timing delays, scoring or saved-state changes are involved.
- Corrects missing Next after learner Start by deriving every Question button's
  visibility from activity state independently of DOM references. MutationObserver
  callbacks only acquire references and synchronize disabled/ARIA state; activity
  transitions alone request visibility. Three-Set learner regressions exercise the
  actual buttons across Retry and parent reset with Question-style visibility queues.

- Start uses the API 1.28 theme-aware button factory when available, including
  custom H5P themes, with a legacy fallback. Compact layout and keyboard focus
  are preserved without hardcoded theme styling.

All 147 automated regression tests and maintainer-reported H5P CLI and WordPress
standalone acceptance passed, including saved-state restoration, parent activity
integration and theme compatibility. The compact interface, Check/Next lifecycle
fixes and themed Start button are accepted. The corrected package is approved for
release; tag creation and GitHub publication await authorization.


---

# H5P.ConcordancesPapiJo 1.1.4 — approved for release

- Exposes Enable "Retry" button in Behavioural settings, enabled by default.
- Keeps the final Set and feedback visible until the learner selects the localized
  View results button. The dedicated Results page retains existing Results formatting
  and offers Retry only when enabled.
- Completion, parent getAnswerGiven() and xAPI completion occur on the final correct
  submission, independently of Results navigation. Opening Results emits no new completion.
- Optional outer resultsPageVisible saved-state metadata preserves both completed
  presentation stages. Legacy completed snapshots open directly on Results, including
  schema-5 hint snapshots. Existing schema versions and fingerprints are unchanged;
  invalid visibility states are rejected. Older runtimes may reject extended snapshots.
- Learner Retry and parent reset clear presentation state; scoring is unchanged.

Automated, H5P CLI and user-reported WordPress acceptance passed, including
InteractiveBookPapiJo integration. Publication authorization is pending.
Learner-selectable play mode remains ON HOLD.

---

# H5P.ConcordancesPapiJo 1.1.3 — prepared for WordPress acceptance

Requires H5P Core API 1.28 and a modern browser with Intl.Segmenter support.

- Automatic horizontal centring of the keyword or gap when KWIC contexts overflow,
  measured from actual geometry and clamped to the available scroll range.
- Dynamic adjustment on container resizing and concordance Set navigation,
  including initially hidden content and correct-answer insertion when needed.
- Manual scrolling is preserved during ordinary interaction with unchanged geometry.
- Ordinary sentences, LancsBox and preformatted Multiconc keep their alignment,
  whitespace, keyword suffixes and punctuation.
- Native browser scrollbar behaviour is retained, including Firefox auto-hiding
  according to browser/platform preferences; no custom scrollbar is introduced.

No changes to authoring semantics, matching, scoring, hints, saved state or xAPI.
Focused automated checks and all user-reported manual Firefox centring acceptance
tests passed, standalone and inside InteractiveBookPapiJo. The release package
awaits WordPress acceptance and explicit publication authorization.
Existing dependency and host compatibility qualifications remain applicable.

---

# H5P.ConcordancesPapiJo 1.1.2

Requires H5P Core API 1.28 and a modern browser with Intl.Segmenter support.

- Automatic KWIC alignment for clearly ordinary sentences, anchored at the first
  keyword match per line using the existing LancsBox layout.
- Preserved LancsBox NODE alignment and numbered/preformatted Multiconc layout,
  including suffix adjacency, punctuation, capitalization and Unicode revelation.
- Approved vector KWIC speech-bubble library icon.
- Root `.h5pignore` excludes development and historical material from CLI packages.
- Retains published 1.1.1 parent task, completion and reset improvements.

No changes to authoring semantics, matching, scoring, hints, saved state or xAPI.
Presentation classification is conservative; text without distinguishing format
signals is treated as ordinary input. Existing compatibility qualifications remain.

User-reported Firefox CLI and WordPress acceptance passed all three KWIC formats.
Standard CLI packaging/installation and WordPress icon display passed. These
checks were completed before candidate preparation and were not repeated.
Version 1.1.2 was subsequently published and accepted standalone and inside
InteractiveBookPapiJo.

---

# H5P.ConcordancesPapiJo 1.1.1

Requires H5P Core API 1.28 and a modern browser with Intl.Segmenter support.

- Boolean `isTask = true` identifies the activity as a task to parent containers.
- Completion-based `getAnswerGiven()` recognizes completed selected-category
  activities independently of score, including restored completed attempts.
- Parent-callable `resetTask()` clears unfinished or completed attempts, including
  saved state before attachment, independently of learner Retry availability and
  without moving focus.
- Focused regression tests cover parent completion, restoration, Retry and reset.

User-reported integration testing passed in H5P CLI and local WordPress,
including completion recognition, partial scoring, Summary and Restart inside
ColumnPapiJo and InteractiveBookPapiJo.

---

# H5P.ConcordancesPapiJo 1.1.0

Requires H5P Core API 1.28 and a modern browser with Intl.Segmenter support.

- Typed answers alongside the existing dropdown default.
- Optional adaptive progressive letter hints based on the latest checked answer;
  each revealing request costs 0.5 points. Hints are disabled by default.
- Typed spelling warnings with 1, 2 (default), 3 or unlimited free warnings per
  Set. Exact correction is required; repeated warned answers are blocked.
- Configurable typed incorrect-attempt penalties of 1 (default) or 0.5 points,
  with fractional activity results and xAPI scores.
- Set order: Shuffle Sets (default) or Keep author-defined order. Category
  eligibility is unchanged; restoration retains the saved run order and Retry
  follows the selected policy.
- Saved-state support for dropdown, typed answers, spelling-warning history and
  adaptive hints (schemas 1/2/4/5), plus accessible spelling feedback, hint
  descriptions, keyboard/IME handling and quiet restoration.

The exact package passed validation and user-reported independent WordPress
installation and Firefox acceptance.

**WordPress compatibility:** WordPress H5P plugin 1.17.10 does not preserve
fractional scores in My Results because its results pipeline uses integer-only
validation, storage and display. Concordances itself reports fractional scores
correctly through its activity results and xAPI. This release does not fix the
WordPress integration; successful installation/Firefox acceptance does not imply
fractional My Results support.

The upstream jQuery UI missing-sprite qualification and the official
ShowWhen/ShowWhenpapijo global-widget collision risk remain. Optional learner
Hint Help (?) remains deferred. See the
[technical release record](docs/release-1.1.0.md).

---

# H5P.ConcordancesPapiJo 1.0.0

First stable standalone release, requiring H5P Core API 1.28.

- Ordinary KWIC concordances and simplified three-column LancsBox X exports:
  LEFT [TAB] NODE [TAB] RIGHT.
- Automatic gap generation with Unicode-aware, NFC-normalized case-insensitive
  matching, including word fragments, and exact original-text revelation.
- Aligned LancsBox primary gaps, preserving prefixes, suffixes and punctuation.
- Global distractors, category filtering/locking, shuffled Sets and answer options.
- Unlimited attempts, 2/1/0 scoring, detailed results and Retry.
- Saved-state restoration and xAPI completion reporting.
- Native keyboard controls, accessible reading alternatives and theme-aware styling.

Manual gaps and five-column LancsBox exports are unsupported. QuestionSetPapiJo
and InteractiveBookPapiJo integration are deferred; version 1.0.0 is standalone.
Modern browser support for Intl.Segmenter is required. Dependencies are bundled
in the .h5p content package; H5P Core and the host integration are not.

The exact package passed independent WordPress installation and Firefox acceptance,
including both formats, partial scoring, editor save/reopen, saved-state restoration
and completion/results reporting. The bundled official jQuery UI dependency
references six unavailable PNG sprites; independent Firefox testing showed no
corresponding image requests or observed defects. This is an environment-specific
observation, not a guarantee for every host. See the
[technical release documentation](docs/release-1.0.0.md).
