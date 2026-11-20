# Version 1.0.0 technical release record

The accepted package is immutable:

- Asset: H5P.ConcordancesPapiJo-1.0.0.h5p
- Size: 835,522 bytes
- SHA-256: 7272c00f0c75439f0fdd9b94ac46dddd0df0339c131a22cf1bfe35ad4e0df285
- H5P Core API: 1.28
- 93 files; Concordances plus nine official runtime/editor dependencies.

Official H5P package validation passed with 10 libraries and no errors. The relevant
portable selection has 47 passing checks after correcting one stale metadata-order
expectation and rerunning only that check. No broad regression or browser test was
repeated for publication. The exact package was subsequently accepted by the user
on an independent WordPress host: installed version, ordinary KWIC, three-column
LancsBox alignment, multiple Sets and partial scoring, editor save/reopen, saved-state
restoration and completion/results reporting all passed in Firefox.

## Bundled dependencies

| Library | Version |
| --- | --- |
| H5P.Question | 1.5.56 |
| FontAwesome | 4.5.6 |
| H5P.JoubelUI | 1.3.46 |
| H5P.Transition | 1.0.4 |
| H5P.FontIcons | 1.0.6 |
| H5P.Components | 1.0.99 |
| jQuery.ui | 1.10.22 |
| H5PEditor.VerticalTabs | 1.3.16 |
| H5PEditor.ShowWhen | 1.0.9 |

The official jQuery.ui stylesheet references six unavailable sprites under images/:
ui-icons_444444_256x240.png, ui-icons_555555_256x240.png,
ui-icons_777620_256x240.png, ui-icons_777777_256x240.png,
ui-icons_cc0000_256x240.png and ui-icons_ffffff_256x240.png.
The supplied official dependency code was not modified and replacements were not
fabricated. Independent Firefox network inspection found no corresponding requests
or observed visual defects. This does not establish universal absence of impact;
other hosts or uses of the upstream stylesheet may exercise these references.

## State and packaging

Schema 1, cpj1 and interpretation markers 1 (ordinary) / 3 (three-column) remain
unchanged. Category punctuation uses safe one-pass display decoding; raw identities,
filtering and fingerprints are unchanged. Existing saved translation overrides are
not rewritten. Manual gaps and five-column exports remain unsupported.

The content package contains h5p.json, content/content.json and versioned library
folders, with declared dependencies and a playable ordinary/LancsBox sample. It is
not a library-only ZIP. The approved source MIT LICENSE is included byte-for-byte
as LICENSE.txt to satisfy the H5P file-extension whitelist.

The accepted archive is attached to the GitHub release rather than committed.
Build/validation scripts are retained for reproducibility but must not be used to
rebuild or replace that accepted artifact. For future builds only, supply an
installed dependency directory with --libraries to release/build_release.py.
The validation script uses an isolated upload/extraction adapter with an unchanged
installed H5P PHP Core, and performs no host installation.
