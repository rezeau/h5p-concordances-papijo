# H5P.ConcordancesPapiJo 1.1.2 — release candidate

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
Published releases and tags are unchanged; this candidate has not been published.

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
