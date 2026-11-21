# Version 1.1.0 release preparation and acceptance record

GitHub release preparation only: no commit, tag, push, GitHub release or upload
has been performed by this preparation. The exact archive below passed official
package validation and user-reported independent WordPress installation/Firefox
acceptance. This record supersedes earlier checkpoint statements that package
installation/acceptance was pending. Checkpoint documents remain historical.

## Accepted artifact

- Filename: H5P.ConcordancesPapiJo-1.1.0.h5p
- Local location: release/1.1.0/H5P.ConcordancesPapiJo-1.1.0.h5p
- Size: 843,963 bytes
- SHA-256: bd79ef6ab856e3cd88a61e031d77203b7ad6b0380bc3c7063b6a3fb8eed9f233
- Library/package source declarations: 1.1.0
- H5P Core API: 1.28
- Package contents: 93 files, 10 libraries, h5p.json and content/content.json
- Official validator: valid=true, 10 libraries, no errors or info messages
- Canonical per-file inventory hash:
  d73616306af5ef5d3b842b20f4c8ec0a161417f6258c4a6ddda8a5658e46a478

The existing archive is the future release asset; do not rebuild or overwrite it.
The archive, staging, extraction and generated inventories stay outside Git,
following the 1.0.0 convention. Local inventory.json, file-inventory.json and
validation/result.json retain the build evidence. This checked-in record preserves
the identifying metadata without committing copied third-party libraries.

| Included library | Version |
| --- | --- |
| H5P.ConcordancesPapiJo | 1.1.0 |
| H5P.Question | 1.5.56 |
| H5P.JoubelUI | 1.3.46 |
| H5P.Components | 1.0.99 |
| H5P.Transition | 1.0.4 |
| H5P.FontIcons | 1.0.6 |
| FontAwesome | 4.5.6 |
| jQuery.ui | 1.10.22 |
| H5PEditor.VerticalTabs | 1.3.16 |
| H5PEditor.ShowWhenpapijo | 1.0.5 |

## Compatibility qualifications

WordPress H5P plugin 1.17.10 does not preserve fractional scores in My Results
because its results pipeline uses integer-only validation, storage and display.
Concordances itself reports fractional scores correctly through activity results
and xAPI. The observed 0.5/2 activity result becomes 0/2 in My Results.
Independent installation and Firefox acceptance do not remove this limitation.

Read-only investigation of the installed integration found:

- h5p-x-api-event.js copies raw scores unchanged; h5p-x-api.js forwards them to
  H5P.setFinished, which posts the number unchanged.
- admin/class-h5p-plugin-admin.php ajax_results uses FILTER_VALIDATE_INT at
  lines 779/780, integer SQL formats at 788 and insert/update at 815/819.
  Decimal input such as 0.5 fails validation to false, then formats as zero.
- public/class-h5p-plugin.php declares score/max_score as INT UNSIGNED at 266/267.
- admin/class-h5p-plugin-admin.php print_results casts score/max_score to int
  at 1168/1169, independently discarding any fraction before table display.

The smallest complete fix belongs in the WordPress integration across input,
storage and display, not Concordances. No such fix is included or authorized.
Other hosts/LRS persistence is not certified by these checks.

The upstream jQuery UI CSS still references six unavailable ui-icons PNG sprites.
Historical acceptance observed no corresponding requests/defects; impact on other
hosts remains qualified. Optional learner Hint Help (?) remains deferred.
Official ShowWhen and ShowWhenpapijo still share H5PEditor.ShowWhen and
widgets.showWhen registrations. The standalone dependency closure includes the
fork only; mixed-editor coexistence remains an explicitly deferred risk.

## Proposed Git and GitHub operations — not executed

Repository: rezeau/h5p-concordances-papijo. Branch: main. The reviewed local and
remote main commit is e3aea9b761363c079238751e498796d6d572ba1c.
The established annotated tag is v1.0.0, with annotation
H5P.ConcordancesPapiJo 1.0.0 and a separate GitHub .h5p release asset.

Proposed commit subject: Release: H5P.ConcordancesPapiJo 1.1.0

Include the accepted runtime/semantics/style changes, library.json/package.json,
all corresponding focused tests and fixtures, current documentation and checkpoint
history, version-aware release/build_release.py, .gitignore and RELEASE-NOTES.md.
The withdrawn spelling-policy checkpoint remains historical; current contracts
are the README, editor integration, saved-state and this release record.

Exclude release/1.1.0 generated output, .h5p binaries, investigation material,
caches and copied dependency/Core/CMS code. Preserve all historical 1.0.0 files,
tag, GitHub release and asset. Do not stage the working tree indiscriminately.

Proposed annotated tag: v1.1.0, annotation H5P.ConcordancesPapiJo 1.1.0, targeting
the reviewed new release commit, not the current 1.0.0 HEAD. Proposed GitHub title:
H5P.ConcordancesPapiJo 1.1.0. The proposed release body is the 1.1.0 section of
[RELEASE-NOTES.md](../RELEASE-NOTES.md), stopping before the historical section.
The GitHub body should use an absolute tag-specific link to this technical record,
as the existing 1.0.0 release does.

No technical package blocker was identified. The fractional My Results issue is
an explicit compatibility limitation, not a claim of full host scoring support.
All Git mutations and GitHub publication await explicit authorization. Recheck
remote refs and the asset SHA-256 immediately before those authorized operations.

## Exact proposed commit scope

42 files: 23 modified and 19 new, reviewed against the existing 1.0.0 commit.
This is a proposed staging manifest only; nothing has been staged.

- .gitignore
- README.md
- RELEASE-NOTES.md
- docs/accepted-spelling-feedback-checkpoint.md
- docs/editor-integration.md
- docs/progressive-hint-configuration-checkpoint.md
- docs/progressive-letter-hints-checkpoint.md
- docs/release-1.1.0-preparation.md
- docs/release-1.1.0.md
- docs/saved-state.md
- docs/selection-session.md
- docs/set-order-checkpoint.md
- docs/showwhenpapijo-editor-fix.md
- docs/spelling-feedback-refinements-checkpoint.md
- docs/spelling-highlight-checkpoint.md
- docs/spelling-warning-firefox-fix.md
- docs/two-spelling-policies-checkpoint.md
- docs/typed-answer-checkpoint.md
- docs/typed-scoring-checkpoint.md
- docs/typed-spelling-checkpoint.md
- docs/typed-state-checkpoint.md
- docs/warning-allowance-checkpoint.md
- library.json
- package.json
- release/build_release.py
- scripts/concordances-renderer.js
- scripts/concordances-session.js
- scripts/concordances-state.js
- scripts/concordances-utils.js
- scripts/h5p-concordances-papijo.js
- semantics.json
- styles/h5p-concordances-papijo.css
- tests/concordances-renderer.test.cjs
- tests/concordances-session.test.cjs
- tests/concordances-state.test.cjs
- tests/concordances-utils.test.cjs
- tests/fixtures/schema1-release-1.0.0.json
- tests/helpers/dom.cjs
- tests/metadata.test.cjs
- tests/runtime.test.cjs
- tests/set-order.test.cjs
- tests/showwhen-editor.test.cjs
