# Phase 2B-2c — investigate missing Firefox spelling warning

## Evidence and cause

Read-only inspection of the local CLI activity concordances-01 found:

~~~json
{"answerMode":"typed","typedPenalty":"0.5","spellingErrorBehaviour":"accept"}
~~~

The Word values include fresco and abstract. The CLI session main-session.json
contains a schema-2 typed state with fresco/fresoc, one scored incorrect attempt
and no warning-state fields. This is the precise outcome expected from obsolete
accept content: resolveSpellingPolicy falls back to mistake, never Warn.

An editor display trap explains how Warn can appear selected without persisting
that value. The installed standard h5peditor-select.js constructor retains params
as this.value. createOptionsHtml selects only exact matches. Since accept is no
longer an option, neither option is explicitly selected and the native select shows
the first one (formerly Warn). appendTo writes the parameter only in its change
handler; validate returns the displayed value but does not call setValue.
The ShowWhen wrapper delegates validation without changing that behavior. Thus
saving without an actual selection change can retain the obsolete accept value.
No editor/Core code was changed.

The CLI api.js loads content/concordances-01/content.json for editor/player data.
The development library junction still resolves to this source workspace. Only
read-only inspection was performed; no CLI content/session/junction was modified.
The original live Firefox instance was not inspected directly, so its precise
loaded parameters/cache remain unverified if it differs from this saved activity.

## Runtime trace

- semantics.json defines warn/mistake, default mistake.
- ConcordancesPapiJo constructor calls resolveSpellingPolicy on Behaviour.
- registerDomElements passes the resolved policy to createSelectionSession.
- correctKeys derive from the authored Word fresco, decoded once and normalized;
  they do not derive from the inflected Context token FRESCOes.
- isMinorSpellingError(fresoc, fresco) returns true for the adjacent swap.
- checkAnswer gives a free warning only when policy=warn and warningUsed=false.
- refreshSelection renders spellingWarning; the live Check handler announces it
  and returns focus to the input.

The exact reported Warn configuration does not fail in source tests. The saved
obsolete configuration does reproduce Incorrect with one scored attempt. Changing
the detector, policy fallback or warning branch would therefore be speculative
and would violate strict fallback requirements.

## Small correction and exact files changed

- semantics.json: place Regular mistake first, matching the strict default/fallback.
  Warn remains available and valid saved Warn values still select it explicitly.
- tests/metadata.test.cjs: assert the new strict-first order and existing two options.
- tests/runtime.test.cjs: one regression reproducing typed/fresco/FRESCOes/fresoc
  with both a real warn value and the observed obsolete accept value.
- docs/spelling-warning-firefox-fix.md: this report.

This prevents the native select from visually presenting Warn for an unsupported
old value. It does not rewrite old authored data or make it Warn. The detector,
normalization, runtime checking, fingerprints, schemas, scores and restoration
are unchanged. No runtime helper or accepted-answer path was introduced.

## Focused checks

~~~powershell
node --test --test-name-pattern='Firefox fresco reproduction|spelling policy authoring' tests/runtime.test.cjs tests/metadata.test.cjs
~~~

2 passed, 0 failed, 0 skipped. Persisted warn produces spellingWarning with zero
scored attempts, input focus, no revelation/completion and schema 3. Persisted
accept remains strict with Incorrect, one scored attempt and schema 2. Both use
the authored target fresco and leave FRESCOes hidden as _____es.
No broad tests or browser automation were run.

## One Firefox retest

Hard-refresh the CLI editor. For concordances-01 explicitly select Regular mistake,
then Warn the learner, and Save (an actual change is essential for this old activity).
Start a fresh CLI session without resuming the prior strict snapshot. With typed
mode, Word fresco and Context FRESCOes, submit fresoc once. Expect the spelling
warning, input focus, no scored attempt and no revelation. Change to fresco and
Check: expect correct original-text revelation and 2/2.

If Incorrect still appears after this, capture the actual player response's
behaviour.spellingErrorBehaviour and the live instance's params.behaviour,
selectionSession.spellingPolicy, displayed Word and getSetState() immediately before
the first Check (especially warningUsed/attempts). Also capture the loaded script
URLs/cache status. This distinguishes wrong parameters, an already used warning,
a different activity or stale runtime code; no speculative runtime fix is warranted.

Versions remain 1.0.0. No package, release, Core/CMS/other-library change, deployment,
CLI junction change or Git mutation. STOPPED awaiting manual Firefox acceptance.
