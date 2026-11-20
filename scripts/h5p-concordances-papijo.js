/* global H5P */

H5P.ConcordancesPapiJo = (function (Question, $, utilities, sessionModel, stateModel, renderer) {
  'use strict';

  const DEFAULT_TEXT = {
    placeholderTitle: 'Concordances Papi Jo',
    foundationMessage: 'Select the word or expression that completes each concordance Set.',
    selectCategory: 'Select a category',
    allCategories: 'All categories',
    uncategorized: 'Uncategorized',
    selectedCategory: 'Category: @category',
    progress: 'Set @current of @total',
    answerLabel: 'Concordance word',
    selectAnswer: 'Select a word or expression',
    check: 'Check',
    next: 'Next',
    retry: 'Retry activity',
    sequenceEnd: 'You have reached the end of this sequence.',
    correct: 'Correct',
    incorrect: 'Incorrect',
    runtimeError: 'Checking is unavailable. Please reload the activity.',
    resultsTitle: 'Results',
    totalScore: 'Final score: @score/@max',
    resultSet: 'Set',
    resultWord: 'Word',
    resultAttempts: 'Attempts',
    resultPoints: 'Score',
    attemptSingular: '@count attempt',
    attemptPlural: '@count attempts',
    setLabel: 'Set @set',
    invalidContentTitle: 'Content needs correction',
    invalidContentDescription: 'The activity is unavailable. The author must correct the following problems.'
  };
  const DEFAULT_A11Y = {
    missingWord: 'missing word',
    correctAnswer: 'Correct. The missing word is @word.',
    incorrectAnswer: 'Incorrect. Try again.',
    kwicRegion: 'Concordance context. Scroll horizontally to read long lines.',
    contextAlternative: 'Concordance context in reading order'
  };
  const DEFAULT_VALIDATION = {
    automaticMissingTarget: 'Set @set, line @line: No safely matched target word. Automatic gaps require a matching occurrence on every nonempty line and grapheme segmentation support.',
    automaticManualGap: 'Set @set, line @line: Underscore gaps are unsupported. Paste the original target word.',
    ambiguousLancsBox: 'Set @set, line @line: Ambiguous tabular input; NODE must contain a safe match for the target word. Use LEFT, NODE and RIGHT columns only.',
    malformedLancsBox: 'Set @set, line @line: Malformed LancsBox row; expected LEFT, NODE and RIGHT in exactly three tab-separated fields.',
    mixedContextFormats: 'Set @set, line @line: Do not mix ordinary KWIC lines and LancsBox rows in one Context.',
    noSets: 'At least one Set is required.',
    missingWord: 'Set @set: A correct word is required.',
    missingContext: 'Set @set: Context is required.',
    duplicateWord: 'Sets @sets use the same correct word after Unicode normalization, surrounding-whitespace trimming and case-insensitive comparison.'
  };
  let instanceCount = 0;

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function withDefaults(value, defaults) {
    const result = isRecord(value) ? {...value} : {};
    Object.keys(defaults).forEach((key) => {
      if (typeof result[key] !== 'string' || result[key].trim().length === 0) {
        result[key] = defaults[key];
      }
    });
    return result;
  }

  // Question/Components treats button labels as HTML, so escape localized text at
  // this boundary. All our other authored/localized output uses DOM textContent.
  function buttonText(value) {
    return value.replace(/[&<>"']/g, (character) =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[character]);
  }

  /**
   * Create the standalone activity with scoring, restoration and completed reporting.
   * @param {object} params Content parameters.
   * @param {number|string} contentId H5P content identifier.
   * @param {object} contentData Host metadata; compatible previousState is restored at first registration.
   */
  function ConcordancesPapiJo(params, contentId, contentData) {
    Question.call(this, 'concordances-papijo', { theme: true });

    const source = isRecord(params) ? params : {};
    const activity = isRecord(source.activity) ? source.activity : {};
    const behaviour = isRecord(source.behaviour) ? source.behaviour : {};

    this.contentId = contentId;
    this.contentData = isRecord(contentData) ? contentData : {};
    this.params = {
      ...source,
      activity: {
        ...activity,
        title: typeof activity.title === 'string' ? activity.title : '',
        introduction: typeof activity.introduction === 'string' ? activity.introduction : '',
        enableCategories: activity.enableCategories === true,
        // Contexts and Set records are deliberately left untouched.
        sets: Array.isArray(activity.sets) ? activity.sets.slice() : []
      },
      behaviour: {
        ...behaviour,
        enableRetry: typeof behaviour.enableRetry === 'boolean' ? behaviour.enableRetry : true,
        enableSolutionsButton: behaviour.enableSolutionsButton === true
      },
      l10n: withDefaults(source.l10n, DEFAULT_TEXT),
      a11y: withDefaults(source.a11y, DEFAULT_A11Y),
      validation: withDefaults(source.validation, DEFAULT_VALIDATION)
    };

    // DOM labels only; these are not authored Set identities or saved-state IDs.
    this.domId = 'h5p-concordances-papijo-' + (++instanceCount);
    this.domRegistered = false;
    this.selectionSession = null;
    this.completionEmitted = false;
    this.on('domChanged', (event) => {
      // Question emits this after attaching sections. Do not echo resize events.
      if (event.data && event.data.library === 'H5P.ConcordancesPapiJo') {
        // Question 1.5 exposes addButton but no public disabled-state setter.
        // Capture only our button in this instance's attached container.
        const target = event.data.$target && event.data.$target[0];
        if (target) {
          this.checkButton = target.querySelector('.' + this.domId + '-check');
          const next = target.querySelector('.' + this.domId + '-next');
          if (next && next !== this.nextButton) {
            // Suppress the second click of a native double-click, even when the
            // following Set was already solved through another category.
            next.addEventListener('click', (event) => {
              if (event.detail > 1) {
                event.preventDefault();
                event.stopImmediatePropagation();
              }
            }, true);
            this.nextButton = next;
          }
        }
        this.updateCheckButton();
        this.trigger('resize');
      }
    });
  }

  ConcordancesPapiJo.prototype = Object.create(Question.prototype);
  ConcordancesPapiJo.prototype.constructor = ConcordancesPapiJo;

  /** Validate every Set before registering any KWIC text with the Question shell. */
  ConcordancesPapiJo.prototype.registerDomElements = function () {
    if (this.domRegistered) {
      return;
    }

    const $content = $('<div>', { class: 'h5p-concordances-papijo-preview' });
    const document = $content[0].ownerDocument;
    $('<h2>', { class: 'h5p-concordances-papijo-title' })
      .text(this.getTitle())
      .appendTo($content);
    $('<p>', { class: 'h5p-concordances-papijo-notice', role: 'note' })
      .text(this.params.l10n.foundationMessage)
      .appendTo($content);

    this.validationErrors = utilities.validateSets(this.params.activity.sets);
    if (this.validationErrors.length > 0) {
      $content[0].appendChild(renderer.renderDiagnostics(document, this.validationErrors, {
        headingId: this.domId + '-invalid',
        l10n: this.params.l10n,
        validation: this.params.validation
      }));
    }
    else {
      // Read once at initial registration. Invalid or inaccessible host data starts clean.
      try { this.selectionSession = stateModel.restoreSession(this.params.activity, this.contentData.previousState); }
      catch (error) { this.selectionSession = null; }
      if (!this.selectionSession) this.selectionSession = sessionModel.createSelectionSession(this.params.activity);
      this.completionEmitted = this.selectionSession.allSolved;
      this.selectionElements = renderer.renderSelectionControls(document, this.selectionSession, {
        domId: this.domId, enableCategories: this.params.activity.enableCategories, l10n: this.params.l10n
      });
      $content[0].appendChild(this.selectionElements.element);
      const {categorySelect, answerSelect} = this.selectionElements;
      if (categorySelect) {
        categorySelect.addEventListener('change', () => {
          if (this.selectionSession.categoryLocked) {
            categorySelect.value = this.selectionSession.categoryId;
            return;
          }
          const previous = this.selectionSession.displayedSetIndex;
          this.selectionSession.selectCategory(categorySelect.value);
          this.refreshSelection(previous !== this.selectionSession.displayedSetIndex);
          this.trigger('resize');
        });
      }
      answerSelect.addEventListener('change', () => {
        this.selectionSession.selectAnswer(answerSelect.value);
        this.refreshSelection();
      });
      this.addButton('check-answer', buttonText(this.params.l10n.check), () => this.checkAnswer(), true, {
        disabled: true, classes: this.domId + '-check',
        'aria-label': buttonText(this.params.l10n.check)
      });
      this.addButton('next-set', buttonText(this.params.l10n.next), () => this.nextSet(), true, {
        disabled: true, classes: this.domId + '-next',
        'aria-label': buttonText(this.params.l10n.next)
      });
      if (this.params.behaviour.enableRetry) {
        // Question has no automatic reset callback: the content type supplies it.
        this.addButton('try-again', buttonText(this.params.l10n.retry), () => this.retry(), false, {
          classes: this.domId + '-retry', 'aria-label': buttonText(this.params.l10n.retry)
        });
      }
      this.refreshSelection();
    }
    if (this.params.activity.introduction.length > 0) {
      this.setIntroduction($('<p>', { class: 'h5p-concordances-papijo-introduction' })
        .text(this.params.activity.introduction));
    }

    this.setContent($content);
    this.domRegistered = true;
  };

  /** Refresh descriptions/input state without reshuffling or rebuilding controls. */
  ConcordancesPapiJo.prototype.refreshSelection = function (focusAnswer = false) {
    if (!this.selectionSession || !this.selectionElements) return;
    const session = this.selectionSession;
    const controls = this.selectionElements;
    if (controls.categorySelect) {
      controls.categorySelect.value = session.categoryId;
      controls.categorySelect.disabled = session.categoryLocked;
      const category = session.categories.find((entry) => entry.id === session.categoryId);
      controls.categorySummary.textContent = this.params.l10n.selectedCategory.replace(/@category\b/g,
        () => renderer.categoryLabel(category, this.params.l10n));
    }
    controls.progress.textContent = this.params.l10n.progress.replace(/@(current|total)\b/g, (placeholder, key) =>
      key === 'current' ? String(session.currentPosition + 1) : String(session.eligibleSetIndices.length));
    if (this.displayedSetIndex !== session.displayedSetIndex) {
      const index = session.displayedSetIndex;
      const view = renderer.renderSet(controls.setHost.ownerDocument, this.params.activity.sets[index], {
        headingId: this.domId + '-set-' + (index + 1),
        label: this.params.l10n.setLabel.replace(/@set\b/g, String(session.currentPosition + 1)),
        a11y: this.params.a11y, decodeEditorText: true
      });
      controls.setHost.replaceChildren(view.element);
      this.setView = view;
      this.displayedSetIndex = index;
    }
    // The same Set may occupy a different position after filtering.
    this.setView.heading.textContent = this.params.l10n.setLabel.replace(/@set\b/g,
      String(session.currentPosition + 1));
    this.setView.scroll.setAttribute('aria-describedby', controls.progress.id);
    const state = session.getSetState();
    if (state?.correct) renderer.revealSet(this.setView, this.params.activity.sets[session.displayedSetIndex].word);
    controls.answerSelect.value = session.selectedAnswerIndex === null ? '' : String(session.selectedAnswerIndex);
    controls.answerSelect.disabled = Boolean(state?.correct || this.checkFailed);
    controls.feedback.textContent = this.checkFailed ? this.params.l10n.runtimeError
      : state?.feedback ? this.params.l10n[state.feedback] : '';
    // Refresh/reattachment/category restoration never announces historical feedback.
    controls.announcement.textContent = '';
    controls.sequenceEnd.textContent = session.atSequenceEnd ? this.params.l10n.sequenceEnd : '';
    controls.sequenceEnd.hidden = !session.atSequenceEnd;
    if (session.allSolved && !this.resultsView) {
      this.resultsView = renderer.renderResults(controls.resultsHost.ownerDocument, session.getResults(), {
        domId: this.domId, l10n: this.params.l10n, score: session.getScore(), maxScore: session.getMaxScore()
      });
      controls.resultsHost.appendChild(this.resultsView);
    }
    this.updateCheckButton();
    // Only a user category change to a different Set moves focus; reattachment does not.
    if (focusAnswer) (state?.correct ? this.setView.scroll : controls.answerSelect).focus();
  };

  ConcordancesPapiJo.prototype.updateCheckButton = function () {
    const disabled = Boolean(this.checkFailed || this.checkProcessing || this.retryProcessing || !this.selectionSession?.canCheck());
    if (this.checkButton) {
      this.checkButton.disabled = disabled;
      this.checkButton.setAttribute('aria-disabled', String(disabled));
    }
    if (this.nextButton) {
      const session = this.selectionSession;
      const nextDisabled = Boolean(this.checkFailed || this.checkProcessing || this.retryProcessing || this.navigationProcessing || !session?.canAdvance());
      this.nextButton.disabled = nextDisabled;
      this.nextButton.setAttribute('aria-disabled', String(nextDisabled));
      if (session.currentPosition >= session.eligibleSetIndices.length - 1) this.hideButton('next-set');
      else this.showButton('next-set');
    }
    if (this.params.behaviour.enableRetry && this.selectionSession) {
      if (this.canRetry()) this.showButton('try-again');
      else this.hideButton('try-again');
    }
  };

  ConcordancesPapiJo.prototype.canRetry = function () {
    return Boolean(this.params.behaviour.enableRetry && this.selectionSession?.allSolved && this.resultsView &&
      !this.checkFailed && !this.checkProcessing && !this.navigationProcessing && !this.retryProcessing);
  };

  /** Internal reset implementation, independent of button availability/focus. */
  ConcordancesPapiJo.prototype._resetAttempt = function () {
    if (!this.selectionSession || !this.selectionElements) return false;
    const fresh = sessionModel.createSelectionSession(this.params.activity);
    this.selectionSession = fresh;
    this.completionEmitted = false;
    this.checkFailed = false;
    this.checkProcessing = false;
    this.navigationProcessing = false;
    this.resultsView = null;
    this.selectionElements.resultsHost.replaceChildren();
    // Force a blank KWIC view even if the new shuffle starts with the same Set.
    this.displayedSetIndex = null;
    renderer.populateAnswers(this.selectionElements.answerSelect, fresh.answers, this.params.l10n);
    this.refreshSelection();
    return true;
  };

  /** Standalone activation only; no parent resetTask contract is exposed. */
  ConcordancesPapiJo.prototype.retry = function () {
    if (!this.canRetry()) return;
    this.retryProcessing = true;
    try {
      if (this._resetAttempt()) {
        const controls = this.selectionElements;
        (controls.categorySelect || controls.answerSelect).focus();
        this.trigger('resize');
      }
    }
    finally {
      this.retryProcessing = false;
      this.updateCheckButton();
    }
  };

  /** Advance once, then let focus settle before accepting another activation. */
  ConcordancesPapiJo.prototype.nextSet = function () {
    if (this.checkFailed || this.checkProcessing || this.retryProcessing || this.navigationProcessing || !this.selectionSession?.canAdvance()) return;
    this.navigationProcessing = true;
    try {
      if (this.selectionSession.advance(this.displayedSetIndex)) {
        this.refreshSelection(true);
        this.trigger('resize');
      }
    }
    finally {
      // Coalesce repeated callbacks in one turn; native multi-clicks are filtered
      // at the button. Later deliberate activations can pass already solved Sets.
      Promise.resolve().then(() => {
        this.navigationProcessing = false;
        this.updateCheckButton();
      });
    }
  };

  /** One guarded submission; only the live transition into results reports completion. */
  ConcordancesPapiJo.prototype.checkAnswer = function () {
    if (this.checkFailed || this.checkProcessing || this.retryProcessing || !this.selectionSession?.canCheck()) return;
    this.checkProcessing = true;
    this.updateCheckButton();
    try {
      const result = this.selectionSession.checkAnswer();
      if (!result) return;
      this.refreshSelection();
      const message = result.correct ? this.params.a11y.correctAnswer.replace(/@word\b/g,
        () => utilities.decodeEditorText(this.params.activity.sets[this.selectionSession.displayedSetIndex].word))
        : this.params.a11y.incorrectAnswer;
      (result.correct ? this.setView.scroll : this.selectionElements.answerSelect).focus();
      this.selectionElements.announcement.textContent = message + (this.selectionSession.atSequenceEnd
        ? ' ' + this.params.l10n.sequenceEnd : '');
    }
    catch (error) {
      // Keep unexpected internal failures inert and expose only localized text.
      this.checkFailed = true;
      const controls = this.selectionElements;
      controls.answerSelect.disabled = true;
      controls.feedback.textContent = this.params.l10n.runtimeError;
      this.setView?.scroll.focus();
      controls.announcement.textContent = this.params.l10n.runtimeError;
    }
    finally {
      this.checkProcessing = false;
      this.updateCheckButton();
      this.trigger('resize');
    }
    if (!this.checkFailed && this.resultsView && this.selectionSession.allSolved) this._reportCompletion();
  };

  /** One standalone completed statement per attempt; reporting cannot alter the UI. */
  ConcordancesPapiJo.prototype._reportCompletion = function () {
    if (this.completionEmitted || !this.selectionSession?.allSolved || !this.resultsView) return;
    this.completionEmitted = true;
    try {
      const event = this.createXAPIEventTemplate('completed');
      const raw = this.getScore(), max = this.getMaxScore();
      event.setScoredResult(raw, max, this, true, true);
      // No persisted attempt timer exists, so omit Core's page-lifecycle duration.
      delete event.data.statement.result.duration;
      // Core rounds to four decimals; retain the agreed exact raw/max ratio.
      if (max > 0) event.data.statement.result.score.scaled = raw / max;
      const definition = event.data.statement.object.definition;
      definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
      definition.interactionType = 'other';
      if (!definition.name) definition.name = {'en-US': this.getTitle()};
      this.trigger(event);
    }
    catch (error) {
      // Host reporting/listener failures must not change feedback, focus or attempts.
      // This guard is deliberately not a transport-delivery/retry mechanism.
    }
  };

  ConcordancesPapiJo.prototype.getTitle = function () {
    return this.params.activity.title || this.params.l10n.placeholderTitle;
  };

  /** H5P Question score contract: integer internal units, not completion. */
  ConcordancesPapiJo.prototype.getScore = function () {
    return this.selectionSession?.getScore() ?? 0;
  };

  ConcordancesPapiJo.prototype.getMaxScore = function () {
    return this.selectionSession?.getMaxScore() ?? 0;
  };

  /** Container answer-given contract remains deferred; standalone completion uses xAPI. */
  ConcordancesPapiJo.prototype.getAnswerGiven = function () {
    return false;
  };

  /** Serialize the current live attempt, including restored interaction state. */
  ConcordancesPapiJo.prototype.getCurrentState = function () {
    return stateModel.createState(this.params.activity, this.selectionSession);
  };

  return ConcordancesPapiJo;
})(H5P.Question, H5P.jQuery, H5P.ConcordancesPapiJoUtils,
  H5P.ConcordancesPapiJoSession, H5P.ConcordancesPapiJoState, H5P.ConcordancesPapiJoRenderer);
