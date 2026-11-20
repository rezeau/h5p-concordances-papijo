# KWIC rendering contract

Validation inspects all Sets before creating the learner session or controls.
Missing words/Contexts, duplicate normalized words, malformed or mixed input,
legacy underscore runs and nonempty lines without safe target matches produce
localized diagnostics. Set/line numbers identify the relevant input; no partial
activity is displayed.

ConcordancesPapiJoUtils.normalizeConcordance first recognizes ordinary or
headerless three-field LancsBox input (LEFT, NODE, RIGHT) for the whole Context. Ordinary lines retain
spaces, tabs and line endings. Tabular rows become unnumbered KWIC with field boundaries normalized. Original authored parameters remain
unchanged. Detection rules are in the [phase report](release-1.0.0.md).

The existing tokenizeAutomaticContext matcher always runs on the resulting display
copy. It uses NFC/lowercase comparison at grapheme boundaries, including fragments
and multiple non-overlapping occurrences. It requires Intl.Segmenter and returns
no tokens on errors. Tokens retain matched source spelling and UTF-16 offsets
within that display copy; they are not offsets into raw tabular authoring input.

renderSet creates one labelled section and blockquote with a focusable horizontal
scroll region, one monospace pre, text nodes and five-underscore gap spans.
Ordinary input keeps this pre layout. LancsBox uses shared intrinsic CSS grid
tracks for right-aligned left contexts and inline primary/continuation
regions. Display-only field offsets select the first matched span in NODE;
other occurrences are not anchors. No whitespace padding is introduced. Rows
without a safe NODE match are rejected as ambiguous tabular input.
There is no manual-gap spacing transform. revealSet
replaces gap spans with strong elements containing each original matched substring;
surrounding text nodes stay intact. Repeated revelation is idempotent.

Only the visual pre is aria-hidden. A separate visually hidden, non-live reading
group has one paragraph per line with localized missing-word text, updated on
revelation. The scroll region retains a visible theme-aware focus outline.
Native selects and themed Question buttons retain keyboard behavior. Wrong Check
focuses the answer, correct Check the Context, Next the incoming input, and Retry
the category or answer. Initialization/restoration does not steal focus.

Runtime display reverses &quot;, &#039;, &lt; and &gt; once in Word/Context copies;
ampersands are not decoded. All authored output uses textContent/text nodes.
No HTML parsing or raw-parameter mutation is introduced. Standard editor
save/reopen transport remains a separate integration boundary.

Registration/reattachment is idempotent; domChanged triggers resize without window
listeners or resize loops. Retry creates a fresh session and clears revelations,
feedback and results using existing controls. Full validation precedes saved-state
hydration; restored completed sessions and rendering emit no completed xAPI event.
The last live correct Check reports completion once. See the
[session contract](selection-session.md) and [saved-state contract](saved-state.md).
