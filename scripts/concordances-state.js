(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./concordances-utils.js'), require('./concordances-session.js'));
  }
  else {
    root.H5P.ConcordancesPapiJoState = factory(root.H5P.ConcordancesPapiJoUtils, root.H5P.ConcordancesPapiJoSession);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (utilities, sessionModel) {
  'use strict';

  const VERSION = 1;
  const FIELDS = ['version', 'fingerprint', 'setOrder', 'answerOrder', 'category', 'locked', 'position', 'sets', 'results'];
  const TYPED_VERSION = 2;
  const TYPED_FIELDS = ['version', 'answerMode', 'fingerprint', 'setOrder', 'category', 'locked', 'position', 'sets', 'results'];
  const hintsEnabled = (behaviour) => utilities.resolveAnswerMode(behaviour) === 'typed' && behaviour?.enableProgressiveHints === true;
  const hintFingerprint = (base) => hash(JSON.stringify([5, base, 'adaptive-letter-hints', 1]));
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

  /** Two 32-bit rolling hashes of canonical UTF-16 JSON; compatibility, not security. */
  function hash(text) {
    let first = 0x811c9dc5, second = 0x9e3779b9;
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193) >>> 0;
      second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
    }
    return 'cpj1:' + first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
  }

  /** Authored order is excluded so an accepted saved run retains its own order. */
  function describe(activity, typed = false, penalty = 1, policy = 'mistake', allowance = 2) {
    if (!activity || utilities.validateSets(activity.sets).length) return null;
    const records = activity.sets.map((set) => [utilities.normalizeWord(set.word), set.word, set.context,
      typeof set.category === 'string' ? set.category : null]);
    records.sort((left, right) => compare(left[0], right[0]));
    const categoriesEnabled = activity.enableCategories === true;
    const distractors = !typed && typeof activity.distractors === 'string' ? activity.distractors : '';
    const canonical = typed ? [TYPED_VERSION, 'typed', categoriesEnabled, records]
      : [VERSION, categoriesEnabled, distractors, records];
    const tabular = activity.sets.some((set) => utilities.normalizeConcordance(utilities.decodeEditorText(set.context)).format === 'lancsbox');
    canonical.push(['automatic-gaps', tabular ? 3 : 1]);
    // Preserve the established one-point typed domain byte-for-byte.
    if (typed && penalty === 0.5) canonical.push(['typed-penalty', 0.5]);
    if (typed && policy === 'warn') canonical.push(['spelling-policy', policy]);
    if (typed && policy === 'warn') canonical.push(['free-spelling-warnings', allowance]);
    // Missing/explicit Shuffle retain established fingerprints and state schemas.
    // Changing policy starts a new run; reordering editor Sets still restores it.
    if (activity.setOrder === 'author') canonical.push(['set-order', 'author']);
    return {
      fingerprint: hash(JSON.stringify(canonical)),
      categoriesEnabled,
      sets: new Map(records.map((record) => [record[0], utilities.normalizeWord(record[3])])),
      correctKeys: new Map(records.map((record) => [record[0], utilities.normalizeWord(utilities.decodeEditorText(record[1]))])),
      answers: new Map((typed ? [] : sessionModel.buildAnswerPool(activity.sets, activity.distractors))
        .map((label) => [utilities.normalizeWord(label), label]))
    };
  }

  function fingerprint(activity, behaviour) {
    try {
      const base = describe(activity, utilities.resolveAnswerMode(behaviour) === 'typed', utilities.resolveTypedPenalty(behaviour), utilities.resolveSpellingPolicy(behaviour), utilities.resolveWarningAllowance(behaviour))?.fingerprint;
      return base ? hintsEnabled(behaviour) ? hintFingerprint(base) : base : null;
    }
    catch (error) { return null; }
  }

  /** Independent JSON data only. An uninitialized/invalid activity has no snapshot. */
  function createAttemptState(activity, session) {
    try {
      if (!session) return {};
      if (session.answerMode === 'typed') {
        const baseState = createTypedState(activity, session);
        if (!session.progressiveHints || !baseState.fingerprint) return baseState;
        return {version: 5, fingerprint: hintFingerprint(baseState.fingerprint), baseState,
          hints: session.setOrder.map((index) => {
            const state = session.getSetState(index);
            return [utilities.normalizeWord(activity.sets[index].word), state.hintHistory.map((row) => row.slice())];
          })};
      }
      const content = describe(activity);
      if (!content) return {};
      const identities = activity.sets.map((set) => utilities.normalizeWord(set.word));
      const category = session.categories.find((entry) => entry.id === session.categoryId);
      return {
        version: VERSION,
        fingerprint: content.fingerprint,
        setOrder: session.setOrder.map((index) => identities[index]),
        answerOrder: session.answers.map(utilities.normalizeWord),
        category: category.type === 'named' ? ['named', category.key] : [category.type],
        locked: session.categoryLocked,
        position: session.currentPosition,
        // [Set identity, selected answer identity, attempts, solved, selection checked]
        sets: session.setOrder.map((index) => {
          const state = session.getSetState(index);
          return [identities[index], state.selectedAnswerIndex === null ? null
            : utilities.normalizeWord(session.answers[state.selectedAnswerIndex]), state.attempts,
          state.correct, state.submittedRevision !== null && state.revision === state.submittedRevision];
        }),
        results: session.allSolved
      };
    }
    catch (error) { return {}; }
  }

  /** Presentation is optional metadata; legacy completed attempts opened Results. */
  function createState(activity, session, resultsPageVisible) {
    const snapshot = createAttemptState(activity, session);
    if (snapshot.fingerprint && typeof resultsPageVisible === 'boolean') {
      snapshot.resultsPageVisible = Boolean(session.allSolved && resultsPageVisible);
    }
    return snapshot;
  }

  function validateState(activity, candidate, behaviour) {
    try {
      let page;
      if (candidate && Object.hasOwn(candidate, 'resultsPageVisible')) {
        const keys = Reflect.ownKeys(candidate);
        if (!record(candidate, keys) || typeof candidate.resultsPageVisible !== 'boolean') return invalid('page');
        page = candidate.resultsPageVisible;
        candidate = Object.fromEntries(keys.filter(key => key !== 'resultsPageVisible').map(key => [key, candidate[key]]));
      }
      const validated = validateAttemptState(activity, candidate, behaviour);
      if (!validated.valid) return validated;
      const solved = validated.state.results;
      if (page === true && !solved) return invalid('page');
      return {...validated, resultsPageVisible: page === undefined ? solved : page};
    }
    catch (error) { return invalid('shape'); }
  }

  /** Reject accessors, custom records and extra fields instead of executing/repairing them. */
  function record(value, fields = FIELDS) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && Object.getPrototypeOf(prototype) !== null) return false;
    const keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every((key) => fields.includes(key) &&
      dataProperty(value, key));
  }

  function dataProperty(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable);
  }

  function array(value, length) {
    if (!Array.isArray(value) || (length !== undefined && value.length !== length) ||
      Reflect.ownKeys(value).length !== value.length + 1) return false;
    const prototype = Object.getPrototypeOf(value);
    if (!prototype || !Array.isArray(prototype) ||
      Object.getPrototypeOf(Object.getPrototypeOf(prototype)) !== null) return false;
    for (let index = 0; index < value.length; index++) {
      if (!dataProperty(value, String(index))) return false;
    }
    return true;
  }

  function permutation(value, expected) {
    return array(value, expected.size) && new Set(value).size === expected.size &&
      value.every((key) => typeof key === 'string' && expected.has(key));
  }

  const invalid = (reason) => ({valid: false, reason});
  const pristine = (row) => row[1] === null && row[2] === 0 && !row[3] && !row[4];

  /** Pure compatibility/consistency check. It never applies state to a session. */
  function validateAttemptState(activity, candidate, behaviour) {
    if (hintsEnabled(behaviour)) return validateHintState(activity, candidate, behaviour);
    if (utilities.resolveAnswerMode(behaviour) === 'typed') return validateTypedState(activity, candidate, utilities.resolveTypedPenalty(behaviour), utilities.resolveSpellingPolicy(behaviour), utilities.resolveWarningAllowance(behaviour));
    try {
      if (!record(candidate)) return invalid('shape');
      if (candidate.version !== VERSION) return invalid('version');
      const content = describe(activity);
      if (!content || candidate.fingerprint !== content.fingerprint) return invalid('content');
      if (!permutation(candidate.setOrder, content.sets) || !permutation(candidate.answerOrder, content.answers)) {
        return invalid('orders');
      }
      const category = candidate.category;
      if (!array(category) || !(['all', 'uncategorized'].includes(category[0]) && category.length === 1 ||
        category[0] === 'named' && category.length === 2 && typeof category[1] === 'string' && category[1].length > 0)) {
        return invalid('category');
      }
      if (!content.categoriesEnabled && category[0] !== 'all') return invalid('category');
      const eligible = candidate.setOrder.filter((id) => category[0] === 'all' ||
        content.sets.get(id) === (category[0] === 'uncategorized' ? '' : category[1]));
      if (!eligible.length) return invalid('category');
      if (typeof candidate.locked !== 'boolean' || typeof candidate.results !== 'boolean' ||
        !Number.isSafeInteger(candidate.position) || candidate.position < 0 || candidate.position >= eligible.length) {
        return invalid('position');
      }
      if (!array(candidate.sets, content.sets.size)) return invalid('sets');
      const rows = new Map();
      for (const row of candidate.sets) {
        if (!array(row, 5) || !content.sets.has(row[0]) || rows.has(row[0]) ||
          !(row[1] === null || typeof row[1] === 'string' && content.answers.has(row[1])) ||
          !Number.isSafeInteger(row[2]) || row[2] < 0 || typeof row[3] !== 'boolean' || typeof row[4] !== 'boolean') {
          return invalid('sets');
        }
        const [id, selection, attempts, solved, checked] = row;
        if (checked && (attempts === 0 || selection === null) ||
          solved && (!checked || attempts === 0 || selection !== id) ||
          !solved && checked && selection === id ||
          content.answers.size === 1 && (attempts > 1 || attempts > 0 && !solved)) {
          return invalid('interaction');
        }
        rows.set(id, row);
      }
      const hasChecks = candidate.sets.some((row) => row[2] > 0);
      if (candidate.locked !== hasChecks) return invalid('lock');
      const positions = new Map(eligible.map((id, index) => [id, index]));
      for (const [id, row] of rows) {
        const position = positions.get(id);
        if (position === undefined || position > candidate.position) {
          if (!pristine(row)) return invalid('navigation');
        }
        else if (position < candidate.position && !row[3]) return invalid('navigation');
      }
      const allSolved = eligible.every((id) => rows.get(id)[3]);
      if (candidate.results !== allSolved || allSolved && candidate.position !== eligible.length - 1) {
        return invalid('results');
      }
      // Return new plain data, with no candidate references and no partial repair.
      return {valid: true, state: {
        version: VERSION, fingerprint: candidate.fingerprint,
        setOrder: candidate.setOrder.slice(), answerOrder: candidate.answerOrder.slice(),
        category: category.slice(), locked: candidate.locked, position: candidate.position,
        sets: candidate.sets.map((row) => row.slice()), results: candidate.results
      }};
    }
    catch (error) { return invalid('shape'); }
  }

  /** Hints wrap the unchanged typed schema; disabled hints keep schemas 1/2/4. */
  function validateHintState(activity, candidate, behaviour) {
    try {
      if (!record(candidate, ['version', 'fingerprint', 'baseState', 'hints']) || candidate.version !== 5) return invalid('shape');
      const base = validateAttemptState(activity, candidate.baseState, {...behaviour, enableProgressiveHints: false});
      if (!base.valid || candidate.fingerprint !== hintFingerprint(base.state.fingerprint)) return invalid('content');
      if (!array(candidate.hints, base.state.sets.length)) return invalid('hints');
      const rows = new Map(base.state.sets.map((row) => [row[0], row]));
      const words = new Map(activity.sets.map((set) => [utilities.normalizeWord(set.word), set.word]));
      const seen = new Set();
      const penalty = utilities.resolveTypedPenalty(behaviour), allowance = utilities.resolveWarningAllowance(behaviour);
      for (const row of candidate.hints) {
        if (!array(row, 2)) return invalid('hints');
        const [id, history] = row, state = rows.get(id);
        if (!state || seen.has(id) || !array(history)) return invalid('hints');
        seen.add(id);
        const letters = sessionModel.hintLimit(words.get(id));
        const incorrect = state[2] - (state[3] ? 1 : 0), warnings = base.state.version === 4 ? state[6] : 0;
        if (history.length > letters) return invalid('hints');
        let previous = null;
        for (let index = 0; index < history.length; index++) {
          const entry = history[index];
          if (!array(entry, 4) || entry.some((value) => !Number.isSafeInteger(value) || value < 0)) return invalid('hints');
          const [errors, submissions, prefix, revealed] = entry;
          const usedWarnings = submissions - errors;
          const points = Math.max(0, 2 - errors * penalty - index * 0.5);
          if (errors > incorrect || usedWarnings < 0 || usedWarnings > warnings || prefix > letters ||
            revealed <= (previous?.[3] ?? 0) ||
            revealed !== sessionModel.nextHintPosition(letters, previous?.[3] ?? 0, prefix, points)) return invalid('hint-progression');
          if (previous) {
            if (errors < previous[0] || usedWarnings < previous[1] - previous[0] || submissions <= previous[1] ||
              (points > 0 ? prefix <= previous[2] : errors <= previous[0])) return invalid('hint-progression');
          }
          else if (errors < 2 && !(base.state.version === 4 && allowance !== 'unlimited' && usedWarnings >= allowance)) return invalid('hint-progression');
          // When this is still the latest checked answer, its prefix is known.
          if (!state[3] && submissions === incorrect + warnings && prefix !== sessionModel.hintPrefix(words.get(id), state[5])) return invalid('hint-prefix');
          previous = entry;
        }
      }
      return {valid: true, state: base.state, hints: candidate.hints.map(([id, history]) => [id, history.map((row) => row.slice())])};
    }
    catch (error) { return invalid('shape'); }
  }

  /** Typed snapshots retain raw text and the last accepted normalized submission. */
  function createTypedState(activity, session) {
    const content = describe(activity, true, session.typedPenalty, session.spellingPolicy, session.warningAllowance);
    if (!content) return {};
    const identities = activity.sets.map((set) => utilities.normalizeWord(set.word));
    const category = session.categories.find((entry) => entry.id === session.categoryId);
    const snapshot = {
      version: TYPED_VERSION, answerMode: 'typed', fingerprint: content.fingerprint,
      setOrder: session.setOrder.map((index) => identities[index]),
      category: category.type === 'named' ? ['named', category.key] : [category.type],
      locked: session.categoryLocked, position: session.currentPosition,
      // [identity, raw input, attempts, solved, feedback checked, last submission key]
      sets: session.setOrder.map((index) => {
        const state = session.getSetState(index);
        return [identities[index], state.typedText, state.attempts, state.correct,
          state.feedback !== null, state.submittedAnswerKey];
      }),
      results: session.allSolved
    };
    if (session.spellingPolicy === 'warn') {
      snapshot.version = 4;
      snapshot.warningAllowance = session.warningAllowance;
      snapshot.spellingPolicy = session.spellingPolicy;
      snapshot.sets.forEach((row, index) => {
        const state = session.getSetState(session.setOrder[index]);
        row.push(state.warningCount, state.feedback === 'spellingWarning', state.warnedAnswers.slice());
      });
    }
    return snapshot;
  }

  function validateTypedState(activity, candidate, penalty = 1, policy = 'mistake', allowance = 1) {
    try {
      const tolerant = policy === 'warn';
      if (!record(candidate, tolerant ? TYPED_FIELDS.concat('spellingPolicy', 'warningAllowance') : TYPED_FIELDS)) return invalid('shape');
      if (candidate.version !== (tolerant ? 4 : TYPED_VERSION) || candidate.answerMode !== 'typed' ||
        tolerant && candidate.spellingPolicy !== policy || tolerant && candidate.warningAllowance !== allowance) return invalid('version');
      const content = describe(activity, true, penalty, policy, allowance);
      if (!content || candidate.fingerprint !== content.fingerprint) return invalid('content');
      if (!permutation(candidate.setOrder, content.sets)) return invalid('orders');
      const category = candidate.category;
      if (!array(category) || !(['all', 'uncategorized'].includes(category[0]) && category.length === 1 ||
        category[0] === 'named' && category.length === 2 && typeof category[1] === 'string' && category[1].length > 0)) return invalid('category');
      if (!content.categoriesEnabled && category[0] !== 'all') return invalid('category');
      const eligible = candidate.setOrder.filter((id) => category[0] === 'all' ||
        content.sets.get(id) === (category[0] === 'uncategorized' ? '' : category[1]));
      if (!eligible.length) return invalid('category');
      if (typeof candidate.locked !== 'boolean' || typeof candidate.results !== 'boolean' ||
        !Number.isSafeInteger(candidate.position) || candidate.position < 0 || candidate.position >= eligible.length) return invalid('position');
      if (!array(candidate.sets, content.sets.size)) return invalid('sets');
      const rows = new Map();
      for (const row of candidate.sets) {
        if (!array(row, tolerant ? 9 : 6) || tolerant && (!Number.isSafeInteger(row[6]) || row[6] < 0 || allowance !== 'unlimited' && row[6] > allowance) || tolerant && typeof row[7] !== 'boolean' || !content.sets.has(row[0]) || rows.has(row[0]) ||
          typeof row[1] !== 'string' || /[\r\n]/.test(row[1]) ||
          !Number.isSafeInteger(row[2]) || row[2] < 0 || typeof row[3] !== 'boolean' || typeof row[4] !== 'boolean' ||
          !(row[5] === null || typeof row[5] === 'string' && row[5].length > 0 &&
            !/[\r\n]/.test(row[5]) && utilities.normalizeWord(row[5]) === row[5])) return invalid('sets');
        const [id, raw, attempts, solved, checked, submitted] = row;
        const key = utilities.normalizeWord(raw), correct = content.correctKeys.get(id);
        if (tolerant) {
          if (!array(row[8], row[6]) || new Set(row[8]).size !== row[6] ||
            row[8].some((value) => typeof value !== 'string' || utilities.normalizeWord(value) !== value ||
              !utilities.isMinorSpellingError(value, correct))) return invalid('interaction');
          if (!validWarningInteraction(row, correct, allowance)) return invalid('interaction');
        }
        else if (attempts === 0 && (submitted !== null || solved || checked) ||
          attempts > 0 && submitted === null ||
          checked && (attempts === 0 || !key || key !== submitted) ||
          solved && (!checked || key !== correct || submitted !== correct) ||
          !solved && attempts > 0 && submitted === correct) return invalid('interaction');
        rows.set(id, row);
      }
      if (candidate.locked !== candidate.sets.some((row) => row[2] > 0 || tolerant && row[6])) return invalid('lock');
      const positions = new Map(eligible.map((id, index) => [id, index]));
      for (const [id, row] of rows) {
        const position = positions.get(id);
        if (position === undefined || position > candidate.position) {
          if (row[1] !== '' || row[2] !== 0 || row[3] || row[4] || row[5] !== null || tolerant && (row[6] || row[7])) return invalid('navigation');
        }
        else if (position < candidate.position && !row[3]) return invalid('navigation');
      }
      const allSolved = eligible.every((id) => rows.get(id)[3]);
      if (candidate.results !== allSolved || allSolved && candidate.position !== eligible.length - 1) return invalid('results');
      return {valid: true, state: {
        version: tolerant ? 4 : TYPED_VERSION, answerMode: 'typed', fingerprint: candidate.fingerprint,
        ...(tolerant ? {spellingPolicy: policy} : {}),
        ...(tolerant ? {warningAllowance: allowance} : {}),
        setOrder: candidate.setOrder.slice(), category: category.slice(), locked: candidate.locked,
        position: candidate.position, sets: candidate.sets.map((row) => row.slice()), results: candidate.results
      }};
    }
    catch (error) { return invalid('shape'); }
  }

  /** Separate rules for Warn schema 4; schema 2's strict rules above are unchanged. */
  function validWarningInteraction(row, correct, allowance = 1) {
    const [, raw, attempts, solved, checked, submitted, used, active] = row;
    const key = utilities.normalizeWord(raw);
    const minor = submitted !== null && utilities.isMinorSpellingError(submitted, correct);
    const exact = submitted === correct;
    if (used && (Array.from(correct).length < 5 || !/^[\p{L}\p{M}]+$/u.test(correct))) return false;
    if (active && (!used || !checked || solved || !minor)) return false;
    if (checked && (!key || key !== submitted)) return false;
    if (solved && (attempts === 0 || !checked || !exact)) return false;
    if (!solved && submitted !== null && exact) return false;
    if (attempts === 0) {
      if (used) return minor && !solved && (!checked || active) && row[8].includes(submitted);
      return submitted === null && !checked && !solved && !active;
    }
    {
      const history = row[8];
      if (active && !history.includes(submitted)) return false;
      if (checked && !active && history.includes(submitted)) return false;
      if (minor && !history.includes(submitted) && (allowance === 'unlimited' || used < allowance)) return false;
    }
    if (submitted === null || !used && minor) return false;
    return true;
  }

  /** Validate completely before constructing a session; never shuffle accepted orders. */
  function restoreSession(activity, candidate, behaviour) {
    const mode = utilities.resolveAnswerMode(behaviour);
    const validated = validateState(activity, candidate, behaviour);
    if (!validated.valid) return null;
    try { return sessionModel.createSelectionSession(activity, undefined, validated.state, mode, utilities.resolveTypedPenalty(behaviour), utilities.resolveSpellingPolicy(behaviour), utilities.resolveWarningAllowance(behaviour), hintsEnabled(behaviour), validated.hints); }
    catch (error) { return null; }
  }

  return Object.freeze({VERSION, TYPED_VERSION, fingerprint, createState, validateState, restoreSession});
});
