# Standard editor integration

The activity uses standard H5P semantics and widgets. Dependencies are
H5PEditor.VerticalTabs 1.3 and H5PEditor.ShowWhenpapijo 1.0; no custom editor is required.

Activity settings start expanded. Fields are title, introduction, global
distractors, enableCategories and a repeatable Sets list (min/defaultNum 1).
Each Set has required plain-text word and textarea context, plus optional category.
Category uses showWhen with ../../enableCategories and nullWhenHidden false,
preserving stored values while hidden. Translations start collapsed. Behavioural
settings expose Set order (Shuffle by default), Answer mode (dropdown by default),
typed progressive hints (disabled by default), typed penalty (1 by default), minor
spelling errors (mistake by default) and free warnings (2 by default). The typed
options retain conditional visibility. The existing enableRetry/enableSolutionsButton
fields retain their paths and use widget none to remain hidden. Missing or
unsupported runtime answer modes resolve to dropdown. Distractor help explains
that stored entries are inactive in typed mode. Persistence uses schema 1 for
dropdown, 2 for strict typed, 4 for Warn and a schema-5 wrapper for adaptive hints. Changing answer mode
starts a fresh attempt. No new custom editor dependency is added.

Context help instructs authors to paste original target words. Gaps are always
generated automatically, including from LancsBox X three-column TAB exports (LEFT, NODE, RIGHT). Configure LancsBox X
to export only these three columns.
There is no gap-generation checkbox, underscore regexp or manual authoring mode.
See the [README examples](../README.md#authoring).

The standard textarea can trim outer whitespace and normalize line endings.
Ordinary internal spacing is preserved by the runtime; LancsBox field boundaries
are normalized in a display copy. No raw Context is rewritten. The accepted
four-escape display conversion remains safe text, not HTML parsing.

Runtime validation checks every Set, including categories outside the learner's
selection. Required content, unique normalized words, format consistency,
well-formed three-field rows with a safe target match in NODE, no legacy underscore runs and a safe target on every
nonempty line are checked before any learner controls appear. Diagnostics identify
the Set and line when applicable. These checks are not an editor save veto.

Earlier standard-editor probes found that invalid fields may still be saved or
replaced with empty values by host filtering. No submission interception or global
patch is introduced. Five-column exports are unsupported. Local Firefox acceptance
of Phases 2B/2C has been reported by the user. New-package installation acceptance
remains separate. Earlier editor investigations are historical evidence only.

Phase 2B-1 adds behaviour.typedPenalty, a standard select using the existing
ShowWhen widget. It is visible only for typed mode, defaults to string 1 and
offers string 0.5. Hidden values are retained by nullWhenHidden=false; dropdown
ignores the value. Existing hidden lifecycle controls remain hidden.

Phase 2B-2b retains only warn and mistake (default) in behaviour.spellingErrorBehaviour,
using the same conditional visibility and hidden-value preservation. Obsolete or
unknown authoring values resolve to mistake.
Only typed mode uses it. No dependency on AdvancedBlanksPapiJo is introduced.

Revised Phase 2B-2f adds freeSpellingWarnings beneath the spelling policy, with
choices 1/2/3/unlimited and ordinary semantics default 2. ShowWhen requires both
typed mode and Warn, retaining values when hidden. Runtime also defaults to 2
for typed/Warn when missing; there is no creation-time hook or new/old distinction.

Phase 2B-3a adds enableProgressiveHints, a boolean defaulting to false, visible
only in typed mode through ShowWhen with nullWhenHidden=false. The selection is
retained when switching to dropdown, where it has no runtime effect. Invalid or
missing runtime values disable it. Phase 2B-3b implements requested letter hints,
half-point deductions and schema-5 restoration; see
[the functional hints checkpoint](progressive-letter-hints-checkpoint.md).

The allowance selector explicitly uses showWhen.type=and. The installed Papi Jo
fork propagates changes from the ShowWhen-wrapped spelling-policy select. Current
standalone dependency closure contains the fork only; loading official ShowWhen
on the same editor page still risks shared-global registration order conflicts.
See [the focused fix](showwhenpapijo-editor-fix.md).

Phase 2C places a single setOrder select in Behavioural settings, with values
shuffle (default) and author. A valid behaviour.setOrder overrides legacy
activity.setOrder at parameter normalization; otherwise the legacy value remains
usable. Runtime ordering and state fingerprint rules are unchanged by placement.
See [the ordering checkpoint](set-order-checkpoint.md). Optional learner Hint
Help (?) and a separately namespaced ShowWhen adapter remain deferred.
