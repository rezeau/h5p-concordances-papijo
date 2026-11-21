'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const libraries = process.env.CONCORDANCES_EDITOR_LIBRARIES;

test('installed ShowWhenpapijo follows wrapped selects with AND and preserves the hidden allowance',
  {skip: !libraries && 'Set CONCORDANCES_EDITOR_LIBRARIES to run the local editor integration check'}, () => {
    const fields = require('../semantics.json').find(field => field.name === 'behaviour').fields;
    const ns = {widgets: {}, t: (section, key) => key};
    const ready = [], wrappers = [], selects = [], values = {allowance: '3'};
    // Small DOM/control boundary; conditional logic and field following are the
    // actual installed scripts, not reimplementations of their behavior.
    ns.$ = () => {
      const wrapper = {hidden: false, toggleClass(name, hidden) {
        if (name === 'hidden') this.hidden = hidden;
        return this;
      }, appendTo() { return this; }, detach() { return this; }};
      wrappers.push(wrapper);
      return wrapper;
    };
    ns.widgets.select = function (parent, field, value, setValue) {
      this.field = field; this.value = value; this.changes = [];
      this.appendTo = () => {}; this.validate = () => this.value;
      this.set = value => {
        this.value = value; setValue(field, value);
        this.changes.forEach(callback => callback(value));
      };
      selects.push(this);
    };
    const context = vm.createContext({ns, H5PEditor: ns, H5P: {cloneObject: value => ({...value})}});
    const editor = fs.readFileSync(path.join(libraries, 'h5p-editor-php-library/scripts/h5peditor.js'), 'utf8');
    for (const name of ['findField', 'followField']) {
      const start = editor.indexOf('ns.' + name + ' = function');
      const end = editor.indexOf('\n};', start) + 3;
      assert.ok(start >= 0 && end > start);
      vm.runInContext(editor.slice(start, end), context);
    }
    const manifest = require(path.join(libraries, 'H5PEditor.ShowWhenpapijo-1.0/library.json'));
    assert.equal(manifest.machineName, 'H5PEditor.ShowWhenpapijo');
    vm.runInContext(fs.readFileSync(path.join(libraries, 'H5PEditor.ShowWhenpapijo-1.0/h5p-show-when.js'), 'utf8'), context);
    const parent = {children: [], ready: callback => ready.push(callback)};
    const mode = new ns.widgets.select(parent, fields.find(field => field.name === 'answerMode'), 'typed', () => {});
    parent.children.push(mode);
    const policy = new ns.ShowWhen(parent, fields.find(field => field.name === 'spellingErrorBehaviour'), 'warn', () => {});
    parent.children.push(policy);
    const allowanceField = fields.find(field => field.name === 'freeSpellingWarnings');
    assert.equal(allowanceField.default, '2');
    const allowance = new ns.ShowWhen(parent, allowanceField, values.allowance, (field, value) => { values.allowance = value; });
    parent.children.push(allowance);
    ready.forEach(callback => callback());
    const controller = selects.find(select => select.field.name === 'spellingErrorBehaviour');
    assert.equal(wrappers[1].hidden, false);
    controller.set('mistake'); assert.equal(wrappers[1].hidden, true);
    controller.set('warn'); assert.equal(wrappers[1].hidden, false);
    mode.set('dropdown'); assert.equal(wrappers[1].hidden, true);
    controller.set('mistake'); assert.equal(wrappers[1].hidden, true);
    mode.set('typed'); assert.equal(wrappers[1].hidden, true);
    controller.set('warn'); assert.equal(wrappers[1].hidden, false);
    assert.equal(values.allowance, '3');
  });
