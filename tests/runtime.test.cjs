'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const {createDocument, findAll} = require('./helpers/dom.cjs');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts/h5p-concordances-papijo.js'), 'utf8');
const semantics = JSON.parse(fs.readFileSync(path.join(root, 'semantics.json'), 'utf8'));

function createHarness(randomDraw = () => 0.999999) {
  const document = createDocument();
  class TextElement {
    constructor(tag, attributes) {
      this[0] = document.createElement(tag.replace(/[<>]/g, ''));
      for (const [name, value] of Object.entries(attributes || {})) this[0].setAttribute(name, value);
      this.tag = tag;
    }

    get children() { return this[0].children; }
    get value() { return this[0].value; }

    text(value) {
      assert.equal(typeof value, 'string');
      this[0].textContent = value;
      return this;
    }

    appendTo(parent) {
      parent[0].appendChild(this[0]);
      return this;
    }

    html() {
      throw new Error('The foundation must not insert authored HTML.');
    }
  }

  function Question(type, options) {
    this.questionType = type;
    this.questionOptions = options;
    this.events = [];
    this.listeners = new Map();
    this.sections = {};
    this.contentRegistrations = 0;
    this.on = (name, handler) => {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(handler);
    };
    this.trigger = (name, data) => {
      if (typeof name === 'object') { data = name.data; name = name.type; }
      this.events.push({ name, data });
      for (const handler of this.listeners.get(name) || []) handler({ data });
    };
    // Double of the inspected Core EventDispatcher/XAPIEvent helper contract.
    this.createXAPIEventTemplate = (verb) => {
      const event = {type: 'xAPI', data: {statement: {
        verb: {id: 'http://adlnet.gov/expapi/verbs/' + verb, display: {'en-US': verb}},
        object: {id: 'https://example.org/content/' + (this.contentId ?? 'preview'), objectType: 'Activity',
          definition: {name: {'en-US': 'Host title'}}}
      }}};
      event.setScoredResult = (raw, max, instance, completion, success) => {
        assert.equal(instance, this);
        event.data.statement.result = {completion, success, duration: 'PT1S', score: {raw, min: 0, max, scaled: Math.round(raw / max * 10000) / 10000}};
      };
      return event;
    };
    this.setContent = (content) => {
      this.sections.content = content;
      this.contentRegistrations++;
    };
    this.setIntroduction = (introduction) => {
      this.sections.introduction = introduction;
    };
    this.buttons = {};
    this.addButton = (id, label, callback, visible, options) => {
      const button = document.createElement('button');
      button.disabled = options.disabled;
      button.hidden = visible === false;
      button.setAttribute('aria-label', options['aria-label']);
      this.buttons[id] = {element: button, callback, label};
      if (id === 'check-answer') this.checkButton = button;
      if (id === 'next-set') this.nextButton = button;
    };
    this.showButton = (id) => { this.buttons[id].element.hidden = false; };
    this.hideButton = (id) => { this.buttons[id].element.hidden = true; };
    this.attach = () => {
      this.registerDomElements();
      this.trigger('domChanged', { library: 'H5P.ConcordancesPapiJo' });
    };
  }

  const H5P = { Question, jQuery: (tag, attributes) => new TextElement(tag, attributes) };
  const random = Object.create(Math);
  random.random = randomDraw;
  const context = vm.createContext({ H5P, Math: random });
  for (const file of ['concordances-utils.js', 'concordances-session.js', 'concordances-state.js', 'concordances-renderer.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'scripts', file), 'utf8'), context, {filename: file});
  }
  vm.runInContext(source, context, { filename: 'h5p-concordances-papijo.js' });
  return { H5P, document, Constructor: H5P.ConcordancesPapiJo };
}

function flattenText(element) {
  return [element.value, ...element.children.flatMap(flattenText)];
}

function submitWord(instance, word) {
  const answer = instance.selectionElements.answerSelect;
  answer.value = String(instance.selectionSession.answers.indexOf(word.trim()));
  answer.dispatchEvent({type: 'change'});
  instance.checkAnswer();
}

async function solveAttempt(instance) {
  const session = instance.selectionSession;
  while (!session.allSolved) {
    submitWord(instance, instance.params.activity.sets[session.displayedSetIndex].word);
    if (!session.allSolved) {
      instance.nextSet();
      await Promise.resolve();
    }
  }
}


const completedStatements = (instance) => instance.events.filter(event=>event.name==='xAPI').map(event=>event.data.statement);

test('ordinary/LancsBox workflows retain categories, partial scores, restoration, xAPI and fresh Retry', async () => {
  for(const tabular of [false,true]) {
    const {Constructor,document}=createHarness();
    const context=(word,n)=>tabular ? ` left \t${word.toUpperCase()}\t right` : `[00${n}] left  ${word.toUpperCase()}  right`;
    const params={activity:{enableCategories:true,distractors:'Wrong',sets:[
      {word:'abstract',category:'A',context:context('abstract',1)},
      {word:'other',category:'A',context:context('other',2)},
      {word:'third',category:'B',context:context('third',3)}
    ]}};
    const original=JSON.stringify(params),activity=new Constructor(params,42,{}); activity.attach();
    const controls=activity.selectionElements;
    controls.categorySelect.value='category-0';controls.categorySelect.dispatchEvent({type:'change'});
    submitWord(activity,'Wrong');assert.equal(controls.categorySelect.disabled,true);
    const wrong=activity.getCurrentState();
    let draws=0;const restoredHarness=createHarness(()=>{draws++;return 0;});
    const restored=new restoredHarness.Constructor(params,42,{previousState:wrong});restored.attach();
    assert.equal(draws,0);assert.equal(restored.selectionElements.feedback.textContent,'Incorrect');
    assert.equal(restored.checkButton.disabled,true);submitWord(restored,'abstract');
    assert.equal(restored.getScore(),1);assert.equal(completedStatements(restored).length,0);
    restored.nextSet();await Promise.resolve();submitWord(restored,'other');
    assert.equal(restored.getScore(),3);assert.equal(restored.getMaxScore(),4);
    assert.equal(completedStatements(restored).length,1);
    assert.equal(completedStatements(restored)[0].result.success,true);
    assert.equal(completedStatements(restored)[0].result.score.raw,3);
    assert.equal(restored.selectionElements.resultsHost.children.length,1);
    assert.ok(!restored.sections.content[0].textContent.includes('hidden.xml'));
    const completed=new Constructor(params,42,{previousState:restored.getCurrentState()});completed.attach();
    assert.equal(completedStatements(completed).length,0);assert.equal(completed.canRetry(),true);
    completed.retry();assert.equal(completed.getScore(),0);assert.equal(completed.getMaxScore(),6);
    assert.equal(completed.selectionSession.categoryLocked,false);assert.equal(completed.selectionElements.resultsHost.children.length,0);
    await solveAttempt(completed);assert.equal(completed.getScore(),6);assert.equal(completedStatements(completed).length,1);
    assert.equal(JSON.stringify(params),original);
  }
});

test('invalid mixed/tabular/manual input blocks the entire interface with Set/line diagnostics',()=>{
 const {Constructor}=createHarness();
 for(const context of ['[001] _____','1\tf.xml\tleft\tabstract','1\tf.xml\tleft\tabstract\tright\n[002] abstract','[001] absent']){
  const activity=new Constructor({activity:{sets:[{word:'abstract',context}]}});activity.attach();
  assert.equal(activity.selectionSession,null);assert.equal(Object.keys(activity.buttons).length,0);
  assert.ok(activity.sections.content[0].textContent.includes('Set 1, line'));
 }
});

test('Word/category escaped punctuation stays safe and retains raw identities',()=>{
 const {Constructor,H5P}=createHarness();
 const params={activity:{enableCategories:true,sets:[{word:'can&#039;t',category:'Teacher&#039;s',context:'[001] CAN&#039;T &lt;tag&gt; &amp;quot;'}]}};
 const activity=new Constructor(params);activity.attach();
 const fingerprint=H5P.ConcordancesPapiJoState.fingerprint(params.activity);
 assert.equal(activity.selectionElements.answerSelect.children[1].textContent,"can't");submitWord(activity,'can&#039;t');
 assert.equal(activity.setView.pre.textContent,"[001] CAN'T <tag> &amp;quot;");
 assert.equal(findAll(activity.resultsView,n=>n.tagName==='TD')[0].textContent,"can't");
 assert.equal(activity.getCurrentState().fingerprint,fingerprint);
 assert.equal(activity.getCurrentState().answerOrder[0],'can&#039;t');
 assert.equal(findAll(activity.sections.content,n=>n.tagName==='TAG').length,0);
});

test('third-attempt zero score still reports successful completion',()=>{
 const {Constructor}=createHarness();const activity=new Constructor({activity:{distractors:'Wrong A\nWrong B',sets:[{word:'One',context:'ONE'}]}});activity.attach();
 submitWord(activity,'Wrong A');submitWord(activity,'Wrong B');submitWord(activity,'One');
 const events=completedStatements(activity);assert.equal(events.length,1);
 assert.equal(events[0].result.score.raw,0);assert.equal(events[0].result.completion,true);assert.equal(events[0].result.success,true);
 activity.refreshSelection();activity.attach();assert.equal(completedStatements(activity).length,1);
});


test('category punctuation decodes once for labels and summary while raw keys and fingerprints stay unchanged', () => {
  const {Constructor,H5P}=createHarness();
  const raw='Teacher&#039;s &quot;class&quot; &lt;img&gt; &amp;quot;';
  const params={activity:{enableCategories:true,sets:[{word:'One',context:'ONE',category:raw}]}};
  const before=JSON.stringify(params), fingerprint=H5P.ConcordancesPapiJoState.fingerprint(params.activity);
  const instance=new Constructor(params);instance.attach();
  const named=instance.selectionSession.categories.find(category=>category.type==='named');
  const expected="Teacher's \"class\" <img> &amp;quot;";
  const option=instance.selectionElements.categorySelect.children.find(node=>node.value===named.id);
  assert.equal(option.textContent,expected);
  instance.selectionSession.selectCategory(named.id);instance.refreshSelection();
  assert.equal(instance.selectionElements.categorySummary.textContent,'Category: '+expected);
  const saved=instance.getCurrentState();
  assert.equal(saved.category[1],H5P.ConcordancesPapiJoUtils.normalizeWord(raw));
  assert.equal(saved.fingerprint,fingerprint);
  assert.equal(JSON.stringify(params),before);
  assert.equal(findAll(instance.sections.content,node=>node.tagName==='IMG').length,0);
});
