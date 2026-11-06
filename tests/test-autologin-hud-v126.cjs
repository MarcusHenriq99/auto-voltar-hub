const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'AUTOLOGIN-YGGIDLE.user.js'), 'utf8');
const extract = (a, b) => {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert.ok(start >= 0 && end > start, `Source boundaries: ${a}`);
  return source.slice(start, end);
};

// DOM contract checked against the shipped PregameScreen: role=button,
// aria-pressed, name in a titled div, Nv., and aside > h2 + Jogar.
class Element {
  constructor(tag, value = '', attrs = {}, children = []) {
    this.tagName = tag; this.value = value; this.attrs = attrs;
    this.children = children; this.isConnected = true; this.disabled = false;
    for (const child of children) child.parentElement = this;
  }
  get textContent() { return [this.value, ...this.children.map(c => c.textContent)].filter(Boolean).join(' '); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.hidden ? 0 : 100, height: this.hidden ? 0 : 30 }; }
  matches(selector) {
    if (selector === '*') return true;
    if (selector.startsWith('#')) return this.attrs.id === selector.slice(1);
    const tag = selector.match(/^[a-z0-9]+/i)?.[0];
    if (tag && this.tagName !== tag) return false;
    return [...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)].every(([, key, value]) => this.attrs[key] != null && (value === undefined || String(this.attrs[key]) === value));
  }
  querySelectorAll(selector) {
    const all = this.children.flatMap(c => [c, ...c.querySelectorAll('*')]);
    return all.filter(c => selector.split(',').some(s => c.matches(s.trim())));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  dispatchEvent(event) {
    if (event.type === 'click') { this.onClick?.(); this.parentElement?.dispatchEvent(event); }
    return true;
  }
}
const el = (tag, text, attrs, children) => new Element(tag, text, attrs, children);
function setup(options = {}) {
  let now = 100000, selectionAt = null;
  const actions = [], logs = [];
  const names = options.names || ['Manny Voadora', 'Sucateira'];
  let selected = options.selected || 'Sucateira';
  const tiles = names.map(name => {
    const title = el('div', name, { title: name });
    const tile = el('div', '', { role: 'button', 'aria-pressed': String(name === selected), title: `${name} (duplo clique entra)` }, [title, el('div', 'Mestre Taekwon'), el('div', 'Nv. 164')]);
    tile.onClick = () => { actions.push(`selecionar:${name}`); selectionAt = { name, at: now }; };
    return tile;
  });
  const jogar = el('button', 'Jogar');
  jogar.disabled = Boolean(options.disabled);
  jogar.onClick = () => actions.push(`jogar:${selected}`);
  const deletar = el('button', 'Deletar');
  deletar.onClick = () => actions.push('deletar');
  const heading = el('h2', selected, { title: selected }, [el('span', '')]);
  const aside = el('aside', '', {}, [heading, jogar, deletar]);
  const root = el('div', '', { id: 'elrag-pregame' }, [el('h1', 'Seus personagens'), ...tiles, el('button', '+ Criar personagem'), aside]);
  const body = el('body', '', {}, [root]);
  const document = el('document', '', {}, [body]); document.body = body;
  const game = { document, MouseEvent: class { constructor(type) { this.type = type; } }, __elragEngine: { pregameEnter() { actions.push('motor'); } } };
  const ctx = {
    console, Date: class extends Date { static now() { return now; } },
    cfg: { ligado: true, personagem: 'Manny Voadora', conhecidos: [], religarAutopilot: true, voltarParaCaca: true },
    identidade: 'marcush2', pedidoManualAte: 0,
    pausadoPeloServidor: () => Boolean(options.paused), salvar() {}, pintar() {},
    log: message => logs.push(message),
    religarAutopilot: async () => actions.push('retomar'),
    esperar: async ms => {
      now += ms;
      options.onWait?.(ctx, ms);
      if (selectionAt && !options.noSelection && now - selectionAt.at >= 400) {
        selected = selectionAt.name;
        for (const tile of tiles) tile.attrs['aria-pressed'] = String(tile.children[0].value === selected);
        if (!options.wrongPanel) heading.value = selected;
      }
    },
  };
  vm.createContext(ctx);
  vm.runInContext(extract('  const clicarBotao =', '  // O clique global') +
    extract('  const visivel = (el) =>', '  // O motor so aparece') +
    extract('  const telaDePersonagens =', '  let pedidoManualAte =') +
    extract('  const tentarEnterPeloMotor =', '  const CIDADES =') +
    '\nglobalThis.api = { cards, jogarDoPersonagem, entrar, selecionarEJogar };', ctx);
  return { ctx, game, actions, logs, tiles, jogar, aside, heading };
}
(async () => {
  let t = setup();
  assert.deepEqual(Array.from(t.ctx.api.cards(t.game.document), c => c.nome), ['Manny Voadora', 'Sucateira']);
  assert.equal(t.ctx.api.jogarDoPersonagem(t.game.document, 'Manny Voadora'), null, 'Default wrong selection is not accepted');
  await t.ctx.api.entrar(t.game);
  assert.deepEqual(t.actions, ['selecionar:Manny Voadora', 'jogar:Manny Voadora', 'retomar'], 'Select name, wait for state, click Jogar, retain hunt recovery');
  assert.equal(t.ctx.cfg.conhecidos.join('|'), 'Manny Voadora|Sucateira');
  await t.ctx.api.entrar(t.game);
  assert.equal(t.actions.filter(a => a.startsWith('jogar:')).length, 1, 'Cooldown prevents repeated entry');

  for (const options of [{ noSelection: true }, { wrongPanel: true }, { disabled: true }]) {
    t = setup(options); await t.ctx.api.entrar(t.game);
    assert.deepEqual(t.actions, ['selecionar:Manny Voadora'], `No unconfirmed entry: ${JSON.stringify(options)}`);
  }
  for (const change of ['off', 'name', 'profile', 'manual']) {
    t = setup({ onWait(ctx, ms) {
      if (ms !== 200) return;
      if (change === 'off') ctx.cfg.ligado = false;
      if (change === 'name') ctx.cfg.personagem = 'Sucateira';
      if (change === 'profile') ctx.identidade = 'outra-conta';
      if (change === 'manual') ctx.pedidoManualAte = Infinity;
    } });
    await t.ctx.api.entrar(t.game);
    assert.ok(!t.actions.some(a => a.startsWith('jogar:')), `${change} cancels entry`);
  }
  t = setup({ names: ['Manny Voadora II', 'Sucateira'] });
  await t.ctx.api.entrar(t.game);
  assert.deepEqual(t.actions, [], 'Similar name never substitutes saved character');
  t = setup({ paused: true }); await t.ctx.api.entrar(t.game);
  assert.deepEqual(t.actions, [], 'Server pause preserved');
  t = setup(); t.ctx.pedidoManualAte = Infinity; await t.ctx.api.entrar(t.game);
  assert.deepEqual(t.actions, [], 'Manual selection pause preserved');
  t = setup(); t.ctx.cfg.ligado = false; await t.ctx.api.entrar(t.game);
  assert.deepEqual(t.actions, [], 'OFF preserved');
  t = setup({ selected: 'Manny Voadora' }); await t.ctx.api.entrar(t.game);
  assert.deepEqual(t.actions, ['selecionar:Manny Voadora', 'jogar:Manny Voadora', 'retomar'], 'Already selected character still uses name then Jogar');

  // Legacy card keeps its own Entrar button while the new HUD rolls out.
  t = setup();
  const button = el('button', 'Entrar');
  const legacy = el('div', '', {}, [el('div', 'Manny Voadora'), el('div', 'Nível 164'), button]);
  const heading = el('h1', 'Seus personagens');
  t.game.document.body.children = [heading, legacy];
  button.onClick = () => { t.actions.push('entrar-legado'); t.game.document.body.children = []; };
  assert.equal(t.ctx.api.cards(t.game.document)[0].nome, 'Manny Voadora');
  await t.ctx.api.entrar(t.game);
  assert.deepEqual(t.actions, ['entrar-legado', 'retomar'], 'Legacy entry and hunt recovery retained');
  console.log('OK: nova HUD seleciona nome exato e confirma cartao/painel antes de Jogar; sem entrada errada, duplicada ou pelo motor; preserva pausas e retomada.');
})().catch(error => { console.error(error); process.exitCode = 1; });

