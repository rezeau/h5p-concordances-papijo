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
  function hintLetters(word) {
    const text = utilities.decodeEditorText(word).trim();
    // Keep combining sequences and emoji intact; count only letter graphemes.
    return Array.from(new Intl.Segmenter('und', {granularity: 'grapheme'}).segment(text),
      ({segment}) => ({text: segment, letter: /\p{L}/u.test(segment)}));
  }

  const hintLimit = (word) => hintLetters(word).filter((part) => part.letter).length;

  /** Compare checked text, never live input; punctuation/spacing remain significant. */
  function hintPrefix(word, submitted) {
    const segmenter = new Intl.Segmenter('und', {granularity: 'grapheme'});
    const target = Array.from(segmenter.segment(utilities.normalizeWord(utilities.decodeEditorText(word))), ({segment}) => segment);
    const answer = Array.from(segmenter.segment(utilities.normalizeWord(submitted)), ({segment}) => segment);
    let prefix = 0;
    for (let index = 0; index < target.length && target[index] === answer[index]; index++) {
      if (/\p{L}/u.test(target[index])) prefix++;
    }
    return prefix;
  }

  function nextHintPosition(letters, previous, prefix, attainable) {
    const cap = attainable > 0 ? Math.max(0, letters - 1) : letters;
    return Math.min(cap, Math.max(previous + (attainable === 0 ? 1 : 0), prefix + 1));
  }

  function createSelectionSession(activity, random = Math.random, validatedState = null, answerMode = 'dropdown', typedPenalty = 1, spellingPolicy = 'mistake', warningAllowance = 2, progressiveHints = false, validatedHints = null) {
    const typed = answerMode === 'typed';
    const hints = typed && progressiveHints === true;
    const policy = typed && spellingPolicy === 'warn' ? spellingPolicy : 'mistake';
    const allowance = utilities.resolveWarningAllowance({answerMode, spellingErrorBehaviour: policy, freeSpellingWarnings: warningAllowance});
    const penalty = typed && typedPenalty === 0.5 ? 0.5 : 1;
    const source = activity && typeof activity === 'object' ? activity : {};
    const sets = Array.isArray(source.sets) ? source.sets : [];
    const categories = Object.freeze((source.enableCategories === true
      ? buildCategories(sets) : [{id: 'all', type: 'all'}]).map((option) => Object.freeze(option)));
    const categoryKeys = sets.map((set) => utilities.normalizeWord(categoryText(set && set.category)));
    const pool = typed ? [] : buildAnswerPool(sets, source.distractors);
    const wordIndices = new Map(sets.map((set, index) => [utilities.normalizeWord(set.word), index]));
    const answerLabels = new Map(pool.map((label) => [utilities.normalizeWord(label), label]));
    const answers = Object.freeze(typed ? [] : validatedState ? validatedState.answerOrder.map((id) => answerLabels.get(id)) : shuffle(pool, random));
    const authorIndices = Array.from({length: sets.length}, (value, index) => index);
    const setOrder = Object.freeze(validatedState ? validatedState.setOrder.map((id) => wordIndices.get(id))
      : source.setOrder === 'author' ? authorIndices.slice() : shuffle(authorIndices, random));
    const ranks = new Map(setOrder.map((index, rank) => [index, rank]));
    // Filter authored Sets first, then apply the run's fixed ordering policy.
    // Preparing one permutation preserves existing Shuffle/Retry randomness.
    const eligibleFor = (category) => authorIndices.filter((index) => category.type === 'all' ||
      categoryKeys[index] === (category.type === 'uncategorized' ? '' : category.key))
      .sort((left, right) => ranks.get(left) - ranks.get(right));
    let categoryId = 'all';
    let eligible = eligibleFor(categories[0]);
    let displayedSetIndex = eligible[0] ?? null;
    const correctKeys = sets.map((set) => utilities.normalizeWord(typed ? utilities.decodeEditorText(set.word) : set && set.word));
    const states = sets.map(() => ({attempts: 0, correct: false, selectedAnswerIndex: null,
      revision: 0, submittedRevision: null, feedback: null, typedText: '', submittedAnswerKey: null, warningCount: 0, warnedAnswers: [], hintCount: 0, hintHistory: []}));
    let processing = false;
    let categoryLocked = false;
    // Only the state module supplies this internal argument after full validation.
    if (validatedState) {
      const savedCategory = validatedState.category;
      const category = categories.find((entry) => entry.type === savedCategory[0] &&
        (entry.type !== 'named' || entry.key === savedCategory[1]));
      categoryId = category.id;
      eligible = eligibleFor(category);
      displayedSetIndex = eligible[validatedState.position];
      categoryLocked = validatedState.locked;
      const answerIndices = new Map(answers.map((label, index) => [utilities.normalizeWord(label), index]));
      validatedState.sets.forEach(([id, answer, attempts, solved, checked, submitted, warningCount, warningActive, warnedAnswers]) => {
        const state = states[wordIndices.get(id)];
        if (typed) { state.typedText = answer; state.submittedAnswerKey = submitted; state.warningCount = warningCount ?? 0;
          state.warnedAnswers = warnedAnswers ? warnedAnswers.slice() : []; }
        else state.selectedAnswerIndex = answer === null ? null : answerIndices.get(answer);
        state.attempts = attempts;
        state.correct = solved;
        state.revision = checked ? 0 : 1;
        state.submittedRevision = checked ? 0 : null;
        state.feedback = checked ? solved ? 'correct' : warningActive ? 'spellingWarning' : 'incorrect' : null;
      });
    }
    if (hints && validatedHints) validatedHints.forEach(([id, history]) => {
      Object.assign(states[wordIndices.get(id)], {hintCount: history.length, hintHistory: history.map((row) => row.slice())});
    });
    const current = () => states[displayedSetIndex];
    const attainable = (state) => Math.max(0, 2 - penalty * (state.attempts - (state.correct ? 1 : 0)) - state.hintCount * 0.5);
    const units = (state) => state.correct ? attainable(state) : 0;
    const hintAvailability = () => {
      const state = current();
      const word = sets[displayedSetIndex]?.word;
      const last = state?.hintHistory.at(-1);
      const revealed = last?.[3] ?? 0;
      if (!hints || !state || state.correct || revealed >= hintLimit(word)) return 'hidden';
      const points = attainable(state), prefix = hintPrefix(word, state.submittedAnswerKey);
      if (last && (state.attempts + state.warningCount <= last[1] ||
        (points > 0 ? prefix <= last[2] : state.attempts <= last[0]))) return 'locked';
      if (nextHintPosition(hintLimit(word), revealed, prefix, points) <= revealed) return 'locked';
      if (last) return 'available';
      const exhausted = policy === 'warn' && allowance !== 'unlimited' && state.warningCount >= allowance;
      return state.attempts >= 2 || exhausted ? 'available' : 'locked';
    };
    const allSolved = () => eligible.length > 0 && eligible.every((index) => states[index].correct);
    const canCheck = () => {
      const state = current();
      return Boolean(state && !processing && !state.correct && (typed ? utilities.normalizeWord(state.typedText).length > 0 &&
          utilities.normalizeWord(state.typedText) !== state.submittedAnswerKey &&
          !(policy === 'warn' && state.warnedAnswers.includes(utilities.normalizeWord(state.typedText)))
          : state.selectedAnswerIndex !== null && state.revision !== state.submittedRevision));
    };
    const position = () => eligible.indexOf(displayedSetIndex);
    const canAdvance = () => Boolean(!processing && current()?.correct &&
      position() >= 0 && position() < eligible.length - 1);

    return Object.freeze({
      answers, categories, setOrder, answerMode: typed ? 'typed' : 'dropdown', typedPenalty: penalty, spellingPolicy: policy, warningAllowance: allowance, progressiveHints: hints,
      hintAvailability,
      getHintText() {
        const state = current();
        if (!hints || !state?.hintCount || state.correct) return '';
        let remaining = state.hintHistory.at(-1)[3];
        return hintLetters(sets[displayedSetIndex].word).map((part) => !part.letter || remaining-- > 0 ? part.text : '_').join('');
      },
      requestHint() {
        if (processing || hintAvailability() !== 'available') return false;
        const state = current();
        const word = sets[displayedSetIndex].word;
        const prefix = hintPrefix(word, state.submittedAnswerKey);
        const revealed = nextHintPosition(hintLimit(word), state.hintHistory.at(-1)?.[3] ?? 0, prefix, attainable(state));
        state.hintHistory.push([state.attempts, state.attempts + state.warningCount, prefix, revealed]);
        state.hintCount++;
        return true;
      },
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
        return state ? Object.freeze({...state, warnedAnswers: Object.freeze(state.warnedAnswers.slice()),
          hintHistory: Object.freeze(state.hintHistory.map((row) => Object.freeze(row.slice())))}) : null;
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
        if (current().attempts === 0) { current().selectedAnswerIndex = null; current().typedText = ''; }
        return true;
      },
      selectCategory(id) {
        if (categoryLocked || processing) return false;
        const option = categories.find((category) => category.id === id);
        if (!option) return false;
        const filtered = eligibleFor(option);
        const nextSetIndex = filtered[0] ?? null;
        // Preserve the earlier unchecked-input reset, but retain every checked Set.
        if (nextSetIndex !== displayedSetIndex && current()?.attempts === 0) {
          current().selectedAnswerIndex = null;
          current().typedText = '';
        }
        categoryId = id;
        eligible = filtered;
        displayedSetIndex = nextSetIndex;
        return true;
      },
      setTypedAnswer(value) {
        const state = current();
        if (!typed || !state || state.correct || processing || typeof value !== 'string') return;
        const changed = utilities.normalizeWord(value) !== utilities.normalizeWord(state.typedText);
        state.typedText = value;
        if (changed) { state.revision++; state.feedback = null; }
      },
      selectAnswer(value) {
        const state = current();
        if (typed || !state || state.correct || processing) return;
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
          const answer = typed ? state.typedText : answers[state.selectedAnswerIndex];
          const answerKey = utilities.normalizeWord(answer);
          const correctKey = correctKeys[displayedSetIndex];
          if (!answerKey || !correctKey) throw new Error('Invalid checking state.');
          const exact = utilities.wordsMatch(answer, correctKey);
          const minor = typed && policy !== 'mistake' && !exact && utilities.isMinorSpellingError(answer, correctKey);
          const correct = exact;
          categoryLocked = true;
          if (minor && policy === 'warn' && (allowance === 'unlimited' || state.warningCount < allowance)) {
            state.warningCount++;
            state.warnedAnswers.push(answerKey);
            state.submittedRevision = state.revision;
            state.submittedAnswerKey = answerKey;
            state.feedback = 'spellingWarning';
            return Object.freeze({correct: false, warning: true, attempts: state.attempts});
          }
          state.attempts++;
          state.submittedRevision = state.revision;
          if (typed) state.submittedAnswerKey = answerKey;
          state.correct = correct;
          state.feedback = correct ? 'correct' : 'incorrect';
          return Object.freeze({correct, attempts: state.attempts});
        }
        finally { processing = false; }
      }
    });
  }

  return Object.freeze({shuffle, buildCategories, buildAnswerPool, hintLimit, hintPrefix, nextHintPosition, createSelectionSession});
});
