const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const extract = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
let saves = 0, scrolls = 0, menus = 0;
const context = {
  normalizar, cfg: { venda: { nomes: ['Aço', 'Gema <especial> & rara'], proteger: {} }, armazem: {} },
  estadoLoja: { mochila: {} },
  fecharOutros: () => {}, abrirSubjanela: () => {}, jogo: () => null,
  TIPOS_VENDA: [], RARIDADES: [], capacidadeMochila: 100, limiteSeguro: () => 70,
  alvoLucky: item => item.name === 'Ovo procurado', protecaoDeCaixa: () => null,
  ovoDePet: item => item.name === 'Ovo de pet', itemTravado: item => item.locked,
  itemDeCompra: item => item.name === 'Poção comprada', itemFavorito: item => item.favorite,
  salvarCfg: () => { saves++; },
  document: {
    createElement: () => ({
      innerHTML: '', listeners: {}, section: { open: false, scrollIntoView: () => { scrolls++; } },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      querySelector() { return this.section; }, remove() {},
    }),
    body: { appendChild: () => { menus++; } },
  },
};
vm.createContext(context);
vm.runInContext(extract('  const nomeBase =', '  const ITENS_ALFHEIM =') +
  extract('  const NUNCA_VENDER_FIXO =', '  const protecaoDaLinha =') +
  extract('  const PREMIOS_RIFA =', '  const rifaEstado =') +
  extract('  const protecaoDaLinha =', '  const linhasDeVenda =') +
  'let menuVenda = null, menuVendaProtegidos = false;\n' + extract('  function abrirMenuVenda(', '  function atualizarPainel()') +
  '\nglobalThis.api = { nuncaVender, nuncaVenderNome, motivoProtecao, protecaoDaLinha, abrirMenuVenda, menu: () => menuVenda, premios: PREMIOS_RIFA };', context);
const a = context.api;
assert.match(a.nuncaVenderNome('+7 Carta Ascensão de LHZ [1]'), /item raro/);
for (const name of a.premios) assert.match(a.nuncaVender({ name }), /rifa/);
assert.match(a.nuncaVender({ name: 'Equipamento', rarity: { tier: 5 } }), /lendario/);
assert.match(a.protecaoDaLinha('Aço'), /lista desta conta/, 'Protege linha mesmo sem mochila lida');
assert.equal(a.nuncaVenderNome('Sacola'), null);
assert.equal(a.nuncaVenderNome('Pedaço'), null);
assert.equal(a.nuncaVenderNome('Osso'), null);
for (const item of [{ name: 'Ovo procurado' }, { name: 'Ovo de pet' },
  { name: 'Cartão Kafra' }, { name: 'Asa de Mosca' }, { name: 'Poção comprada' },
  { name: 'Favorito', favorite: true }, { name: 'Travado', locked: true }]) {
  assert.ok(a.motivoProtecao(item, 'etc'), item.name + ' mantém proteção');
}
context.estadoLoja.mochila = { etc: [{ name: 'Cristal pessoal' }] };
a.abrirMenuVenda(true);
let menu = a.menu();
assert.match(menu.innerHTML, /data-nunca-vender/);
assert.match(menu.innerHTML, /Gema &lt;especial&gt; &amp; rara/);
assert.match(menu.innerHTML, /Prêmios da rifa/);
assert.match(menu.innerHTML, /Ascensão de LHZ/);
assert.doesNotMatch(menu.innerHTML, /data-v="ligado"|data-v="limite"|data-capacidade|data-ar=|data-a="testar"/, 'Nunca vender não duplica controles da rotina');
assert.match(menu.innerHTML, /data-v="comCarta"|data-v="raridadeMin"/, 'Regras de proteção ficam na lista');
menu.listeners.input({ target: { dataset: { v: 'nomes' }, value: '  Cristal pessoal  \n\nOutra gema' } });
assert.equal(saves, 1);
assert.deepEqual(Array.from(context.cfg.venda.nomes), ['Cristal pessoal', 'Outra gema']);
assert.match(a.protecaoDaLinha('Cristal pessoal'), /lista desta conta/);
assert.match(a.motivoProtecao({ name: 'Cristal pessoal' }, 'etc'), /lista desta conta/, 'Mesma proteção usada pelo ferreiro e depósito');
assert.equal(a.nuncaVenderNome('Aço'), null, 'Remoção da lista pessoal é respeitada');
menu.listeners.input({ target: { dataset: { v: 'nomes' }, value: '' } });
assert.match(a.nuncaVenderNome('Carta Ascensão de LHZ'), /item raro/);
assert.match(a.nuncaVenderNome('Runa Eterna de Thanatos'), /rifa/);
a.abrirMenuVenda({ type: 'click' });
assert.ok(a.menu(), 'Botão Venda troca para opções da rotina');
assert.match(a.menu().innerHTML, /data-v="ligado"/);
assert.match(a.menu().innerHTML, /data-v="limite"/);
assert.match(a.menu().innerHTML, /data-a="testar"/);
assert.doesNotMatch(a.menu().innerHTML, /data-v="nomes"|data-v="raridadeMin"|data-v="comCarta"|data-p=|data-nunca-vender/, 'Venda não duplica listas e proteções');
a.abrirMenuVenda({ type: 'click' });
assert.equal(a.menu(), null, 'Botão Venda mantém alternância normal');
a.abrirMenuVenda(true);
a.menu().listeners.click({ target: { dataset: { a: 'fechar' } } });
assert.equal(a.menu(), null, 'Fechar Nunca vender não abre Venda');
console.log('OK: proteção por conta e janelas distintas de Venda e Nunca vender, sem controles duplicados.');
