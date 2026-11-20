'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const utilities=require('../scripts/concordances-utils.js');
const root=path.resolve(__dirname,'..');

test('missing grapheme segmentation rejects automatic-only input deterministically',()=>{
 const sandbox={module:{exports:{}},Intl:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/concordances-utils.js'),'utf8'),sandbox);
 const result=sandbox.module.exports.validateSets([{word:'x',context:'X'}]);
 assert.equal(result[0].code,'automaticMissingTarget');assert.equal(result[0].line,1);
 assert.equal(sandbox.module.exports.tokenizeAutomaticContext('X','x').tokens.length,0);
});

test('three-column reconstruction preserves boundaries, all ten fresco rows and ordinary tabs', () => {
  const source = require('./fixtures/lancsbox-three-column.cjs');
  const normalized = utilities.normalizeConcordance(source);
  assert.equal(normalized.format, 'lancsbox');
  assert.equal(normalized.lines.length, 10);
  assert.ok(!normalized.context.includes('\t'));
  assert.ok(!normalized.context.includes('[001]'));
  assert.equal(normalized.context.split('\n')[0], 'It boasts an ornate lobby, frescoed ceilings and a grand music');
  const result = utilities.tokenizeAutomaticContext(source, 'fresco');
  assert.deepEqual(result.errors, []);
  assert.equal(result.tokens.filter(token=>token.type==='gap').length,10);
  assert.equal(result.tokens.map(token=>token.text).join(''), normalized.context);
  assert.equal(utilities.normalizeConcordance('[001]\t ABSTRACT  end').context, '[001]\t ABSTRACT  end');
  assert.equal(utilities.normalizeConcordance('left  inside\tabstract\t, right').context, 'left  inside abstract, right');
});

test('malformed, mixed, ambiguous, old five-column and manually gapped Contexts fail without partial tokens', () => {
  for (const [context, code, line] of [
    ['left\t\tright', 'malformedLancsBox', 1],
    ['left\tabstract\tright\textra', 'malformedLancsBox', 1],
    ['1\tfile.xml\tleft\tabstract\tright', 'malformedLancsBox', 1],
    ['left\tabstract\tright\n[002] abstract', 'mixedContextFormats', 2],
    ['left\tabstract\tright\nordinary\tabstract', 'mixedContextFormats', 2],
    ['[001] abstract\n[002] _____', 'automaticManualGap', 2],
    ['abstract left\tother\tright', 'ambiguousLancsBox', 1],
    ['left\tother\tright', 'automaticMissingTarget', 1]
  ]) {
    const errors=utilities.validateSets([{word:'abstract',context}]);
    assert.ok(errors.some(e=>e.code===code&&e.line===line&&e.setIndices[0]===0));
    assert.equal(utilities.tokenizeAutomaticContext(context,'abstract').tokens.length,0);
  }
});
test('automatic literal matching maps Unicode grapheme ranges and all non-overlapping fragments safely', () => {
  for (const [word, context, expected] of [
    ['abstract', 'ABSTRACT Abstract abstract ABSTRACTions semi-ABSTRACT', '_____ _____ _____ _____ions semi-_____'],
    ['éternel', 'ÉTERNEL E\u0301TERNELlement', '_____ _____lement'],
    ['i\u0307', 'İ x', '_____ x'],
    ['a+b[?]', 'a+b[?] A+B[?]', '_____ _____'],
    ['aa', 'aaaaa', '__________a'],
    ['abstract', '[001]\t ABSTRACT  x\r\n\r\n[002]\u00a0ABSTRACT\u00a0 ', '[001]\t _____  x\r\n\r\n[002]\u00a0_____\u00a0 ']
  ]) {
    const result = utilities.tokenizeAutomaticContext(context, word);
    assert.deepEqual(result.errors, []);
    assert.equal(result.tokens.map((token) => token.text).join(''), context);
    assert.equal(result.tokens.map((token) => token.type === 'gap' ? '_____' : token.text).join(''), expected);
    result.tokens.forEach((token) => assert.equal(context.slice(token.index, token.index + token.text.length), token.text));
  }
});

test('automatic validation identifies Set/line failures, rejects manual markers and unsafe partial graphemes', () => {
  const errors = utilities.validateSets([{word: 'abstract', context: '[001] ABSTRACT\n[002] missing\n[003] ABSTRACT _____'}]);
  assert.deepEqual(errors, [
    {code: 'automaticMissingTarget', line: 2, setIndices: [0]},
    {code: 'automaticManualGap', line: 3, setIndices: [0]}
  ]);
  assert.deepEqual(utilities.tokenizeAutomaticContext('i İ', 'i').errors, []);
  assert.equal(utilities.tokenizeAutomaticContext('İ', 'i').errors[0].code, 'automaticMissingTarget');
  assert.deepEqual(utilities.validateSets([{word: 'x', context: 'x_y\n  '}]), []);
  assert.equal(utilities.tokenizeAutomaticContext('ABSTRACT\nmissing', 'abstract').tokens.length, 0);
  assert.deepEqual(utilities.validateSets([{word: 'x', context: 'x'}]), []);
});

test('answer comparison accepts canonical Unicode, trimmed and case-insensitive equivalents only', () => {
  for (const [answer, word] of [['cafe\u0301', ' CAF\u00c9 '], ['  WOULD\n', 'would'], ['\u0130', 'i\u0307']]) {
    assert.equal(utilities.wordsMatch(answer, word), true);
  }
  for (const [answer, word] of [['', ''], [null, null], ['Cafe', 'Caf\u00e9'], ['a b', 'ab'], ['\uff21', 'A']]) {
    assert.equal(utilities.wordsMatch(answer, word), false);
  }
});

test('comparison keys trim outer whitespace and ignore case while preserving internal spaces', () => {
  assert.equal(utilities.normalizeWord(' \tMiXeD\n '), 'mixed');
  assert.equal(utilities.normalizeWord(' New  York '), 'new  york');
  assert.notEqual(utilities.normalizeWord('New  York'), utilities.normalizeWord('New York'));
});

test('comparison keys use canonical Unicode normalization and retain meaningful accents', () => {
  assert.equal(utilities.normalizeWord(' CAF\u00c9 '), utilities.normalizeWord('cafe\u0301'));
  assert.equal(utilities.normalizeWord('\u00c5'), utilities.normalizeWord('A\u030a'));
  assert.notEqual(utilities.normalizeWord('caf\u00e9'), utilities.normalizeWord('cafe'));
  assert.notEqual(utilities.normalizeWord('\uff21'), utilities.normalizeWord('A'));
});

test('word comparison is locale-independent lowercase mapping rather than full Unicode case folding', () => {
  assert.equal(utilities.normalizeWord('STRA\u1e9eE'), utilities.normalizeWord('stra\u00dfe'));
  assert.notEqual(utilities.normalizeWord('stra\u00dfe'), utilities.normalizeWord('strasse'));
});

test('duplicate detection covers all Sets regardless of category and returns original spellings', () => {
  const sets = Object.freeze([
    Object.freeze({word: ' Would ', context: '__', category: 'A'}),
    Object.freeze({word: 'Could', context: '__', category: 'A'}),
    Object.freeze({word: 'WOULD', context: '__', category: 'B'}),
    Object.freeze({word: 'would', context: '__'})
  ]);
  assert.deepEqual(utilities.findDuplicateWords(sets), [
    {key: 'would', setIndices: [0, 2, 3], words: [' Would ', 'WOULD', 'would']}
  ]);
  assert.equal(sets[0].word, ' Would ');
});

test('duplicate detection finds canonically equivalent Unicode words in deterministic groups', () => {
  assert.deepEqual(utilities.findDuplicateWords([
    {word: ' CAF\u00c9 '}, {word: 'Other'}, {word: 'cafe\u0301'}, {word: 'OTHER'}
  ]), [
    {key: 'caf\u00e9', setIndices: [0, 2], words: [' CAF\u00c9 ', 'cafe\u0301']},
    {key: 'other', setIndices: [1, 3], words: ['Other', 'OTHER']}
  ]);
});

test('blank and missing correct words remain a required-field concern, not duplicate groups', () => {
  assert.deepEqual(utilities.findDuplicateWords([null, {}, {word: ''}, {word: ' \t'}, {word: 7}]), []);
  assert.deepEqual(utilities.findDuplicateWords([{word: 'One'}, {word: 'Two'}]), []);
});

test('prototype-like correct words are handled as ordinary text keys', () => {
  assert.deepEqual(utilities.findDuplicateWords([
    {word: '__proto__'}, {word: '__PROTO__'}, {word: 'constructor'}, {word: 'CONSTRUCTOR'}
  ]).map((group) => group.setIndices), [[0, 1], [2, 3]]);
});

test('all declared scripts load in a browser-like VM without Node APIs or custom editor registration', () => {
  const H5P = {Question: function () {}, jQuery: function () {}};
  const context = vm.createContext({H5P});
  const library = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));
  for (const entry of library.preloadedJs) {
    vm.runInContext(fs.readFileSync(path.join(root, entry.path), 'utf8'), context, {filename: entry.path});
  }
  assert.equal(typeof H5P.ConcordancesPapiJo, 'function');
  assert.equal(H5P.ConcordancesPapiJoUtils.tokenizeAutomaticContext('X', 'x').errors.length, 0);
  assert.equal(H5P.ConcordancesPapiJoUtils.normalizeWord(' CAF\u00c9 '), 'caf\u00e9');
  assert.equal(context.H5PEditor, undefined);
  assert.deepEqual(Object.keys(H5P).sort(), ['ConcordancesPapiJo', 'ConcordancesPapiJoRenderer', 'ConcordancesPapiJoSession', 'ConcordancesPapiJoState', 'ConcordancesPapiJoUtils', 'Question', 'jQuery']);
});
