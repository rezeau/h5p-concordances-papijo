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
