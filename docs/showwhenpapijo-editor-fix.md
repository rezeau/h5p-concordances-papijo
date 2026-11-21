# ShowWhenpapijo editor fix

## Exact changes

- library.json: replace H5PEditor.ShowWhen 1.0 with H5PEditor.ShowWhenpapijo 1.0.
  The official widget is not also declared. Version fields remain 1.0.0 / Core API 1.28.
- semantics.json: add type=and to freeSpellingWarnings.showWhen, retaining its
  typed + warn rules, nullWhenHidden=false and default 2.
- tests/metadata.test.cjs: update expected dependency and explicit AND configuration.
- tests/showwhen-editor.test.cjs: new optional local integration check using the
  installed fork plus actual editor findField/followField implementations.
- README.md; docs/editor-integration.md: current editor dependency/conventions.
- docs/showwhenpapijo-editor-fix.md: this report.

No runtime, scoring, hint unlocking, saved-state, schema/fingerprint, other-library,
Core/CMS or CLI junction/configuration changes. No Git mutation, packaging,
deployment, publication or browser automation. Earlier local edits are preserved.

## Behavior and verification

The official widget defaults rule combination to OR and does not forward wrapped
select changes. The installed fork adds the forwarding; explicit AND is still
required. The field is now visible only for typed + warn. Its value remains stored
while hidden, and default allowance remains 2.

Focused command (set the environment variable to the installed libraries directory):

~~~powershell
node --test --test-name-pattern='editor declares|warning allowance editor|installed ShowWhenpapijo' tests/metadata.test.cjs tests/showwhen-editor.test.cjs
~~~

CONCORDANCES_EDITOR_LIBRARIES was set for that shell command only. Result:
3 passed, 0 failed, 0 skipped. The integration test uses actual installed conditional
logic and field-following functions with a small control/DOM boundary, not browser
automation. It verifies immediate Warn -> mistake -> Warn changes, Dropdown hiding,
typed/mistake hiding, and retention of selected value 3. Metadata verifies default 2.
The local integration test skips when its library-directory environment variable is
absent, keeping ordinary portable test execution independent of a machine layout.

## Dependency resolution and remaining risk

Read-only inspection of installed CLI resolver/asset generation code confirmed
machine-name-based local library discovery. Its discovery helper can register
unregistered libraries by writing the registry, so that mutating helper was not
invoked. Instead the current declared dependency graph was resolved recursively
against the actual installed manifests, and the existing registry entry was read.

The graph resolves to Concordances 1.0.0, VerticalTabs 1.3.16, ShowWhenpapijo 1.0.5,
Question 1.5.56, JoubelUI 1.3.46, Components 1.0.99, Transition 1.0.4,
FontIcons 1.0.6, FontAwesome 4.5.6 and jQuery.ui 1.10.22. No declared library is
missing, and official H5PEditor.ShowWhen is absent from this closure. The existing
registry already maps the fork to h5p-editor-show-whenpapijo. Its manifest supplies
h5p-show-when.js and h5p-show-when.css without additional dependencies.

Both official and fork scripts register H5PEditor.ShowWhen and widgets.showWhen.
Mixed-library editor pages or switching content types without a fresh page load
can therefore remain order-dependent if another library loads official ShowWhen.
The fork can also affect other co-loaded fields. Its hidden values are retained;
unlike the official widget, it does not implement nullWhenHidden clearing. Current
Concordances fields require preservation, so this is consistent here. No changes
were made to other libraries to eliminate the shared-global risk. A separately
namespaced adapter would require a later explicit decision if mixed-editor
coexistence becomes a requirement.

## Firefox acceptance

Hard-refresh/reopen the standalone Concordances editor so the revised dependency
list loads. In Typed + Warn, select allowance 3. Switch to Regular mistake:
allowance must hide immediately. Switch back to Warn: it must show value 3.
Switch to Dropdown: it must hide; return to Typed + Warn and confirm value 3.
A fresh activity must default to allowance 2. This manual browser verification is
pending; no browser success is claimed by the source-level integration check.

STOPPED for Firefox acceptance.
