# H5P.ConcordancesPapiJo

A standalone H5P concordance activity. Authors paste lines containing a target
Word; learners identify the automatically hidden word using a dropdown or typed input.
Source declarations are **1.1.0**, requiring **H5P Core API 1.28**. The exact
package passed validation and user-reported independent WordPress installation
and Firefox acceptance. GitHub publication is prepared but not performed. See
the [1.1.0 release record](docs/release-1.1.0.md).

First stable standalone release. The exact distribution has passed independent
WordPress installation, installed-version verification and Firefox acceptance for
both input formats, multiple Sets/partial scoring, editor save/reopen, saved-state
restoration and WordPress completion/results reporting. See
[release notes](RELEASE-NOTES.md), [installation](docs/installation.md) and
[technical qualifications](docs/release-1.0.0.md).

## Accepted local source: typed answers, hints and Set order

Version 1.1.0 offers Behavioural settings > Answer mode: dropdown (default) or typed.
Missing settings retain dropdown. Typed mode uses a native text input and the same
Check, scoring, categories, Next, results and Retry. Enter submits except during
key repeat or IME composition. Distractors remain stored but are inactive.

Typed attempts now persist in schema 2, including raw text, last-submission gating,
category/Set order and completed results. Dropdown schema-1 fields and fingerprints
remain unchanged. Cross-mode snapshots start fresh; inactive distractor edits do
not invalidate typed attempts. Completed restoration does not replay xAPI completion.
Phases 2B and 2C have passed user-reported local Firefox acceptance, including
Set order placement in Behavioural settings. The exact 1.1.0 package has also
passed independent WordPress installation and Firefox acceptance. This does not
establish fractional My Results support. Source declarations are now 1.1.0;
the published 1.0.0 package remains unchanged. See the
[restoration checkpoint report](docs/typed-state-checkpoint.md).

Typed mode also offers **Points deducted per incorrect attempt**: 1 (default)
or 0.5, applied as max(0, 2 - penalty × incorrect attempts) once solved.
Half-point results and xAPI retain exact numeric values; dropdown scoring is
unchanged. Penalty changes invalidate typed progress, while missing/explicit 1
retain existing typed compatibility. WordPress H5P plugin 1.17.10 does not
preserve fractional scores in My Results: its pipeline uses integer-only
validation, storage and display. Native activity results and emitted xAPI retain
fractions correctly. Hint deductions can also produce fractions with penalty 1.
See the [scoring checkpoint](docs/typed-scoring-checkpoint.md).

Typed Behaviour offers **Warn** or **Regular mistake** (default). Warn allows
1, 2, 3 or Unlimited free spelling warnings per Set, with **2 as the default**
for all activities. Repeated normalized warned answers are blocked; once a finite
allowance is exhausted, new minor errors count as scored mistakes. Exact correction
is always required. Retry clears counts/history. Warn uses schema 4 with count and
allowance validation; obsolete development states may start fresh without migration.
See the [warning allowance checkpoint](docs/warning-allowance-checkpoint.md).

Progressive letter hints are optional, typed-only and disabled by default. Hints
use the latest checked answer: they reveal its correctly matched prefix plus the
next letter, retaining earlier revelation. Each actual revelation costs 0.5 points.
Two scored mistakes or finite spelling-warning exhaustion unlock the first hint.
Later hints require a new submission with an improved prefix while points remain;
the full answer stays masked. At zero points, a new scored submission is still
required between requests, but prefix improvement is optional and full revelation
is allowed. Spaces/punctuation remain visible. Locked controls have screen-reader
descriptions without persistent visible explanations. Adaptive schema 5 restores
positions and progression quietly; hint-disabled schemas 1/2/4 are unchanged.
See the [functional hints checkpoint](docs/progressive-letter-hints-checkpoint.md).

**Set order** offers Shuffle Sets (default) or Keep author-defined order. Missing
settings retain Shuffle. Categories filter eligibility before the fixed run order
is applied. Accepted saved runs retain their order even after editor reordering;
Retry uses the selected policy and current editor order. The editor stores
behaviour.setOrder; a compatibility bridge still reads legacy activity.setOrder.
See the [Set order checkpoint](docs/set-order-checkpoint.md).

## Authoring

Use the standard H5P editor: required title, optional introduction and global
distractors (one per line), and one or more Sets. Each Set has a required Word,
required multiline Context and optional Category. Correct words must be unique
across all Sets after NFC/trim/lowercase normalization. Category fields appear
when Enable categories is checked and retain their values when hidden.
Activity settings start expanded; translations start collapsed.

**Paste concordance lines containing the target word. Gaps are generated
automatically.** No gap-generation option is needed. Both ordinary KWIC and
headerless LancsBox X three-column tab-separated exports are supported.

Ordinary KWIC example, with Word **abstract**:

~~~text
[001] An ABSTRACT painting.
[002] High-level ABSTRACTions are difficult.
[003] Several semi-ABSTRACT painters.
~~~

Learners see An _____ painting, High-level _____ions and semi-_____ painters,
with the original numbering, spaces and punctuation. All non-overlapping literal
occurrences are hidden, including fragments inside longer words. Matching uses
Unicode NFC and lowercase at whole grapheme boundaries; accents are significant,
with no stemming or full case folding. Correct revelation preserves each original matched substring, including case
and Unicode representation. A modern browser with Intl.Segmenter grapheme support is required;
without it, content fails safely with diagnostics.

Configure LancsBox X to export only **LEFT, NODE, RIGHT**, separated by TABs.
No line numbers or filename columns are needed or generated. Example with Word
**fresco** (the separators below are actual TAB characters):

~~~text
It boasts an ornate lobby, 	frescoed 	ceilings and a grand music
amid sculptures, artwork, fountains and 	frescoes 	and try the exquisite tasting
~~~

Learners see frescoed as _____ed and frescoes as _____es. NODE identifies the
primary matched gap; left contexts are right-aligned against its shared grid
column, and suffixes/right contexts stay attached. Other target occurrences are
also gapped. Field-edge padding is trimmed and natural separation inserted unless
adjoining punctuation joins the fields. Internal text and Unicode spelling remain
unchanged. Horizontal scrolling preserves long contexts without clipping.

Rows with exactly two TABs are tabular candidates and require a nonempty NODE
containing a safe target match. Extra fields (including old five-column exports),
empty NODEs and mixed ordinary/tabular rows produce diagnostics. If the target
matches only outside NODE, the row is rejected as ambiguous. A single ordinary
TAB is preserved; no format selector is needed. Embedded field TABs, headers and
quoted multiline fields are unsupported.

Use one format per Context; different Sets may use different formats. Ordinary
lines retain their surrounding spacing and tabs exactly. Whitespace-only lines
are retained and ignored during target validation. The standard textarea may trim
outer whitespace and normalize line endings; preservation starts with parameters
received by the runtime. The raw Context parameter is never rewritten.

All Sets are validated before learner controls appear. Missing fields, duplicate
words, malformed LancsBox-like rows, mixed formats, underscore runs of two or more,
and nonempty lines without a matched target block the activity with localized
Set/line diagnostics. Single underscores remain literal. Replace legacy underscore
gaps with the original target text before using old development content.

## Learner behavior

One Set is displayed at a time. Sets shuffle once per attempt by default, or follow
author-defined order when selected. The dropdown answer pool still shuffles
independently. Correct words from every Set precede distractors during
normalized deduplication; the first trimmed spelling wins. The pool stays global
and reusable across category changes.

Categories derive from Set values, with All categories and Uncategorized when
needed. Before the first accepted Check, category changes restart at the first
eligible Set. The first accepted Check locks the category and eligible sequence.
Answer selection alone never evaluates or counts an attempt. A wrong Check
requires a selection change before another submission; attempts are unlimited.
A correct Check reveals every gap in bold theme-aware success color, locks that
Set and enables Next when another eligible Set exists. There is no Previous or Skip.

Dropdown scoring is 2 on the first correct attempt, 1 on the second, and 0 on
the third or later. Typed solved-Set scoring is max(0, 2 - penalty × scored
incorrect attempts - 0.5 × hint requests); free spelling warnings do not count
as scored attempts. Unsolved Sets earn zero. Maximum is twice the eligible Set
count. Final results retain the revealed Context above a prepared-order table of
Word, attempts and earned/max units. No passing threshold is introduced.

Standard Question Retry appears after results unless the hidden enableRetry
setting is false. It clears the attempt, results, feedback and category lock,
reapplies the ordering policy, returns to All categories and focuses the category
or answer control. Reattachment retains the current attempt and controls.

## Saved state and xAPI

JSON schemas 1 (dropdown), 2 (typed), 4 (typed Warn) and 5 (adaptive hints)
and strict restoration retain prepared orders, category,
selection, position, accepted attempts, feedback and results without shuffle draws
or replay. Missing or incompatible state starts clean. Fingerprints retain raw
Context and stable normalized identities. Valid ordinary automatic sessions keep
their previous fingerprint domain; LancsBox content uses a new domain. Old manual
content/states are unsupported. See the [state contract](docs/saved-state.md).
Persistence remains the host's responsibility.

The last live correct Check emits one standard completed xAPI statement, with
completion/success true even at raw zero, score min 0 and the active-category
raw/max. Completed restoration and repeated rendering are quiet; Retry permits a
new completion. Delivery to an LRS remains the host's responsibility.

Version 1.1.0 remains standalone. QuestionSetPapiJo and InteractiveBookPapiJo integration
are deferred, as are other parent containers. resetTask, showSolutions and
getXAPIData parent interfaces remain absent; getAnswerGiven remains false.

## Presentation and dependencies

KWIC uses one horizontally scrollable monospace pre with per-line accessible
reading alternatives. Native labelled selects, standard Question buttons, theme
colors and focus behavior are retained. One polite atomic region announces Check
feedback; restored feedback/results do not replay announcements.

Authored text uses text nodes. The existing display conversion reverses only
&quot;, &#039;, &lt; and &gt; once; ampersands are not recursively decoded. Word/Context
raw values and identities stay unchanged. Literal entity spelling cannot always
be distinguished from the standard editor's escaping. Screen-reader speech and
full host save/reopen still require manual verification.

Runtime dependency: H5P.Question 1.5 and its transitive dependencies. Editor:
H5PEditor.VerticalTabs 1.3 and H5PEditor.ShowWhenpapijo 1.0. No custom widget, npm runtime
dependency or build step is required. The approved [MIT LICENSE](LICENSE) and
Papi Jo author metadata are retained.

## Installation and verification

The accepted 1.1.0 archive is prepared for GitHub publication; its exact filename,
hash and installation qualifications are in the [release record](docs/release-1.1.0.md).
The historical published package remains available as
[H5P.ConcordancesPapiJo-1.0.0.h5p](https://github.com/rezeau/h5p-concordances-papijo/releases/download/v1.0.0/H5P.ConcordancesPapiJo-1.0.0.h5p).
Import the chosen content package
on an H5P-enabled host supporting Core API 1.28. Use an account
allowed to install libraries. Dependencies are bundled; H5P Core/the host plugin
are not. This is a content package: import registers libraries and creates playable
sample content. It is not a library-only ZIP. Do not use the development junction.
Follow the [installation and acceptance procedure](docs/installation.md).

The historical 1.0.0 release had **47 passing checks** in its relevant portable selection: the initial run
passed 46 with one stale metadata-order expectation, corrected and rerun alone
(1 passed). The category punctuation regression confirms safe one-pass display
conversion and unchanged category identity/fingerprint. Package inventory, dependency
closure, metadata, declared assets, exclusions and ZIP CRC were checked. The
official H5P package validator returned true with no errors. No new browser automation or historical suites were run for publication.
Independent WordPress/Firefox acceptance was subsequently completed by the user.
The upstream icon-asset qualification remains documented.

For the accepted 1.1.0 package and proposed publication, see the
[release record](docs/release-1.1.0.md); the earlier
[release preparation](docs/release-1.1.0-preparation.md) remains historical. Optional learner Hint
Help (?) and the official ShowWhen/ShowWhenpapijo shared-global collision remain
deferred. The standalone editor dependency closure contains only the fork;
mixed-editor coexistence remains qualified.

Known limits: manual gaps and five-column LancsBox are unsupported; Intl.Segmenter
is required; long contexts require horizontal scrolling; two TABs plus a safe NODE
match define tabular input. Standard editor outer whitespace/entity transport,
full screen-reader speech and host persistence/LRS delivery retain their documented
boundaries. Existing saved translation overrides may keep old wording until the
author updates them; this release does not rewrite saved parameters.
