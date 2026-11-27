/* global H5P */

H5P.ConcordancesPapiJo = (function (Question, $, utilities, sessionModel, stateModel, renderer) {
  'use strict';

  const DEFAULT_TEXT = {
    modeLabel: 'Answer mode',
    selectWord: 'Select word',
    typeWord: 'Type word',
    start: 'Start',
    hintAvailable: 'Hint available',
    hintAfterRequest: 'Submit an answer with a longer correct prefix to unlock the next hint. At zero points, make a new scored submission.',
    hintRevealed: 'Letter hint: @hint',
    hintDescription: 'Each underscore represents an unrevealed letter.',
    hintLockedWarnings: 'Hint locked: make two scored incorrect attempts or use all free spelling warnings for this Set.',
    hintLocked: 'Hint locked: make two scored incorrect attempts.',
    hint: 'Hint',
    placeholderTitle: 'Concordances Papi Jo',
    spellingWarningsExhausted: 'Incorrect — You have used all your free spelling warnings.',
    spellingWarningAnswer: 'Check your spelling: @answer',
    spellingWarning: 'Check your spelling. Change your answer and try again. This warning does not cost an attempt.',
    typedInstruction: 'Type the word or expression that completes each concordance Set.',
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
    viewResults: 'View results',
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
    missingLetter: 'A letter is missing.',
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
  // this boundary. Task description HTML is validated by H5P Core using semantics;
  // all other authored/localized output uses DOM textContent.
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

    this.learnerChoice = behaviour.answerMode === 'learner';
    this.authoredBehaviour = {...behaviour};
    this.choice = {mode: 'dropdown', categoryId: 'all'};
    this.viewListeners = [];
    this.contentId = contentId;
    this.contentData = isRecord(contentData) ? contentData : {};
    this.isTask = true;
    this.params = {
      ...source,
      activity: {
        ...activity,
        title: typeof activity.title === 'string' ? activity.title : '',
        introduction: typeof activity.introduction === 'string' ? activity.introduction : '',
        enableCategories: activity.enableCategories === true,
        // Bridge the editor location; keep legacy activity values and state domains.
        setOrder: ['shuffle', 'author'].includes(behaviour.setOrder) ? behaviour.setOrder : activity.setOrder,
        // Contexts and Set records are deliberately left untouched.
        sets: Array.isArray(activity.sets) ? activity.sets.slice() : []
      },
      behaviour: {
        ...behaviour,
        answerMode: utilities.resolveAnswerMode(behaviour),
        typedPenalty: utilities.resolveTypedPenalty(behaviour),
        spellingErrorBehaviour: utilities.resolveSpellingPolicy(behaviour),
        freeSpellingWarnings: utilities.resolveWarningAllowance(behaviour),
        enableProgressiveHints: behaviour.enableProgressiveHints === true,
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
    this.resultsPageVisible = false;
    this.on('resize', () => this.kwicLayout?.update());
    this.on('domChanged', (event) => {
      // Question emits this after attaching sections. Do not echo resize events.
      if (event.data && event.data.library === 'H5P.ConcordancesPapiJo') {
        if (this.destroyed) return;
        const target = event.data.$target && event.data.$target[0];
        if (target) {
          // Ignore another instance's bubbled attachment event.
          if (!this.instruction || !target.contains(this.instruction[0])) return;
          this.watchQuestionButtons(target);
        }
        this.updateCheckButton();
        this.trigger('resize');
      }
    });
  }

  ConcordancesPapiJo.prototype = Object.create(Question.prototype);
  ConcordancesPapiJo.prototype.constructor = ConcordancesPapiJo;

  /** Question detaches hidden buttons and reinserts them without domChanged. */
  ConcordancesPapiJo.prototype.watchQuestionButtons = function (target) {
    if (this.buttonRoot !== target) {
      this.stopWatchingButtons();
      this.buttonRoot = target;
      const Observer = target.ownerDocument.defaultView?.MutationObserver || globalThis.MutationObserver;
      if (Observer) {
        const observer = new Observer(() => {
          if (this.destroyed || this.buttonObserver !== observer || this.buttonRoot !== target) return;
          this.synchronizeButtonStates();
        });
        this.buttonObserver = observer;
        // Child lists only: disabled/ARIA writes cannot retrigger this observer.
        observer.observe(target, {childList: true, subtree: true});
      }
    }
    this.syncQuestionButtons();
  };

  ConcordancesPapiJo.prototype.stopWatchingButtons = function () {
    this.buttonObserver?.disconnect();
    this.buttonObserver = null;
    this.buttonRoot = null;
    if (this.nextGuardButton) this.nextGuardButton.removeEventListener('click', this.nextClickGuard, true);
    this.nextGuardButton = null;
    this.checkButton = this.hintButton = this.nextButton = null;
  };

  ConcordancesPapiJo.prototype.syncQuestionButtons = function () {
    const root = this.buttonRoot;
    if (!root || this.destroyed) return false;
    let changed = false;
    for (const [property, suffix] of [['checkButton', 'check'], ['hintButton', 'hint'], ['nextButton', 'next']]) {
      const className = this.domId + '-' + suffix;
      const current = this[property];
      const owned = current && current.ownerDocument === root.ownerDocument &&
        (current.getAttribute('class') || '').split(/\s+/).includes(className) &&
        !(current.isConnected && !root.contains(current));
      const button = root.querySelector('.' + className) || (owned ? current : null);
      if (button === current) continue;
      this[property] = button;
      changed = true;
      if (property === 'nextButton') {
        if (this.nextGuardButton) this.nextGuardButton.removeEventListener('click', this.nextClickGuard, true);
        this.nextGuardButton = button;
        this.nextClickGuard ||= event => {
          if (event.detail > 1) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        };
        button?.addEventListener('click', this.nextClickGuard, true);
      }
    }
    return changed;
  };

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
    if (this.params.activity.introduction.length > 0) {
      // H5P Core sanitizes this HTML field according to semantics.json before runtime.
      // Keep it outside the replaceable attempt host and Question's introduction
      // wrapper so normal theme typography and authored formatting can inherit.
      $('<div>', { class: 'h5p-concordances-papijo-introduction', id: this.domId + '-introduction' })
        .html(this.params.activity.introduction)
        .appendTo($content);
    }
    this.instruction = $('<p>', { class: 'h5p-concordances-papijo-notice', role: 'note' })
      .text(this.params.behaviour.answerMode === 'typed' ? this.params.l10n.typedInstruction : this.params.l10n.foundationMessage)
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
      // Read host state once; learner envelopes resolve the mode before restoration.
      try {
        const previousState = this.contentData.previousState;
        if (this.learnerChoice) {
          const restored = stateModel.restoreLearnerState(this.params.activity, this.authoredBehaviour, previousState);
          if (restored) {
            this.choice = restored.choice;
            this.selectionSession = restored.session;
            this.resultsPageVisible = restored.page;
            this.resolveChoiceBehaviour();
          }
        }
        else {
          this.selectionSession = stateModel.restoreSession(this.params.activity, previousState, this.params.behaviour);
          this.resultsPageVisible = Boolean(this.selectionSession &&
            stateModel.validateState(this.params.activity, previousState, this.params.behaviour).resultsPageVisible);
        }
      }
      catch (error) { this.selectionSession = null; this.resultsPageVisible = false; }
      if (!this.learnerChoice && !this.selectionSession) this.selectionSession = this.createAttemptSession();
      this.completionEmitted = Boolean(this.selectionSession?.allSolved);
      this.attemptHost = document.createElement('div');
      $content[0].appendChild(this.attemptHost);
      this.registerAttemptButtons();
      if (this.learnerChoice && !this.selectionSession) this.showChoice();
      else this.mountAttempt();
    }
    this.setContent($content);
    this.domRegistered = true;
  };

  ConcordancesPapiJo.prototype.registerAttemptButtons = function () {
    this.addButton('check-answer', buttonText(this.params.l10n.check), () => this.checkAnswer(), true, {
      disabled: true, classes: this.domId + '-check',
      'aria-label': buttonText(this.params.l10n.check)
    });
    if (this.params.behaviour.enableProgressiveHints && (this.learnerChoice || this.params.behaviour.answerMode === 'typed')) {
      // Always inert in 3a; unlocking displays a status, never a no-op action.
      this.addButton('letter-hint', buttonText(this.params.l10n.hint), () => this.requestHint(), true, {
        disabled: true, classes: this.domId + '-hint', 'aria-label': buttonText(this.params.l10n.hint)
      });
    }
    this.addButton('next-set', buttonText(this.params.l10n.next), () => this.nextSet(), true, {
      disabled: true, classes: this.domId + '-next',
      'aria-label': buttonText(this.params.l10n.next)
    });
    this.addButton('view-results', buttonText(this.params.l10n.viewResults), () => this.viewResults(), false, {
      'aria-label': buttonText(this.params.l10n.viewResults)
    });
    if (this.params.behaviour.enableRetry) {
      // Question has no automatic reset callback: the content type supplies it.
      this.addButton('try-again', buttonText(this.params.l10n.retry), () => this.retry(), false, {
        classes: this.domId + '-retry', 'aria-label': buttonText(this.params.l10n.retry)
      });
    }
  };

  ConcordancesPapiJo.prototype.listenView = function (target, name, handler) {
    target.addEventListener(name, handler);
    this.viewListeners.push([target, name, handler]);
  };

  ConcordancesPapiJo.prototype.disposeView = function () {
    this.kwicLayout?.disconnect();
    this.kwicLayout = null;
    this.viewListeners.forEach(([target, name, handler]) => target.removeEventListener(name, handler));
    this.viewListeners = [];
    this.setupElements = null;
    this.selectionElements = null;
    this.setView = null;
    this.displayedSetIndex = null;
    this.attemptHost?.replaceChildren();
  };

  ConcordancesPapiJo.prototype.resolveChoiceBehaviour = function () {
    this.params.behaviour = {...this.params.behaviour,
      ...stateModel.effectiveBehaviour(this.authoredBehaviour, this.choice.mode),
      enableRetry: this.authoredBehaviour.enableRetry !== false};
  };

  ConcordancesPapiJo.prototype.createAttemptSession = function () {
    const b = this.params.behaviour;
    return sessionModel.createSelectionSession(this.params.activity, undefined, null, b.answerMode,
      b.typedPenalty, b.spellingErrorBehaviour, b.freeSpellingWarnings, b.enableProgressiveHints);
  };

  ConcordancesPapiJo.prototype.showChoice = function () {
    this.disposeView();
    this.instruction[0].hidden = true;
    const view = renderer.renderModeChoice(this.attemptHost.ownerDocument, {
      domId: this.domId, l10n: this.params.l10n, choice: this.choice,
      createStartButton: typeof H5P.Components?.Button === 'function' ? label => H5P.Components.Button({
        label: buttonText(label), ariaLabel: buttonText(label), buttonType: 'button',
        classes: 'h5p-concordances-papijo-start'
      }) : null,
      categories: stateModel.choiceCategories(this.params.activity), enableCategories: this.params.activity.enableCategories
    });
    this.setupElements = view;
    this.attemptHost.appendChild(view.element);
    this.listenView(view.modeSelect, 'change', () => { this.choice.mode = view.modeSelect.value; });
    if (view.categorySelect) this.listenView(view.categorySelect, 'change', () => {
      this.choice.categoryId = view.categorySelect.value;
    });
    this.listenView(view.startButton, 'click', event => {
      event.preventDefault();
      if (event.detail > 1) return;
      this.startActivity();
    });
    this.updateCheckButton();
  };

  ConcordancesPapiJo.prototype.startActivity = function () {
    if (!this.learnerChoice || this.selectionSession || !this.setupElements || this.startProcessing) return;
    if (!['dropdown', 'typed'].includes(this.choice.mode) ||
      !stateModel.choiceCategories(this.params.activity).some(category => category.id === this.choice.categoryId)) return;
    this.startProcessing = true;
    try {
      this.resolveChoiceBehaviour();
      this.selectionSession = this.createAttemptSession();
      this.selectionSession.selectCategory(this.choice.categoryId);
      this.mountAttempt();
      this.selectionElements.answerControl.focus();
      this.trigger('resize');
    }
    finally { this.startProcessing = false; }
  };

  ConcordancesPapiJo.prototype.mountAttempt = function () {
    this.disposeView();
    const document = this.attemptHost.ownerDocument;
    this.instruction.text(this.params.behaviour.answerMode === 'typed'
      ? this.params.l10n.typedInstruction : this.params.l10n.foundationMessage);
    this.selectionElements = renderer.renderSelectionControls(document, this.selectionSession, {
      domId: this.domId, enableHints: this.params.behaviour.answerMode === 'typed' && this.params.behaviour.enableProgressiveHints, enableCategories: this.params.activity.enableCategories, categoryFinalized: this.learnerChoice, l10n: this.params.l10n
    });
    this.attemptHost.replaceChildren(this.selectionElements.element);
    const {categorySelect, answerSelect} = this.selectionElements;
    if (categorySelect) {
      this.listenView(categorySelect, 'change', () => {
        if (this.learnerChoice || this.selectionSession.categoryLocked) {
          categorySelect.value = this.selectionSession.categoryId;
          return;
        }
        const previous = this.selectionSession.displayedSetIndex;
        this.selectionSession.selectCategory(categorySelect.value);
        this.refreshSelection(previous !== this.selectionSession.displayedSetIndex);
        this.trigger('resize');
      });
    }
    if (this.params.behaviour.answerMode === 'typed') {
      this.listenView(answerSelect, 'input', () => {
        this.selectionSession.setTypedAnswer(answerSelect.value);
        this.refreshSelection();
      });
      this.listenView(answerSelect, 'compositionstart', () => { this.answerComposing = true; });
      this.listenView(answerSelect, 'compositionend', () => { this.answerComposing = false; });
      this.listenView(answerSelect, 'keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (event.repeat || event.isComposing || event.keyCode === 229 || this.answerComposing) return;
        this.checkAnswer();
      });
    }
    else this.listenView(answerSelect, 'change', () => {
      this.selectionSession.selectAnswer(answerSelect.value);
      this.refreshSelection();
    });
    this.refreshSelection();
  };

  /** Refresh descriptions/input state without reshuffling or rebuilding controls. */
  ConcordancesPapiJo.prototype.refreshSelection = function (focusAnswer = false) {
    if (!this.selectionSession || !this.selectionElements) return;
    const session = this.selectionSession;
    const controls = this.selectionElements;
    if (controls.categorySelect) {
      controls.categorySelect.value = session.categoryId;
      controls.categorySelect.disabled = this.learnerChoice || session.categoryLocked;
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
      this.kwicLayout?.disconnect();
      controls.setHost.replaceChildren(view.element);
      this.setView = view;
      this.kwicLayout = renderer.observeKwic(view);
      this.displayedSetIndex = index;
    }
    // The same Set may occupy a different position after filtering.
    this.setView.heading.textContent = this.params.l10n.setLabel.replace(/@set\b/g,
      String(session.currentPosition + 1));
    this.setView.scroll.setAttribute('aria-describedby', controls.progress.id);
    const state = session.getSetState();
    if (state?.correct && !this.setView.revealed) {
      renderer.revealSet(this.setView, this.params.activity.sets[session.displayedSetIndex].word);
      this.kwicLayout.update();
    }
    const value = session.answerMode === 'typed' ? state.typedText
      : session.selectedAnswerIndex === null ? '' : String(session.selectedAnswerIndex);
    // Avoid resetting the caret during routine input updates.
    if (controls.answerControl.value !== value) controls.answerControl.value = value;
    controls.answerControl.disabled = Boolean(state?.correct || this.checkFailed);
    controls.feedback.textContent = this.checkFailed ? this.params.l10n.runtimeError
      : this.spellingWarningsExhausted() ? this.params.l10n.spellingWarningsExhausted
      : state?.feedback ? this.params.l10n[state.feedback] : '';
    if (!this.checkFailed && state?.feedback === 'spellingWarning') {
      const warning = renderer.renderSpellingWarning(controls.feedback.ownerDocument, state.typedText,
        utilities.decodeEditorText(this.params.activity.sets[session.displayedSetIndex].word), this.params.l10n.spellingWarningAnswer, this.params.a11y.missingLetter);
      controls.feedback.replaceChildren(warning.element);
      controls.spellingAnnouncement = warning.announcement;
    }
    // Refresh/reattachment/category restoration never announces historical feedback.
    controls.announcement.textContent = '';
    this.instruction[0].hidden = this.resultsPageVisible || this.learnerChoice;
    controls.exercise.hidden = this.resultsPageVisible;
    controls.resultsHost.hidden = !this.resultsPageVisible;
    controls.sequenceEnd.textContent = this.resultsPageVisible ? this.params.l10n.sequenceEnd : '';
    controls.sequenceEnd.hidden = !this.resultsPageVisible;
    if (this.resultsPageVisible && session.allSolved && !this.resultsView) {
      this.resultsView = renderer.renderResults(controls.resultsHost.ownerDocument, session.getResults(), {
        domId: this.domId, l10n: this.params.l10n, score: session.getScore(), maxScore: session.getMaxScore()
      });
      controls.resultsHost.appendChild(this.resultsView);
    }
    this.updateCheckButton();
    // Only a user category change to a different Set moves focus; reattachment does not.
    if (focusAnswer) (state?.correct ? this.setView.scroll : controls.answerControl).focus();
  };

  /** Release layout observation when a host disposes of this activity. */
  ConcordancesPapiJo.prototype.destroy = function () {
    this.destroyed = true;
    this.stopWatchingButtons();
    this.disposeView();
  };

  /** Derived feedback only: no persisted exhaustion flag or changes to checking. */
  ConcordancesPapiJo.prototype.spellingWarningsExhausted = function () {
    const session = this.selectionSession, state = session?.getSetState();
    return Boolean(session?.answerMode === 'typed' && session.spellingPolicy === 'warn' &&
      session.warningAllowance !== 'unlimited' && state?.feedback === 'incorrect' &&
      state.warningCount >= session.warningAllowance &&
      !state.warnedAnswers.includes(utilities.normalizeWord(state.typedText)) &&
      utilities.isMinorSpellingError(state.typedText,
        utilities.decodeEditorText(this.params.activity.sets[session.displayedSetIndex].word)));
  };

  /** Availability and request guards share the session's score/progression model. */
  ConcordancesPapiJo.prototype.getHintAvailability = function () {
    return this.checkFailed ? 'hidden' : this.selectionSession?.hintAvailability() ?? 'hidden';
  };

  ConcordancesPapiJo.prototype.requestHint = function () {
    if (this.checkFailed || this.checkProcessing || this.retryProcessing || this.navigationProcessing ||
      !this.selectionSession?.requestHint()) return;
    this.updateCheckButton();
    this.selectionElements.answerControl.focus();
    this.selectionElements.announcement.textContent = this.selectionElements.hintReveal.textContent + ' ' + this.params.l10n.hintDescription;
    this.trigger('resize');
  };

  ConcordancesPapiJo.prototype.refreshHintControl = function () {
    const status = this.selectionElements?.hintStatus;
    if (!status) return;
    const availability = this.getHintAvailability();
    status.className = 'h5p-concordances-papijo-hint-status h5p-concordances-papijo-sr-only';
    status.hidden = availability === 'hidden';
    status.textContent = availability === 'hidden' ? '' : availability === 'available' ? this.params.l10n.hintAvailable
      : this.selectionSession.getSetState().hintCount ? this.params.l10n.hintAfterRequest
      : this.selectionSession.spellingPolicy === 'warn' && this.selectionSession.warningAllowance !== 'unlimited'
        ? this.params.l10n.hintLockedWarnings : this.params.l10n.hintLocked;
    const pattern = this.selectionSession.getHintText();
    const reveal = this.selectionElements.hintReveal;
    reveal.hidden = !pattern;
    reveal.textContent = pattern ? this.params.l10n.hintRevealed.replace(/@hint\b/g, () => pattern) : '';
  };

  /** Pure button DOM synchronization: never request Question visibility here. */
  ConcordancesPapiJo.prototype.synchronizeButtonStates = function () {
    if (this.destroyed) return;
    this.syncQuestionButtons();
    const session = this.selectionSession;
    if (this.checkButton) {
      const disabled = Boolean(this.checkFailed || this.checkProcessing || this.retryProcessing || !session?.canCheck());
      this.checkButton.disabled = disabled;
      this.checkButton.setAttribute('aria-disabled', String(disabled));
    }
    if (this.nextButton) {
      const disabled = Boolean(this.checkFailed || this.checkProcessing || this.retryProcessing || this.navigationProcessing || !session?.canAdvance());
      this.nextButton.disabled = disabled;
      this.nextButton.setAttribute('aria-disabled', String(disabled));
    }
    if (this.hintButton) {
      const disabled = this.getHintAvailability() !== 'available';
      this.hintButton.disabled = disabled;
      this.hintButton.setAttribute('aria-disabled', String(disabled));
      const status = this.selectionElements?.hintStatus;
      if (status) this.hintButton.setAttribute('aria-describedby', status.id);
    }
  };

  /** Visibility derives from activity state, including when buttons are detached. */
  ConcordancesPapiJo.prototype.updateButtonVisibility = function () {
    if (!this.attemptHost || this.destroyed) return;
    const session = this.selectionSession;
    const exercise = Boolean(session && !this.resultsPageVisible);
    const visible = (id, show) => show ? this.showButton(id) : this.hideButton(id);
    visible('check-answer', exercise);
    visible('next-set', exercise && session.currentPosition < session.eligibleSetIndices.length - 1);
    visible('view-results', exercise && session.allSolved && !this.checkProcessing && !this.retryProcessing && !this.checkFailed);
    if (this.params.behaviour.enableProgressiveHints && (this.learnerChoice || this.params.behaviour.answerMode === 'typed')) {
      visible('letter-hint', exercise && this.selectionElements?.hintStatus && this.getHintAvailability() !== 'hidden');
    }
    if (this.params.behaviour.enableRetry) visible('try-again', this.canRetry());
  };

  /** Normal activity transitions refresh feedback, states and Question visibility. */
  ConcordancesPapiJo.prototype.updateCheckButton = function () {
    if (this.destroyed) return;
    this.refreshHintControl();
    this.synchronizeButtonStates();
    this.updateButtonVisibility();
  };

  ConcordancesPapiJo.prototype.canRetry = function () {
    return Boolean(this.params.behaviour.enableRetry && this.selectionSession?.allSolved && this.resultsPageVisible && this.resultsView &&
      !this.checkFailed && !this.checkProcessing && !this.navigationProcessing && !this.retryProcessing);
  };

  /** Internal reset implementation, independent of button availability/focus. */
  ConcordancesPapiJo.prototype._resetAttempt = function () {
    if (this.learnerChoice && this.attemptHost) {
      this.selectionSession = null;
      this.completionEmitted = false;
      this.checkFailed = this.checkProcessing = this.navigationProcessing = this.answerComposing = false;
      this.resultsPageVisible = false;
      this.resultsView = null;
      this.showChoice();
      return true;
    }
    if (!this.selectionSession || !this.selectionElements) return false;
    const fresh = sessionModel.createSelectionSession(this.params.activity, undefined, null, this.params.behaviour.answerMode, this.params.behaviour.typedPenalty, this.params.behaviour.spellingErrorBehaviour, this.params.behaviour.freeSpellingWarnings, this.params.behaviour.enableProgressiveHints);
    this.selectionSession = fresh;
    this.completionEmitted = false;
    this.checkFailed = false;
    this.checkProcessing = false;
    this.navigationProcessing = false;
    this.resultsPageVisible = false;
    this.resultsView = null;
    this.selectionElements.resultsHost.replaceChildren();
    // Force a blank KWIC view even if the new shuffle starts with the same Set.
    this.displayedSetIndex = null;
    this.answerComposing = false;
    if (fresh.answerMode === 'dropdown') renderer.populateAnswers(this.selectionElements.answerControl, fresh.answers, this.params.l10n);
    this.refreshSelection();
    return true;
  };

  /** Parent reset is independent of learner Retry availability and does not move focus. */
  ConcordancesPapiJo.prototype.resetTask = function () {
    if (!this.domRegistered) {
      this.contentData = {...this.contentData, previousState: {}};
      return;
    }
    if (this._resetAttempt()) this.trigger('resize');
  };

  /** Learner Retry also restores focus to the activity controls. */
  ConcordancesPapiJo.prototype.retry = function () {
    if (!this.canRetry()) return;
    this.retryProcessing = true;
    try {
      if (this._resetAttempt()) {
        const controls = this.selectionElements;
        (this.learnerChoice ? this.setupElements.modeSelect : controls.categorySelect || controls.answerControl).focus();
        this.trigger('resize');
      }
    }
    finally {
      this.retryProcessing = false;
      this.updateCheckButton();
    }
  };

  /** Presentation-only navigation; completion already occurred on submission. */
  ConcordancesPapiJo.prototype.viewResults = function () {
    if (this.resultsPageVisible || !this.selectionSession?.allSolved || this.checkFailed ||
      this.checkProcessing || this.retryProcessing || this.navigationProcessing) return;
    this.resultsPageVisible = true;
    this.refreshSelection();
    this.resultsView.children[0].focus();
    this.trigger('resize');
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

  /** One guarded submission; only the live transition into completion reports completion. */
  ConcordancesPapiJo.prototype.checkAnswer = function () {
    if (this.checkFailed || this.checkProcessing || this.retryProcessing || !this.selectionSession?.canCheck()) return;
    this.checkProcessing = true;
    this.updateCheckButton();
    try {
      const result = this.selectionSession.checkAnswer();
      if (!result) return;
      this.refreshSelection();
      const message = this.spellingWarningsExhausted() ? this.params.l10n.spellingWarningsExhausted : result.warning ? this.selectionElements.spellingAnnouncement : result.correct ? this.params.a11y.correctAnswer.replace(/@word\b/g,
        () => utilities.decodeEditorText(this.params.activity.sets[this.selectionSession.displayedSetIndex].word))
        : this.params.a11y.incorrectAnswer;
      (result.correct ? this.setView.scroll : this.selectionElements.answerControl).focus();
      this.selectionElements.announcement.textContent = message;
    }
    catch (error) {
      // Keep unexpected internal failures inert and expose only localized text.
      this.checkFailed = true;
      const controls = this.selectionElements;
      controls.answerControl.disabled = true;
      controls.feedback.textContent = this.params.l10n.runtimeError;
      this.setView?.scroll.focus();
      controls.announcement.textContent = this.params.l10n.runtimeError;
    }
    finally {
      this.checkProcessing = false;
      this.updateCheckButton();
      this.trigger('resize');
    }
    if (!this.checkFailed && this.selectionSession.allSolved) this._reportCompletion();
  };

  /** One standalone completed statement per attempt; reporting cannot alter the UI. */
  ConcordancesPapiJo.prototype._reportCompletion = function () {
    if (this.completionEmitted || !this.selectionSession?.allSolved) return;
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

  /** H5P Question score contract: numeric points, not completion. */
  ConcordancesPapiJo.prototype.getScore = function () {
    return this.selectionSession?.getScore() ?? 0;
  };

  ConcordancesPapiJo.prototype.getMaxScore = function () {
    if (this.selectionSession) return this.selectionSession.getMaxScore();
    if (!this.learnerChoice || utilities.validateSets(this.params.activity.sets).length) return 0;
    const category = stateModel.choiceCategories(this.params.activity).find(entry => entry.id === this.choice.categoryId);
    if (!category) return 0;
    return 2 * this.params.activity.sets.filter(set => category.type === 'all' ||
      utilities.normalizeWord(set.category) === (category.type === 'named' ? category.key : '')).length;
  };

  /** The selected-category activity is answered once the selected sequence is solved. */
  ConcordancesPapiJo.prototype.getAnswerGiven = function () {
    return Boolean(this.selectionSession?.allSolved);
  };

  /** Serialize the current live attempt, including restored interaction state. */
  ConcordancesPapiJo.prototype.getCurrentState = function () {
    if (this.learnerChoice) return stateModel.createLearnerState(this.params.activity, this.authoredBehaviour,
      this.choice, this.selectionSession, this.resultsPageVisible);
    return stateModel.createState(this.params.activity, this.selectionSession, this.resultsPageVisible);
  };

  return ConcordancesPapiJo;
})(H5P.Question, H5P.jQuery, H5P.ConcordancesPapiJoUtils,
  H5P.ConcordancesPapiJoSession, H5P.ConcordancesPapiJoState, H5P.ConcordancesPapiJoRenderer);
