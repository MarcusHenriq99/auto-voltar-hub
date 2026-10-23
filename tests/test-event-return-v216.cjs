const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

let source = fs.readFileSync(require('path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
source = source.replace(
  '  fznBypassIsTrusted(window);\n  fznHackClick(window);\n  fznInjetar();\n  setInterval(fznInjetar, 500);',
  ''
);
source = source.replace(
  '  atualizarPainel();\n  setInterval(verificar, 500);',
  'globalThis.api={cfg,npcGerenteEventos,opcaoTeleportEvento,nomeGerenteEventos};'
);
const saved = new Map();
const context = {
  console,
  setInterval: () => 0,
  document: { querySelectorAll: () => [] },
  localStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  },
};
vm.createContext(context);
vm.runInContext(source, context);
const { cfg, npcGerenteEventos, opcaoTeleportEvento, nomeGerenteEventos } = context.api;
assert.strictEqual(cfg.retornoEvento, false, 'Evento deve iniciar desligado');
assert.strictEqual(nomeGerenteEventos('Gerente de Eventos'), true);
assert.strictEqual(nomeGerenteEventos('Gerente de Prêmios'), true, 'Nome real do NPC no jogo');

const npc = (name, gid) => ({
  constructor: { TYPE_NPC: 1 }, objecttype: 1, GID: gid, position: [150, 180],
  display: { name }, onMouseDown() {},
});
const gerente = npc('Gerente de Prêmios', 12);
const gerenteUnico = { forEach(fn) { [npc('Kafra', 1), gerente, npc('Mercador', 2)].forEach(fn); } };
assert.strictEqual(npcGerenteEventos(gerenteUnico), gerente, 'Achar gerente pelo nome, sem coordenada/zoom');
const ambiguo = { forEach(fn) { [gerente, npc('Gerente de Prêmios', 13)].forEach(fn); } };
assert.strictEqual(npcGerenteEventos(ambiguo), null, 'Nao escolher NPC ambiguo');

const button = text => ({
  innerText: text, disabled: false, closest: () => null,
  getBoundingClientRect: () => ({ width: 90, height: 24 }),
});
const ir = button('Ir para o evento');
const premio = button('Trocar prêmios');
const game = { document: { querySelectorAll: () => [ir, premio] } };
assert.strictEqual(opcaoTeleportEvento(game), ir, 'Escolher teleporte, nunca troca de premios');
game.document.querySelectorAll = () => [button('Trocar prêmios')];
assert.strictEqual(opcaoTeleportEvento(game), null, 'Sem teleporte, permanecer na cidade');
console.log('OK: modo Evento desligado por padrao; identifica gerente e opcao de teleporte sem escolher premios.');

