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
    // Grid tracks share a keyword column; positions come from NODE, not
    // from the first matching occurrence in the reconstructed sentence.
    const normalized = utilities.normalizeConcordance(context);
    if (normalized.format === 'lancsbox') {
      pre.className += ' h5p-concordances-papijo-tabular';
      const gapElements = new Map(tokens.filter((token) => token.type === 'gap')
        .map((token, index) => [token, gapNodes[index]]));
      pre.replaceChildren();
      lineTokens.forEach((line, index) => {
        const metadata = normalized.lines[index];
        let length = 0, anchor = null;
        line.forEach((token) => {
          if (!anchor && metadata && token.type === 'gap' && length >= metadata.keywordStart &&
            length + token.text.length <= metadata.keywordEnd) anchor = {start: length, end: length + token.text.length};
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
    return {element: section, heading, pre, scroll, alternative, accessibleLines, tokens, gapNodes, lineTokens};
  }

  /** Reveal only gap nodes. Surrounding text nodes and stored Context stay untouched. */
  function revealSet(view) {
    if (view.revealed) return;
    const matches = view.tokens.filter((token) => token.type === 'gap');
    view.gapNodes.forEach((gap, index) => {
      const strong = element(view.pre.ownerDocument, 'strong', 'h5p-concordances-papijo-revealed-word', matches[index].text);
      gap.parentNode.replaceChild(strong, gap);
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
    const answerSelect = element(document, 'select', 'h5p-concordances-papijo-select');
    answerSelect.id = options.domId + '-answer';
    answerSelect.setAttribute('aria-describedby', [categorySummary && categorySummary.id, progress.id].filter(Boolean).join(' '));
    populateAnswers(answerSelect, session.answers, options.l10n);
    container.appendChild(answerLabel);
    container.appendChild(answerSelect);
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
    const sequenceEnd = element(document, 'p', 'h5p-concordances-papijo-sequence-end');
    sequenceEnd.hidden = true;
    container.appendChild(sequenceEnd);
    const resultsHost = element(document, 'div', 'h5p-concordances-papijo-results-host');
    container.appendChild(resultsHost);
    return {element: container, categorySelect, categorySummary, progress, setHost, answerSelect, feedback, announcement, sequenceEnd, resultsHost};
  }

  return Object.freeze({renderSet, revealSet, renderDiagnostics, categoryLabel, renderResults, populateAnswers, renderSelectionControls});
});
