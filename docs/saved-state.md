# Saved-state schema 1

Serialization, validation and Phase 1E-2 restoration are implemented. At initial
registration, restoreSession validates contentData.previousState and hydrates the
existing session without shuffle draws. Invalid candidates start clean. No custom
storage, network or parent API is added. Phase 1H-1 completed reporting
uses an in-memory guard initialized from the restored solved state; this format
does not change and restored completed states are not reported again.

## Snapshot

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

The fingerprint hashes canonical JSON of this fixed positional structure:

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

Title, introduction, localization and behaviour settings are excluded: they do
not change Set identity, content, eligibility, ordering, checking or score units.
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
unlocked state and no results. Orders can match by chance; they are still freshly
prepared. Calling the serializer/validator never shuffles, checks or scores input.

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
