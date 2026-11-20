# Independent installation and Firefox acceptance

Distribution: H5P.ConcordancesPapiJo-1.0.0.h5p, in this directory (835,522 bytes).
SHA-256: 7272c00f0c75439f0fdd9b94ac46dddd0df0339c131a22cf1bfe35ad4e0df285

This is a valid H5P **content package**, not a library-only archive. It includes
h5p.json, content/content.json, H5P.ConcordancesPapiJo-1.0 and nine official
runtime/editor dependencies. An administrator import registers the libraries and
creates editable/playable sample content. H5P Core and a CMS integration are not
bundled. The source/LICENSE is included unchanged as library LICENSE.txt for the
upload extension whitelist. Package validation does not install anything.

## Test host and import

1. Choose a separate H5P-enabled test site, using a separate sandbox for initial testing.
   The release package has passed independent WordPress/Firefox acceptance. Do not use a source-linked development junction for independent installation.
2. Confirm H5P Core API 1.28 support and permission to upload/install libraries.
   In WordPress, sign in as an administrator, open H5P Content > Add New, choose
   Upload, select this .h5p file, and create/save the content. Equivalent H5P upload
   flows on other supported hosts can be used. Do not use the CLI import command:
   installed CLI 1.1.6 imports content without registering bundled libraries.
3. In the host's H5P library management page, verify Concordances Papi Jo
   major/minor 1.0 and patch 0 where shown. If the UI displays only 1.0, inspect
   its installed library.json through the host's normal administrative tooling:
   machineName H5P.ConcordancesPapiJo, majorVersion 1, minorVersion 0, patchVersion 0.
   The imported content must reference mainLibrary H5P.ConcordancesPapiJo 1.0.
   An existing 0.1 library can coexist; this is not automatic migration of 0.1 content.
4. Open the imported sample in Firefox after a hard refresh. The fixture has two
   Sets: abstract (ordinary KWIC) and fresco (three-column LancsBox), plus global
   distractors, categories and All categories. No gap/format switch should appear.

## Activity checks

5. Choose Teacher's ordinary KWIC. Confirm the category apostrophe displays as
   punctuation, all three numbered Context lines appear, and ABSTRACTions becomes
   _____ions. Choose abstract, Check, and verify original uppercase ABSTRACT and
   unchanged suffixes/spacing. With one eligible Set, expect score 2/2 and results.
6. Retry, choose LancsBox X, and inspect the three unnumbered fresco rows. Primary
   gaps must align before and after revelation, with ed/es/es, suffixes attached.
   No numbers or filenames should be generated. Choose fresco, Check, expect 2/2.
7. Retry, keep All categories. Complete both Sets using Next in the shuffled order.
   Maximum is 4. For partial scoring, submit a distractor first, change to the
   correct answer and Check; that Set earns 1/2. Category must lock after the
   first Check; Retry must restore a fresh unlocked full attempt.
8. Check narrow-window horizontal scrolling, keyboard dropdown/Check/Next/Retry
   focus, accessible natural reading order and theme feedback. Inspect imported
   content in the editor and save/reopen both Context formats.
9. If the host enables user-state persistence, leave and resume an unfinished
   attempt and verify orders/answers/counts. Inspect local completed xAPI reporting
   through the host's normal logging: one event per live finish, quiet restoration,
   and a new event after Retry. Host/LRS delivery is a separate acceptance check.

## Dependency qualification

All declared dependency libraries/assets are bundled and H5P package validation
passed with no errors. However, the local jQuery.ui 1.10.22 source stylesheet
references six missing PNG icons. Exact paths are in inventory.json and REPORT.md.
This can cause missing jQuery UI theme icons if that upstream styling is exercised.
No replacement images or dependency changes were invented. Watch for missing-image
requests and visual issues during independent testing; retain this qualification when evaluating other hosts. Independent WordPress installation and Firefox checks were completed by the user;
no ui-icons requests or related defects were observed in that environment. This
does not guarantee the same result on every host.
