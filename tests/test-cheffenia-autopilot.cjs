const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOHUNT-YGGIDLE.user.js'), 'utf8');
const trecho = (de, ate) => {
  const a = source.indexOf(de), b = source.indexOf(ate, a);
  assert.ok(a >= 0 && b > a, `Trecho ausente: ${de}`);
  return source.slice(a, b);
};
let agora = 10000, mapa = 'vulcao_cheff', ligacoes = 0;
const cfg = { ligado: true, asa: 'auto', soMvp: true, cheffeniaTeleporte: false };
const w = { document: { body: { innerText: 'Chefenia Solo: 53min Voltar para Prontera' } } };
const e = { setAutopilotRunning(on) { if (on) ligacoes++; } };
w.__elragEngine = e;
const ctx = {
  cfg, Date: { now: () => agora }, posicao: () => ({ mapa }), CIDADES_RE: /^prontera$/,
  mapaDeRenascer: () => false, temJanelaAberta: () => true,
  AUTOPILOT_PARADO: new Set([0, 1]), log: () => {},
};
vm.createContext(ctx);
vm.runInContext(
  trecho('  const janelaBloqueiaReligar =', '  // v1.60: sempre ativo') +
  trecho('  const mapaCheffenia =', '  const visivelCheff =') +
  trecho('  let apParadoDesde =', '  const ciclo =') +
  '\nglobalThis.api = { sessaoCheffenia, janelaBloqueiaReligar, ligarAutopilotAoEntrarCheffenia };', ctx);

assert.equal(ctx.api.sessaoCheffenia(w, e), true, 'O timer identifica Chefenia mesmo se o codigo do mapa mudar');
assert.equal(ctx.api.janelaBloqueiaReligar(w, mapa), false, 'Convite Voltar para nao bloqueia o Autopilot');
assert.equal(ctx.api.ligarAutopilotAoEntrarCheffenia(w, e, { runtimeState: 1 }, agora, mapa), true);
assert.equal(ligacoes, 1, 'Liga na entrada sem esperar tres segundos');
assert.equal(ctx.api.ligarAutopilotAoEntrarCheffenia(w, e, { runtimeState: 1 }, agora + 100, mapa), false);
assert.equal(ligacoes, 1, 'Nao repete o clique a cada ciclo');
w.document.body.innerText = 'Renascer agora';
assert.equal(ctx.api.janelaBloqueiaReligar(w, mapa), true, 'Morte continua bloqueando a religacao');

const asas = {
  cfg, sessaoCheffenia: () => true, posicao: () => ({ mapa }), Date: { now: () => agora },
  snapshotAp: () => ({}), mvpEmCombate: () => false,
};
vm.createContext(asas);
vm.runInContext(trecho('  const usarAsa =', '  setInterval(() => {\n    try { if (ocupado)') +
  '\nglobalThis.usar = usarAsa;', asas);
assert.equal(asas.usar(w, e, agora), false, 'Asa Chefenia OFF impede o Auto Hunt de usar asa');

const nomes = source.match(/  const MVP_NOMES = new Set\([^\n]+/)[0];
const catalogo = { Set, normN: s => String(s).toLowerCase().replace(/[^a-z0-9]/g, ''),
  catIds: new Set([1038]), catNomes: new Set(['osiris']), MVP_IDS: new Set() };
vm.createContext(catalogo);
vm.runInContext(nomes + '\n' + trecho('  const ehMvp =', '  let mvpFixado =') +
  '\nglobalThis.ehMvpTeste = ehMvp;', catalogo);
for (const name of ['Cabra da Peste', 'Cabra Safado', 'Cabra Macho'])
  assert.equal(catalogo.ehMvpTeste({ name, mobId: 99999 }), true, `${name} deve valer mesmo com catalogo antigo`);
console.log('OK: entrada liga Autopilot, asa OFF bloqueada e Cabras reconhecidos.');
