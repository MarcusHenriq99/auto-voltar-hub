const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const section = (from, to) => {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `Trecho ausente: ${from}`);
  return source.slice(a, b);
};
const clickSource = section('  const clicarBotao =', '  const clicarNoCanvas =');
const entrySource = section('  const entradaDoMapaPesquisado =', '  const PORTEIRO_BIO4 =');
const returnSource = section('  const voltarAoMapa =', '  const TENTATIVAS_VOLTAR =');

let map = 'prontera', open = false, entryClicks = 0, confirmClicks = 0;
const overlay = {};
const mapButton = { visible: true, isConnected: true, label: 'Mundo de Midgard', click() { open = true; } };
const card = { innerText: 'Mapa: mag_dun02', parentElement: null };
const entry = {
  visible: true, isConnected: true, label: 'Entrar', parentElement: card,
  getBoundingClientRect: () => ({ left: 20, top: 20, width: 100, height: 30 }),
  contains: () => false,
  dispatchEvent(event) { if (event.type === 'click') { entryClicks++; confirm.visible = true; } },
};
const confirm = {
  visible: false, isConnected: true, label: 'Confirmar',
  getBoundingClientRect: () => ({ left: 20, top: 70, width: 100, height: 30 }),
  contains: () => false,
  dispatchEvent(event) { if (event.type === 'click') { confirmClicks++; map = 'mag_dun02'; } },
};
class Input { dispatchEvent() {} focus() {} }
Object.defineProperty(Input.prototype, 'value', { get() { return this._value; }, set(value) { this._value = value; } });
const input = new Input(); input.placeholder = 'Buscar cidade, mapa'; input.visible = true;
const document = {
  querySelectorAll(selector) {
    if (selector === 'input') return open ? [input] : [];
    if (selector === 'button') return open ? [mapButton, entry, confirm] : [mapButton];
    return [];
  },
  querySelector: () => mapButton,
  elementFromPoint: () => overlay,
  body: { innerText: '' },
};
const w = { document, HTMLInputElement: Input, Event: class { constructor(type) { this.type = type; } }, MouseEvent: class { constructor(type) { this.type = type; } } };
const cfg = { ligado: true, mapaFarmManual: 'mag_dun02', destinoFarm: { mapa: 'mag_dun02' }, retornoEvento: false, conteudo: { modo: 'normal', expiraEm: 0 } };
const context = {
  cfg, visivel: el => el.visible, textoDe: el => el.label || el.innerText || '',
  posicao: () => ({ mapa: map }), mapaDeRenascer: () => false,
  botaoPorTexto: (doc, fn) => doc.querySelectorAll('button').find(b => b.visible && fn(b.label)) || null,
  esperar: async () => {}, esperarAte: async fn => fn(),
  etapa: () => {}, log: () => {}, salvarCfg: () => {}, limiteSeguro: () => 70,
  fecharArmazem: async () => true, pesoSeguroParaVoltar: async () => true,
  sairDaEconomia: async () => {}, religarEconomia: async () => {},
  diagTela: () => {}, apertarEsc: () => {}, segurarRetorno: () => false,
  historicoLog: () => [],
};
vm.createContext(context);
vm.runInContext(clickSource + entrySource + returnSource + '\nglobalThis.returnToMap = voltarAoMapa;', context);
context.returnToMap(w).then(ok => {
  assert.equal(ok, true, 'Deve confirmar chegada ao mapa pesquisado');
  assert.equal(entryClicks, 1, 'Clique enviado ao botao Entrar, nao a camada sobreposta');
  assert.equal(confirmClicks, 1, 'Encontra confirmacao que ja existia oculta');
  assert.equal(map, 'mag_dun02');
  console.log('OK: mapa exato, botao encoberto e confirmacao antes oculta.');
}).catch(error => { console.error(error); process.exitCode = 1; });
