# Version 1.1.0 preparation — no package built

Subsequent authorized build: source declarations are now 1.1.0 and a separate
test package has been built and validated. See the
[build report](../release/1.1.0/REPORT.md), retained locally outside Git.
Independent WordPress installation and Firefox acceptance have since passed,
as reported by the user; see the current [release record](release-1.1.0.md).
WordPress H5P 1.17.10 fractional My Results remains a known limitation.
The preparation record below describes
the earlier pass; its unchanged-version and no-package statements are historical.

Phases 2B and 2C have user-reported local Firefox acceptance, including adaptive
letter hints and Set order placement in Behavioural settings. Source declarations
remain 1.0.0 / Core API 1.28. The historical 1.0.0 archive and release records are
unchanged. No 1.1.0 installation, package validation or publication is claimed.

## Accepted functionality

- Dropdown remains the default; typed mode offers penalty 1 (default) or 0.5.
- Regular mistake remains the spelling default. Typed Warn allows 1/2/3/unlimited
  free warnings per Set, default 2; exact correction is required and repeats are blocked.
- Typed adaptive letter hints are optional and disabled by default. Every actual
  revelation costs 0.5; subsequent unlocking uses the checked prefix or, at zero
  points, a new scored submission. Full revelation does not solve the Set.
- Set order is a single Behavioural setting: Shuffle (default) or author order.
  Category eligibility is unchanged. A saved run retains its permutation after
  editor reordering; Retry applies the policy again using current source order.
- Schemas 1/2/4/5 remain supported with existing fingerprints and restoration
  behavior. This preparation changes neither runtime nor state code.

See [editor settings](editor-integration.md), [state contracts](saved-state.md)
and [learner lifecycle](selection-session.md).

## Fractional score qualification

Native results, getScore and emitted xAPI preserve fractional numeric scores.
Both typed penalty 0.5 and hint deductions can produce fractions; selecting
penalty 1 alone does not prevent fractional scores when hints are enabled.

The previously inspected WordPress H5P My Results handler validates scores with
FILTER_VALIDATE_INT and stores them using %d. That implementation cannot be
claimed to preserve fractions. Local Firefox/CLI acceptance does not certify
WordPress persistence, and no current host-persistence fix or new-host acceptance
has been performed. Other hosts/LRS persistence also remains unverified here.
Before a release claims fractional WordPress My Results support, separately
authorize a host qualification/resolution decision. No WordPress or Core changes
are included in this preparation. Native/xAPI support must remain distinguished
from that host limitation. See [the inspected limitation](typed-scoring-checkpoint.md).

## Future packaging, requiring separate authorization

The builder accepts --version (default 1.1.0) and --libraries. It derives:

- release/1.1.0/H5P.ConcordancesPapiJo-1.1.0.h5p
- release/1.1.0/staging
- release/1.1.0/inventory.json

Preflight requires matching library.json and package.json declarations and Core
API 1.28 before creating output. Current 1.0.0 declarations deliberately block
a 1.1.0 build. The tool never relabels source. Versions below 1.1.0 are rejected
to protect the immutable 1.0.0 release.

The entire output directory must be absent. Exclusive directory creation ensures
clean staging and rejects retries over failed output; archive creation remains
exclusive too. Failed output stays available for inspection and needs explicitly
authorized cleanup or relocation before retry. There is no automatic recursive
deletion, staging reuse or archive overwrite.

Dependencies are read from the supplied installed-library directory. Existing
dependency-closure, asset, CSS, license and development-exclusion checks remain.
Tests, investigation material, docs, package.json, caches and CLI/Core/CMS sources
are not distribution content. A content package generates h5p.json, content JSON
and versioned library folders; the source tree must not simply be zipped.

Node >=22 is needed for focused source checks; packaging uses Python 3 and the
retained validator uses PHP with ZIP/mbstring plus installed H5P Core API 1.28.
The inspected CLI is 1.1.6. Its import command does not register bundled libraries;
future independent installation must use the host's administrator import workflow.
No CLI registration, dependency discovery, junction change or import is needed
for this preparation.

## Focused preparation verification

The corrected Behavioural-settings metadata test passed alone. Python syntax and
seven read-only release-preflight cases passed: current source-version mismatch,
immutable 1.0.0 rejection, malformed version rejection, simulated matching 1.1.0
output paths, existing-output refusal, package-version mismatch and Core mismatch.
Exclusive output/staging directory and archive creation guards were inspected
through the Python AST. The builder and ZIP creation were not executed.

Local links in the seven edited Markdown files and the consolidated feature/state
summaries were checked. Runtime/editor functionality, schemas, fingerprints and
version declarations were not changed. No broad suite or browser automation was run.

## Deferred items and release gates

Optional learner Hint Help (?) remains deferred. Official ShowWhen and
ShowWhenpapijo still share H5PEditor.ShowWhen and widgets.showWhen registrations;
the standalone closure contains the fork only, while mixed-editor coexistence
remains qualified. A namespaced fix would require separate scope and authorization.

The upstream jQuery UI stylesheet still references six unavailable ui-icons PNG
sprites. Historical Firefox acceptance found no corresponding requests/defects;
this is not a universal host guarantee. Retain the qualification and observe it
during future independent installation; do not fabricate replacement assets.

Next: separately authorize 1.1.0 version declarations and packaging, retaining
Core API 1.28 and the 1.0.0 archive. Then validate the new package and independently
accept its installation/editor/runtime behavior. Fractional host persistence needs
its own qualification before any claim of support. Publication remains a later,
separately authorized step.
