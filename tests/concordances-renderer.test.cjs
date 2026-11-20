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
