'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test');
const renderer=require('../scripts/concordances-renderer.js');
const {createDocument,findAll}=require('./helpers/dom.cjs');
const options={headingId:'set',label:'Set 1',decodeEditorText:true,a11y:{missingWord:'missing word',kwicRegion:'Scroll context',contextAlternative:'Reading context'}};
test('ordinary and LancsBox inputs share gaps, safe punctuation, revelation and accessible alternatives',()=>{
 for(const [context,expected] of [
  ['[001] &quot;ABSTRACT&quot; isn&#039;t &lt;tag&gt;  ABSTRACTions\r\n[002]\tsemi-ABSTRACT\u00a0 &amp;quot;', '[001] "_____" isn\'t <tag>  _____ions\r\n[002]\tsemi-_____\u00a0 &amp;quot;'],
  ['  High-level  \t ABSTRACTions \t are difficult.\nsemi-\tABSTRACT\t painters', 'High-level _____ions are difficult.\nsemi-_____ painters']
 ]){
  const set=Object.freeze({word:'abstract',context}),view=renderer.renderSet(createDocument(),set,options);
  assert.equal(view.pre.textContent,expected);
  assert.ok(!view.element.textContent.includes('secret.xml'));
  assert.equal(findAll(view.element,n=>['IMG','SCRIPT','TAG'].includes(n.tagName)).length,0);
  assert.deepEqual(view.accessibleLines.map(n=>n.textContent),expected.replace(/_____/g,'missing word').split(/\r\n|\n/));
  const nodes=view.pre.childNodes.filter(n=>n.nodeType===3);
  renderer.revealSet(view,'abstract'); renderer.revealSet(view,'different');
  assert.equal(view.pre.textContent,expected.replace(/_____/g,'ABSTRACT'));
  assert.deepEqual(view.pre.childNodes.filter(n=>n.nodeType===3),nodes);
  assert.ok(findAll(view.pre,n=>n.tagName==='STRONG').every(n=>n.textContent==='ABSTRACT'&&n.className==='h5p-concordances-papijo-revealed-word'));
  assert.deepEqual(view.accessibleLines.map(n=>n.textContent),view.pre.textContent.split(/\r\n|\n/));
  assert.equal(set.context,context);
  assert.equal(view.pre.getAttribute('aria-hidden'),'true');assert.equal(view.scroll.tabIndex,0);
  assert.equal(findAll(view.element,n=>n.getAttribute('aria-live')!==null).length,0);
 }
});


test('revelation preserves each original match, Unicode representation and safe accessible text', () => {
  for (const [word, context, revealed, matches] of [
    ['abstract', 'ABSTRACT Abstract abstract Abstraction abstraction semi-ABSTRACT',
      'ABSTRACT Abstract abstract Abstraction abstraction semi-ABSTRACT',
      ['ABSTRACT', 'Abstract', 'abstract', 'Abstract', 'abstract', 'ABSTRACT']],
    ['abstract', 'An\tAbstraction\t and ABSTRACTion.',
      'An Abstraction and ABSTRACTion.', ['Abstract', 'ABSTRACT']],
    ['éternel', 'ÉTERNEL E\u0301TERNELlement éternel',
      'ÉTERNEL E\u0301TERNELlement éternel', ['ÉTERNEL', 'E\u0301TERNEL', 'éternel']],
    ['<tag>', '&lt;TAG&gt; &lt;tag&gt; &amp;quot;',
      '<TAG> <tag> &amp;quot;', ['<TAG>', '<tag>']]
  ]) {
    const set=Object.freeze({word,context});
    const view=renderer.renderSet(createDocument(),set,options);
    const surrounding=view.pre.childNodes.filter(node=>node.nodeType===3);
    renderer.revealSet(view, word);
    renderer.revealSet(view, 'ignored');
    assert.equal(view.pre.textContent,revealed);
    const strong=findAll(view.pre,node=>node.tagName==='STRONG');
    assert.deepEqual(strong.map(node=>node.textContent),matches);
    assert.ok(strong.every(node=>node.className==='h5p-concordances-papijo-revealed-word'));
    assert.deepEqual(view.accessibleLines.map(node=>node.textContent),revealed.split(/\r\n|\r|\n/));
    assert.deepEqual(view.pre.childNodes.filter(node=>node.nodeType===3),surrounding);
    assert.equal(findAll(view.element,node=>['TAG','SCRIPT','IMG'].includes(node.tagName)).length,0);
    assert.equal(set.context,context);
  }
});


test('tabular grid anchors NODE-field matches while preserving other occurrences and suffixes', () => {
  const context = 'ABSTRACT short\tabstract\t art\nA much longer left context\tabstraction\t follows ABSTRACT\nleft\tabstraction,\t right';
  const view = renderer.renderSet(createDocument(), Object.freeze({word:'abstract',context}), options);
  const rows=findAll(view.pre,node=>node.className==='h5p-concordances-papijo-kwic-row');
  assert.equal(rows.length,3);
  assert.ok(view.pre.className.includes('h5p-concordances-papijo-tabular'));
  assert.deepEqual(rows.map(row=>row.children.length),[2,2,2]);
  assert.deepEqual(findAll(view.pre,node=>node.className==='h5p-concordances-papijo-kwic-primary').map(node=>node.textContent),['_____','_____','_____']);
  assert.deepEqual(findAll(view.pre,node=>node.className==='h5p-concordances-papijo-kwic-left').map(node=>node.textContent),['_____ short ','A much longer left context ','left ']);
  assert.deepEqual(findAll(view.pre,node=>node.className==='h5p-concordances-papijo-kwic-right').map(node=>node.textContent),[' art','ion follows _____','ion, right']);
  renderer.revealSet(view);
  assert.equal(view.pre.textContent,'ABSTRACT short abstract art\nA much longer left context abstraction follows ABSTRACT\nleft abstraction, right');
  assert.deepEqual(view.accessibleLines.map(node=>node.textContent),view.pre.textContent.split('\n'));
  assert.deepEqual(findAll(view.pre,node=>node.className==='h5p-concordances-papijo-kwic-primary').map(node=>node.textContent),['abstract','abstract','abstract']);
  const ordinary=renderer.renderSet(createDocument(),{word:'abstract',context:'[001]  ABSTRACT  '},options);
  assert.ok(!ordinary.pre.className.includes('tabular'));
  assert.equal(ordinary.pre.textContent,'[001]  _____  ');
});


test('all ten fresco rows retain NODE alignment, suffixes, natural accessible order and exact revelation', () => {
  const context=require('./fixtures/lancsbox-three-column.cjs');
  const view=renderer.renderSet(createDocument(),Object.freeze({word:'fresco',context}),options);
  const primary=findAll(view.pre,node=>node.className==='h5p-concordances-papijo-kwic-primary');
  assert.equal(primary.length,10);
  assert.ok(primary.every(node=>node.textContent==='_____'));
  const right=findAll(view.pre,node=>node.className==='h5p-concordances-papijo-kwic-right');
  assert.deepEqual(right.map(node=>node.textContent.split(' ')[0]),['ed','es','es','es,','.','','ed','','','es']);
  const expected=require('../scripts/concordances-utils.js').normalizeConcordance(context).context;
  renderer.revealSet(view);
  assert.equal(view.pre.textContent,expected);
  assert.deepEqual(view.accessibleLines.map(node=>node.textContent),expected.split('\n'));
  assert.equal(findAll(view.pre,node=>node.className==='h5p-concordances-papijo-kwic-number').length,0);
});


test('plain cat sentences reuse shared tracks and retain inline suffixes and source data', () => {
  const context = 'There is a black cat sitting on the red mat.\n' +
    'Let me tell you the story of a nice white cat in the garden.\nToo many cats spoil the house.';
  const set = Object.freeze({word:'cat', context});
  const view = renderer.renderSet(createDocument(), set, options);
  const cells = (name) => findAll(view.pre, node => node.className === 'h5p-concordances-papijo-kwic-' + name);
  assert.ok(view.pre.className.includes('h5p-concordances-papijo-tabular'));
  assert.deepEqual(cells('left').map(node => node.textContent),
    ['There is a black ', 'Let me tell you the story of a nice white ', 'Too many ']);
  assert.deepEqual(cells('primary').map(node => node.textContent), ['_____', '_____', '_____']);
  assert.equal(cells('right')[2].textContent, 's spoil the house.');
  cells('continuation').forEach((node, index) => {
    assert.deepEqual(node.children, [cells('primary')[index], cells('right')[index]]);
    assert.equal(node.childNodes.length, 2);
  });
  assert.equal(cells('continuation')[2].textContent, '_____s spoil the house.');
  assert.deepEqual(findAll(view.pre, node => node.className === 'h5p-concordances-papijo-gap'), view.gapNodes);
  assert.deepEqual(view.accessibleLines.map(node => node.textContent), context.replace(/cat/g, 'missing word').split('\n'));
  assert.equal(view.scroll.tabIndex, 0);
  assert.equal(view.scroll.getAttribute('role'), 'region');
  assert.equal(view.pre.getAttribute('aria-hidden'), 'true');
  renderer.revealSet(view);
  renderer.revealSet(view);
  assert.equal(view.pre.textContent, context);
  assert.equal(cells('continuation')[2].textContent, 'cats spoil the house.');
  assert.deepEqual(view.accessibleLines.map(node => node.textContent), context.split('\n'));
  assert.deepEqual(set, {word:'cat', context});
});

test('whole-context preservation protects numbered, spaced, tabbed and mixed preformatted lines', () => {
  for (const context of [
    '[001] ABSTRACTions and semi-\n[002] semi-ABSTRACTions by Everett McNear\n[003] quite ABSTRACT. In France',
    '  ABSTRACTions\r\nABSTRACT.',
    'An ABSTRACT  example.\nAnother ABSTRACT.',
    'An ABSTRACT\tcontinues.\nAnother ABSTRACT.',
    'An ABSTRACT.\n[002] Another ABSTRACT.',
    '[001]ABSTRACTions\n[002]ABSTRACT.',
    '1. ABSTRACTions\n2) ABSTRACT.',
    'An ABSTRACT. \nAnother ABSTRACT.',
    'An\u00a0ABSTRACT.\nAnother ABSTRACT.'
  ]) {
    const set = Object.freeze({word:'abstract', context});
    const view = renderer.renderSet(createDocument(), set, options);
    assert.equal(view.pre.className, 'h5p-concordances-papijo-context');
    assert.equal(findAll(view.pre, node => node.className === 'h5p-concordances-papijo-kwic-row').length, 0);
    assert.equal(view.pre.textContent, context.replace(/ABSTRACT/g, '_____'));
    const surrounding = view.pre.childNodes.filter(node => node.nodeType === 3);
    renderer.revealSet(view);
    assert.equal(view.pre.textContent, context);
    assert.deepEqual(view.pre.childNodes.filter(node => node.nodeType === 3), surrounding);
    assert.deepEqual(view.accessibleLines.map(node => node.textContent), context.split(/\r\n|\r|\n/));
    assert.equal(set.context, context);
  }
});

test('plain first-gap anchoring preserves later matches, Unicode, blank lines and all line endings', () => {
  const context = '\r\nAn E\u0301TERNELlement, ÉTERNEL!\r\n\rPuis éternel.\n';
  const set = Object.freeze({word:'éternel', context});
  const view = renderer.renderSet(createDocument(), set, options);
  const primary = findAll(view.pre, node => node.className === 'h5p-concordances-papijo-kwic-primary');
  const right = findAll(view.pre, node => node.className === 'h5p-concordances-papijo-kwic-right');
  assert.ok(view.pre.className.includes('h5p-concordances-papijo-tabular'));
  assert.equal(primary.length, 2);
  assert.equal(view.gapNodes.length, 3);
  assert.equal(primary[0].children[0], view.gapNodes[0]);
  assert.equal(primary[1].children[0], view.gapNodes[2]);
  assert.equal(right[0].textContent, 'lement, _____!');
  assert.deepEqual(findAll(view.pre, node => node.className === 'h5p-concordances-papijo-gap'), view.gapNodes);
  assert.equal(findAll(view.pre, node => node.className === 'h5p-concordances-papijo-kwic-unanchored').length, 3);
  assert.equal(view.pre.textContent, '\r\nAn _____lement, _____!\r\n\rPuis _____.\n');
  assert.deepEqual(view.accessibleLines.map(node => node.textContent), ['', 'An missing wordlement, missing word!', '', 'Puis missing word.', '']);
  renderer.revealSet(view);
  assert.equal(view.pre.textContent, context);
  assert.deepEqual(findAll(view.pre, node => node.tagName === 'STRONG').map(node => node.textContent),
    ['E\u0301TERNEL', 'ÉTERNEL', 'éternel']);
  assert.deepEqual(view.accessibleLines.map(node => node.textContent), context.split(/\r\n|\r|\n/));
  assert.deepEqual(set, {word:'éternel', context});
});

test('spelling feedback highlights code-point edits without changing source text or revealing omissions',()=>{
  for(const [answer,target,highlight,before,omission] of [
    ['frescp','fresco','p','fresc',false],['frescco','fresco','c','fresc',false],
    ['fresoc','fresco','oc','fres',false],['fresc','fresco','','fresc',true],
    ['resco','fresco','','',true],[' FRÉscp ','frésco','p',' FRÉsc',false],
    ['E\u0301ternxl','éternel','x','E\u0301tern',false],
    ['\u{10428}cbde','\u{10428}bcde','cb','\u{10428}',false]
  ]){
    const view=renderer.renderSpellingWarning(createDocument(),answer,target,'Check your spelling: @answer');
    const text=view.element.children[0],mark=text.children[0];
    assert.equal(view.element.textContent,'Check your spelling: '+(omission ? before+'_'+answer.slice(before.length) : answer)+(omission?' A letter is missing.':''));
    assert.equal(view.announcement,'Check your spelling: '+answer+(omission?' A letter is missing.':''));
    assert.equal(mark.textContent,omission?'_':highlight);assert.equal(text.childNodes[0].data,before);
    assert.equal(mark.className,omission?'h5p-concordances-papijo-spelling-error h5p-concordances-papijo-spelling-omission':'h5p-concordances-papijo-spelling-error');
    if(omission)assert.equal(mark.getAttribute('aria-hidden'),'true');
  }
  const unsafe=renderer.renderSpellingWarning(createDocument(),'<img onerror=x> &quot;','fresco','Check your spelling: @answer');
  assert.equal(unsafe.element.textContent,'Check your spelling: <img onerror=x> &quot;');assert.equal(findAll(unsafe.element,n=>n.tagName==='IMG').length,0);
});


test('missing-letter underscores retain raw Unicode grapheme boundaries and never reveal target characters',()=>{
  for(const [answer,target,expected] of [['freco','fresco','fre_co'],['bcde','\u{10428}bcde','_bcde'],['E\u0301terel','éternel','E\u0301ter_el']]){
    const view=renderer.renderSpellingWarning(createDocument(),answer,target,'Check your spelling: @answer');
    assert.equal(view.element.children[0].textContent,expected);const marks=findAll(view.element,node=>node.className.includes('spelling-omission'));assert.equal(marks.length,1);assert.equal(marks[0].textContent,'_');assert.equal(marks[0].getAttribute('aria-hidden'),'true');
    assert.equal(view.announcement,'Check your spelling: '+answer+' A letter is missing.');
  }
});
