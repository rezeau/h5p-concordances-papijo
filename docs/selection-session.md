# Selection session and learner lifecycle

Current source includes accepted Phases 2B/2C. Automatic input validation and
LancsBox conversion happen before the session is prepared. No format selector
is needed. Answers may use a dropdown or typed input.

One attempt prepares a Fisher-Yates Set permutation by default, or uses editor
order when Keep author-defined order is selected. Eligible Sets are filtered
before applying that fixed run order. The dropdown answer pool shuffles separately.
The pool includes every correct word before distractor lines, using
NFC/trim/lowercase/NFC deduplication and the first trimmed display spelling.
Category filtering never shrinks or reshuffles it. Native option values are
opaque pool positions; no current correct-answer flag is written to attributes.

Categories derive from Set values, with All categories and Uncategorized where
needed. Commas remain part of names. Before the first accepted Check, category
changes start at the first eligible Set. The first accepted Check locks category
and eligible order, whether correct or incorrect. Unknown or locked category
changes are ignored.

Selecting or typing an answer does not evaluate it. Check requires a nonempty answer and
an unsolved Set; unchanged already-submitted input and duplicate callbacks are
ignored. A scored Check increments once. Typed Warn permits the configured
1/2/3/unlimited free minor-spelling warnings (default 2) without scored attempts;
repeated normalized warned answers are blocked. Exact correction is required.
Wrong answers retain blanks and require an answer change before resubmission. Unlimited attempts are allowed.
Correct answers reveal every generated gap and lock the Set.

Next advances exactly one eligible Set after success, without reshuffling.
Progress uses eligible position, not authored index. There is no Previous or Skip.
Per-Set selections, attempts and correctness survive refresh and reattachment.
Dropdown Sets earn 2 on attempt 1, 1 on attempt 2, and 0 thereafter. Typed solved
Sets earn max(0, 2 - penalty × scoredIncorrectAttempts - 0.5 × hintRequests), with
penalty 1 (default) or 0.5. Unsolved Sets earn zero; maximum is twice the eligible
count and stays fixed after lock. Native results/xAPI preserve fractions;
fractional WordPress My Results persistence is not established.

Optional typed hints are disabled by default. Two scored mistakes or finite
warning exhaustion unlock the first hint. Each revealing request costs 0.5 and
uses the latest checked prefix plus the next letter, retaining prior revelation.
Later requests need improved checked prefixes while points remain; at zero they
need a new scored submission. Full revelation is permitted only at zero and
does not solve the Set. See [the adaptive rules](progressive-letter-hints-checkpoint.md).

Once every eligible Set is solved, the final revealed Context remains above a
static semantic table of prepared-order words, accepted attempts and earned/max
units. The last live correct Check emits one completed xAPI event, including at
raw score zero. Rendering and restoration do not replay it.

Retry is shown only after results when the existing hidden enableRetry setting
permits it. It reapplies the ordering policy, clears per-Set state/results/feedback,
returns to All categories with an unlocked sequence and focuses category or answer.
Shuffle permutations can recur by chance; author mode uses current editor order.
Existing controls/listeners are reused.

Native labelled selects and themed Question buttons retain focus outlines. One
polite atomic region announces Check feedback. Wrong Check focuses the answer;
correct Check focuses the Context; Next focuses the incoming answer or solved
Context. Restored feedback/results remain quiet and initial attachment does not
move focus.

getCurrentState returns independent schema-1/2/4/5 data according to the active mode.
Compatible previousState is strictly validated then restored without shuffle draws.
The saved permutation survives editor reordering until Retry.
Missing or invalid state starts clean; the [state contract](saved-state.md)
documents automatic-only compatibility. getAnswerGiven remains false; parent
resetTask/showSolutions/getXAPIData contracts remain deferred.
