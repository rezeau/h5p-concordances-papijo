# Typed spelling detection and warnings

The current two-policy contract is documented in
[Phase 2B-2b](two-spelling-policies-checkpoint.md). Earlier three-policy behavior
has been removed; there is no setting that solves a misspelled answer.

The shared detector is unchanged: one insertion, deletion, substitution or adjacent
transposition on NFC/trim/lowercase Unicode code points, with a target of at least
five code points and input of at least four. Both must be lexical single words.
Short words/expressions remain exact-only. Accents are significant; a one-edit
accent difference can trigger the free warning. Distance does not establish word
meaning, so similar legitimate words can still be classified as minor errors.

Warn grants the configured free-warning allowance per Set (default 2), retaining input/focus and not increasing
scored attempts. Later minor errors count normally. Regular mistake is the default.
Both policies require exact correction before success and original-text revelation.
The one-point and half-point scoring options, Enter/IME/caret behavior, safe text
rendering and existing completion flow remain unchanged.
