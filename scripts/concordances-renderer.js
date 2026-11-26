(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./concordances-utils.js'));
  }
  else {
    root.H5P.ConcordancesPapiJoRenderer = factory(root.H5P.ConcordancesPapiJoUtils);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (utilities) {
  'use strict';

  function element(document, tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  /** Presentation only: ambiguous/preformatted input keeps its original pre layout. */
  function isPlainContext(context) {
    if (/[^\S\r\n ]/.test(context)) return false;
    return context.split(/\r\n|\r|\n/).every((line) => !line ||
      !(/^ | $| {2,}|^\[\d+\]|^\d+[.)](?:\s|$)/.test(line)));
  }

  /**
   * Render one validated Set. Corpus strings are never parsed as HTML; editor escapes are handled only in the display copy.
   * Original tokens also provide lossless replacement points after a correct Check.
   */
  function renderSet(document, set, options) {
    // Invert only the four escapes emitted by the standard textarea, once.
    // Never parse markup or decode ampersands; authored Context remains untouched.
    const context = options.decodeEditorText ? utilities.decodeEditorText(set.context) : set.context;
    const section = element(document, 'section', 'h5p-concordances-papijo-set');
    section.setAttribute('aria-labelledby', options.headingId);
    const heading = element(document, 'h3', 'h5p-concordances-papijo-set-title', options.label);
    heading.id = options.headingId;
    section.appendChild(heading);

    const quote = element(document, 'blockquote', 'h5p-concordances-papijo-kwic');
    const scroll = element(document, 'div', 'h5p-concordances-papijo-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', options.a11y.kwicRegion);
    const pre = element(document, 'pre', 'h5p-concordances-papijo-context');
    // Only the visual text is hidden, never the keyboard-focusable scroll region.
    pre.setAttribute('aria-hidden', 'true');
    const tokens = utilities.tokenizeAutomaticContext(context,
      options.decodeEditorText ? utilities.decodeEditorText(set.word) : set.word).tokens;
    const displayTokens = tokens;
    const gapNodes = [];
    displayTokens.forEach((token) => {
      if (token.type === 'text') {
        pre.appendChild(document.createTextNode(token.text));
      }
      else {
        const gap = element(document, 'span', 'h5p-concordances-papijo-gap', '_____');
        pre.appendChild(gap);
        gapNodes.push(gap);
      }
    });
    scroll.appendChild(pre);
    quote.appendChild(scroll);
    section.appendChild(quote);

    const alternative = element(document, 'div', 'h5p-concordances-papijo-sr-only');
    alternative.setAttribute('role', 'group');
    alternative.setAttribute('aria-label', options.a11y.contextAlternative);
    // Separate alternatives follow original line boundaries; their text is not live.
    const lineTokens = [[]];
    displayTokens.forEach((token) => {
      if (token.type === 'gap') lineTokens[lineTokens.length - 1].push(token);
      else token.text.split(/(\r\n|\r|\n)/).forEach((part, index) => {
        if (index % 2) lineTokens.push([]);
        else lineTokens[lineTokens.length - 1].push({...token, text: part});
      });
    });
    // Keep LancsBox NODE anchors; only clearly plain contexts use the first gap.
    // Classification is for the whole display copy, never stored authoring data.
    const normalized = utilities.normalizeConcordance(context);
    const lancsbox = normalized.format === 'lancsbox';
    let primaryNode = null;
    if (lancsbox || isPlainContext(context)) {
      pre.className += ' h5p-concordances-papijo-tabular';
      const gapElements = new Map(tokens.filter((token) => token.type === 'gap')
        .map((token, index) => [token, gapNodes[index]]));
      pre.replaceChildren();
      lineTokens.forEach((line, index) => {
        const metadata = normalized.lines[index];
        let length = 0, anchor = null;
        line.forEach((token) => {
          if (!anchor && token.type === 'gap' && (!lancsbox || (metadata &&
            length >= metadata.keywordStart && length + token.text.length <= metadata.keywordEnd))) {
            anchor = {start: length, end: length + token.text.length};
          }
          length += token.text.length;
        });
        const row = element(document, 'span', 'h5p-concordances-papijo-kwic-row');
        const appendRange = (start, end, className) => {
          const cell = element(document, 'span', className);
          let position = 0;
          line.forEach((token) => {
            const next = position + token.text.length;
            if (next > start && position < end) {
              cell.appendChild(token.type === 'gap' ? gapElements.get(token)
                : document.createTextNode(token.text.slice(Math.max(0, start - position), end - position)));
            }
            position = next;
          });
          row.appendChild(cell);
        };
        if (anchor) {
          appendRange(0, anchor.start, 'h5p-concordances-papijo-kwic-left');
          appendRange(anchor.start, anchor.end, 'h5p-concordances-papijo-kwic-primary');
          if (!primaryNode) primaryNode = row.children[1];
          appendRange(anchor.end, length, 'h5p-concordances-papijo-kwic-right');
          // Keep the primary and suffix inline so different revealed widths never
          // insert a grid-sized space before the continuation.
          const continuation = element(document, 'span', 'h5p-concordances-papijo-kwic-continuation');
          continuation.appendChild(row.children[1]);
          continuation.appendChild(row.children[1]);
          row.appendChild(continuation);
        }
        else appendRange(0, length, 'h5p-concordances-papijo-kwic-unanchored');
        pre.appendChild(row);
        if (index < lineTokens.length - 1) {
          const separator = normalized.context.match(/\r\n|\r|\n/g)[index];
          pre.appendChild(document.createTextNode(separator));
        }
      });
    }
    const accessibleLines = lineTokens.map((line) => {
      const text = line.map((token) =>
        token.type === 'gap' ? options.a11y.missingWord : token.text).join('');
      const paragraph = element(document, 'p', '', text);
      alternative.appendChild(paragraph);
      return paragraph;
    });
    section.appendChild(alternative);
    return {element: section, heading, pre, scroll, alternative, accessibleLines, tokens, gapNodes, lineTokens,
      keywordNode: primaryNode || gapNodes[0]};
  }

  /** Centre measured KWIC geometry only when its width or centring target changes. */
  function observeKwic(view) {
    const {scroll, pre} = view;
    let previous = null, disposed = false;
    const update = () => {
      if (disposed) return;
      const width = scroll.clientWidth;
      // Keep observing hidden/detached views so their first visible layout is handled.
      if (!width || !scroll.isConnected) {
        previous = null;
        return;
      }
      const keyword = view.keywordNode;
      if (!keyword) return;
      const rect = keyword.getBoundingClientRect();
      const centre = scroll.scrollLeft + rect.left - scroll.getBoundingClientRect().left -
        scroll.clientLeft + rect.width / 2;
      const maximum = Math.max(0, scroll.scrollWidth - width);
      const target = Math.max(0, Math.min(maximum, centre - width / 2));
      // Scroll offsets cancel out above: manual scrolling does not change the target.
      // Ignore height-only notifications and repeated H5P resize/attachment events.
      if (previous && previous.width === width && Math.abs(previous.target - target) < 0.5) return;
      previous = {width, target};
      if (maximum > 0 && Math.abs(scroll.scrollLeft - target) >= 0.5) scroll.scrollLeft = target;
    };
    const ResizeObserver = pre.ownerDocument.defaultView?.ResizeObserver;
    const observer = ResizeObserver ? new ResizeObserver(update) : null;
    if (observer) {
      observer.observe(scroll);
      observer.observe(pre);
    }
    update();
    return {update, disconnect() {
      disposed = true;
      if (observer) observer.disconnect();
    }};
  }

  /** Reveal only gap nodes. Surrounding text nodes and stored Context stay untouched. */
  function revealSet(view) {
    if (view.revealed) return;
    const matches = view.tokens.filter((token) => token.type === 'gap');
    view.gapNodes.forEach((gap, index) => {
      const strong = element(view.pre.ownerDocument, 'strong', 'h5p-concordances-papijo-revealed-word', matches[index].text);
      gap.parentNode.replaceChild(strong, gap);
      if (view.keywordNode === gap) view.keywordNode = strong;
    });
    view.accessibleLines.forEach((paragraph, index) => {
      paragraph.textContent = view.lineTokens[index].map((token) => token.text).join('');
    });
    view.revealed = true;
  }

  /** Render trusted diagnostic codes and localized text with numeric Set references. */
  function renderDiagnostics(document, errors, options) {
    const section = element(document, 'section', 'h5p-concordances-papijo-diagnostic');
    section.setAttribute('role', 'region');
    section.setAttribute('aria-labelledby', options.headingId);
    const heading = element(document, 'h3', '', options.l10n.invalidContentTitle);
    heading.id = options.headingId;
    section.appendChild(heading);
    section.appendChild(element(document, 'p', '', options.l10n.invalidContentDescription));
    const list = element(document, 'ul');
    errors.forEach((error) => {
      const numbers = error.setIndices.map((index) => index + 1);
      const message = options.validation[error.code].replace(/@(set|sets|line)\b/g, (placeholder, key) =>
        key === 'line' ? String(error.line) : key === 'sets' ? numbers.join(', ') : String(numbers[0]));
      list.appendChild(element(document, 'li', '', message));
    });
    section.appendChild(list);
    return section;
  }

  function categoryLabel(category, l10n) {
    return category.type === 'all' ? l10n.allCategories
      : category.type === 'uncategorized' ? l10n.uncategorized : utilities.decodeEditorText(category.label);
  }

  /** Render final integer-unit results, in the supplied prepared sequence order. */
  function renderResults(document, rows, options) {
    const section = element(document, 'section', 'h5p-concordances-papijo-results');
    const heading = element(document, 'h3', '', options.l10n.resultsTitle);
    heading.id = options.domId + '-results-title';
    heading.setAttribute('tabindex', '-1');
    section.setAttribute('role', 'region');
    section.setAttribute('aria-labelledby', heading.id);
    section.appendChild(heading);
    const total = element(document, 'p', 'h5p-concordances-papijo-total');
    total.id = options.domId + '-results-total';
    total.appendChild(element(document, 'strong', '', options.l10n.totalScore.replace(/@(score|max)\b/g,
      (placeholder, key) => String(key === 'score' ? options.score : options.maxScore))));
    section.appendChild(total);
    const table = element(document, 'table');
    table.setAttribute('aria-labelledby', heading.id);
    table.setAttribute('aria-describedby', total.id);
    const head = element(document, 'thead');
    const headers = element(document, 'tr');
    ['resultSet', 'resultWord', 'resultAttempts', 'resultPoints'].forEach((key) => {
      const cell = element(document, 'th', '', options.l10n[key]);
      cell.setAttribute('scope', 'col');
      headers.appendChild(cell);
    });
    head.appendChild(headers);
    table.appendChild(head);
    const body = element(document, 'tbody');
    rows.forEach((result, index) => {
      const row = element(document, 'tr');
      const set = element(document, 'th', '', options.l10n.setLabel.replace(/@set\b/g, String(index + 1)));
      set.setAttribute('scope', 'row');
      row.appendChild(set);
      row.appendChild(element(document, 'td', '', utilities.decodeEditorText(result.word)));
      const attempts = result.attempts === 1 ? options.l10n.attemptSingular : options.l10n.attemptPlural;
      row.appendChild(element(document, 'td', '', attempts.replace(/@count\b/g, String(result.attempts))));
      row.appendChild(element(document, 'td', '', result.units + '/2'));
      body.appendChild(row);
    });
    table.appendChild(body);
    section.appendChild(table);
    return section;
  }

  /** Display-only edit mapping: never rewrite input or expose target characters. */
  function renderSpellingWarning(document, answer, target, template, missingLetter = 'A letter is missing.') {
    const line = element(document, 'span', 'h5p-concordances-papijo-spelling-line');
    const label = template.split('@answer');
    line.appendChild(document.createTextNode(label[0]));
    const text = element(document, 'span', 'h5p-concordances-papijo-spelling-answer');
    let start = -1, end = -1, omission = false;
    if (utilities.isMinorSpellingError(answer, target)) {
      const a = Array.from(utilities.normalizeWord(answer)), b = Array.from(utilities.normalizeWord(target));
      let index = 0;
      while (index < Math.min(a.length, b.length) && a[index] === b[index]) index++;
      const leading = answer.length - answer.trimStart().length;
      const trimmed = answer.trim(), map = [];
      const segmenter = new Intl.Segmenter('und', {granularity: 'grapheme'});
      for (const segment of segmenter.segment(trimmed)) {
        const range = {start: leading + segment.index, end: leading + segment.index + segment.segment.length};
        for (const point of Array.from(utilities.normalizeWord(segment.segment))) map.push(range);
      }
      if (map.length === a.length) {
        start = map[index]?.start ?? leading + trimmed.length;
        omission = a.length < b.length;
        const swapped = a.length === b.length && a[index] === b[index + 1] && a[index + 1] === b[index];
        end = omission ? start : map[index + (swapped ? 1 : 0)].end;
      }
    }
    if (start < 0) text.appendChild(document.createTextNode(answer));
    else {
      text.appendChild(document.createTextNode(answer.slice(0, start)));
      const mark = element(document, 'span', omission ? 'h5p-concordances-papijo-spelling-error h5p-concordances-papijo-spelling-omission'
        : 'h5p-concordances-papijo-spelling-error', omission ? '_' : answer.slice(start, end));
      if (omission) mark.setAttribute('aria-hidden', 'true');
      text.appendChild(mark);
      text.appendChild(document.createTextNode(answer.slice(end)));
    }
    line.appendChild(text);
    line.appendChild(document.createTextNode(label.slice(1).join('@answer')));
    if (omission) line.appendChild(element(document, 'span', 'h5p-concordances-papijo-sr-only', ' ' + missingLetter));
    return {element: line, announcement: template.replace('@answer', () => answer) + (omission ? ' ' + missingLetter : '')};
  }

  /** Replace pool options safely; values stay opaque and carry no correct-answer marker. */
  function populateAnswers(answerSelect, answers, l10n) {
    const document = answerSelect.ownerDocument;
    answerSelect.replaceChildren();
    const placeholder = element(document, 'option', '', l10n.selectAnswer);
    placeholder.value = '';
    answerSelect.appendChild(placeholder);
    answers.forEach((label, index) => {
      const option = element(document, 'option', '', utilities.decodeEditorText(label));
      option.value = String(index);
      answerSelect.appendChild(option);
    });
  }

  /** Native selection controls are created once; Retry refreshes only their options. */
  function renderSelectionControls(document, session, options) {
    const container = element(document, 'div', 'h5p-concordances-papijo-selection');
    let categorySelect = null;
    let categorySummary = null;
    if (options.enableCategories) {
      const label = element(document, 'label', 'h5p-concordances-papijo-control-label', options.l10n.selectCategory);
      label.setAttribute('for', options.domId + '-category');
      categorySelect = element(document, 'select', 'h5p-concordances-papijo-select');
      categorySelect.id = options.domId + '-category';
      categorySelect.setAttribute('aria-controls', options.domId + '-current-set');
      session.categories.forEach((category) => {
        const option = element(document, 'option', '', categoryLabel(category, options.l10n));
        option.value = category.id;
        categorySelect.appendChild(option);
      });
      categorySummary = element(document, 'p', 'h5p-concordances-papijo-category-summary');
      categorySummary.id = options.domId + '-category-summary';
      container.appendChild(label);
      container.appendChild(categorySelect);
      container.appendChild(categorySummary);
    }

    const progress = element(document, 'p', 'h5p-concordances-papijo-progress');
    progress.id = options.domId + '-eligible-progress';
    const setHost = element(document, 'div', 'h5p-concordances-papijo-current-set');
    setHost.id = options.domId + '-current-set';
    container.appendChild(progress);
    container.appendChild(setHost);

    const answerLabel = element(document, 'label', 'h5p-concordances-papijo-control-label', options.l10n.answerLabel);
    answerLabel.setAttribute('for', options.domId + '-answer');
    const typed = session.answerMode === 'typed';
    const answerSelect = element(document, typed ? 'input' : 'select',
      typed ? 'h5p-concordances-papijo-input' : 'h5p-concordances-papijo-select');
    if (typed) {
      answerSelect.setAttribute('type', 'text');
      answerSelect.setAttribute('autocomplete', 'off');
      answerSelect.setAttribute('autocapitalize', 'none');
      answerSelect.setAttribute('spellcheck', 'false');
    }
    answerSelect.id = options.domId + '-answer';
    answerSelect.setAttribute('aria-describedby', [categorySummary && categorySummary.id, progress.id].filter(Boolean).join(' '));
    if (!typed) populateAnswers(answerSelect, session.answers, options.l10n);
    container.appendChild(answerLabel);
    container.appendChild(answerSelect);
    let hintStatus = null;
    let hintReveal = null;
    if (typed && options.enableHints) {
      hintStatus = element(document, 'p', 'h5p-concordances-papijo-hint-status');
      hintStatus.id = options.domId + '-hint-status';
      hintStatus.setAttribute('role', 'note');
      container.appendChild(hintStatus);
      hintReveal = element(document, 'p', 'h5p-concordances-papijo-hint-reveal');
      hintReveal.hidden = true;
      container.appendChild(hintReveal);
      answerSelect.setAttribute('aria-describedby', answerSelect.getAttribute('aria-describedby') + ' ' + hintStatus.id);
    }
    const feedback = element(document, 'p', 'h5p-concordances-papijo-feedback');
    feedback.id = options.domId + '-feedback';
    // Static description and one separate live message avoid reading feedback twice
    // when focus returns to the dropdown. aria-details exposes the related details.
    answerSelect.setAttribute('aria-details', feedback.id);
    const announcement = element(document, 'div', 'h5p-concordances-papijo-sr-only');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    container.appendChild(feedback);
    container.appendChild(announcement);
    const exercise = element(document, 'div', 'h5p-concordances-papijo-exercise');
    Array.from(container.childNodes).forEach(child => exercise.appendChild(child));
    container.appendChild(exercise);
    const sequenceEnd = element(document, 'p', 'h5p-concordances-papijo-sequence-end');
    sequenceEnd.hidden = true;
    container.appendChild(sequenceEnd);
    const resultsHost = element(document, 'div', 'h5p-concordances-papijo-results-host');
    container.appendChild(resultsHost);
    return {element: container, exercise, hintStatus, hintReveal, categorySelect, categorySummary, progress, setHost, answerSelect, answerControl: answerSelect, feedback, announcement, sequenceEnd, resultsHost};
  }

  return Object.freeze({renderSpellingWarning, renderSet, observeKwic, revealSet, renderDiagnostics, categoryLabel, renderResults, populateAnswers, renderSelectionControls});
});
