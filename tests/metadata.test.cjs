'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const library = readJson('library.json');
const semantics = readJson('semantics.json');
const packageJson = readJson('package.json');
const field = (fields, name) => {
  const result = fields.find((entry) => entry.name === name);
  assert.ok(result, `Missing semantic field: ${name}`);
  return result;
};
const activity = field(semantics, 'activity');
const sets = field(activity.fields, 'sets');

function walkFields(fields, inspect) {
  assert.ok(Array.isArray(fields));
  const names = new Set();
  for (const entry of fields) {
    assert.equal(typeof entry.name, 'string');
    assert.ok(!names.has(entry.name), `Duplicate sibling field: ${entry.name}`);
    names.add(entry.name);
    inspect(entry);
    if (entry.type === 'group') walkFields(entry.fields, inspect);
    if (entry.type === 'list') walkFields([entry.field], inspect);
  }
}

test('manifest identifies a runnable standalone activity at version 1.1.5 for Core API 1.28', () => {
  assert.equal(library.machineName, 'H5P.ConcordancesPapiJo');
  assert.deepEqual([library.majorVersion, library.minorVersion, library.patchVersion], [1, 1, 5]);
  assert.deepEqual(library.coreApi, { majorVersion: 1, minorVersion: 28 });
  assert.equal(library.runnable, 1);
  assert.deepEqual(library.embedTypes, ['iframe']);
  for (const key of ['title', 'description', 'author', 'license']) {
    assert.equal(typeof library[key], 'string');
    assert.ok(library[key].length > 0);
  }
  assert.match(library.description, /saved-state restoration and xAPI completion/i);
  assert.equal(packageJson.version, '1.1.5');
});

test('runtime depends only on official Question 1.5 and guards optional themed Start creation', () => {
  assert.deepEqual(library.preloadedDependencies, [
    { machineName: 'H5P.Question', majorVersion: 1, minorVersion: 5 }
  ]);
  assert.equal(library.dynamicDependencies, undefined);
  for (const entry of library.preloadedJs) {
    const source = fs.readFileSync(path.join(root, entry.path), 'utf8');
    if (entry.path === 'scripts/h5p-concordances-papijo.js') {
      assert.match(source, /typeof H5P\.Components\?\.Button === 'function'/);
    }
    else assert.doesNotMatch(source, /H5P\.Components/);
  }
});

test('editor declares VerticalTabs but no unimplemented editor library', () => {
  assert.deepEqual(library.editorDependencies, [
    { machineName: 'H5PEditor.VerticalTabs', majorVersion: 1, minorVersion: 3 },
    { machineName: 'H5PEditor.ShowWhenpapijo', majorVersion: 1, minorVersion: 0 }
  ]);
  assert.equal(activity.widget, undefined);
  assert.equal(field(sets.field.fields, 'context').widget, 'textarea');
});

test('every declared runtime asset exists and resolves inside this project', () => {
  for (const asset of [...library.preloadedJs, ...library.preloadedCss]) {
    assert.equal(typeof asset.path, 'string');
    assert.equal(path.isAbsolute(asset.path), false);
    const absolute = fs.realpathSync(path.join(root, asset.path));
    const relative = path.relative(fs.realpathSync(root), absolute);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.equal(fs.statSync(absolute).isFile(), true);
    assert.ok(fs.statSync(absolute).size > 0);
  }
});

test('semantics have valid foundation field types and unique sibling names', () => {
  const supported = new Set(['text', 'boolean', 'group', 'list', 'select']);
  walkFields(semantics, (entry) => {
    assert.ok(supported.has(entry.type), `Unsupported type: ${entry.type}`);
    assert.equal(typeof entry.label, 'string');
    assert.ok(entry.label.length > 0);
    if (entry.optional !== undefined) assert.equal(typeof entry.optional, 'boolean');
    if (entry.common !== undefined) assert.equal(typeof entry.common, 'boolean');
    if (entry.widget !== undefined) {
      assert.ok(['textarea', 'none', 'showWhen'].includes(entry.widget));
      if (entry.widget === 'textarea') assert.equal(entry.type, 'text');
    }
    if (entry.type === 'boolean' && entry.default !== undefined) {
      assert.equal(typeof entry.default, 'boolean');
    }
  });
});

test('activity includes a required plain title and optional multiline introduction and distractors', () => {
  const title = field(activity.fields, 'title');
  assert.equal(title.type, 'text');
  assert.equal(title.optional, false);
  for (const name of ['introduction', 'distractors']) {
    const entry = field(activity.fields, name);
    assert.equal(entry.type, 'text');
    assert.equal(entry.widget, 'textarea');
    assert.equal(entry.optional, true);
  }
});

test('Sets use a repeatable group list with a minimum and default of one and VerticalTabs', () => {
  assert.equal(sets.type, 'list');
  assert.equal(sets.min, 1);
  assert.equal(sets.defaultNum, 1);
  assert.equal(sets.entity, 'Set');
  assert.deepEqual(sets.widgets, [{ name: 'VerticalTabs', label: 'Default' }]);
  assert.equal(sets.field.type, 'group');
  for (const name of ['word', 'context']) {
    const entry = field(sets.field.fields, name);
    assert.equal(entry.type, 'text');
    assert.equal(entry.optional, false);
  }
});

test('Context stays required and delegates mode-specific gap validation to runtime', () => {
  const context = field(sets.field.fields, 'context');
  assert.equal(context.type, 'text');
  assert.equal(context.widget, 'textarea');
  assert.equal(context.optional, false);
  assert.equal(context.maxLength, undefined);
  assert.equal(context.default, undefined);
  assert.equal(context.regexp, undefined);
  assert.equal(activity.fields.some((entry) => entry.name === 'automaticGaps'), false);
  assert.match(context.description, /LancsBox X/);
  assert.match(context.description, /Gaps are generated automatically/);
  assert.match(context.description, /spacing is preserved/);
  assert.match(context.description, /tab-separated/);
  assert.match(activity.description, /Gaps are generated automatically/);
});

test('categories default to disabled and each Set has one optional plain-text category', () => {
  const enabled = field(activity.fields, 'enableCategories');
  assert.equal(enabled.type, 'boolean');
  assert.equal(enabled.default, false);
  const category = field(sets.field.fields, 'category');
  assert.equal(category.type, 'text');
  assert.equal(category.optional, true);
  assert.equal(category.widget, 'showWhen');
  assert.deepEqual(category.showWhen, {rules: [{field: '../../enableCategories', equals: true}], nullWhenHidden: false});
  assert.equal(activity.expanded, true);
  assert.equal(field(semantics, 'behaviour').expanded, false);
  assert.match(category.description, /not a category separator/);
  assert.deepEqual(sets.field.fields.map((entry) => entry.name), ['word', 'context', 'category']);
});

test('Sets have no hidden identity fields or editor-managed subContentId generation', () => {
  assert.equal(sets.field.isSubContent, undefined);
  assert.equal(sets.field.fields.some((entry) => ['setId', 'subContentId'].includes(entry.name)), false);
  assert.equal(sets.field.fields.some((entry) => entry.widget === 'none'), false);
});

test('standard authoring explicitly explains that duplicate correct words may still be saved', () => {
  const word = field(sets.field.fields, 'word');
  assert.match(word.description, /Unicode normalization/);
  assert.match(word.description, /case-insensitive/);
  assert.match(word.description, /duplicate words may still be saved/);
  assert.equal(word.regexp, undefined);
});

test('manifest loads shared browser validation utilities before the learner shell', () => {
  assert.deepEqual(library.preloadedJs, [
    { path: 'scripts/concordances-utils.js' },
    { path: 'scripts/concordances-session.js' },
    { path: 'scripts/concordances-state.js' },
    { path: 'scripts/concordances-renderer.js' },
    { path: 'scripts/h5p-concordances-papijo.js' }
  ]);
});

test('answer mode and Retry are visible while Show solution stays hidden', () => {
  const behaviour = field(semantics, 'behaviour');
  assert.equal(behaviour.type, 'group');
  assert.equal(behaviour.widget, undefined);
  assert.deepEqual(behaviour.fields.map((entry) => entry.name), ['setOrder', 'answerMode', 'enableProgressiveHints', 'typedPenalty', 'spellingErrorBehaviour', 'freeSpellingWarnings', 'enableRetry', 'enableSolutionsButton']);
  const mode = field(behaviour.fields, 'answerMode');
  assert.equal(mode.type, 'select');
  assert.equal(mode.default, 'dropdown');
  assert.deepEqual(mode.options.map(option=>option.value), ['dropdown', 'typed', 'learner']);
  assert.deepEqual(field(behaviour.fields, 'enableRetry'), {
    name: 'enableRetry',
    type: 'boolean',
    label: 'Enable "Retry" button',
    description: 'Allow learners to restart the activity after completing it.',
    default: true
  });
  assert.equal(field(behaviour.fields, 'enableSolutionsButton').widget, 'none');
  assert.match(field(activity.fields, 'distractors').description, /inactive in typed/);
  assert.equal(field(behaviour.fields, 'enableRetry').default, true);
  assert.equal(field(behaviour.fields, 'enableSolutionsButton').default, false);
});

test('all semantic text stays plain without unintended rich-text formatting or HTML labels', () => {
  walkFields(semantics, (entry) => {
    assert.notEqual(entry.widget, 'html');
    for (const property of ['tags', 'font', 'enterMode']) assert.equal(entry[property], undefined);
    for (const property of ['label', 'description', 'default']) {
      if (typeof entry[property] === 'string') assert.doesNotMatch(entry[property], /<[^>]*>/);
    }
  });
});

test('localization covers learner UI, categories, feedback, results, accessibility and validation', () => {
  const groups = {
    l10n: ['placeholderTitle', 'foundationMessage', 'selectCategory', 'allCategories', 'uncategorized',
      'selectedCategory', 'modeLabel', 'selectWord', 'typeWord', 'start', 'progress', 'answerLabel', 'selectAnswer', 'check', 'next', 'viewResults', 'retry',
      'correct', 'incorrect', 'answerRequired', 'resultsTitle', 'totalScore', 'firstAttemptCount',
      'secondAttemptCount', 'laterAttemptCount', 'resultSet', 'resultWord', 'resultAttempts', 'resultPoints',
      'setLabel', 'invalidContentTitle', 'invalidContentDescription', 'runtimeError', 'sequenceEnd', 'attemptSingular', 'attemptPlural', 'typedInstruction', 'spellingWarning', 'spellingWarningAnswer', 'spellingWarningsExhausted', 'hint', 'hintLocked', 'hintLockedWarnings', 'hintAvailable', 'hintAfterRequest', 'hintRevealed', 'hintDescription'],
    a11y: ['missingWord', 'correctAnswer', 'incorrectAnswer', 'kwicRegion', 'contextAlternative', 'missingLetter'],
    validation: ['duplicateWord', 'noSets', 'missingWord', 'missingContext', 'automaticMissingTarget', 'automaticManualGap', 'malformedLancsBox', 'mixedContextFormats', 'ambiguousLancsBox']
  };
  for (const [name, required] of Object.entries(groups)) {
    const group = field(semantics, name);
    assert.equal(group.common, true);
    assert.deepEqual(group.fields.map((entry) => entry.name), required);
    for (const entry of group.fields) {
      assert.equal(entry.type, 'text');
      assert.equal(typeof entry.default, 'string');
      assert.ok(entry.default.length > 0);
    }
  }
});

test('browser entry point has valid JavaScript syntax', () => {
  for (const entry of library.preloadedJs) {
    const file = path.join(root, entry.path);
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }));
  }
});

test('project scripts require no installed packages, build step, packaging or deployment', () => {
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
  assert.equal(packageJson.scripts.build, undefined);
  assert.equal(packageJson.scripts.install, undefined);
  assert.equal(packageJson.scripts.postinstall, undefined);
  assert.deepEqual(Object.keys(packageJson.scripts), ['check:syntax', 'validate', 'test']);
  assert.equal(packageJson.private, true);
});

test('source tree excludes junctions, installed packages and archives outside release output', () => {
  function visit(directory) {
    for (const name of fs.readdirSync(directory)) {
      if (name === '.git' || (directory === path.join(root, 'release') && name === '1.0.0')) continue;
      const file = path.join(directory, name);
      assert.equal(fs.lstatSync(file).isSymbolicLink(), false, `Unexpected link: ${file}`);
      assert.ok(name !== 'node_modules', `Unexpected directory: ${name}`);
      assert.ok(!name.endsWith('.h5p') || path.relative(root,file).startsWith('release'+path.sep), `Unexpected package: ${name}`);
      if (fs.statSync(file).isDirectory()) visit(file);
    }
  }
  visit(root);
});


test('typed scoring penalty is conditionally visible with one-point default and preserved hidden value',()=>{
  const penalty=field(field(semantics,'behaviour').fields,'typedPenalty');
  assert.equal(penalty.type,'select');assert.equal(penalty.default,'1');
  assert.deepEqual(penalty.options.map(option=>option.value),['1','0.5']);
  assert.equal(penalty.widget,'showWhen');assert.deepEqual(penalty.showWhen,{rules:[{field:'answerMode',equals:['typed','learner']}],nullWhenHidden:false});
});


test('spelling policy authoring defaults to mistake and is visible for typed and learner modes',()=>{
  const setting=field(field(semantics,'behaviour').fields,'spellingErrorBehaviour');
  assert.equal(setting.default,'mistake');assert.equal(field(semantics,'l10n').fields.some(item=>item.name==='acceptedSpellingFeedback'),false);assert.deepEqual(setting.options.map(option=>option.value),['mistake','warn']);
  assert.deepEqual(setting.showWhen,{rules:[{field:'answerMode',equals:['typed','learner']}],nullWhenHidden:false});
});


test('warning allowance editor defaults to two for new and existing content and retains hidden values',()=>{
  const field=semantics.find(item=>item.name==='behaviour').fields.find(item=>item.name==='freeSpellingWarnings');
  assert.equal(field.default,'2');assert.deepEqual(field.options.map(item=>item.value),['1','2','3','unlimited']);
  assert.deepEqual(field.showWhen,{rules:[{field:'answerMode',equals:['typed','learner']},{field:'spellingErrorBehaviour',equals:'warn'}],nullWhenHidden:false,type:'and'});
  const utils=require('../scripts/concordances-utils.js');
  assert.equal(utils.resolveWarningAllowance({answerMode:'typed',spellingErrorBehaviour:'warn'}),2);
  assert.equal(utils.resolveWarningAllowance({answerMode:'typed',spellingErrorBehaviour:'warn',freeSpellingWarnings:'1'}),1);
  assert.equal(utils.resolveWarningAllowance({answerMode:'dropdown',freeSpellingWarnings:'unlimited'}),1);
});


test('progressive hint author setting defaults disabled and remains typed-only with hidden value preservation',()=>{
  const setting=field(field(semantics,'behaviour').fields,'enableProgressiveHints');
  assert.equal(setting.type,'boolean');assert.equal(setting.default,false);
  assert.equal(setting.description,'Allow learners to request progressive letter hints after making incorrect attempts. Each hint reduces the available score by 0.5 points.');
  assert.deepEqual(setting.showWhen,{rules:[{field:'answerMode',equals:['typed','learner']}],nullWhenHidden:false});
  assert.equal(field(field(semantics,'behaviour').fields,'enableSolutionsButton').widget,'none');
});
