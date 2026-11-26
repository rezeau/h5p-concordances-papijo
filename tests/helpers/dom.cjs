'use strict';

// Minimal text-node DOM for unit tests; layout and actual Question attachment
// are checked separately in the headless-browser integration probe.
function createDocument() {
  const document = {};
  class Element {
    constructor(tag) {
      this.nodeType = 1;
      this.tagName = tag.toUpperCase();
      this.tag = `<${tag}>`;
      this.ownerDocument = document;
      this.attributes = {};
      this.childNodes = [];
      this.parentNode = null;
      this.listeners = new Map();
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    get className() { return this.attributes.class || ''; }
    set className(value) { this.setAttribute('class', value); }
    get id() { return this.attributes.id || ''; }
    set id(value) { this.setAttribute('id', value); }
    get tabIndex() { return Number(this.attributes.tabindex ?? -1); }
    set tabIndex(value) { this.setAttribute('tabindex', value); }
    get children() { return this.childNodes.filter((child) => child.nodeType === 1); }
    get value() {
      if (this.tagName === 'INPUT') return this.inputValue ?? '';
      if (this.tagName === 'OPTION') return this.getAttribute('value') ?? this.textContent;
      if (this.tagName === 'SELECT') {
        const desired = this.selectedValue ?? this.children[0]?.value ?? '';
        return this.children.some((option) => option.value === desired) ? desired : '';
      }
      return this.childNodes.filter((child) => child.nodeType === 3).map((child) => child.data).join('');
    }
    set value(value) {
      if (this.tagName === 'INPUT') {
        this.inputValue = String(value);
        this.valueWrites = (this.valueWrites || 0) + 1;
        this.selectionStart = this.selectionEnd = this.inputValue.length;
      }
      else if (this.tagName === 'OPTION') this.setAttribute('value', value);
      else this.selectedValue = String(value);
    }
    get textContent() { return this.childNodes.map((child) => child.nodeType === 3 ? child.data : child.textContent).join(''); }
    set textContent(value) {
      this.childNodes = [];
      this.appendChild(document.createTextNode(String(value)));
    }
    contains(node) {
      return node === this || this.children.some(child => child.contains(node));
    }
    querySelector(selector) {
      const className = selector.startsWith('.') ? selector.slice(1) : null;
      return findAll(this, node => node !== this && (className
        ? node.className.split(/\s+/).includes(className) : node.tagName.toLowerCase() === selector))[0] || null;
    }
    removeChild(child) {
      const index = this.childNodes.indexOf(child);
      if (index < 0) throw new Error('Missing child');
      this.childNodes.splice(index, 1);
      child.parentNode = null;
      document.onChildListChange?.(this);
      return child;
    }
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this.childNodes.push(child);
      document.onChildListChange?.(this);
      return child;
    }
    replaceChildren(...children) {
      this.childNodes.forEach((child) => { child.parentNode = null; });
      this.childNodes = [];
      document.onChildListChange?.(this);
      children.forEach((child) => this.appendChild(child));
    }
    replaceChild(next, previous) {
      const index = this.childNodes.indexOf(previous);
      if (index < 0) throw new Error('Missing child');
      this.childNodes[index] = next;
      previous.parentNode = null;
      next.parentNode = this;
      document.onChildListChange?.(this);
      return previous;
    }
    addEventListener(name, handler, capture = false) {
      if (capture) {
        this.captureListeners ||= new Map();
        if (!this.captureListeners.has(name)) this.captureListeners.set(name, []);
        this.captureListeners.get(name).push(handler);
        return;
      }
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(handler);
    }
    removeEventListener(name, handler, capture = false) {
      if (capture) {
        this.captureListeners?.set(name, (this.captureListeners.get(name) || []).filter(entry => entry !== handler));
        return;
      }
      this.listeners.set(name, (this.listeners.get(name) || []).filter(entry => entry !== handler));
    }
    dispatchEvent(event) {
      let stopped = false;
      const originalStop = event.stopImmediatePropagation;
      event.stopImmediatePropagation = () => { stopped = true; originalStop?.call(event); };
      for (const handler of [...this.captureListeners?.get(event.type) || [], ...this.listeners.get(event.type) || []]) {
        if (stopped) break;
        handler(event);
      }
      event.stopImmediatePropagation = originalStop;
    }
    click() {
      if (!this.disabled) this.dispatchEvent({type: 'click', detail: 1, preventDefault() {}});
    }
    focus() { document.activeElement = this; }
    set innerHTML(value) { throw new Error('Unit renderer must never assign innerHTML.'); }
  }
  document.createElement = (tag) => new Element(tag);
  document.createTextNode = (data) => ({nodeType: 3, data: String(data), parentNode: null, ownerDocument: document});
  return document;
}

function findAll(node, predicate) {
  const element = node[0] || node;
  return [element, ...element.children.flatMap((child) => findAll(child, () => true))].filter(predicate);
}

module.exports = {createDocument, findAll};
