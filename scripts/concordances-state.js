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

  /** Authored order is excluded; exact word/Context/category strings are included. */
  function describe(activity) {
    if (!activity || utilities.validateSets(activity.sets).length) return null;
    const records = activity.sets.map((set) => [utilities.normalizeWord(set.word), set.word, set.context,
      typeof set.category === 'string' ? set.category : null]);
    records.sort((left, right) => compare(left[0], right[0]));
    const categoriesEnabled = activity.enableCategories === true;
    const distractors = typeof activity.distractors === 'string' ? activity.distractors : '';
    const canonical = [VERSION, categoriesEnabled, distractors, records];
    const tabular = activity.sets.some((set) => utilities.normalizeConcordance(utilities.decodeEditorText(set.context)).format === 'lancsbox');
    canonical.push(['automatic-gaps', tabular ? 3 : 1]);
    return {
      fingerprint: hash(JSON.stringify(canonical)),
      categoriesEnabled,
      sets: new Map(records.map((record) => [record[0], utilities.normalizeWord(record[3])])),
      answers: new Map(sessionModel.buildAnswerPool(activity.sets, activity.distractors)
        .map((label) => [utilities.normalizeWord(label), label]))
    };
  }

  function fingerprint(activity) {
    try { return describe(activity)?.fingerprint ?? null; }
    catch (error) { return null; }
  }

  /** Independent JSON data only. An uninitialized/invalid activity has no snapshot. */
  function createState(activity, session) {
    try {
      if (!session) return {};
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

  /** Reject accessors, custom records and extra fields instead of executing/repairing them. */
  function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && Object.getPrototypeOf(prototype) !== null) return false;
    const keys = Reflect.ownKeys(value);
    return keys.length === FIELDS.length && keys.every((key) => FIELDS.includes(key) &&
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
  function validateState(activity, candidate) {
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

  /** Validate completely before constructing a session; never shuffle accepted orders. */
  function restoreSession(activity, candidate) {
    const validated = validateState(activity, candidate);
    if (!validated.valid) return null;
    try { return sessionModel.createSelectionSession(activity, undefined, validated.state); }
    catch (error) { return null; }
  }

  return Object.freeze({VERSION, fingerprint, createState, validateState, restoreSession});
});
