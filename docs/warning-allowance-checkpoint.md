# Revised Phase 2B-2f — configurable free warnings

Implemented locally under the revised development policy. All activities default
to 2 warnings. No creation-time initialization hook, old-content migration or
new/existing distinction. Existing CLI test activities may be recreated. Version
declarations remain 1.0.0; the published 1.0.0 asset is not modified.

## Editor and counting

behaviour.freeSpellingWarnings offers 1, 2, 3 and Unlimited. Semantics default is
string 2; runtime also resolves missing/unsupported values to 2 in typed/Warn mode.
The selector sits beneath Minor spelling errors, and ShowWhen requires typed and
warn. nullWhenHidden=false preserves the selection when switching modes/policies.
Regular mistake remains the default; inactive allowances do not affect it or dropdown.
Existing hidden lifecycle controls stay hidden.

Each Set tracks warningCount and warned normalized answers separately from scored
attempts. Each distinct eligible minor submission consumes one free warning while
allowance remains, retains raw input/highlighting/focus and adds no scored attempt.
A normalized answer already warned is blocked even after other answers, including
in Unlimited mode. The existing last-submission gate also remains. Once a finite
allowance is exhausted, new minor errors count as ordinary scored submissions.
An exact answer solves normally; earlier scored mistakes are never reset by warnings.
Both 1/0.5-point penalties remain in force. Retry resets all counts and history.

The detector/thresholds, highlight renderer, missing-letter indicator, keyboard/IME,
normalization, original revelation, categories/navigation and xAPI contract are unchanged.

## Saved state and simplified development policy

Warn now uses a single schema 4 for all allowances, including 1. Root fields include
spellingPolicy=warn and warningAllowance (integer 1/2/3 or string unlimited).
Set tuples have nine elements:

~~~text
[id, raw text, scored attempts, solved, checked, last normalized submission,
 warning count, active warning, distinct warned normalized answers]
~~~

Counts are nonnegative safe integers, finite counts cannot exceed their allowance,
and history length must equal count. History must be a dense unique list of
normalized eligible minor errors, with no accessors or unsafe data types. An
active warning must have checked feedback and a valid recorded minor submission.
Zero scored attempts with submitted state must be justified by warning use.
Exhaustion/history consistency prevents unspent warnings being represented as scored
minor failures or repeated warned submissions being scored again. Future/ineligible
Sets remain pristine; category lock considers warnings and scored attempts.
Completion/results consistency is validated and scores are derived, never stored.

Warn fingerprints include the effective allowance marker, so one allowance's state
cannot hydrate another. All schema-3 Warn states are rejected without migration.
The earlier boolean warningUsed state/hydration path and its obsolete fixture were
removed. No obsolete accept runtime or special state conversion is retained.
Dropdown schema 1 and strict typed schema 2 remain functional and continue to ignore
inactive allowance settings. No new compatibility requirements were imposed on them.

Restoration hydrates counts/history without shuffle draws or automatic Check;
input/raw text and highlighted feedback return quietly. Completed restoration emits
no new completion, and Retry permits a new normal completion after clearing state.

## Exact implementation files for this revised checkpoint

- semantics.json — conditional four-choice selector, default 2, generic Warn label.
- scripts/concordances-utils.js — effective allowance resolver.
- scripts/concordances-session.js — counts/history, exhaustion, gating, hydration/reset.
- scripts/concordances-state.js — schema 4, allowance fingerprint and strict validation;
  remove obsolete schema-3 preservation branches.
- scripts/h5p-concordances-papijo.js — resolve/pass allowance to fresh and Retry sessions.
- tests/metadata.test.cjs — default/visibility/options checks.
- tests/concordances-session.test.cjs — allowances, distinctness, penalties/earlier errors.
- tests/concordances-state.test.cjs — count/history restoration, malformed and cross-allowance rejection.
- tests/runtime.test.cjs — revised defaults, state restoration, highlighted warning and Retry.
- tests/fixtures/spelling-policy-2b2.json — removed obsolete intermediate fixture.
- README.md; docs/editor-integration.md; docs/saved-state.md;
  docs/typed-spelling-checkpoint.md — current contract updates.
- docs/warning-allowance-checkpoint.md — this report.

Earlier uncommitted development work is preserved.

## Focused verification

After the user's revised policy, one focused selection:

~~~powershell
node --test --test-name-pattern='warning allowance|revised warning defaults|spelling policies distinguish|highlighted spelling warning|schema-1 published|typed penalty compatibility' tests/concordances-session.test.cjs tests/concordances-state.test.cjs tests/runtime.test.cjs tests/metadata.test.cjs
~~~

9 passed, 0 failed, 0 skipped. Covers default 2 and explicit 1, choices/visibility,
all four allowances, finite exhaustion, earlier scored mistakes, both penalties,
equivalent/history gating, schema-4 round-trips/cross-allowance/malformed/pristine-row
checks, rejection of old Warn schemas, highlighted warning persistence, quiet
completed restoration, Retry and current dropdown/strict behavior. An earlier
8-check run preceded the user's revised policy and is superseded by this result.
No broad suite, browser automation or host persistence claim.

## One manual Firefox acceptance sequence

Create/recreate a typed/Warn test activity with Word fresco and Context FRESCOes.
Confirm the new selector defaults to 2. Submit fresoc then frescp: two highlighted
warnings, zero scored attempts. Return to FRESOC: Check stays blocked. Submit frescoo:
ordinary incorrect feedback and one scored attempt. Correct to fresco: expect 1/2
with penalty 1, or 1.5/2 with penalty 0.5. Retry and verify the warnings renew.
In fresh sessions repeat with allowance 1, 3 and Unlimited; Unlimited must still
block repeated normalized warned answers. Save/reload where host persistence is
available and verify retained counts/history/highlights; completed resume stays quiet.
Changing the allowance invalidates the old attempt. Old development Warn states
may start fresh. A brief mode/policy switch must retain the authored selector value.

The missing-letter indicator was not changed. Browser/host persistence and screen
reader speech remain manual acceptance tasks. The previously documented fractional
WordPress My Results limitation remains. No packaging, deployment, Git mutation,
publication or Core/CMS/other-library/CLI-junction change occurred. STOPPED for Firefox acceptance.
