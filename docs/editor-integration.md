# Standard editor integration

The activity uses standard H5P semantics and widgets. Dependencies are
H5PEditor.VerticalTabs 1.3 and H5PEditor.ShowWhen 1.0; no custom editor is required.

Activity settings start expanded. Fields are title, introduction, global
distractors, enableCategories and a repeatable Sets list (min/defaultNum 1).
Each Set has required plain-text word and textarea context, plus optional category.
Category uses showWhen with ../../enableCategories and nullWhenHidden false,
preserving stored values while hidden. Translations start collapsed; existing
behaviour controls remain hidden.

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
patch is introduced. Five-column exports are unsupported. Firefox save/reopen acceptance remains necessary for the new
workflow. Earlier editor investigations are historical evidence only.
