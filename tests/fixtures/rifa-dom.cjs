// DOM mínimo para testar agrupamento e preservação das setas abertas.
class Element {
  constructor(tag, doc) {
    this.tagName = tag; this.ownerDocument = doc; this.children = [];
    this.dataset = {}; this.style = {}; this.open = false; this.value = '';
  }
  set textContent(value) { this.value = value; this.children = []; }
  get textContent() { return this.value + this.children.map(x => x.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.value = ''; this.children = children; }
  querySelectorAll() { return this.children.filter(x => x.tagName === 'details' && x.dataset.rifaEdicao); }
}
const document = { createElement: tag => new Element(tag, document) };
module.exports = { document, Element };
