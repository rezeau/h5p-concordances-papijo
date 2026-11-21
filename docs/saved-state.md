# Saved-state schemas 1/2/4/5

This guide describes the accepted Phases 2B/2C local source. User-reported Firefox
acceptance is complete, including independent installation of the exact 1.1.0
package. WordPress H5P plugin 1.17.10 uses integer-only My Results handling;
native/xAPI fractional scores are correct but are not preserved in that host view.

Serialization, validation and Phase 1E-2 restoration are implemented. At initial
registration, restoreSession validates contentData.previousState and hydrates the
existing session without shuffle draws. Invalid candidates start clean. No custom
storage, network or parent API is added. Phase 1H-1 completed reporting
uses an in-memory guard initialized from the restored solved state; this format
does not change and restored completed states are not reported again.

## Typed schema 2 (local Phase 2A-3)

Dropdown retains the exact schema-1 contract below. Typed mode uses separate strict
schema-2 records and fingerprints. APIs fingerprint/validateState/restoreSession
accept a behaviour argument with answerMode typed; omission or explicit dropdown
selects schema 1. createState infers mode from the session. Mode is never inferred
from an untrusted snapshot.

Schema 2 has exactly version (2), answerMode (typed), fingerprint, setOrder,
category, locked, position, sets and results. There is no answerOrder or persisted
score. Each Set tuple is:

~~~text
[id, rawTypedText, attempts, solved, checked, lastSubmittedNormalizedKeyOrNull]
~~~

Raw text is preserved, not HTML-decoded; markup-looking strings are safe plain
text. checked represents visible submitted feedback. The retained last submitted
key also blocks equivalent resubmission after editing away and back, even when
checked is false. Solved rows must match the once-decoded authored target under
NFC/trim/lowercase rules. Newline values are rejected because a native single-line
input cannot preserve them; there is no arbitrary length cap or markup ban.

Typed canonical fingerprint input is [2, typed, categoriesEnabled, sortedSetRecords,
[automatic-gaps, interpretation]], hashed with the unchanged cpj1 algorithm.
Interpretation remains 1 for ordinary, 3 when any Set is tabular. Records retain
raw Word/Context/category and raw normalized identities. Distractors are excluded
and never read for typed compatibility. Relevant authored edits or a mode change
reject incompatible snapshots. Schema 1 canonical input remains unchanged.

Restore validates exact data shapes, category/Set identity/order, attempts,
submitted-key consistency, solved/checked state, pristine future/ineligible Sets,
lock and results. Only fully valid independent data hydrates the session, without
shuffle draws, auto-checks, focus stealing or live announcements. Scores/results
are derived and completed restoration initializes the existing completion guard.
See [the checkpoint report](typed-state-checkpoint.md).

## Configurable typed scoring (local Phase 2B-1)

Schema-2 fields/tuple validation and derived-score storage rules are unchanged.
Missing/explicit one-point penalty keep the earlier typed canonical payload
exactly. Only half-point scoring appends [typed-penalty, 0.5] after the existing
interpretation marker, before cpj1 hashing. Changing penalty rejects incompatible
attempts; inactive dropdown penalty values do not affect schema 1 or its hash.
Typed state creation uses the session's effective penalty; validation, restoration
and fresh/Retry sessions use the resolved Behaviour setting. No stored score,
penalty field, migration or schema bump is introduced. Scores are re-derived from
attempts with the compatible rule. Completed restoration stays quiet.

## Configurable Warn policy: schema 4 (Phase 2B-2f)

Warn activities use schema 4 for every allowance: 1, 2, 3 or the string unlimited.
Missing/unsupported values default to 2 when typed/Warn is active. Dropdown and
strict policy ignore the allowance. No creation hook or old-content distinction.

The root extends the prior typed fields with spellingPolicy=warn and warningAllowance.
Each row contains:

~~~text
[id, rawTypedText, scoredAttempts, solved, checked, lastSubmissionKey,
 warningCount, warningActive, warnedNormalizedAnswers]
~~~

The count is a nonnegative safe integer, finite counts cannot exceed the allowance,
and warnedNormalizedAnswers is a dense, unique list of eligible minor spelling
answers whose length equals the count. It prevents reusing a warned answer after
editing away and back, including Unlimited. Counts/history reset only on Retry.
Feedback requires a valid last warned answer; unscored submitted states must be
explained by warning use. Scores remain derived. Ineligible/future rows remain
pristine and category locking reflects warning use or scored attempts.

The typed fingerprint includes [free-spelling-warnings, effectiveAllowance] after
the Warn marker, so cross-allowance snapshots cannot restore. Schema-3/intermediate
Warn states are rejected rather than migrated. Strict typed schema 2 and dropdown
schema 1 retain their current formats; no special compatibility code for obsolete
spelling configurations is retained. Highlighted feedback reconstructs from raw
text quietly, with no schema changes to presentation or missing-letter markers.
See the [checkpoint report](warning-allowance-checkpoint.md).

## Adaptive progressive hints: schema 5 (Phase 2B-3b)

Typed mode with enableProgressiveHints=true wraps the unchanged schema-2 or
schema-4 base state in exactly version=5, fingerprint, baseState and hints.
The wrapper fingerprint hashes [5, baseFingerprint, 'adaptive-letter-hints', 1]
using the existing cpj1 algorithm. Each hints entry is [Set identity, history];
each request history row is [scoredIncorrectAttempts,
totalIncorrectAndWarningSubmissions, matchedPrefixLetters, revealedLetters].
Hint count and cost derive from history; no score is stored.

Validation first checks the complete base state, then unique Set identities,
history bounds, first unlock, monotonic submissions/warnings/revelation, improved
prefix at positive points or a new scored submission at zero, the positive-score
full-answer cap and consistency with the latest known checked prefix. Future and
ineligible Sets cannot have hints. Malformed or obsolete development hint states
start fresh without migration. Restoration reconstructs hint text and availability
without new deductions, focus movement, announcements or completion events.
Hint-disabled activities retain schemas 1/2/4. See the
[adaptive hint contract](progressive-letter-hints-checkpoint.md).

## Configurable Set order (Phase 2C)

The editor stores behaviour.setOrder: shuffle (default) or author. The runtime
normalizes a valid behaviour value into its internal activity.setOrder path,
falling back to the legacy activity value. Missing settings retain Shuffle.
The internal state helpers consume that normalized activity; they do not perform
the editor-path bridge independently.

Missing/explicit Shuffle preserve their existing fingerprint payloads. Author
mode appends ['set-order', 'author'] to the base canonical payload before hashing;
the schema-5 wrapper consequently incorporates it through the base fingerprint.
Changing ordering policy rejects incompatible state. Schemas and the hash
algorithm are unchanged, with no migration.

Editor Set order itself remains excluded: an accepted saved run restores its full
saved permutation after authored reordering in either mode. Category eligibility
is unchanged. Retry clears the run and returns to All categories, using fresh
Shuffle draws or current editor order as selected. See the
[Set order contract](set-order-checkpoint.md).

## Schema-1 snapshot

After valid session initialization, `getCurrentState()` returns independent plain
JSON data. Before first attachment or for invalid content it returns `{}`, which
is not a valid saved attempt. The schema version is separate from library 1.0.0.

```json
{
  "version": 1,
  "fingerprint": "cpj1:…",
  "setOrder": ["would", "could"],
  "answerOrder": ["could", "maybe", "would"],
  "category": ["named", "verbs"],
  "locked": true,
  "position": 0,
  "sets": [
    ["would", "could", 1, false, true],
    ["could", null, 0, false, false]
  ],
  "results": false
}
```

The fingerprint above is illustrative; actual values have 16 hexadecimal digits
after `cpj1:`. Root fields are required and unknown fields are rejected.

| Field | Meaning |
| --- | --- |
| `version` | Supported integer schema version, currently 1 |
| `fingerprint` | Compatibility fingerprint of current authored content |
| `setOrder` | Full prepared Set permutation, using normalized correct-word identities |
| `answerOrder` | Full prepared global pool permutation, using normalized answer identities |
| `category` | `['all']`, `['uncategorized']`, or `['named', normalizedName]`; no transient category-N IDs |
| `locked` | Whether the first accepted Check has fixed the category/eligible sequence |
| `position` | Zero-based position within the filtered saved Set order |
| `sets` | One tuple for every authored Set, including ineligible/pristine Sets |
| `results` | Logical final-results mode; not a host completion flag |

Each Set tuple is `[id, selectedAnswerIdOrNull, attempts, solved, checked]`.
Serialization emits tuples in prepared Set order; validation resolves by identity
and accepts any tuple order with exactly the expected identities.

`checked` means the current selection is still the selection of the most recent
accepted Check. It supplies the minimum missing feedback/gating information:

- Solved + checked: reveal the original word, show correct feedback and lock Check.
- Unsolved + checked: show incorrect feedback and require a selection change.
- Unchecked: no feedback; a nonempty selection can be checked, even after earlier
  failures. A cleared selection can have a positive attempt count.

For example, selecting B and then returning to previously checked A without
submitting again leaves `checked=false`. Counts/selections alone cannot represent
that distinction. Revision counters, focus and live-announcement text are omitted.

Scores, totals, result rows, Context strings, DOM nodes, rendered HTML and authored
parameter copies are not stored. Identities are literal normalized text, including
any HTML-looking word text; they are never parsed as HTML or written to new DOM
attributes. Results/revelation/feedback are derived from the tuples
and compatible content, without serializing their display markup.

## Identity and content compatibility

Set and answer identities use the existing NFC / surrounding trim / Unicode
lowercase / NFC normalization. Runtime all-Set validation already requires unique
nonempty normalized correct words. Answer IDs resolve against `buildAnswerPool`:
correct words first, then distractor lines, normalized deduplication, first
trimmed display spelling retained. Distinct identities do not rely on pool indices.
Named categories use normalized keys, keeping them distinct from built-in types.

Authored Set reordering is compatible when the same uniquely identified Sets and
their exact attempt-relevant content remain unchanged. Saved orders retain the
learner's prepared permutations. The first displayed spelling/order of category
labels may change on author reordering; category membership and identity do not.

The schema-1 Shuffle fingerprint hashes canonical JSON of this structure (author
mode appends the marker described above):

```text
[1, categoriesEnabled, rawDistractors, sortedSetRecords, interpretation]
interpretation = ["automatic-gaps", 1] for ordinary KWIC only
                 ["automatic-gaps", 3] if any Set uses three-column LancsBox
Set record = [normalizedId, rawWord, rawContext, rawCategoryOrNull]
```

Set records sort by normalized identity using JavaScript UTF-16 string `<`/`>`
comparison, not locale sorting. All fields have explicit JSON boundaries; authored
object property insertion order is irrelevant. Context is included exactly, with
every space and line ending. Raw word/category spelling edits and raw distractor
edits conservatively invalidate compatibility even if normalization/deduplication
would yield equivalent choices. Set additions/removals and category enablement
also invalidate it. Non-string categories become null, and non-string distractors
become an empty string, matching the runtime's treatment of those ignored values.

Title, introduction and localization are excluded. Inactive typed settings do
not affect dropdown fingerprints. Active answer mode, typed penalty, spelling
policy/allowance, hints and Set order follow their compatibility rules above.
The raw input fields include everything needed to detect changed deduplication
winners and answer display spellings, without saving those authored strings twice.

The lightweight hash makes two unsigned 32-bit rolling passes over canonical
JSON UTF-16 code units: XOR each code unit, then `Math.imul` using seeds
`0x811c9dc5` / `0x9e3779b9` and multipliers `0x01000193` / `0x85ebca6b`.
The two zero-padded eight-digit hexadecimal values follow `cpj1:`. It is
deterministic compatibility metadata, not cryptographic authentication; hash
collisions remain possible. Changing the algorithm requires versioning it.

## Separate validator

`ConcordancesPapiJoState.validateState(activity, candidate)` returns either
`{valid: true, state: independentPlainCopy}` or `{valid: false, reason: code}`.
The browser namespace is `H5P.ConcordancesPapiJoState`; Node uses the same module's
CommonJS export. `fingerprint(activity)` returns a fingerprint or null for invalid
content, and `createState(activity, session)` supplies runtime snapshots.

Validation requires:

- Exact supported schema and matching fingerprint against valid current content.
- Plain records/dense data arrays without accessors, extra fields or custom
  prototypes; exact Set/answer permutations and one tuple per expected identity.
- A valid category and nonempty eligible sequence derived from the saved order,
  plus a safe integer position within it. Disabled categories permit only All.
- Known selected answer IDs or null, nonnegative safe integer counts and boolean
  solved/checked flags. Checked selections require a count and selection; solved
  selections must be checked and match their Set ID. A checked correct answer
  cannot remain unsolved. A one-answer pool cannot have incorrect attempts.
- Lock status exactly matching whether any accepted Check exists.
- Solved preceding Sets; future and ineligible Sets must be pristine. An unlocked
  attempt therefore starts at position zero with no accepted Checks.
- Results mode exactly matching all eligible Sets being solved, at the last
  eligible position. Scores and result rows remain derived, not persisted.

Reason codes are `shape`, `version`, `content`, `orders`, `category`, `position`,
`sets`, `interaction`, `lock`, `navigation` and `results`. They contain no corpus
text. The validator does not mutate the candidate, content or live session, and
never repairs, partially applies or automatically migrates a state.

## Lifecycle and limits

Snapshots reflect category/provisional choices, wrong Check, changed unchecked
input, correct Check, Next and final results. Retry creates fresh tuples and
orders with the same content fingerprint, All categories, position zero,
unlocked state and no results. Shuffle orders can match by chance; author mode
uses current editor order. Calling the serializer/validator never shuffles,
checks or scores input.

Phase 1E-2 maps identities to current indices/labels and hydrates session state,
then reuses the renderer for feedback/revelation/results. See the
[restoration report](release-1.0.0.md) for lifecycle, tests
and manual acceptance. Focus, live text and transient runtime-error
display state are excluded. `getAnswerGiven()` remains false, scoring and learner
workflow are unchanged, and no `resetTask`, `showSolutions` or parent integration is introduced.
Phase 1H-1 reports only newly completed live attempts, using no extra state field.

## Automatic-only compatibility (Phase 1K-2A)

Schema 1 and the cpj1 hash algorithm are unchanged. Valid ordinary input uses the
previous automatic interpretation domain, preserving compatible ordinary automatic
sessions. The removed automaticGaps parameter is ignored, whether absent, true or
false. An old manual-mode fingerprint lacks this domain and cannot restore under
the new interpretation. Legacy underscore-gap content fails validation outright.

Any activity containing LancsBox Context uses interpretation version 3, invalidating
earlier tabular snapshots. Old five-column content is invalid and cannot restore. Original tab-separated Context, including every space and line ending, remains in the fingerprint. Conversion is
only a display/validation operation; no new stored authoring format is introduced.
Relevant raw content edits still invalidate state, even if the display is equivalent.

New ordinary and LancsBox snapshots use the existing strict validator and restore
without shuffling, replayed Checks or duplicate completed xAPI reporting. No score,
category identity, Set ordering or answer ordering rule changes. See the
[focused verification report](release-1.0.0.md).
