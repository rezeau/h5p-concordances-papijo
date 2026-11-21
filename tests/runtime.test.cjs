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
      if (id === 'letter-hint') this.hintButton = button;
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

test('Set order runtime restoration and Retry follow the selected policy', async () => {
  for (const policy of [undefined, 'shuffle', 'author']) {
    let draw = 0;
    const {Constructor} = createHarness(() => draw);
    const params = {behaviour: policy ? {setOrder: policy} : {}, activity: {enableCategories: true, sets: [
      {word: 'One', context: 'One', category: 'A'},
      {word: 'Two', context: 'Two', category: 'B'},
      {word: 'Three', context: 'Three', category: 'A'}
    ]}};
    const instance = new Constructor(params, 42, {});
    instance.attach();
    const expected = policy === 'author' ? [0, 1, 2] : [1, 2, 0];
    assert.deepEqual(Array.from(instance.selectionSession.setOrder), expected);
    instance.selectionElements.categorySelect.value = 'category-0';
    instance.selectionElements.categorySelect.dispatchEvent({type: 'change'});
    await solveAttempt(instance);
    const saved = JSON.parse(JSON.stringify(instance.getCurrentState()));
    const restored = new Constructor(params, 42, {previousState: saved});
    restored.attach();
    assert.deepEqual(Array.from(restored.selectionSession.setOrder), expected);
    assert.equal(restored.canRetry(), true);
    draw = 0.999999;
    restored.retry();
    assert.deepEqual(Array.from(restored.selectionSession.setOrder), [0, 1, 2]);
    assert.deepEqual(Array.from(restored.selectionSession.eligibleSetIndices), [0, 1, 2]);
    assert.equal(restored.selectionSession.categoryId, 'all');
    assert.equal(restored.getScore(), 0);
    await solveAttempt(restored);
    assert.equal(restored.getScore(), 6);
    draw = 0;
    restored.retry();
    assert.deepEqual(Array.from(restored.selectionSession.setOrder), expected);
  }
});

test('Set order editor bridge preserves legacy snapshots and gives explicit behaviour values precedence', () => {
  for (const behaviour of [{}, {answerMode: 'typed'},
    {answerMode: 'typed', spellingErrorBehaviour: 'warn'},
    {answerMode: 'typed', enableProgressiveHints: true}]) {
    for (const policy of ['shuffle', 'author']) {
      const activity = {setOrder: policy, sets: [
        {word: 'One', context: 'One'}, {word: 'Two', context: 'Two'}, {word: 'Three', context: 'Three'}
      ]};
      const legacyParams = {activity, behaviour};
      const originalParams = JSON.stringify(legacyParams);
      const {Constructor} = createHarness(() => 0);
      const legacy = new Constructor(legacyParams, 42, {});
      legacy.attach();
      const saved = JSON.parse(JSON.stringify(legacy.getCurrentState()));
      const {setOrder, ...newActivity} = activity;
      const newParams = {activity: newActivity, behaviour: {...behaviour, setOrder}};
      const fresh = new Constructor(newParams, 42, {});
      fresh.attach();
      assert.deepEqual(JSON.parse(JSON.stringify(fresh.getCurrentState())), saved);
      const noShuffle = createHarness(() => { throw new Error('Accepted restoration must not shuffle'); });
      for (const params of [legacyParams, newParams]) {
        const restored = new noShuffle.Constructor(params, 42, {previousState: saved});
        restored.attach();
        assert.deepEqual(JSON.parse(JSON.stringify(restored.getCurrentState())), saved);
      }
      const preferred = new Constructor({activity: {...activity, setOrder: policy === 'author' ? 'shuffle' : 'author'},
        behaviour: {...behaviour, setOrder: policy}}, 42, {});
      preferred.attach();
      assert.deepEqual(JSON.parse(JSON.stringify(preferred.getCurrentState())), saved);
      assert.equal(JSON.stringify(legacyParams), originalParams);
    }
  }
});

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


function typeAnswer(instance, value) {
  const input=instance.selectionElements.answerControl;
  input.value=value;input.dispatchEvent({type:'input'});
}

test('answer mode defaults preserve missing and explicit dropdown controls, snapshots and fingerprints', () => {
  const {Constructor,H5P}=createHarness();
  const activity={sets:[{word:'One',context:'ONE'}]};
  const snapshots=[];
  for(const behaviour of [undefined,{answerMode:'dropdown'},{answerMode:'unknown'}]) {
    const instance=new Constructor({activity,behaviour});instance.attach();
    assert.equal(instance.params.behaviour.answerMode,'dropdown');
    assert.equal(instance.selectionElements.answerControl.tagName,'SELECT');
    snapshots.push(JSON.stringify(instance.getCurrentState()));
  }
  assert.equal(snapshots[0],snapshots[1]);assert.equal(snapshots[0],snapshots[2]);
  assert.equal(JSON.parse(snapshots[0]).fingerprint,H5P.ConcordancesPapiJoState.fingerprint(activity));
});

test('typed input renders accessible native control, retains raw text and caret without attempts or feedback', () => {
  const {Constructor,document}=createHarness();
  const instance=new Constructor({activity:{distractors:'Stored wrong',sets:[{word:'fresco',context:'frescoed'}]},behaviour:{answerMode:'typed'}});
  instance.attach();const input=instance.selectionElements.answerControl;
  assert.equal(input.tagName,'INPUT');assert.equal(input.getAttribute('type'),'text');
  assert.equal(input.getAttribute('autocomplete'),'off');assert.equal(input.getAttribute('spellcheck'),'false');
  assert.equal(input.children.length,0);assert.equal(instance.selectionSession.answers.length,0);
  assert.ok(findAll(instance.sections.content,node=>node.tagName==='LABEL').some(node=>node.getAttribute('for')===input.id));
  assert.ok(input.getAttribute('aria-describedby'));assert.ok(input.getAttribute('aria-details'));
  input.focus();input.value='frEsco';input.selectionStart=2;input.selectionEnd=4;
  const writes=input.valueWrites;input.dispatchEvent({type:'input'});
  assert.equal(input.valueWrites,writes);assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,4);
  assert.equal(document.activeElement,input);assert.equal(instance.selectionSession.getSetState().typedText,'frEsco');
  assert.equal(instance.selectionSession.getSetState().attempts,0);assert.equal(instance.getScore(),0);
  assert.equal(instance.selectionElements.feedback.textContent,'');assert.equal(instance.selectionElements.announcement.textContent,'');
  assert.equal(instance.checkButton.disabled,false);
  typeAnswer(instance,'  ');assert.equal(instance.checkButton.disabled,true);
  assert.equal(instance.params.activity.distractors,'Stored wrong');
  assert.equal(instance.selectionElements.answerControl,input);instance.attach();assert.equal(instance.selectionElements.answerControl,input);
});

test('typed Enter ignores repeat and IME, prevents form submission and shares guarded Check', () => {
  const {Constructor,document}=createHarness();
  const instance=new Constructor({activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:'typed'}});instance.attach();
  typeAnswer(instance,'fresco');const input=instance.selectionElements.answerControl;
  let prevented=0;
  const enter=(extra={})=>input.dispatchEvent({type:'keydown',key:'Enter',preventDefault(){prevented++;},...extra});
  enter({repeat:true});enter({isComposing:true});enter({keyCode:229});
  input.dispatchEvent({type:'compositionstart'});enter();assert.equal(instance.selectionSession.getSetState().attempts,0);
  input.dispatchEvent({type:'compositionend'});enter();enter();instance.buttons['check-answer'].callback();
  assert.equal(prevented,6);assert.equal(instance.selectionSession.getSetState().attempts,1);
  assert.equal(instance.getScore(),2);assert.equal(instance.setView.pre.textContent,'FRESCOes');
  assert.equal(document.activeElement,instance.setView.scroll);assert.equal(completedStatements(instance).length,1);
});

test('typed incorrect feedback and equivalent-answer gating retain unlimited attempts and zero score', () => {
  const {Constructor,document}=createHarness();const instance=new Constructor({activity:{sets:[{word:'fresco',context:'fresco'}]},behaviour:{answerMode:'typed'}});instance.attach();
  typeAnswer(instance,'frescoes');instance.checkAnswer();
  assert.equal(instance.selectionElements.feedback.textContent,'Incorrect');
  assert.equal(document.activeElement,instance.selectionElements.answerControl);
  typeAnswer(instance,' FRESCOES ');assert.equal(instance.checkButton.disabled,true);instance.checkAnswer();
  assert.equal(instance.selectionSession.getSetState().attempts,1);
  typeAnswer(instance,'frescoed');assert.equal(instance.checkButton.disabled,false);instance.checkAnswer();
  typeAnswer(instance,'Fresco');instance.checkAnswer();
  assert.equal(instance.selectionSession.getSetState().attempts,3);assert.equal(instance.getScore(),0);
  assert.equal(instance.getMaxScore(),2);assert.equal(completedStatements(instance)[0].result.success,true);
});

test('typed categories, Next, final results and Retry reuse shared lifecycle and the same input', async () => {
  const {Constructor,document}=createHarness();
  const instance=new Constructor({activity:{enableCategories:true,sets:[{word:'One',context:'ONE',category:'A'},{word:'Two',context:'TWO',category:'B'}]},behaviour:{answerMode:'typed'}});instance.attach();
  const input=instance.selectionElements.answerControl;
  typeAnswer(instance,'wrong');instance.checkAnswer();typeAnswer(instance,'one');instance.checkAnswer();
  assert.equal(instance.selectionSession.categoryLocked,true);assert.equal(instance.getScore(),1);
  instance.nextSet();await Promise.resolve();assert.equal(instance.selectionElements.answerControl,input);
  assert.equal(input.value,'');assert.equal(document.activeElement,input);
  typeAnswer(instance,'two');instance.checkAnswer();assert.equal(instance.getScore(),3);assert.equal(instance.getMaxScore(),4);
  assert.ok(instance.resultsView);assert.equal(instance.canRetry(),true);
  instance.retry();assert.equal(instance.selectionElements.answerControl,input);assert.equal(input.value,'');
  assert.equal(instance.getScore(),0);assert.equal(instance.selectionSession.categoryLocked,false);
  assert.equal(instance.selectionSession.answers.length,0);assert.equal(instance.resultsView,null);
  assert.equal(document.activeElement,instance.selectionElements.categorySelect);
});

test('typed schema 2 is separate from dropdown schema 1 while dropdown restoration stays available', () => {
  const {Constructor,H5P}=createHarness();const activity={sets:[{word:'One',context:'ONE'}]};
  const dropdown=new Constructor({activity});dropdown.attach();submitWord(dropdown,'One');const saved=dropdown.getCurrentState();
  assert.equal(saved.version,1);
  const typed=new Constructor({activity,behaviour:{answerMode:'typed'}},1,{previousState:saved});typed.attach();
  assert.equal(typed.selectionSession.allSolved,false);typeAnswer(typed,'partial');
  assert.equal(typed.getCurrentState().version,2);
  assert.equal(H5P.ConcordancesPapiJoState.createState(activity,typed.selectionSession).version,2);
  const restored=new Constructor({activity,behaviour:{answerMode:'dropdown'}},1,{previousState:saved});restored.attach();
  assert.equal(restored.selectionSession.allSolved,true);assert.equal(restored.getScore(),2);
  assert.equal(completedStatements(restored).length,0);
});


test('typed restoration retains raw input, feedback, gating, focus and caret without randomness',()=>{
  const {Constructor}=createHarness();const params={activity:{sets:[{word:'One',context:'ONE'}]},behaviour:{answerMode:'typed'}};
  const initial=new Constructor(params);initial.attach();
  const restore=()=>{const {Constructor:C,document}=createHarness(()=>{throw new Error('Unexpected restoration shuffle');});const instance=new C(params,1,{previousState:JSON.parse(JSON.stringify(initial.getCurrentState()))});instance.attach();assert.equal(document.activeElement,undefined);return {instance,document};};
  typeAnswer(initial,' PaRtiAL ');let result=restore();assert.equal(result.instance.selectionElements.answerControl.value,' PaRtiAL ');assert.equal(result.instance.checkButton.disabled,false);
  typeAnswer(initial,'wrong');initial.checkAnswer();typeAnswer(initial,' WRONG ');result=restore();
  assert.equal(result.instance.selectionElements.feedback.textContent,'Incorrect');assert.equal(result.instance.checkButton.disabled,true);
  assert.equal(result.instance.selectionElements.announcement.textContent,'');
  typeAnswer(initial,'different');result=restore();assert.equal(result.instance.checkButton.disabled,false);assert.equal(result.instance.selectionElements.feedback.textContent,'');
  typeAnswer(result.instance,'one');result.instance.checkAnswer();assert.equal(result.document.activeElement,result.instance.setView.scroll);
  assert.equal(result.instance.getScore(),1);assert.equal(result.instance.selectionSession.getSetState().attempts,2);
});

test('typed completed restoration is quiet at 2/1/0 scores and Retry permits one new completed event',()=>{
  for(const wrongs of [0,1,2]){
    const {Constructor}=createHarness();const params={activity:{sets:[{word:'One',context:'ONE'}]},behaviour:{answerMode:'typed'}};
    const live=new Constructor(params);live.attach();for(let i=0;i<wrongs;i++){typeAnswer(live,'wrong'+i);live.checkAnswer();}
    typeAnswer(live,'one');live.checkAnswer();live.attach();live.refreshSelection();
    assert.equal(completedStatements(live).length,1);assert.equal(live.getScore(),2-wrongs);
    assert.equal(completedStatements(live)[0].result.success,true);
    const restored=new Constructor(params,1,{previousState:JSON.parse(JSON.stringify(live.getCurrentState()))});restored.attach();restored.attach();restored.refreshSelection();restored.checkAnswer();
    assert.equal(restored.getScore(),2-wrongs);assert.ok(restored.resultsView);assert.equal(completedStatements(restored).length,0);
    restored.retry();typeAnswer(restored,'one');restored.checkAnswer();restored.refreshSelection();
    assert.equal(completedStatements(restored).length,1);assert.equal(restored.getScore(),2);
  }
});


test('typed penalty defaults, fractional results/xAPI, quiet restoration and Retry keep numeric points',async()=>{
  const {Constructor}=createHarness();
  for(const behaviour of [{answerMode:'typed'},{answerMode:'typed',typedPenalty:'1'},{answerMode:'dropdown',typedPenalty:'0.5'}]){
    const instance=new Constructor({activity:{sets:[{word:'One',context:'ONE'}]},behaviour});instance.attach();assert.equal(instance.selectionSession.typedPenalty,1);
  }
  const params={activity:{sets:[{word:'One',context:'ONE'},{word:'Two',context:'TWO'}]},behaviour:{answerMode:'typed',typedPenalty:'0.5'}};
  const instance=new Constructor(params);instance.attach();
  for(const word of ['one','two']){
    typeAnswer(instance,'wrong');instance.checkAnswer();typeAnswer(instance,word);instance.checkAnswer();
    if(!instance.selectionSession.allSolved){instance.nextSet();await Promise.resolve();}
  }
  assert.equal(instance.getScore(),3);assert.equal(instance.getMaxScore(),4);
  assert.deepEqual(Array.from(instance.selectionSession.getResults(),row=>row.units),[1.5,1.5]);
  assert.ok(instance.resultsView.textContent.includes('1.5/2'));assert.ok(instance.resultsView.textContent.includes('3/4'));
  const event=completedStatements(instance)[0];assert.equal(event.result.score.raw,3);assert.equal(event.result.score.max,4);assert.equal(event.result.score.scaled,0.75);
  const saved=JSON.parse(JSON.stringify(instance.getCurrentState()));const restored=new Constructor(params,1,{previousState:saved});restored.attach();restored.attach();assert.equal(restored.getScore(),3);assert.equal(completedStatements(restored).length,0);
  restored.retry();assert.equal(restored.getScore(),0);assert.equal(restored.selectionSession.typedPenalty,0.5);
  typeAnswer(restored,'wrong');restored.checkAnswer();typeAnswer(restored,'one');restored.checkAnswer();restored.nextSet();await Promise.resolve();typeAnswer(restored,'two');restored.checkAnswer();
  assert.equal(restored.getScore(),3.5);const retryEvent=completedStatements(restored)[0];assert.equal(retryEvent.result.score.raw,3.5);assert.equal(retryEvent.result.score.scaled,0.875);assert.equal(completedStatements(restored).length,1);
  const single=new Constructor({activity:{sets:[{word:'One',context:'ONE'}]},behaviour:params.behaviour});single.attach();typeAnswer(single,'wrong');single.checkAnswer();typeAnswer(single,'one');single.checkAnswer();assert.equal(single.getScore(),1.5);assert.equal(completedStatements(single)[0].result.score.raw,1.5);
});


test('spelling warning announces without answer revelation, restores quietly and Retry renews one warning',()=>{
  for(const policy of ['warn']){
    const {Constructor,document}=createHarness();const params={activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:'typed',spellingErrorBehaviour:policy,freeSpellingWarnings:'1',typedPenalty:'0.5'}};
    const instance=new Constructor(params);instance.attach();typeAnswer(instance,'fresoc');instance.checkAnswer();
    if(policy==='warn'){
      assert.ok(instance.selectionElements.feedback.textContent.includes('Check your spelling'));assert.equal(instance.selectionElements.announcement.textContent,instance.selectionElements.feedback.textContent);
      assert.equal(instance.setView.pre.textContent,'_____es');assert.equal(document.activeElement,instance.selectionElements.answerControl);
      assert.equal(instance.selectionSession.getSetState().attempts,0);assert.equal(completedStatements(instance).length,0);
      const resumed=new Constructor(params,1,{previousState:JSON.parse(JSON.stringify(instance.getCurrentState()))});resumed.attach();
      assert.equal(resumed.selectionElements.announcement.textContent,'');assert.equal(resumed.checkButton.disabled,true);
      typeAnswer(resumed,' FRESOC ');assert.equal(resumed.checkButton.disabled,true);
      typeAnswer(resumed,'frescp');resumed.checkAnswer();assert.equal(resumed.selectionSession.getSetState().attempts,1);
      typeAnswer(resumed,'fresco');resumed.checkAnswer();assert.equal(resumed.getScore(),1.5);
      const finished=new Constructor(params,1,{previousState:JSON.parse(JSON.stringify(resumed.getCurrentState()))});finished.attach();assert.equal(completedStatements(finished).length,0);
      finished.retry();typeAnswer(finished,'fresoc');finished.checkAnswer();assert.equal(finished.selectionSession.getSetState().attempts,0);assert.equal(finished.getCurrentState().sets[0][6],1);
    }
  }
});


test('exact correct feedback and warn/mistake/dropdown feedback remain unchanged',()=>{
  for(const [mode,policy,answer,expected] of [
    ['typed','mistake',' FRESCO ','Correct'],['typed','warn','fresoc',null],
    ['typed','mistake','fresoc','Incorrect'],['dropdown','mistake','fresco','Correct']
  ]){
    const {Constructor}=createHarness();const instance=new Constructor({activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:mode,spellingErrorBehaviour:policy}});instance.attach();
    if(mode==='typed')typeAnswer(instance,answer);else{const control=instance.selectionElements.answerControl;control.value=String(instance.selectionSession.answers.indexOf(answer));control.dispatchEvent({type:'change'});}
    instance.checkAnswer();assert.equal(instance.selectionElements.feedback.textContent,expected===null?instance.params.l10n.spellingWarningAnswer.replace('@answer',answer):expected);
    if(expected==='Correct')assert.ok(instance.selectionElements.announcement.textContent.startsWith('Correct. The missing word is fresco.'));
  }
});


test('Firefox fresco reproduction warns for persisted Warn configuration',()=>{
  for(const [policy,warning,attempts,version] of [['warn',true,0,4]]){
    const {Constructor,H5P,document}=createHarness();
    const params={activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:'typed',typedPenalty:'0.5',spellingErrorBehaviour:policy}};
    const instance=new Constructor(params);instance.attach();
    assert.equal(H5P.ConcordancesPapiJoUtils.isMinorSpellingError('fresoc','fresco'),true);
    typeAnswer(instance,'fresoc');instance.checkAnswer();
    assert.equal(instance.selectionSession.spellingPolicy,warning?'warn':'mistake');
    assert.equal(instance.selectionSession.getSetState().warningCount > 0,warning);
    assert.equal(instance.selectionSession.getSetState().attempts,attempts);
    assert.equal(instance.selectionElements.feedback.textContent,warning?instance.params.l10n.spellingWarningAnswer.replace('@answer','fresoc'):'Incorrect');
    assert.equal(instance.getCurrentState().version,version);assert.equal(instance.setView.pre.textContent,'_____es');
    assert.equal(instance.getScore(),0);assert.equal(completedStatements(instance).length,0);
    assert.equal(document.activeElement,instance.selectionElements.answerControl);
  }
});


test('highlighted spelling warning announces submitted text once and restores silently without score or state changes',()=>{
  const {Constructor,document}=createHarness();const params={activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:'typed',spellingErrorBehaviour:'warn',freeSpellingWarnings:'1',typedPenalty:'0.5'}};
  const instance=new Constructor(params);instance.attach();typeAnswer(instance,'fresoc');instance.checkAnswer();
  assert.equal(instance.selectionElements.feedback.textContent,'Check your spelling: fresoc');
  assert.equal(instance.selectionElements.announcement.textContent,'Check your spelling: fresoc');
  assert.equal(findAll(instance.selectionElements.feedback,n=>n.className==='h5p-concordances-papijo-spelling-error')[0].textContent,'oc');
  assert.equal(instance.selectionElements.answerControl.value,'fresoc');assert.equal(document.activeElement,instance.selectionElements.answerControl);
  assert.equal(instance.selectionSession.getSetState().attempts,0);assert.equal(instance.getScore(),0);assert.equal(instance.setView.pre.textContent,'_____es');
  const saved=JSON.parse(JSON.stringify(instance.getCurrentState()));const restored=new Constructor(params,1,{previousState:saved});restored.attach();
  assert.equal(restored.selectionElements.feedback.textContent,'Check your spelling: fresoc');
  assert.equal(restored.selectionElements.announcement.textContent,'');assert.equal(completedStatements(restored).length,0);
  assert.equal(JSON.stringify(restored.getCurrentState()),JSON.stringify(saved));
});


test('warning allowance runtime restores highlighted feedback, counts, quiet completion and resets on Retry',()=>{
  for(const allowance of ['2','3','unlimited']){
    const {Constructor}=createHarness();const params={activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:'typed',spellingErrorBehaviour:'warn',freeSpellingWarnings:allowance,typedPenalty:'0.5'}};
    const live=new Constructor(params);live.attach();for(const word of ['fresoc','frescp']){typeAnswer(live,word);live.checkAnswer();}
    const restored=new Constructor(params,1,{previousState:JSON.parse(JSON.stringify(live.getCurrentState()))});restored.attach();
    assert.equal(restored.selectionSession.getSetState().warningCount,2);assert.equal(restored.selectionSession.getSetState().attempts,0);
    assert.equal(restored.selectionElements.feedback.textContent,'Check your spelling: frescp');assert.equal(restored.selectionElements.announcement.textContent,'');
    typeAnswer(restored,'FRESOC');assert.equal(restored.checkButton.disabled,true);
    typeAnswer(restored,'fresco');restored.checkAnswer();assert.equal(restored.getScore(),2);assert.equal(completedStatements(restored).length,1);
    const finished=new Constructor(params,1,{previousState:JSON.parse(JSON.stringify(restored.getCurrentState()))});finished.attach();assert.equal(completedStatements(finished).length,0);
    finished.retry();assert.equal(finished.selectionSession.getSetState().warningCount,0);assert.equal(finished.selectionSession.getSetState().warnedAnswers.length,0);
    typeAnswer(finished,'fresoc');finished.checkAnswer();assert.equal(finished.selectionSession.getSetState().warningCount,1);assert.equal(finished.selectionSession.getSetState().attempts,0);
  }
});


test('revised warning defaults use two warnings without creation hooks or legacy-state migration',()=>{
  const {Constructor}=createHarness();const params={activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:'typed',spellingErrorBehaviour:'warn'}};
  const live=new Constructor(params);live.attach();assert.equal(live.selectionSession.warningAllowance,2);
  typeAnswer(live,'fresoc');live.checkAnswer();typeAnswer(live,'frescp');live.checkAnswer();
  assert.equal(live.selectionSession.getSetState().warningCount,2);assert.equal(live.selectionSession.getSetState().attempts,0);
  const saved=JSON.parse(JSON.stringify(live.getCurrentState()));assert.equal(saved.version,4);
  const resumed=new Constructor(params,1,{previousState:saved});resumed.attach();typeAnswer(resumed,'frescoo');resumed.checkAnswer();
  assert.equal(resumed.selectionSession.getSetState().warningCount,2);assert.equal(resumed.selectionSession.getSetState().attempts,1);
  const obsolete={...saved,version:3};const fresh=new Constructor(params,1,{previousState:obsolete});fresh.attach();assert.equal(fresh.selectionSession.getSetState().warningCount,0);
});


test('exhaustion feedback is specific to a new eligible finite typo, is spoken once and restores quietly',()=>{
  const expected='Incorrect — You have used all your free spelling warnings.';
  for(const penalty of ['1','0.5']){
    const {Constructor,document}=createHarness();const params={activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:'typed',spellingErrorBehaviour:'warn',typedPenalty:penalty}};
    const live=new Constructor(params);live.attach();for(const word of ['fresoc','frescp']){typeAnswer(live,word);live.checkAnswer();}
    const before=live.selectionSession.getSetState();typeAnswer(live,'frescoo');live.checkAnswer();
    assert.equal(live.selectionElements.feedback.textContent,expected);assert.equal(live.selectionElements.announcement.textContent,expected);
    const after=live.selectionSession.getSetState();assert.equal(after.attempts,1);assert.equal(after.warningCount,2);assert.deepEqual(after.warnedAnswers,before.warnedAnswers);
    assert.equal(live.selectionElements.answerControl.disabled,false);assert.equal(document.activeElement,live.selectionElements.answerControl);assert.equal(live.setView.pre.textContent,'_____es');
    const saved=JSON.parse(JSON.stringify(live.getCurrentState()));const resumed=new Constructor(params,1,{previousState:saved});resumed.attach();
    assert.equal(resumed.selectionElements.feedback.textContent,expected);assert.equal(resumed.selectionElements.announcement.textContent,'');assert.equal(completedStatements(resumed).length,0);assert.equal(JSON.stringify(resumed.getCurrentState()),JSON.stringify(saved));
    typeAnswer(resumed,'mosaic');resumed.checkAnswer();assert.equal(resumed.selectionElements.feedback.textContent,'Incorrect');assert.equal(resumed.selectionElements.announcement.textContent,'Incorrect. Try again.');
    typeAnswer(resumed,'FRESOC');assert.equal(resumed.checkButton.disabled,true);resumed.checkAnswer();assert.equal(resumed.selectionSession.getSetState().attempts,2);
    typeAnswer(resumed,'fresco');resumed.checkAnswer();assert.equal(resumed.getScore(),penalty==='1'?0:1);
    const unlimited=new Constructor({...params,behaviour:{...params.behaviour,freeSpellingWarnings:'unlimited'}});unlimited.attach();for(const word of ['fresoc','frescp','frescoo']){typeAnswer(unlimited,word);unlimited.checkAnswer();assert.equal(unlimited.spellingWarningsExhausted(),false);assert.equal(unlimited.selectionSession.getSetState().attempts,0);}
  }
});

test('missing-letter underscore feedback preserves input and restores the same visual and accessible meaning quietly',()=>{
  const {Constructor}=createHarness();const params={activity:{sets:[{word:'fresco',context:'FRESCOes'}]},behaviour:{answerMode:'typed',spellingErrorBehaviour:'warn'}};
  const live=new Constructor(params);live.attach();typeAnswer(live,'freco');live.checkAnswer();
  assert.equal(live.selectionElements.feedback.textContent,'Check your spelling: fre_co A letter is missing.');
  assert.equal(live.selectionElements.announcement.textContent,'Check your spelling: freco A letter is missing.');assert.equal(live.selectionElements.answerControl.value,'freco');
  assert.equal(live.selectionSession.getSetState().attempts,0);assert.equal(live.getScore(),0);
  const saved=JSON.parse(JSON.stringify(live.getCurrentState()));const restored=new Constructor(params,1,{previousState:saved});restored.attach();
  assert.equal(restored.selectionElements.feedback.textContent,live.selectionElements.feedback.textContent);assert.equal(restored.selectionElements.announcement.textContent,'');assert.equal(completedStatements(restored).length,0);assert.equal(JSON.stringify(restored.getCurrentState()),JSON.stringify(saved));
});


function hintInstance(behaviour={},activity={sets:[{word:'fresco',context:'FRESCOes'}]}) {
  const harness=createHarness();const instance=new harness.Constructor({activity,behaviour:{answerMode:'typed',enableProgressiveHints:true,...behaviour}});instance.attach();return {...harness,instance};
}

test('adaptive hints use the checked prefix, preserve live input and never charge a non-revealing request',()=>{
  for(const answer of ['frost','frosted']) {
    const {instance}=hintInstance({typedPenalty:0.5});
    typeAnswer(instance,'wrong');instance.checkAnswer();typeAnswer(instance,answer);instance.checkAnswer();
    typeAnswer(instance,'fresc'); // Editing alone must not change the submitted prefix.
    instance.requestHint();assert.equal(instance.selectionSession.getHintText(),'fre___');
    assert.equal(instance.selectionElements.answerControl.value,'fresc');
    assert.equal(instance.selectionSession.getSetState().hintCount,1);
  }
  const {instance}=hintInstance({spellingErrorBehaviour:'warn',freeSpellingWarnings:1,typedPenalty:0.5});
  typeAnswer(instance,'fresoc');instance.checkAnswer();instance.requestHint();
  assert.equal(instance.selectionSession.getHintText(),'fresc_');
  typeAnswer(instance,'fresc');instance.checkAnswer();
  assert.equal(instance.getHintAvailability(),'locked');
  const saved=JSON.stringify(instance.getCurrentState());instance.requestHint();
  assert.equal(JSON.stringify(instance.getCurrentState()),saved);
  typeAnswer(instance,'fresco');instance.checkAnswer();assert.equal(instance.getScore(),1);
  assert.equal(completedStatements(instance)[0].result.score.raw,1);
  const {instance:free}=hintInstance({spellingErrorBehaviour:'warn',freeSpellingWarnings:1});
  typeAnswer(free,'fresoc');free.checkAnswer();free.requestHint();typeAnswer(free,'fresco');free.checkAnswer();
  assert.equal(free.getScore(),1.5);
});

test('adaptive hints require improving submissions at positive points and a new scored submission even at zero',()=>{
  const {instance}=hintInstance({typedPenalty:0.5,spellingErrorBehaviour:'warn',freeSpellingWarnings:1});
  typeAnswer(instance,'aresco');instance.checkAnswer();instance.requestHint();
  assert.equal(instance.selectionSession.getHintText(),'f_____');
  typeAnswer(instance,' ARESCO ');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'locked');
  assert.equal(instance.selectionSession.getSetState().attempts,0);
  typeAnswer(instance,'mosaic');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'locked');
  typeAnswer(instance,'frisco');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'available');
  instance.requestHint();assert.equal(instance.selectionSession.getHintText(),'fre___');
  assert.equal(instance.getHintAvailability(),'locked'); // The deduction has reached zero, but no new submission yet.
  const count=instance.selectionSession.getSetState().hintCount;instance.requestHint();
  assert.equal(instance.selectionSession.getSetState().hintCount,count);
  for(const [answer,pattern] of [['frosting','fres__'],['froster','fresc_'],['frosted','fresco']]) {
    typeAnswer(instance,answer);instance.checkAnswer();instance.requestHint();
    assert.equal(instance.selectionSession.getHintText(),pattern);
    assert.notEqual(instance.getHintAvailability(),'available');
  }
  assert.equal(instance.selectionSession.allSolved,false);assert.equal(completedStatements(instance).length,0);
  typeAnswer(instance,'fresco');instance.checkAnswer();assert.equal(instance.getScore(),0);
  instance.retry();assert.equal(instance.selectionSession.getSetState().hintCount,0);
  assert.equal(instance.selectionSession.getSetState().warningCount,0);assert.equal(instance.selectionSession.getSetState().attempts,0);
  // A scored mistake can itself reach zero: the exception applies immediately,
  // but the next click still requires another scored submission.
  const {instance:transition}=hintInstance({typedPenalty:1,spellingErrorBehaviour:'warn',freeSpellingWarnings:1});
  typeAnswer(transition,'aresco');transition.checkAnswer();transition.requestHint();
  for(const answer of ['mosaic','banana']){typeAnswer(transition,answer);transition.checkAnswer();}
  assert.equal(transition.getHintAvailability(),'available');transition.requestHint();
  assert.equal(transition.selectionSession.getHintText(),'fr____');assert.equal(transition.getHintAvailability(),'locked');
});

test('adaptive hints compare normalized Unicode graphemes and preserve punctuation with safe rendering',()=>{
  const model=require('../scripts/concordances-session.js');
  assert.equal(model.hintPrefix('Éternel',' E\u0301TERx '),4);
  assert.equal(model.hintPrefix('Éternel','eternel'),0);
  assert.equal(model.hintPrefix('été été','été-été'),3); // Internal spacing is significant.
  const {instance}=hintInstance({typedPenalty:0.5}, {sets:[{word:'E\u0301té &lt;été&gt;',context:'E\u0301té &lt;été&gt;'}]});
  typeAnswer(instance,'wrong');instance.checkAnswer();typeAnswer(instance,'Éta <xx>');instance.checkAnswer();
  instance.requestHint();assert.equal(instance.selectionSession.getHintText(),'E\u0301té <___>');
  assert.equal(instance.selectionElements.hintReveal.children.length,0);
  assert.ok(instance.selectionElements.announcement.textContent.includes('Each underscore'));
  assert.equal(instance.selectionElements.answerControl.value,'Éta <xx>');
});

test('adaptive hints restore positions and progression quietly and reject invalid schema-5 histories',()=>{
  const stateModel=require('../scripts/concordances-state.js');
  const activity={sets:[{word:'fresco',context:'FRESCOes'},{word:'abstract',context:'ABSTRACTions'}]};
  const behaviour={answerMode:'typed',enableProgressiveHints:true,spellingErrorBehaviour:'warn',freeSpellingWarnings:1,typedPenalty:0.5};
  const {instance}=hintInstance(behaviour,activity);
  typeAnswer(instance,'aresco');instance.checkAnswer();instance.requestHint();
  const saved=JSON.parse(JSON.stringify(instance.getCurrentState()));
  const {Constructor,document}=createHarness(()=>{throw Error('Restoration must not shuffle');});
  const restored=new Constructor({activity,behaviour},1,{previousState:saved});restored.attach();
  assert.equal(restored.selectionSession.getHintText(),'f_____');assert.equal(restored.getHintAvailability(),'locked');
  assert.equal(restored.selectionElements.announcement.textContent,'');assert.equal(document.activeElement,undefined);
  typeAnswer(restored,' ARESCO ');restored.checkAnswer();assert.equal(restored.selectionSession.getSetState().attempts,0);
  typeAnswer(restored,'frosting');restored.checkAnswer();assert.equal(restored.getHintAvailability(),'available');
  restored.requestHint();assert.equal(restored.selectionSession.getHintText(),'fre___');
  const resumed=stateModel.restoreSession(activity,JSON.parse(JSON.stringify(restored.getCurrentState())),behaviour);
  assert.ok(resumed);assert.equal(resumed.getHintText(),'fre___');assert.equal(resumed.hintAvailability(),'locked');
  typeAnswer(restored,'fresco');restored.checkAnswer();assert.equal(restored.getScore(),0.5);
  restored.selectionSession.advance(0);restored.refreshSelection();typeAnswer(restored,'abstract');restored.checkAnswer();
  const completed=new Constructor({activity,behaviour},1,{previousState:JSON.parse(JSON.stringify(restored.getCurrentState()))});completed.attach();
  assert.equal(completed.getScore(),2.5);assert.equal(completedStatements(completed).length,0);assert.equal(completed.selectionElements.announcement.textContent,'');
  for(const mutate of [s=>s.hints[0][1][0][0]=-1,s=>s.hints[0][1][0][3]=6,s=>s.hints[0][1][0][2]=5,
    s=>s.hints[0][1].push(s.hints[0][1][0].slice()),s=>s.hints[1][1].push([0,1,0,1]),
    s=>s.hints[0].push(0),s=>s.hints[1]=s.hints[0],s=>s.fingerprint='bad']){
    const bad=JSON.parse(JSON.stringify(saved));mutate(bad);assert.equal(stateModel.validateState(activity,bad,behaviour).valid,false);
  }
  assert.equal(stateModel.validateState(activity,saved.baseState,{...behaviour,enableProgressiveHints:false}).valid,true);
});

test('progressive hints have no UI when missing, invalid, disabled or dropdown; enabled locked control is accessible and inert',()=>{
  for(const behaviour of [{enableProgressiveHints:undefined},{enableProgressiveHints:false},{enableProgressiveHints:'true'},{answerMode:'dropdown'}]){
    const {instance}=hintInstance(behaviour);assert.equal(instance.selectionElements.hintStatus,null);assert.equal(instance.buttons['letter-hint'],undefined);assert.equal(instance.getHintAvailability(),'hidden');
  }
  const {instance}=hintInstance();const button=instance.buttons['letter-hint'].element,status=instance.selectionElements.hintStatus;
  assert.equal(button.hidden,false);assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-disabled'),'true');
  assert.equal(button.getAttribute('aria-describedby'),status.id);assert.equal(status.hidden,false);assert.ok(status.className.includes('sr-only'));assert.ok(status.textContent.includes('two scored incorrect attempts'));
  assert.ok(instance.selectionElements.answerControl.getAttribute('aria-describedby').includes(status.id));
  const saved=JSON.stringify(instance.getCurrentState());instance.buttons['letter-hint'].callback();assert.equal(JSON.stringify(instance.getCurrentState()),saved);
});

test('progressive hint unlocking needs two scored errors and enables the functional button',()=>{
  const {instance}=hintInstance();typeAnswer(instance,'mosaic');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'locked');
  typeAnswer(instance,' MOSAIC ');instance.checkAnswer();assert.equal(instance.selectionSession.getSetState().attempts,1);assert.equal(instance.getHintAvailability(),'locked');
  typeAnswer(instance,'banana');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'available');
  assert.equal(instance.buttons['letter-hint'].element.hidden,false);assert.equal(instance.buttons['letter-hint'].element.disabled,false);
  assert.equal(instance.selectionElements.hintStatus.textContent,'Hint available');assert.equal(instance.selectionElements.hintStatus.hidden,false);
  typeAnswer(instance,'unrelated');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'available');
});

test('progressive hints unlock on finite warning exhaustion but free or repeated Unlimited warnings add no scored attempts',()=>{
  const typos=['fresoc','frescp','frescoo'];
  for(const allowance of [1,2,3]){
    const {instance}=hintInstance({spellingErrorBehaviour:'warn',freeSpellingWarnings:allowance});
    assert.ok(instance.selectionElements.hintStatus.textContent.includes('free spelling warnings'));
    for(let index=0;index<allowance;index++){
      typeAnswer(instance,typos[index]);instance.checkAnswer();assert.equal(instance.selectionSession.getSetState().attempts,0);
      assert.equal(instance.getHintAvailability(),index===allowance-1?'available':'locked');
      typeAnswer(instance,' '+typos[index].toUpperCase()+' ');instance.checkAnswer();assert.equal(instance.selectionSession.getSetState().warningCount,index+1);
    }
  }
  const {instance}=hintInstance({spellingErrorBehaviour:'warn',freeSpellingWarnings:'unlimited'});
  for(const typo of typos){typeAnswer(instance,typo);instance.checkAnswer();assert.equal(instance.getHintAvailability(),'locked');}
  typeAnswer(instance,'FRESOC');instance.checkAnswer();assert.equal(instance.selectionSession.getSetState().attempts,0);assert.equal(instance.getHintAvailability(),'locked');
  typeAnswer(instance,'mosaic');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'locked');
  typeAnswer(instance,'banana');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'available');
});

test('progressive hints reset per Set and Retry, hide on success and retain scores when no hint is requested',async()=>{
  const {instance}=hintInstance({}, {sets:[{word:'fresco',context:'FRESCOes'},{word:'abstract',context:'ABSTRACTions'}]});
  typeAnswer(instance,'mosaic');instance.checkAnswer();typeAnswer(instance,'banana');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'available');
  typeAnswer(instance,'fresco');instance.checkAnswer();assert.equal(instance.getHintAvailability(),'hidden');assert.equal(instance.selectionElements.hintStatus.hidden,true);
  assert.equal(instance.getScore(),0);instance.nextSet();await Promise.resolve();assert.equal(instance.getHintAvailability(),'locked');
  typeAnswer(instance,'abstract');instance.checkAnswer();assert.equal(instance.getScore(),2);assert.equal(instance.getMaxScore(),4);assert.equal(instance.getHintAvailability(),'hidden');
  const saved=instance.getCurrentState();assert.equal(saved.version,5);assert.ok(saved.hints.every(row=>row[1].length===0));
  instance.retry();assert.equal(instance.getHintAvailability(),'locked');assert.equal(instance.getScore(),0);
});
