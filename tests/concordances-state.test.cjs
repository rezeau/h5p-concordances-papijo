'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const model = require('../scripts/concordances-session.js');
const stateModel = require('../scripts/concordances-state.js');
const clone = (value) => JSON.parse(JSON.stringify(value));
const keepOrder = () => 0.999999;

test('automatic-only fingerprints ignore removed mode flags, retain ordinary domain and invalidate legacy manual sessions', () => {
  const ordinary={sets:[{word:'abstract',context:'ABSTRACT'}]};
  assert.equal(stateModel.fingerprint(ordinary),stateModel.fingerprint({...ordinary,automaticGaps:true}));
  assert.equal(stateModel.fingerprint(ordinary),stateModel.fingerprint({...ordinary,automaticGaps:false}));
  const saved=stateModel.createState(ordinary,model.createSelectionSession(ordinary,keepOrder));
  assert.equal(stateModel.validateState(ordinary,saved).valid,true);
  const manual={sets:[{word:'abstract',context:'_____'}]};
  assert.equal(stateModel.fingerprint(manual),null);
  assert.equal(stateModel.restoreSession(manual,saved),null);
  const tabular={sets:[{word:'abstract',context:'left\tABSTRACT\tright'}]};
  assert.notEqual(stateModel.fingerprint(tabular),saved.fingerprint);
  const oldFive={sets:[{word:'abstract',context:'1\tf.xml\tleft\tABSTRACT\tright'}]};
  assert.equal(stateModel.fingerprint(oldFive),null);
  assert.equal(stateModel.restoreSession(oldFive,saved),null);
  const tabState=stateModel.createState(tabular,model.createSelectionSession(tabular,keepOrder));
  // A snapshot from the former tabular interpretation domain must not hydrate.
  const canonical=[1,false,'',[['abstract','abstract',tabular.sets[0].context,null]],['automatic-gaps',2]];
  let a=0x811c9dc5,b=0x9e3779b9;
  for(const c of JSON.stringify(canonical).split('')){
    a=Math.imul(a^c.charCodeAt(0),0x01000193)>>>0;
    b=Math.imul(b^c.charCodeAt(0),0x85ebca6b)>>>0;
  }
  const stale={...tabState,fingerprint:'cpj1:'+a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')};
  assert.equal(stateModel.restoreSession(tabular,stale),null);
  assert.equal(tabState.version,1);
  assert.equal(stateModel.validateState(tabular,tabState).valid,true);
  assert.deepEqual(stateModel.createState(tabular,stateModel.restoreSession(tabular,tabState)),tabState);
});
const activity={enableCategories:true,distractors:'Wrong',sets:[{word:'One',context:'first One',category:'A'},{word:'Two',context:'second Two',category:'B'}]};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('restoration maps saved identities across authored reordering and preserves every prepared order/state', () => {
  const source = {enableCategories: true, distractors: 'Wrong', sets: [
    {word: 'One', category: 'A', context: 'One'}, {word: 'Two', category: 'B', context: 'Two'},
    {word: 'Three', category: 'A', context: 'Three'}
  ]};
  const session = model.createSelectionSession(source, () => 0);
  session.selectCategory('category-0');
  session.selectAnswer(String(session.answers.indexOf('Three'))); session.checkAnswer();
  session.advance(session.displayedSetIndex);
  const saved = stateModel.createState(source, session);
  const reordered = {...source, sets: source.sets.slice().reverse()};
  const restored = stateModel.restoreSession(reordered, saved);
  assert.ok(restored);
  assert.deepEqual(stateModel.createState(reordered, restored), saved);
  assert.equal(reordered.sets[restored.displayedSetIndex].word, 'One');
  assert.equal(restored.getScore(), 2);
  assert.equal(restored.getMaxScore(), 4);
  assert.equal(restored.selectCategory('all'), false);
});

test('snapshots and validated copies round-trip through JSON without sharing live or candidate state', () => {
  const source = freeze(clone(activity)), before = JSON.stringify(source);
  const session = model.createSelectionSession(source, keepOrder);
  session.selectAnswer('2');
  const snapshot = stateModel.createState(source, session), candidate = freeze(clone(snapshot));
  assert.deepEqual(snapshot, candidate);
  const validated = stateModel.validateState(source, candidate);
  assert.equal(validated.valid, true);
  assert.deepEqual(validated.state, candidate);
  validated.state.sets[0][2] = 999;
  validated.state.answerOrder.reverse();
  snapshot.setOrder.reverse();
  snapshot.sets[0][1] = 'invalid';
  assert.equal(candidate.sets[0][2], 0);
  assert.equal(session.getSetState(0).attempts, 0);
  assert.equal(session.selectedAnswerIndex, 2);
  assert.deepEqual(session.setOrder, [0, 1]);
  assert.equal(JSON.stringify(source), before);
  assert.equal(JSON.stringify(candidate).includes(source.sets[0].context), false);
});

test('stable Set/answer/category identities preserve shuffled permutations across authored Set reordering and deduplication', () => {
  const source = {enableCategories: true, distractors: 'cafe\u0301\n X \nx\nY', sets: [
    {word: ' CAF\u00c9 ', context: ' CAF\u00c9 ', category: ' Verbs '},
    {word: 'Other', context: 'Other', category: 'Nouns'}, {word: 'Last', context: 'Last', category: 'verbs'}
  ]};
  const session = model.createSelectionSession(source, () => 0);
  session.selectCategory('category-0');
  const snapshot = stateModel.createState(source, session);
  assert.deepEqual(snapshot.setOrder, ['other', 'last', 'caf\u00e9']);
  assert.deepEqual(snapshot.category, ['named', 'verbs']);
  assert.equal(snapshot.answerOrder.filter((id) => id === 'caf\u00e9').length, 1);
  assert.equal(snapshot.answerOrder.filter((id) => id === 'x').length, 1);
  const reordered = {...source, sets: source.sets.slice().reverse()};
  assert.equal(stateModel.fingerprint(reordered), snapshot.fingerprint);
  const accepted = stateModel.validateState(reordered, snapshot);
  assert.equal(accepted.valid, true);
  assert.deepEqual(accepted.state.setOrder, snapshot.setOrder);
  assert.deepEqual(accepted.state.answerOrder, snapshot.answerOrder);
  const currentPool = model.buildAnswerPool(reordered.sets, reordered.distractors);
  assert.equal(currentPool.includes('CAF\u00c9'), true); // Correct spelling wins over its distractor alias.
});

test('canonical fingerprints ignore property/Set order and reject each relevant authored content edit', () => {
  const session = model.createSelectionSession(activity, keepOrder);
  const snapshot = stateModel.createState(activity, session);
  const reorderedProperties = {sets: activity.sets.map((set) => ({category: set.category, context: set.context, word: set.word})),
    distractors: activity.distractors, enableCategories: true};
  assert.equal(stateModel.fingerprint(reorderedProperties), snapshot.fingerprint);
  const edits = [
    (source) => { source.sets.push({word: 'Three', context: 'Three'}); },
    (source) => { source.sets.pop(); },
    (source) => { source.sets[0].word = 'ONE'; },
    (source) => { source.sets[0].context += ' '; },
    (source) => { source.distractors = 'wrong\nWrong'; },
    (source) => { source.sets[0].category = 'B'; },
    (source) => { source.enableCategories = false; }
  ];
  for (const edit of edits) {
    const source = clone(activity); edit(source);
    assert.notEqual(stateModel.fingerprint(source), snapshot.fingerprint);
    assert.deepEqual(stateModel.validateState(source, snapshot), {valid: false, reason: 'content'});
  }
});

test('strict validation rejects malformed, partial and inconsistent candidates without mutation or executing accessors', () => {
  const session = model.createSelectionSession(activity, keepOrder);
  session.selectAnswer('2'); session.checkAnswer();
  const valid = stateModel.createState(activity, session);
  const edits = [
    (state) => { state.version = 2; },
    (state) => { state.fingerprint = 'unknown'; },
    (state) => { state.setOrder[0] = state.setOrder[1]; },
    (state) => { state.answerOrder[0] = state.answerOrder[1]; },
    (state) => { state.sets.pop(); },
    (state) => { state.category = ['named', 'missing']; },
    (state) => { state.position = 20; },
    (state) => { state.sets[0][1] = 'missing'; },
    (state) => { state.sets[0][2] = -1; },
    (state) => { state.sets[0][2] = 1.5; },
    (state) => { state.sets[0][3] = true; },
    (state) => { state.sets[0][1] = 'one'; }, // A checked correct selection cannot remain unsolved.
    (state) => { state.locked = false; },
    (state) => { state.position = 1; }, // Its preceding Set is unsolved.
    (state) => { state.sets[1][1] = 'two'; }, // A future Set cannot have provisional input.
    (state) => { state.results = true; },
    (state) => { state.score = 0; }
  ];
  for (const edit of edits) {
    const candidate = clone(valid); edit(candidate); freeze(candidate);
    const before = JSON.stringify(candidate);
    assert.equal(stateModel.validateState(activity, candidate).valid, false);
    assert.equal(JSON.stringify(candidate), before);
  }
  for (const candidate of [null, {}, [], {version: 1}]) assert.equal(stateModel.validateState(activity, candidate).valid, false);
  let accessed = false;
  const accessor = {...valid};
  Object.defineProperty(accessor, 'version', {enumerable: true, get() { accessed = true; throw Error('Do not execute'); }});
  assert.equal(stateModel.validateState(activity, accessor).valid, false);
  assert.equal(accessed, false);
  assert.deepEqual(stateModel.createState(activity, session), valid);
});
