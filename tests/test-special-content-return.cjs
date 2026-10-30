const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const section = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Trecho ausente: ${start}`);
  return source.slice(a, b);
};

let now = 100000, map = 'lhz_dun04', saved = 0;
const cfg = { conteudo: { modo: 'bio4', expiraEm: 0 } };
const timer = { innerText: 'Bio 4: 39min', closest: () => null };
const game = { document: { querySelectorAll: () => [timer] } };
const context = {
  cfg, Date: { now: () => now }, posicao: () => ({ mapa: map }),
  visivel: () => true, salvarCfg: () => { saved++; }, log: () => {},
};
vm.createContext(context);
vm.runInContext(section('  const mapaCheffenia =', '  const PORTEIRO_BIO4 =') +
  '\nglobalThis.api = { mapaDoConteudo, mapaConfereConteudo, vigiarTempoConteudo, tempoConteudoEsgotado };', context);
context.api.vigiarTempoConteudo(game);
assert.equal(saved, 1, 'Tempo deve ficar salvo para conferir mesmo depois de sair do mapa');
assert.equal(cfg.conteudo.expiraEm, now + 40 * 60000, 'Visor em minutos recebe margem de arredondamento');
map = 'prontera'; now += 39 * 60000;
assert.equal(context.api.tempoConteudoEsgotado(), false, 'Retorno segue permitido dentro do tempo pago');
now += 60001;
assert.equal(context.api.tempoConteudoEsgotado(), true, 'Nao entra novamente quando o tempo acaba');

let conversa = false, entrada = 0, cliqueNpc = 0;
map = 'prontera';
cfg.conteudo = { modo: 'cheffenia', expiraEm: now + 600000 };
cfg.destinoFarm = { mapa: 'moro_vol' };
assert.equal(context.api.mapaConfereConteudo('mid_volinf'), true, 'A instancia real da Cheffenia confirma a chegada');
const npc = { GID: 42, objecttype: 7, constructor: { TYPE_NPC: 7 }, position: [160, 184], display: { name: 'Arauto da Cheffenia' } };
const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 400 }) };
const w = {
  __elragEngine: { camera: { worldToScreen: () => [300, 200] } },
  document: { body: { get innerText() { return conversa ? 'Arauto da Cheffenia' : ''; } } },
};
Object.assign(context, {
  etapa: () => {}, carregarEntidadesNpc: async () => ({ forEach: fn => fn(npc) }),
  canvasDoJogo: () => canvas,
  clicarNoCanvas: async () => { cliqueNpc++; conversa = true; },
  esperarAte: async fn => fn(),
  botaoPorTexto: (_doc, fn) => conversa && fn('Entrar') ? { click() { entrada++; map = 'mid_volinf'; } } : null,
  segurarRetorno: () => false, validarChegadaFarm: () => true, religarEconomia: async () => {},
});
vm.runInContext(section('  const entrarCheffenia =', '  const nomeGerenteEventos =') +
  '\nglobalThis.entrarCheffenia = entrarCheffenia;', context);
context.entrarCheffenia(w).then(ok => {
  assert.equal(ok, true);
  assert.equal(cliqueNpc, 1, 'Clica no Arauto pelo canvas');
  assert.equal(entrada, 1, 'Escolhe Entrar uma vez');
  assert.equal(map, 'mid_volinf', 'Confirma chegada ao mapa real da Cheffenia');
  console.log('OK: timer da Bio 4 e entrada pelo Arauto da Cheffenia.');
}).catch(error => { console.error(error); process.exitCode = 1; });
