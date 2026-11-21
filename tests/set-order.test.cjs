'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../scripts/concordances-session.js');
const state = require('../scripts/concordances-state.js');
const activity = {enableCategories: true, sets: [
  {word: 'One', context: 'One', category: 'A'},
  {word: 'Two', context: 'Two', category: 'B'},
  {word: 'Three', context: 'Three', category: 'A'},
  {word: 'Four', context: 'Four'}
]};

test('Set order editor choices default to Shuffle; missing setting preserves runtime and fingerprints', () => {
  const semantics = JSON.parse(fs.readFileSync(path.join(__dirname, '../semantics.json'), 'utf8'));
  const setting = semantics.find((entry) => entry.name === 'behaviour').fields.find((entry) => entry.name === 'setOrder');
  const countSettings = (fields) => fields.reduce((count, entry) => count + (entry.name === 'setOrder' ? 1 : 0) +
    (entry.fields ? countSettings(entry.fields) : 0) + (entry.field ? countSettings([entry.field]) : 0), 0);
  assert.equal(countSettings(semantics), 1);
  assert.equal(semantics.find((entry) => entry.name === 'activity').fields.some((entry) => entry.name === 'setOrder'), false);
  assert.equal(setting.label, 'Set order');
  assert.equal(setting.type, 'select');
  assert.equal(setting.default, 'shuffle');
  assert.deepEqual(setting.options, [
    {value: 'shuffle', label: 'Shuffle Sets (default)'},
    {value: 'author', label: 'Keep author-defined order'}
  ]);
  const missing = model.createSelectionSession(activity, () => 0);
  assert.deepEqual(missing.setOrder, [1, 2, 3, 0]);
  for (const value of ['shuffle', 'unknown']) {
    const source = {...activity, setOrder: value};
    assert.deepEqual(state.createState(source, model.createSelectionSession(source, () => 0)), state.createState(activity, missing));
    assert.equal(state.fingerprint(source), state.fingerprint(activity));
  }
});

test('Set order filters identical eligible Sets before applying either fixed run order', () => {
  for (const policy of ['shuffle', 'author']) {
    const source = {...activity, setOrder: policy};
    const session = model.createSelectionSession(source, () => 0);
    const expected = policy === 'author' ? [0, 1, 2, 3] : [1, 2, 3, 0];
    assert.deepEqual(session.setOrder, expected);
    for (const [category, indices] of [['category-0', [0, 2]], ['category-1', [1]], ['uncategorized', [3]], ['all', [0, 1, 2, 3]]]) {
      assert.equal(session.selectCategory(category), true);
      assert.deepEqual(session.eligibleSetIndices, expected.filter((index) => indices.includes(index)));
    }
    session.selectCategory('category-0');
    const eligible = session.eligibleSetIndices;
    for (const index of eligible) {
      assert.equal(session.displayedSetIndex, index);
      session.selectAnswer(String(session.answers.indexOf(activity.sets[index].word)));
      session.checkAnswer();
      assert.equal(session.selectCategory('all'), false);
      session.advance(index);
      assert.deepEqual(session.eligibleSetIndices, eligible);
    }
    assert.deepEqual(session.getResults().map((row) => row.setIndex), eligible);
    assert.equal(session.getScore(), 4);
    assert.equal(session.getMaxScore(), 4);
    const disabled = model.createSelectionSession({...source, enableCategories: false}, () => 0);
    assert.deepEqual(disabled.eligibleSetIndices, expected);
    assert.equal(disabled.selectCategory('category-0'), false);
  }
});

test('Set order round-trips schemas 1/2/4/5 and retains saved order after editor reordering', () => {
  for (const policy of ['shuffle', 'author']) {
    for (const [behaviour, version] of [[{}, 1], [{answerMode: 'typed'}, 2],
      [{answerMode: 'typed', spellingErrorBehaviour: 'warn'}, 4],
      [{answerMode: 'typed', enableProgressiveHints: true}, 5]]) {
      const source = {...activity, setOrder: policy};
      const typed = behaviour.answerMode === 'typed';
      const session = model.createSelectionSession(source, () => 0, null, behaviour.answerMode,
        1, behaviour.spellingErrorBehaviour, 2, behaviour.enableProgressiveHints);
      session.selectCategory('category-0');
      const word = source.sets[session.displayedSetIndex].word;
      if (typed) session.setTypedAnswer(word);
      else session.selectAnswer(String(session.answers.indexOf(word)));
      session.checkAnswer();
      session.advance(session.displayedSetIndex);
      const saved = JSON.parse(JSON.stringify(state.createState(source, session)));
      assert.equal(saved.version, version);
      const reordered = {...source, sets: source.sets.slice().reverse()};
      const originalRandom = Math.random;
      Math.random = () => { throw new Error('Restoration must not shuffle'); };
      try {
        const restored = state.restoreSession(reordered, saved, behaviour);
        assert.ok(restored);
        assert.deepEqual(state.createState(reordered, restored), saved);
        assert.equal(reordered.sets[restored.displayedSetIndex].word, source.sets[session.displayedSetIndex].word);
      }
      finally { Math.random = originalRandom; }
      assert.equal(state.restoreSession({...source, setOrder: policy === 'author' ? 'shuffle' : 'author'}, saved, behaviour), null);
      const malformed = JSON.parse(JSON.stringify(saved));
      const base = malformed.baseState || malformed;
      base.setOrder[1] = base.setOrder[0];
      assert.equal(state.restoreSession(source, malformed, behaviour), null);
    }
  }
});
