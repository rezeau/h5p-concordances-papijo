(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./concordances-utils.js'));
  }
  else {
    root.H5P.ConcordancesPapiJoSession = factory(root.H5P.ConcordancesPapiJoUtils);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (utilities) {
  'use strict';

  /** Return a shuffled copy. Randomness injection is for deterministic testing. */
  function shuffle(items, random = Math.random) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index--) {
      const sample = random();
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new RangeError('Shuffle randomness must be in [0, 1).');
      }
      const other = Math.floor(sample * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function categoryText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /** Built-in IDs cannot collide with author category names. */
  function buildCategories(sets) {
    const options = [{id: 'all', type: 'all'}];
    const seen = new Set();
    let uncategorized = false;
    (Array.isArray(sets) ? sets : []).forEach((set) => {
      const label = categoryText(set && set.category);
      const key = utilities.normalizeWord(label);
      if (key.length === 0) {
        uncategorized = true;
      }
      else if (!seen.has(key)) {
        seen.add(key);
        options.push({id: 'category-' + (seen.size - 1), type: 'named', key, label});
      }
    });
    if (uncategorized) options.push({id: 'uncategorized', type: 'uncategorized'});
    return options;
  }

  /** Correct words take precedence over matching distractors, preserving display spelling. */
  function buildAnswerPool(sets, distractors) {
    const choices = [];
    const seen = new Set();
    const add = (value) => {
      if (typeof value !== 'string') return;
      const label = value.trim();
      const key = utilities.normalizeWord(label);
      if (key.length > 0 && !seen.has(key)) {
        seen.add(key);
        choices.push(label);
      }
    };
    (Array.isArray(sets) ? sets : []).forEach((set) => add(set && set.word));
    if (typeof distractors === 'string') distractors.split(/\r\n|\r|\n/).forEach(add);
    return choices;
  }

  /**
   * In-memory interaction only. Call after whole-activity runtime validation.
   * Scores are derived from attempts/correctness; no score fields or persistence.
   */
  function createSelectionSession(activity, random = Math.random, validatedState = null) {
    const source = activity && typeof activity === 'object' ? activity : {};
    const sets = Array.isArray(source.sets) ? source.sets : [];
    const categories = Object.freeze((source.enableCategories === true
      ? buildCategories(sets) : [{id: 'all', type: 'all'}]).map((option) => Object.freeze(option)));
    const categoryKeys = sets.map((set) => utilities.normalizeWord(categoryText(set && set.category)));
    const pool = buildAnswerPool(sets, source.distractors);
    const wordIndices = new Map(sets.map((set, index) => [utilities.normalizeWord(set.word), index]));
    const answerLabels = new Map(pool.map((label) => [utilities.normalizeWord(label), label]));
    const answers = Object.freeze(validatedState ? validatedState.answerOrder.map((id) => answerLabels.get(id)) : shuffle(pool, random));
    const setOrder = Object.freeze(validatedState ? validatedState.setOrder.map((id) => wordIndices.get(id))
      : shuffle(Array.from({length: sets.length}, (value, index) => index), random));
    let categoryId = 'all';
    let eligible = setOrder.slice();
    let displayedSetIndex = eligible[0] ?? null;
    const correctKeys = sets.map((set) => utilities.normalizeWord(set && set.word));
    const states = sets.map(() => ({attempts: 0, correct: false, selectedAnswerIndex: null,
      revision: 0, submittedRevision: null, feedback: null}));
    let processing = false;
    let categoryLocked = false;
    // Only the state module supplies this internal argument after full validation.
    if (validatedState) {
      const savedCategory = validatedState.category;
      const category = categories.find((entry) => entry.type === savedCategory[0] &&
        (entry.type !== 'named' || entry.key === savedCategory[1]));
      categoryId = category.id;
      eligible = category.type === 'all' ? setOrder.slice() : setOrder.filter((index) =>
        categoryKeys[index] === (category.type === 'uncategorized' ? '' : category.key));
      displayedSetIndex = eligible[validatedState.position];
      categoryLocked = validatedState.locked;
      const answerIndices = new Map(answers.map((label, index) => [utilities.normalizeWord(label), index]));
      validatedState.sets.forEach(([id, answer, attempts, solved, checked]) => {
        const state = states[wordIndices.get(id)];
        state.selectedAnswerIndex = answer === null ? null : answerIndices.get(answer);
        state.attempts = attempts;
        state.correct = solved;
        state.revision = checked ? 0 : 1;
        state.submittedRevision = checked ? 0 : null;
        state.feedback = checked ? solved ? 'correct' : 'incorrect' : null;
      });
    }
    const current = () => states[displayedSetIndex];
    const units = (state) => !state.correct ? 0 : state.attempts === 1 ? 2 : state.attempts === 2 ? 1 : 0;
    const allSolved = () => eligible.length > 0 && eligible.every((index) => states[index].correct);
    const canCheck = () => {
      const state = current();
      return Boolean(state && !processing && !state.correct && state.selectedAnswerIndex !== null &&
        state.revision !== state.submittedRevision);
    };
    const position = () => eligible.indexOf(displayedSetIndex);
    const canAdvance = () => Boolean(!processing && current()?.correct &&
      position() >= 0 && position() < eligible.length - 1);

    return Object.freeze({
      answers, categories, setOrder,
      get categoryId() { return categoryId; },
      get categoryLocked() { return categoryLocked; },
      get allSolved() { return allSolved(); },
      get eligibleSetIndices() { return eligible.slice(); },
      get displayedSetIndex() { return displayedSetIndex; },
      get currentPosition() { return position(); },
      get atSequenceEnd() { return Boolean(current()?.correct && position() === eligible.length - 1); },
      get selectedAnswerIndex() { return current()?.selectedAnswerIndex ?? null; },
      getSetState(index = displayedSetIndex) {
        const state = states[index];
        return state ? Object.freeze({...state}) : null;
      },
      canCheck,
      canAdvance,
      getScore() { return eligible.reduce((total, index) => total + units(states[index]), 0); },
      getMaxScore() { return 2 * eligible.length; },
      getResults() {
        // Never expose unsolved words through a result model or result DOM.
        if (!allSolved()) return null;
        return eligible.map((index) => Object.freeze({setIndex: index, word: sets[index].word,
          attempts: states[index].attempts, units: units(states[index])}));
      },
      advance(expectedSetIndex) {
        // A stale submission belongs to the old view and cannot skip a solved Set.
        if (expectedSetIndex !== displayedSetIndex || !canAdvance()) return false;
        displayedSetIndex = eligible[position() + 1];
        if (current().attempts === 0) current().selectedAnswerIndex = null;
        return true;
      },
      selectCategory(id) {
        if (categoryLocked || processing) return false;
        const option = categories.find((category) => category.id === id);
        if (!option) return false;
        const filtered = option.type === 'all' ? setOrder.slice() : setOrder.filter((index) =>
          option.type === 'uncategorized' ? categoryKeys[index] === '' : categoryKeys[index] === option.key);
        const nextSetIndex = filtered[0] ?? null;
        // Preserve the earlier unchecked-input reset, but retain every checked Set.
        if (nextSetIndex !== displayedSetIndex && current()?.attempts === 0) {
          current().selectedAnswerIndex = null;
        }
        categoryId = id;
        eligible = filtered;
        displayedSetIndex = nextSetIndex;
        return true;
      },
      selectAnswer(value) {
        const state = current();
        if (!state || state.correct || processing) return;
        // The value is an opaque pool position, never a Set's correct-answer key.
        const index = typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : NaN;
        const selected = Number.isSafeInteger(index) && index < answers.length ? index : null;
        if (state.selectedAnswerIndex === selected) return;
        state.selectedAnswerIndex = selected;
        state.revision++;
        state.feedback = null;
      },
      checkAnswer() {
        if (!canCheck()) return null;
        processing = true;
        try {
          const state = current();
          const answerKey = utilities.normalizeWord(answers[state.selectedAnswerIndex]);
          const correctKey = correctKeys[displayedSetIndex];
          if (!answerKey || !correctKey) throw new Error('Invalid checking state.');
          const correct = utilities.wordsMatch(answers[state.selectedAnswerIndex], correctKey);
          categoryLocked = true;
          state.attempts++;
          state.submittedRevision = state.revision;
          state.correct = correct;
          state.feedback = correct ? 'correct' : 'incorrect';
          return Object.freeze({correct, attempts: state.attempts});
        }
        finally { processing = false; }
      }
    });
  }

  return Object.freeze({shuffle, buildCategories, buildAnswerPool, createSelectionSession});
});
