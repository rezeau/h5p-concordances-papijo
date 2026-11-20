(function (root, factory) {
  'use strict';

  const utilities = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = utilities;
  }
  else {
    root.H5P = root.H5P || {};
    root.H5P.ConcordancesPapiJoUtils = utilities;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Produce a comparison key only; callers retain the original word for display.
   * This uses Unicode lowercase mapping, not full case folding or locale rules.
   * Context must never be passed through word normalization.
   */
  function normalizeWord(word) {
    return typeof word === 'string'
      ? word.normalize('NFC').trim().toLowerCase().normalize('NFC')
      : '';
  }

  /**
   * Inspect all authored Sets, regardless of category, without rewriting them.
   * Blank/missing words are excluded; required-field checks are a separate concern.
   * @returns {Array<{key: string, setIndices: number[], words: string[]}>} Duplicate groups.
   */
  function findDuplicateWords(sets) {
    if (!Array.isArray(sets)) {
      return [];
    }

    const groups = new Map();
    sets.forEach((set, index) => {
      const word = set && set.word;
      const key = normalizeWord(word);
      if (key.length === 0) {
        return;
      }
      if (!groups.has(key)) {
        groups.set(key, { key, setIndices: [], words: [] });
      }
      const group = groups.get(key);
      group.setIndices.push(index);
      group.words.push(word);
    });
    return Array.from(groups.values()).filter((group) => group.setIndices.length > 1);
  }

  /** Validate the entire authored activity without filtering categories or changing data. */
  function validateSets(sets) {
    if (!Array.isArray(sets) || sets.length === 0) {
      return [{code: 'noSets', setIndices: []}];
    }

    const errors = [];
    for (let index = 0; index < sets.length; index++) {
      const set = sets[index];
      if (normalizeWord(set && set.word).length === 0) {
        errors.push({code: 'missingWord', setIndices: [index]});
      }
      const context = set && set.context;
      // Trim only a temporary emptiness check; never store or render this projection.
      if (typeof context !== 'string' || context.trim().length === 0) {
        errors.push({code: 'missingContext', setIndices: [index]});
      }
      else if (normalizeWord(set && set.word)) {
        tokenizeAutomaticContext(decodeEditorText(context), decodeEditorText(set.word)).errors.forEach((error) =>
          errors.push({...error, setIndices: [index]}));
      }
    }
    findDuplicateWords(sets).forEach((group) => {
      errors.push({code: 'duplicateWord', setIndices: group.setIndices.slice()});
    });
    return errors;
  }

  /** Non-empty answer comparison uses the same identity rules as validation. */
  function wordsMatch(answer, word) {
    const key = normalizeWord(answer);
    return key.length > 0 && key === normalizeWord(word);
  }

  function decodeEditorText(text) {
    return text.replace(/&(?:quot|lt|gt|#039);/g,
      (entity) => ({'&quot;': '"', '&#039;': "'", '&lt;': '<', '&gt;': '>'})[entity]);
  }

  /** Recognize a whole Context before removing any tab separators. */
  function normalizeConcordance(context) {
    const parts = context.split(/(\r\n|\r|\n)/), errors = [], formats = [], lines = [];
    const join = (left, right) => !left || !right ? left + right
      : /[-'’([{«“"]$/.test(left) || /^[,.;:!?%)}\]»”"'’-]/.test(right) ? left + right : left + ' ' + right;
    parts.forEach((line, index) => {
      if (index % 2 || !line.trim()) return;
      const fields = line.split('\t');
      const like = fields.length >= 3;
      if (!like) { formats.push({type: 'ordinary', line: index / 2 + 1}); return; }
      if (fields.length !== 3 || !fields[1].trim()) {
        errors.push({code: 'malformedLancsBox', line: index / 2 + 1}); return;
      }
      formats.push({type: 'lancsbox', line: index / 2 + 1});
      const keyword = fields[1].trim();
      const throughKeyword = join(fields[0].trim(), keyword);
      lines[index / 2] = {keywordStart: throughKeyword.length - keyword.length,
        keywordEnd: throughKeyword.length};
      parts[index] = join(throughKeyword, fields[2].trim());
    });
    const first = formats[0]?.type;
    const mixed = formats.find((entry) => entry.type !== first);
    if (mixed) errors.push({code: 'mixedContextFormats', line: mixed.line});
    return {context: errors.length ? '' : parts.join(''), format: first || 'ordinary', errors, lines};
  }

  /** Literal comparison at whole grapheme boundaries; offsets always refer to source. */
  function tokenizeAutomaticContext(context, word) {
    const target = normalizeWord(word), tokens = [], errors = [];
    const segmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('und', {granularity: 'grapheme'}) : null;
    const key = (text) => text.normalize('NFC').toLowerCase().normalize('NFC');
    const normalized = normalizeConcordance(context);
    if (normalized.errors.length) return {tokens: [], errors: normalized.errors};
    const parts = normalized.context.split(/(\r\n|\r|\n)/);
    let offset = 0;
    parts.forEach((line, partIndex) => {
      if (partIndex % 2 || !line.trim()) {
        tokens.push({type: 'text', index: offset, text: line}); offset += line.length; return;
      }
      const lineNumber = partIndex / 2 + 1;
      if (/_{2,}/.test(line)) errors.push({code: 'automaticManualGap', line: lineNumber});
      if (!segmenter || !target) {
        errors.push({code: 'automaticMissingTarget', line: lineNumber});
      }
      else {
        const boundaries = Array.from(segmenter.segment(line), (segment) => segment.index).concat(line.length);
        let cursor = 0, matches = 0;
        for (let start = 0; start < boundaries.length - 1;) {
          let endMatch = -1;
          for (let end = start + 1; end < boundaries.length; end++) {
            const candidate = key(line.slice(boundaries[start], boundaries[end]));
            if (candidate === target) { endMatch = end; break; }
            if (candidate.length >= target.length) break;
          }
          if (endMatch < 0) { start++; continue; }
          if (boundaries[start] > cursor) tokens.push({type: 'text', index: offset + cursor, text: line.slice(cursor, boundaries[start])});
          cursor = boundaries[endMatch];
          tokens.push({type: 'gap', index: offset + boundaries[start], text: line.slice(boundaries[start], cursor)});
          matches++; start = endMatch;
        }
        if (cursor < line.length) tokens.push({type: 'text', index: offset + cursor, text: line.slice(cursor)});
        if (!matches) errors.push({code: 'automaticMissingTarget', line: lineNumber});
        const node = normalized.lines[partIndex / 2];
        if (node && !tokens.some((token) => token.type === 'gap' &&
          token.index >= offset + node.keywordStart && token.index + token.text.length <= offset + node.keywordEnd)) {
          errors.push({code: 'ambiguousLancsBox', line: lineNumber});
        }
      }
      offset += line.length;
    });
    return {tokens: errors.length ? [] : tokens, errors};
  }

  return Object.freeze({ normalizeConcordance,
    normalizeWord, wordsMatch, findDuplicateWords, validateSets, decodeEditorText, tokenizeAutomaticContext });
});
