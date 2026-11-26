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


const typedMode={answerMode:'typed'};
const typedActivity={enableCategories:true,distractors:'Ignored',sets:[{word:'can&#039;t',context:"CAN'T",category:'A'},{word:'Two',context:'TWO',category:'B'}]};
const typedSession=()=>model.createSelectionSession(typedActivity,keepOrder,null,'typed');
const saveTyped=session=>stateModel.createState(typedActivity,session);
const restoreTyped=saved=>stateModel.restoreSession(typedActivity,saved,typedMode);

test('schema-1 published fixture remains exact for absent and explicit dropdown mode',()=>{
  const fixture=require('./fixtures/schema1-release-1.0.0.json');
  for(const mode of [undefined,{answerMode:'dropdown'}]){
    assert.equal(stateModel.fingerprint(fixture.activity,mode),fixture.state.fingerprint);
    assert.equal(stateModel.validateState(fixture.activity,fixture.state,mode).valid,true);
    const restored=stateModel.restoreSession(fixture.activity,fixture.state,mode);
    assert.deepEqual(stateModel.createState(fixture.activity,restored),fixture.state);
  }
});

test('typed schema 2 preserves partial, incorrect, changed-back, changed and solved values without shuffling',()=>{
  const session=typedSession();
  const check=()=>{
    const saved=saveTyped(session),copy=clone(saved);assert.equal(saved.version,2);assert.equal(saved.answerMode,'typed');
    assert.equal(Object.hasOwn(saved,'answerOrder'),false);
    assert.equal(stateModel.validateState(typedActivity,freeze(copy),typedMode).valid,true);
    const restored=restoreTyped(copy);assert.ok(restored);assert.deepEqual(saveTyped(restored),saved);
    assert.equal(restored.canCheck(),session.canCheck());assert.equal(restored.getScore(),session.getScore());
    assert.equal(restored.getSetState().typedText,session.getSetState().typedText);
    return restored;
  };
  session.setTypedAnswer('  PaRtiAL  ');check();
  session.setTypedAnswer('wrong');session.checkAnswer();check();
  session.setTypedAnswer(' WRONG ');assert.equal(check().canCheck(),false);
  session.setTypedAnswer('different');check();session.setTypedAnswer('wrong');assert.equal(check().canCheck(),false);
  session.setTypedAnswer(" CAN'T ");check();session.checkAnswer();check();
  session.advance(session.displayedSetIndex);session.setTypedAnswer('two');session.checkAnswer();
  assert.equal(check().allSolved,true);
  const markup=typedSession();markup.setTypedAnswer('<img onerror=x> &quot;');assert.equal(restoreTyped(saveTyped(markup)).getSetState().typedText,'<img onerror=x> &quot;');
});

test('typed fingerprint ignores distractors, rejects mode/content changes and retains category identity across reordering',()=>{
  const session=typedSession();session.selectCategory('category-0');session.setTypedAnswer("can't");session.checkAnswer();
  const saved=saveTyped(session);
  const changed={...typedActivity,distractors:'Completely different',sets:typedActivity.sets.slice().reverse()};
  assert.equal(stateModel.fingerprint(changed,typedMode),saved.fingerprint);
  assert.ok(stateModel.restoreSession(changed,saved,typedMode));
  assert.equal(stateModel.restoreSession(typedActivity,saved),null);
  const dropdown=stateModel.createState(typedActivity,model.createSelectionSession(typedActivity,keepOrder));
  assert.equal(restoreTyped(dropdown),null);
  for(const mutate of [a=>a.sets[0].word='Other',a=>a.sets[0].context+=' ',a=>a.enableCategories=false,a=>a.sets[0].category='C']){
    const copy=clone(typedActivity);mutate(copy);assert.equal(stateModel.restoreSession(copy,saved,typedMode),null);
  }
});

test('typed strict validation rejects malformed and impossible snapshots without executing accessors',()=>{
  const session=typedSession();session.setTypedAnswer('wrong');session.checkAnswer();const saved=saveTyped(session);
  const changes=[s=>s.version=1,s=>s.answerMode='dropdown',s=>s.fingerprint='cpj1:bad',s=>s.answerOrder=[],s=>s.score=99,
    s=>s.setOrder.reverse(),s=>s.setOrder[1]=s.setOrder[0],s=>s.category=['named','absent'],s=>s.position=9,s=>s.locked=false,
    s=>s.results=true,s=>s.sets[0][2]=-1,s=>s.sets[0][2]=1.5,s=>s.sets[0][2]=Number.MAX_SAFE_INTEGER+1,
    s=>s.sets[0][1]={html:'bad'},s=>s.sets[0][1]='line\nbreak',s=>s.sets[0][3]=true,s=>s.sets[0][5]=null,
    s=>s.sets[0][5]=' WRONG ',s=>s.sets[0][5]="can't",s=>s.sets[0][1]='different',s=>s.sets[1][1]='future input',
    s=>s.sets[0].push('extra'),s=>s.sets.pop()];
  // Reversing order alone would move the checked Set into the future and is invalid.
  for(const mutate of changes){const copy=clone(saved);mutate(copy);assert.equal(stateModel.validateState(typedActivity,copy,typedMode).valid,false);}
  let reads=0;const malicious=clone(saved);Object.defineProperty(malicious.sets[0],'1',{get(){reads++;return 'bad';},enumerable:true});
  assert.equal(stateModel.validateState(typedActivity,malicious,typedMode).valid,false);assert.equal(reads,0);
});


test('typed penalty compatibility preserves legacy one-point domain and restores all half-point stages',()=>{
  const activity={sets:[{word:'One',context:'ONE'}],distractors:'Ignored'};
  const one={answerMode:'typed',typedPenalty:'1'},half={answerMode:'typed',typedPenalty:'0.5'};
  // Reference canonical input from Phase 2A-3, before scoring was configurable.
  const canonical=[2,'typed',false,[['one','One','ONE',null]],['automatic-gaps',1]];
  let a=0x811c9dc5,b=0x9e3779b9;for(const character of JSON.stringify(canonical)){a=Math.imul(a^character.charCodeAt(0),0x01000193)>>>0;b=Math.imul(b^character.charCodeAt(0),0x85ebca6b)>>>0;}
  const legacy='cpj1:'+a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
  assert.equal(stateModel.fingerprint(activity,typedMode),legacy);assert.equal(stateModel.fingerprint(activity,one),legacy);
  assert.notEqual(stateModel.fingerprint(activity,half),legacy);
  assert.equal(stateModel.fingerprint(activity),stateModel.fingerprint(activity,{answerMode:'dropdown',typedPenalty:'0.5'}));
  for(const penalty of [1,0.5]){
    const mode=penalty===1?one:half,other=penalty===1?half:one;
    const session=model.createSelectionSession(activity,keepOrder,null,'typed',penalty);
    const roundTrip=()=>{
      const saved=stateModel.createState(activity,session);
      const restored=stateModel.restoreSession({...activity,distractors:'Changed'},clone(saved),mode);
      assert.ok(restored);assert.deepEqual(stateModel.createState(activity,restored),saved);assert.equal(restored.getScore(),session.getScore());
      assert.equal(restored.canCheck(),session.canCheck());assert.equal(stateModel.restoreSession(activity,saved,other),null);
      assert.equal(Object.hasOwn(saved,'score'),false);assert.equal(Object.hasOwn(saved,'typedPenalty'),false);
    };
    session.setTypedAnswer(' Partial ');roundTrip();session.setTypedAnswer('wrong');session.checkAnswer();roundTrip();session.setTypedAnswer('different');roundTrip();session.setTypedAnswer('One');session.checkAnswer();roundTrip();
    assert.equal(session.getScore(),2-penalty);
  }
});


test('warning allowance schema 4 round-trips counts/history with strict cross-allowance rejection',()=>{
  const activity={enableCategories:true,sets:[{word:'fresco',context:'FRESCOes',category:'A'},{word:'Two',context:'TWO',category:'B'}]};
  for(const allowance of [1,2,3,'unlimited']){
    const behaviour={answerMode:'typed',spellingErrorBehaviour:'warn',freeSpellingWarnings:allowance};
    const session=model.createSelectionSession(activity,keepOrder,null,'typed',1,'warn',allowance);session.selectCategory('category-0');
    session.setTypedAnswer('fresoc');session.checkAnswer();if(allowance!==1){session.setTypedAnswer('frescp');session.checkAnswer();}
    const saved=stateModel.createState(activity,session);assert.equal(saved.version,4);assert.equal(saved.warningAllowance,allowance);assert.equal(saved.sets[0][6],allowance===1?1:2);assert.equal(saved.sets[0][8].length,allowance===1?1:2);
    const restored=stateModel.restoreSession(activity,clone(saved),behaviour);assert.ok(restored);assert.deepEqual(stateModel.createState(activity,restored),saved);assert.equal(restored.getSetState().warningCount,allowance===1?1:2);
    restored.setTypedAnswer(' FRESOC ');assert.equal(restored.canCheck(),false);restored.setTypedAnswer('fresh');assert.equal(restored.canCheck(),true);
    for(const other of [1,2,3,'unlimited'].filter(value=>value!==allowance))assert.equal(stateModel.restoreSession(activity,saved,{...behaviour,freeSpellingWarnings:other}),null);
    assert.equal(stateModel.restoreSession(activity,{...saved,version:3},behaviour),null);
    for(const mutate of [s=>s.warningAllowance='invalid',s=>s.sets[0][6]=-1,s=>s.sets[0][6]=1.5,s=>s.sets[0][6]=Number.MAX_SAFE_INTEGER+1,s=>s.sets[0][8].push(s.sets[0][8][0]),s=>s.sets[0][8][0]='unrelated',s=>s.sets[0][7]=false,s=>s.sets[1][1]='future',s=>s.locked=false]){
      const bad=clone(saved);mutate(bad);assert.equal(stateModel.validateState(activity,bad,behaviour).valid,false);
    }
  }
  for(const behaviour of [{},{answerMode:'typed'}])assert.equal(stateModel.fingerprint(activity,behaviour),stateModel.fingerprint(activity,{...behaviour,freeSpellingWarnings:'unlimited'}));
});


test('page metadata rejects unfinished Results, accessors and nested hint flags', () => {
  const activity = {sets: [{word: 'One', context: 'ONE'}]};
  for (const behaviour of [{}, {answerMode: 'typed', enableProgressiveHints: true}]) {
    const session = model.createSelectionSession(activity, keepOrder, null,
      behaviour.answerMode, 1, 'mistake', 2, behaviour.enableProgressiveHints);
    const snapshot = stateModel.createState(activity, session, false);
    assert.equal(stateModel.validateState(activity, snapshot, behaviour).valid, true);
    assert.equal(stateModel.validateState(activity, {...snapshot, resultsPageVisible: true}, behaviour).valid, false);
    Object.defineProperty(snapshot, 'resultsPageVisible', {enumerable: true,
      get() { throw new Error('Must not execute'); }});
    assert.equal(stateModel.validateState(activity, snapshot, behaviour).valid, false);
    if (behaviour.enableProgressiveHints) {
      const nested = stateModel.createState(activity, session, false);
      nested.baseState.resultsPageVisible = false;
      assert.equal(stateModel.validateState(activity, nested, behaviour).valid, false);
    }
  }
});


test('learner envelope validates selection, category identity, mode domains and malformed stages without changing fixed snapshots', () => {
  const activity = {enableCategories: true, sets: [
    {word: 'fresco', context: 'FRESCO', category: 'A'}, {word: 'Other', context: 'OTHER', category: 'B'}]};
  const authored = {answerMode: 'learner', typedPenalty: '0.5', spellingErrorBehaviour: 'warn',
    freeSpellingWarnings: '3', enableProgressiveHints: true};
  const choice = {mode: 'typed', categoryId: 'category-0'};
  const selection = stateModel.createLearnerState(activity, authored, choice, null, false);
  const saved = clone(selection);
  const restored = stateModel.restoreLearnerState(activity, authored, freeze(saved));
  assert.deepEqual(restored.choice, choice); assert.equal(restored.session, null);
  assert.deepEqual(saved, selection);
  const effective = stateModel.effectiveBehaviour(authored, choice.mode);
  assert.equal(effective.typedPenalty, 0.5); assert.equal(effective.freeSpellingWarnings, 3);
  const session = model.createSelectionSession(activity, keepOrder, null, 'typed', 0.5, 'warn', 3, true);
  session.selectCategory(choice.categoryId); session.setTypedAnswer('partial');
  const active = stateModel.createLearnerState(activity, authored, choice, session, false);
  assert.equal(active.attemptState.version, 5);
  assert.equal(stateModel.validateState(activity, active, effective).valid, false);
  const reordered = {...activity, sets: activity.sets.slice().reverse()};
  const resumed = stateModel.restoreLearnerState(reordered, authored, active);
  assert.equal(resumed.session.getSetState().typedText, 'partial');
  assert.equal(resumed.choice.categoryId, 'category-1');
  for (const invalid of [
    {...selection, mode: 'unknown'}, {...selection, version: 2}, {...selection, extra: true},
    {...selection, category: ['named', 'missing']}, {...selection, fingerprint: 'changed'},
    {...selection, stage: 'attempt'}, {...selection, attemptState: active.attemptState},
    {...active, mode: 'dropdown'}, {...active, category: ['all']},
    {...active, attemptState: {...active.attemptState, resultsPageVisible: true}}
  ]) assert.equal(stateModel.restoreLearnerState(activity, authored, invalid), null);
  const accessor = {...selection};
  Object.defineProperty(accessor, 'mode', {enumerable: true, get() { throw new Error('Do not execute'); }});
  assert.equal(stateModel.restoreLearnerState(activity, authored, accessor), null);
  assert.equal(stateModel.restoreLearnerState(activity, {...authored, typedPenalty: '1'}, active), null);
  assert.equal(stateModel.restoreLearnerState({...activity, sets: [{word: 'Changed', context: 'CHANGED'}]}, authored, active), null);
});
