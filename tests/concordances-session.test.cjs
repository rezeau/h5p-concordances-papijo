'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const model = require('../scripts/concordances-session.js');
const keepOrder = () => 0.999999;

test('only an accepted Check locks category and eligible sequence, for both correct and incorrect answers', () => {
  for (const answer of ['0', '1']) {
    const session = model.createSelectionSession({enableCategories: true, sets: [
      {word: 'One', context: '__', category: 'A'}, {word: 'Two', context: '__', category: 'B'}
    ]}, keepOrder);
    assert.equal(session.checkAnswer(), null);
    assert.equal(session.categoryLocked, false);
    session.selectAnswer('0');
    assert.equal(session.categoryLocked, false);
    assert.equal(session.selectCategory('category-0'), true);
    assert.equal(session.selectCategory('category-1'), true);
    session.selectAnswer(answer);
    const eligible = session.eligibleSetIndices;
    session.checkAnswer();
    assert.equal(session.categoryLocked, true);
    assert.equal(session.selectCategory('all'), false);
    assert.equal(session.categoryId, 'category-1');
    assert.deepEqual(session.eligibleSetIndices, eligible);
    assert.equal(session.getSetState().attempts, 1);
  }
});

test('integer units derive 2/1/0 from accepted attempts and final results follow shuffled order', () => {
  const session = model.createSelectionSession({sets: [
    {word: 'One', context: '__'}, {word: 'Two', context: '__'}, {word: 'Three', context: '__'}
  ], distractors: 'Wrong A\nWrong B'}, () => 0);
  assert.equal(session.getScore(), 0);
  assert.equal(session.getMaxScore(), 6);
  assert.equal(session.getResults(), null);
  for (const [index, count] of [1, 2, 4].entries()) {
    const word = ['Two', 'Three', 'One'][index];
    for (let attempt = 1; attempt <= count; attempt++) {
      const choice = attempt === count ? word : attempt % 2 ? 'Wrong A' : 'Wrong B';
      session.selectAnswer(String(session.answers.indexOf(choice)));
      session.checkAnswer();
    }
    assert.equal(session.getScore(), [2, 3, 3][index]);
    assert.ok(Number.isInteger(session.getScore()));
    assert.equal(session.getMaxScore(), 6);
    if (index < 2) {
      assert.equal(session.getResults(), null);
      session.advance(session.displayedSetIndex);
    }
  }
  assert.equal(session.allSolved, true);
  assert.deepEqual(session.getResults().map(({word, attempts, units}) => ({word, attempts, units})), [
    {word: 'Two', attempts: 1, units: 2}, {word: 'Three', attempts: 2, units: 1}, {word: 'One', attempts: 4, units: 0}
  ]);
  assert.equal(session.checkAnswer(), null);
  assert.equal(session.getScore(), 3);
  assert.equal(Object.keys(session.getSetState()).some((key) => /score|unit/i.test(key)), false);
});

test('maximum follows the selected category before Check and remains fixed after locking', () => {
  const activity = {enableCategories: true, sets: [
    {word: 'One', context: '__', category: 'A'}, {word: 'Two', context: '__', category: 'A'},
    {word: 'Three', context: '__', category: 'B'}
  ]};
  const session = model.createSelectionSession(activity, keepOrder);
  assert.equal(session.getMaxScore(), 6);
  session.selectCategory('category-1');
  assert.equal(session.getMaxScore(), 2);
  session.selectCategory('category-0');
  assert.equal(session.getMaxScore(), 4);
  const pool = session.answers, order = session.setOrder;
  session.selectAnswer('2'); session.checkAnswer();
  session.selectCategory('category-1');
  assert.equal(session.getMaxScore(), 4);
  assert.equal(session.getScore(), 0);
  assert.deepEqual(session.eligibleSetIndices, [0, 1]);
  assert.equal(session.answers, pool);
  assert.equal(session.setOrder, order);
  assert.equal(model.createSelectionSession({...activity, enableCategories: false}, keepOrder).getMaxScore(), 6);
});

test('forward navigation requires correctness, follows shuffled positions and rejects stale submissions', () => {
  const session = model.createSelectionSession({sets: [
    {word: 'One', context: '__'}, {word: 'Two', context: '__'}, {word: 'Three', context: '__'}
  ]}, () => 0);
  assert.deepEqual(session.setOrder, [1, 2, 0]);
  assert.equal(session.currentPosition, 0);
  assert.equal(session.canAdvance(), false);
  assert.equal(session.advance(1), false);
  session.selectAnswer(String(session.answers.indexOf('One'))); session.checkAnswer();
  assert.equal(session.canAdvance(), false);
  session.selectAnswer(String(session.answers.indexOf('Two'))); session.checkAnswer();
  assert.equal(session.canAdvance(), true);
  assert.equal(session.advance(1), true);
  assert.equal(session.currentPosition, 1);
  assert.equal(session.displayedSetIndex, 2);
  assert.equal(session.advance(1), false);
  assert.equal(session.getSetState(1).attempts, 2);
  assert.equal(session.selectedAnswerIndex, null);
});

test('category navigation starts at its first prepared Set before Check, then retains the locked sequence', () => {
  const session = model.createSelectionSession({enableCategories: true, sets: [
    {word: 'One', context: '__', category: 'A'}, {word: 'Two', context: '__', category: 'B'},
    {word: 'Three', context: '__', category: 'A'}
  ]}, () => 0);
  const pool = session.answers, order = session.setOrder;
  session.selectCategory('category-1');
  session.selectCategory('category-0');
  assert.deepEqual(session.eligibleSetIndices, [2, 0]);
  session.selectAnswer(String(pool.indexOf('Three'))); session.checkAnswer();
  assert.equal(session.advance(2), true);
  assert.equal(session.currentPosition, 1);
  assert.equal(session.selectCategory('category-1'), false);
  assert.equal(session.selectCategory('category-0'), false);
  assert.equal(session.displayedSetIndex, 0);
  assert.equal(session.currentPosition, 1);
  assert.equal(session.getSetState(2).attempts, 1);
  assert.equal(session.getSetState(2).correct, true);
  assert.equal(session.canAdvance(), false);
  assert.equal(session.answers, pool);
  assert.equal(session.setOrder, order);
});
const sets = [
  {word: 'One', context: '[001] __', category: ' A '},
  {word: 'Two', context: '[002] __', category: 'B'},
  {word: 'Three', context: '[003] __', category: 'a'},
  {word: 'Four', context: '[004] __'}
];

test('Check requires selection and only a submission increments attempts', () => {
  const session = model.createSelectionSession({sets}, keepOrder);
  assert.equal(session.canCheck(), false);
  assert.equal(session.checkAnswer(), null);
  session.selectAnswer('1');
  assert.equal(session.getSetState().attempts, 0);
  assert.equal(session.canCheck(), true);
  assert.deepEqual(session.checkAnswer(), {correct: false, attempts: 1});
  assert.equal(session.canCheck(), false);
  assert.equal(session.selectedAnswerIndex, 1);
  for (let i = 0; i < 20; i++) assert.equal(session.checkAnswer(), null);
  session.selectAnswer('1'); // A duplicate change event is not a changed answer.
  assert.equal(session.canCheck(), false);
  assert.equal(session.getSetState().attempts, 1);
});

test('incorrect answers allow unlimited changed submissions without mutating choices or order', () => {
  const session = model.createSelectionSession({sets, distractors: 'Wrong'}, keepOrder);
  const pool = session.answers, order = session.setOrder;
  for (let count = 1; count <= 40; count++) {
    session.selectAnswer(count % 2 ? '1' : '2');
    assert.deepEqual(session.checkAnswer(), {correct: false, attempts: count});
  }
  assert.equal(session.answers, pool);
  assert.equal(session.setOrder, order);
  assert.deepEqual(pool, ['One', 'Two', 'Three', 'Four', 'Wrong']);
  assert.equal(session.displayedSetIndex, 0);
});

test('a correct check locks the Set, preserves the selection and stores no redundant score', () => {
  const session = model.createSelectionSession({sets}, keepOrder);
  session.selectAnswer('1'); session.checkAnswer();
  session.selectAnswer('0');
  assert.deepEqual(session.checkAnswer(), {correct: true, attempts: 2});
  const state = session.getSetState();
  assert.equal(state.correct, true);
  assert.equal(state.feedback, 'correct');
  assert.equal(Object.isFrozen(state), true);
  session.selectAnswer('3');
  assert.equal(session.selectedAnswerIndex, 0);
  assert.equal(session.checkAnswer(), null);
  assert.equal(session.getSetState().attempts, 2);
  assert.equal(Object.keys(state).some((key) => /score|point|unit/i.test(key)), false);
});

test('comparison uses normalized word text rather than shuffled pool position', () => {
  const source = {enableCategories: true, sets: [
    {word: ' CAF\u00c9 ', context: '__', category: 'A'},
    {word: 'Other', context: '__', category: 'B'}
  ], distractors: 'cafe\u0301\nWrong'};
  const session = model.createSelectionSession(source, () => 0);
  session.selectCategory('category-0');
  const index = session.answers.indexOf('CAF\u00c9');
  assert.notEqual(index, session.displayedSetIndex);
  assert.equal(session.answers.length, 3);
  session.selectAnswer(String(index));
  assert.deepEqual(session.checkAnswer(), {correct: true, attempts: 1});
  assert.equal(source.sets[0].word, ' CAF\u00c9 ');
});

test('refused category changes retain incorrect and correct attempts and allow normal forward navigation', () => {
  const session = model.createSelectionSession({sets, enableCategories: true}, keepOrder);
  session.selectAnswer('1'); session.checkAnswer();
  assert.equal(session.selectCategory('category-1'), false);
  assert.equal(session.selectCategory('category-0'), false);
  assert.equal(session.getSetState().attempts, 1);
  assert.equal(session.getSetState().feedback, 'incorrect');
  assert.equal(session.selectedAnswerIndex, 1);
  assert.equal(session.canCheck(), false);
  session.selectAnswer('0'); session.checkAnswer();
  assert.equal(session.selectCategory('category-1'), false);
  assert.equal(session.getSetState().correct, true);
  assert.equal(session.canCheck(), false);
  assert.equal(session.selectCategory('all'), false);
  assert.equal(session.getSetState().attempts, 2);
  assert.equal(session.getSetState().correct, true);
  assert.equal(session.advance(0), true);
  assert.equal(session.getSetState().attempts, 0);
  assert.equal(session.getSetState(0).attempts, 2);
});

test('malformed/empty session checking fails closed without an attempt', () => {
  const session = model.createSelectionSession({});
  session.selectAnswer('0');
  assert.equal(session.canCheck(), false);
  assert.equal(session.checkAnswer(), null);
  assert.equal(session.getSetState(), null);
  const invalid = model.createSelectionSession({sets: [{word: '', context: '__'}], distractors: 'One'});
  invalid.selectAnswer('0');
  assert.throws(() => invalid.checkAnswer(), /Invalid checking state/);
  assert.equal(invalid.getSetState().attempts, 0);
});

test('shuffle uses deterministic injectable randomness and never mutates its input', () => {
  const original = Object.freeze(['A', 'B', 'C']);
  assert.deepEqual(model.shuffle(original, () => 0), ['B', 'C', 'A']);
  assert.deepEqual(model.shuffle(original, keepOrder), ['A', 'B', 'C']);
  assert.deepEqual(original, ['A', 'B', 'C']);
  assert.deepEqual(model.shuffle([], () => { throw Error('No draw needed'); }), []);
});

test('shuffle rejects invalid injected randomness instead of producing missing choices', () => {
  for (const sample of [-1, 1, NaN, Infinity]) assert.throws(() => model.shuffle([1, 2], () => sample), RangeError);
});

test('categories trim display names and deduplicate case-insensitively in authored order', () => {
  assert.deepEqual(model.buildCategories(sets), [
    {id: 'all', type: 'all'},
    {id: 'category-0', type: 'named', key: 'a', label: 'A'},
    {id: 'category-1', type: 'named', key: 'b', label: 'B'},
    {id: 'uncategorized', type: 'uncategorized'}
  ]);
});

test('category deduplication uses canonical Unicode normalization and retains first spelling', () => {
  const categories = model.buildCategories([{category: ' CAF\u00c9 '}, {category: 'cafe\u0301'}]);
  assert.equal(categories.length, 2);
  assert.equal(categories[1].label, 'CAF\u00c9');
  assert.equal(categories[1].key, 'caf\u00e9');
});

test('Uncategorized exists only when a Set has a missing, blank or malformed category', () => {
  assert.equal(model.buildCategories([{category: 'A'}]).some((option) => option.id === 'uncategorized'), false);
  assert.equal(model.buildCategories([]).some((option) => option.id === 'uncategorized'), false);
  for (const category of [undefined, null, '', ' \t', 3, {}, []]) {
    assert.equal(model.buildCategories([{category}]).some((option) => option.id === 'uncategorized'), true);
  }
});

test('categories disabled prepares all Sets and does not derive named selector options', () => {
  const session = model.createSelectionSession({sets, enableCategories: false}, keepOrder);
  assert.deepEqual(session.categories, [{id: 'all', type: 'all'}]);
  assert.deepEqual(session.eligibleSetIndices, [0, 1, 2, 3]);
  assert.equal(session.displayedSetIndex, 0);
  assert.equal(session.selectCategory('category-0'), false);
});

test('All categories includes every Set and named filtering keeps one prepared relative order', () => {
  const session = model.createSelectionSession({sets, enableCategories: true}, () => 0);
  const order = session.setOrder.slice();
  assert.deepEqual(session.eligibleSetIndices, order);
  session.selectCategory('category-0');
  assert.deepEqual(session.eligibleSetIndices, order.filter((index) => [0, 2].includes(index)));
  assert.equal(session.displayedSetIndex, session.eligibleSetIndices[0]);
  session.selectCategory('all');
  assert.deepEqual(session.eligibleSetIndices, order);
});

test('Uncategorized filters blank and malformed values without coercing them into names', () => {
  const session = model.createSelectionSession({enableCategories: true, sets: [
    {word: 'One', category: 'A'}, {word: 'Two', category: {}}, {word: 'Three', category: ' '}
  ]}, keepOrder);
  session.selectCategory('uncategorized');
  assert.deepEqual(session.eligibleSetIndices, [1, 2]);
});

test('authored category names cannot collide with built-in category identifiers', () => {
  const session = model.createSelectionSession({enableCategories: true, sets: [
    {word: 'One', category: 'All categories'}, {word: 'Two', category: 'Uncategorized'}, {word: 'Three'}
  ]}, keepOrder);
  session.selectCategory('category-0');
  assert.deepEqual(session.eligibleSetIndices, [0]);
  session.selectCategory('category-1');
  assert.deepEqual(session.eligibleSetIndices, [1]);
  session.selectCategory('uncategorized');
  assert.deepEqual(session.eligibleSetIndices, [2]);
});

test('global pool includes all correct words before distractors and retains trimmed first spellings', () => {
  assert.deepEqual(model.buildAnswerPool([
    {word: ' Caf\u00e9 ', category: 'A'}, {word: 'Would', category: 'B'}, {word: 'New  York'}
  ], ' \n cafe\u0301 \nWOULD\r\nOther\rOTHER\n'), ['Caf\u00e9', 'Would', 'New  York', 'Other']);
});

test('distractors ignore empty lines and deduplicate across CRLF, LF and CR', () => {
  assert.deepEqual(model.buildAnswerPool([], '\r\nOne\n  \nONE\rTwo\r\n two \n'), ['One', 'Two']);
});

test('pool comparison preserves internal spaces, accents and distinct compatibility characters', () => {
  assert.deepEqual(model.buildAnswerPool([{word: 'Caf\u00e9'}], 'Cafe\n New  York\nnew york\n\uff21\nA'),
    ['Caf\u00e9', 'Cafe', 'New  York', 'new york', '\uff21', 'A']);
});

test('malformed distractors and incomplete data do not throw or become object-string choices', () => {
  for (const distractors of [undefined, null, {}, [], 7]) {
    assert.deepEqual(model.buildAnswerPool([{word: 'One'}], distractors), ['One']);
  }
  assert.deepEqual(model.buildAnswerPool([null, {}, {word: 7}, {word: ' '}], null), []);
});

test('initialization shuffles answers and full Set indices only once', () => {
  let calls = 0;
  const session = model.createSelectionSession({sets, enableCategories: true, distractors: 'Extra'}, () => { calls++; return 0.5; });
  assert.equal(calls, 7); // Four draws for five answers, three for four Sets.
  const answers = session.answers;
  const order = session.setOrder;
  for (const id of ['category-0', 'category-1', 'uncategorized', 'all', 'all']) session.selectCategory(id);
  assert.equal(calls, 7);
  assert.equal(session.answers, answers);
  assert.equal(session.setOrder, order);
});

test('global pool remains identical for every category and contains words outside each filter', () => {
  const session = model.createSelectionSession({sets, enableCategories: true}, keepOrder);
  for (const id of session.categories.map((option) => option.id)) {
    session.selectCategory(id);
    assert.deepEqual(session.answers, ['One', 'Two', 'Three', 'Four']);
  }
});

test('provisional answers can be cleared and reused without removing choices or evaluating them', () => {
  const session = model.createSelectionSession({sets}, keepOrder);
  const answers = session.answers;
  for (const value of ['0', '', '1', '0']) session.selectAnswer(value);
  assert.equal(session.selectedAnswerIndex, 0);
  assert.equal(session.answers, answers);
  assert.equal(session.answers.length, 4);
  assert.equal(session.completed, undefined);
  assert.equal(session.correct, undefined);
  assert.equal(session.getScore(), 0);
});

test('selection resets only when a category change displays a different Set', () => {
  const session = model.createSelectionSession({sets, enableCategories: true}, keepOrder);
  session.selectAnswer('0');
  session.selectCategory('category-0');
  assert.equal(session.displayedSetIndex, 0);
  assert.equal(session.selectedAnswerIndex, 0);
  session.selectCategory('category-1');
  assert.equal(session.displayedSetIndex, 1);
  assert.equal(session.selectedAnswerIndex, null);
  session.selectAnswer('0');
  session.selectCategory('all');
  assert.equal(session.selectedAnswerIndex, null);
});

test('invalid category/answer identifiers do not select unavailable entries', () => {
  const session = model.createSelectionSession({sets}, keepOrder);
  session.selectAnswer('0');
  assert.equal(session.selectCategory('__proto__'), false);
  assert.equal(session.selectedAnswerIndex, 0);
  for (const value of ['-1', '01', '4', 'NaN', '__proto__', null, 0]) {
    session.selectAnswer(value);
    assert.equal(session.selectedAnswerIndex, null);
  }
});

test('session preparation leaves frozen authored data and Context exactly unchanged', () => {
  const activity = Object.freeze({enableCategories: true, distractors: ' Extra \r\n', sets: Object.freeze([
    Object.freeze({word: 'One', context: '\r\n[001]  __  tail  ', category: ' A '})
  ])});
  const before = JSON.stringify(activity);
  const session = model.createSelectionSession(activity, keepOrder);
  session.selectCategory('category-0');
  session.selectAnswer('0');
  assert.equal(JSON.stringify(activity), before);
  const copy = session.eligibleSetIndices;
  copy.length = 0;
  assert.deepEqual(session.eligibleSetIndices, [0]);
  assert.equal(Object.isFrozen(session.answers), true);
});


test('typed normalization accepts NFC/case/trim only, preserves accents and decodes authored escapes once', () => {
  for (const [word,answer,correct] of [
    ['fresco',' fresco ',true],['fresco','Fresco',true],['fresco','frescoes',false],['fresco','frescoed',false],
    ['fresco','mosaic',false],['éternel','E\u0301TERNEL',true],['éternel','eternel',false],
    ['can&#039;t',"CAN'T",true],['can&#039;t','can&#039;t',false],
    ['&amp;quot;','&amp;quot;',true],['&amp;quot;','&quot;',false]
  ]) {
    const session=model.createSelectionSession({sets:[{word,context:word}]},()=>0,null,'typed');
    session.setTypedAnswer(answer);
    assert.equal(session.getSetState().typedText,answer);
    assert.equal(session.checkAnswer().correct,correct);
  }
});

test('typed checking ignores inactive distractors and pool shuffles, gates normalized resubmission and scores 2/1/0', () => {
  for (const wrongCount of [0,1,2,3]) {
    const source={sets:[{word:'fresco',context:'fresco'}]};
    Object.defineProperty(source,'distractors',{get(){throw new Error('Inactive distractors accessed');}});
    const session=model.createSelectionSession(source,()=>{throw new Error('Unexpected pool shuffle');},null,'typed');
    assert.deepEqual(session.answers,[]);
    for(const blank of ['', ' \t ']) {session.setTypedAnswer(blank);assert.equal(session.canCheck(),false);assert.equal(session.checkAnswer(),null);}
    for(let index=0;index<wrongCount;index++) {
      const wrong='wrong'+index;session.setTypedAnswer(wrong);
      assert.equal(session.checkAnswer().correct,false);
      session.setTypedAnswer(' '+wrong.toUpperCase()+' ');
      assert.equal(session.canCheck(),false);assert.equal(session.checkAnswer(),null);
      session.setTypedAnswer('different');assert.equal(session.canCheck(),true);
      session.setTypedAnswer(wrong);assert.equal(session.canCheck(),false);
    }
    session.setTypedAnswer('FRESCO');assert.equal(session.getSetState().attempts,wrongCount);
    assert.equal(session.checkAnswer().correct,true);
    assert.equal(session.getScore(),Math.max(0,2-wrongCount));assert.equal(session.getMaxScore(),2);
    assert.equal(session.getResults()[0].attempts,wrongCount+1);
    assert.equal(session.checkAnswer(),null);
  }
});


test('typed scoring penalty yields exact half points, clamps at zero and preserves submission gating',()=>{
  for(const [penalty,expected] of [[1,[2,1,0,0,0,0]],[0.5,[2,1.5,1,0.5,0,0]]]){
    for(let wrongs=0;wrongs<expected.length;wrongs++){
      const session=model.createSelectionSession({sets:[{word:'One',context:'ONE'}]},keepOrder,null,'typed',penalty);
      for(let index=0;index<wrongs;index++){
        session.setTypedAnswer('wrong'+index);session.checkAnswer();
        session.setTypedAnswer(' WRONG'+index+' ');assert.equal(session.canCheck(),false);assert.equal(session.checkAnswer(),null);
      }
      session.setTypedAnswer('One');assert.equal(session.getSetState().attempts,wrongs);
      session.checkAnswer();assert.equal(session.getScore(),expected[wrongs]);assert.equal(session.getResults()[0].units,expected[wrongs]);assert.equal(session.getMaxScore(),2);
    }
  }
  const dropdown=model.createSelectionSession({distractors:'Wrong',sets:[{word:'One',context:'ONE'}]},keepOrder,null,'dropdown',0.5);
  dropdown.selectAnswer(String(dropdown.answers.indexOf('Wrong')));dropdown.checkAnswer();dropdown.selectAnswer(String(dropdown.answers.indexOf('One')));dropdown.checkAnswer();assert.equal(dropdown.getScore(),1);
});


test('spelling policies distinguish free warnings from scored attempts for both penalties',()=>{
  const activity={sets:[{word:'fresco',context:'frescoes'}]};
  for(const penalty of [1,0.5])for(const policy of ['mistake','warn']){
    const session=model.createSelectionSession(activity,keepOrder,null,'typed',penalty,policy,1);
    session.setTypedAnswer('fresoc');assert.equal(session.getSetState().attempts,0);
    const result=session.checkAnswer();assert.equal(result.correct,false);
    assert.equal(session.getSetState().typedText,'fresoc');
    if(policy==='warn'){
      assert.equal(result.warning,true);assert.equal(session.getSetState().attempts,0);assert.equal(session.getSetState().warningCount > 0,true);
      session.setTypedAnswer(' FRESOC ');assert.equal(session.canCheck(),false);assert.equal(session.checkAnswer(),null);
      session.setTypedAnswer('fresco');session.checkAnswer();assert.equal(session.getScore(),2);
    }else{assert.equal(session.getSetState().attempts,1);session.setTypedAnswer('fresco');session.checkAnswer();assert.equal(session.getScore(),2-penalty);}
    const warn=model.createSelectionSession(activity,keepOrder,null,'typed',penalty,'warn',1);
    warn.setTypedAnswer('unrelated');warn.checkAnswer();warn.setTypedAnswer('fresoc');warn.checkAnswer();assert.equal(warn.getSetState().attempts,1);
    warn.setTypedAnswer('frescp');assert.equal(warn.checkAnswer().correct,false);assert.equal(warn.getSetState().attempts,2);assert.equal(warn.getSetState().feedback,'incorrect');
    warn.setTypedAnswer('fresco');warn.checkAnswer();assert.equal(warn.getScore(),Math.max(0,2-penalty*2));
  }
});


test('warning allowances count distinct free submissions, preserve earlier attempts and exhaust under both penalties',()=>{
  const typos=['fresoc','frescp','frescoo','fresc','ffresco','fresko'];
  for(const allowance of [1,2,3,'unlimited'])for(const penalty of [1,0.5]){
    const session=model.createSelectionSession({sets:[{word:'fresco',context:'FRESCOes'}]},keepOrder,null,'typed',penalty,'warn',allowance);
    session.setTypedAnswer('unrelated');session.checkAnswer();
    for(let index=0;index<typos.length;index++){
      session.setTypedAnswer(typos[index]);const result=session.checkAnswer();
      assert.equal(result.warning===true,allowance==='unlimited'||index<allowance);
      session.setTypedAnswer(' '+typos[index].toUpperCase()+' ');assert.equal(session.canCheck(),false);assert.equal(session.checkAnswer(),null);
    }
    assert.equal(session.getSetState().warningCount,allowance==='unlimited'?6:allowance);
    assert.equal(session.getSetState().attempts,1+(allowance==='unlimited'?0:6-allowance));
    if(allowance!==1){session.setTypedAnswer(typos[0]);assert.equal(session.canCheck(),false);}
    session.setTypedAnswer('fresco');session.checkAnswer();
    assert.equal(session.getScore(),Math.max(0,2-penalty*(1+(allowance==='unlimited'?0:6-allowance))));assert.equal(session.getMaxScore(),2);
  }
});
