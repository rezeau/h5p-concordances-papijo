# Selection session and learner lifecycle

The session model is unchanged by Phase 1K-2A. Automatic input validation and
LancsBox conversion happen before the session is prepared. No format selector
or new learner control is added.

One attempt prepares a Fisher-Yates Set permutation and global answer pool once.
The pool includes every correct word before distractor lines, using
NFC/trim/lowercase/NFC deduplication and the first trimmed display spelling.
Category filtering never shrinks or reshuffles it. Native option values are
opaque pool positions; no current correct-answer flag is written to attributes.

Categories derive from Set values, with All categories and Uncategorized where
needed. Commas remain part of names. Before the first accepted Check, category
changes start at the first eligible Set. The first accepted Check locks category
and eligible order, whether correct or incorrect. Unknown or locked category
changes are ignored.

Selecting an answer does not evaluate it. Check requires a nonempty selection and
an unsolved Set; unchanged already-submitted input and duplicate callbacks are
ignored. An accepted Check increments once. Wrong answers retain blanks and
require a selection change before resubmission. Unlimited attempts are allowed.
Correct answers reveal every generated gap and lock the Set.

Next advances exactly one eligible Set after success, without reshuffling.
Progress uses eligible position, not authored index. There is no Previous or Skip.
Per-Set selections, attempts and correctness survive refresh and reattachment.
Correct Sets earn 2 units on attempt 1, 1 on attempt 2, and 0 thereafter. Unsolved
Sets earn zero; maximum is twice the eligible count and stays fixed after lock.

Once every eligible Set is solved, the final revealed Context remains above a
static semantic table of prepared-order words, accepted attempts and earned/max
units. The last live correct Check emits one completed xAPI event, including at
raw score zero. Rendering and restoration do not replay it.

Retry is shown only after results when the existing hidden enableRetry setting
permits it. It prepares fresh permutations, clears per-Set state/results/feedback,
returns to All categories with an unlocked sequence and focuses category or answer.
The same permutation can recur by chance. Existing controls/listeners are reused.

Native labelled selects and themed Question buttons retain focus outlines. One
polite atomic region announces Check feedback. Wrong Check focuses the answer;
correct Check focuses the Context; Next focuses the incoming answer or solved
Context. Restored feedback/results remain quiet and initial attachment does not
move focus.

getCurrentState returns independent schema-1 data for a valid initialized session.
Compatible previousState is strictly validated then restored without shuffle draws.
Missing or invalid state starts clean; the [state contract](saved-state.md)
documents automatic-only compatibility. getAnswerGiven remains false; parent
resetTask/showSolutions/getXAPIData contracts remain deferred.
