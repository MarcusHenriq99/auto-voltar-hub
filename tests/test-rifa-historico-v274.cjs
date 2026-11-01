const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
function extract(from, to) {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert.ok(a >= 0 && b > a, from);
  return source.slice(a, b);
}
let now = new Date('2026-10-31T23:00:00Z').getTime(), writes = 0, starts = 0;
let edition = { id: '31-20', inicio: now + 600000, abriu: false }, prize = '';
const FakeDate = class extends Date { static now() { return now; } };
const cfg = { ligado: true, rifa: { ligado: false, premios: ['Fúria'], limiteGasto: 1000000, historico: [] } };
const { document } = require('./fixtures/rifa-dom.cjs');
const historyElement = document.createElement('div');
const context = {
  cfg, Date: FakeDate, ocupado: false, rifaMenu: null,
  salvarCfg: () => { writes++; }, edicaoRifaAtual: () => edition,
  anuncioRifa: () => prize, premioMarcadoRifa: p => cfg.rifa.premios.includes(p),
  rifaStatus: () => {}, executarRifa: () => { starts++; }, log: () => {},
};
vm.createContext(context);
vm.runInContext(extract('  const rifaEstado =', '  const conferirResultadoRifa =') +
  extract('  const vigiarRifa =', '  const abrirMenuRifa =') +
  '\nglobalThis.api = { watch: vigiarRifa, reason: registrarMotivoRifa, text: textoHistoricoRifa, finalize: encerrarObservacoesRifa, render: atualizarHistoricoRifa };', context);
const api = context.api;
api.watch({});
assert.equal(cfg.rifa.historico.length, 1, 'Registrar mesmo desligada e sem anúncio');
assert.match(cfg.rifa.historico[0].resultado, /Ignorada.*desligada/);
const firstWrites = writes;
for (let i = 0; i < 100; i++) api.watch({});
assert.equal(writes, firstWrites, 'Não persistir avisos idênticos a cada tick');
assert.equal(cfg.rifa.historico[0].ocorrencias.length, 1);
prize = 'Hino de Bragi';
api.watch({});
assert.equal(cfg.rifa.historico[0].premio, prize, 'Completar prêmio quando anúncio chegar');
assert.ok(writes > firstWrites, 'Persistir prêmio mesmo quando motivo não muda');
cfg.rifa.ligado = true;
api.watch({});
assert.match(cfg.rifa.historico[0].resultado, /Ignorada.*prêmio não marcado/);
assert.equal(starts, 0);
assert.match(api.text(), /desligada/);
assert.match(api.text(), /prêmio não marcado/);
cfg.rifa.premios = [];
api.watch({}); assert.match(cfg.rifa.historico[0].resultado, /nenhum prêmio selecionado/);
cfg.rifa.premios = ['Fúria']; cfg.rifa.limiteGasto = 0;
api.watch({}); assert.match(cfg.rifa.historico[0].resultado, /orçamento/);
cfg.rifa.limiteGasto = 1000000; context.ocupado = true;
api.watch({}); assert.match(cfg.rifa.historico[0].resultado, /Aguardando rotina/);
context.ocupado = false; prize = 'Fúria';
api.watch({}); assert.match(cfg.rifa.historico[0].resultado, /Aguardando último minuto/);
edition.abriu = true; now = edition.inicio;
api.watch({}); assert.equal(starts, 1, 'Histórico de ignorada não bloqueia participação após mudar configuração');
const record = cfg.rifa.historico[0];
record.confirmados = 2; record.gasto = 1000000; record.resultado = 'Não ganhou'; record.vencedor = 'Outra pessoa';
api.reason(edition, prize, 'Limite atingido', 'orçamento esgotado');
assert.equal(record.resultado, 'Não ganhou', 'Preservar resultado de edição com bilhetes');
assert.equal(record.confirmados, 2); assert.equal(record.gasto, 1000000);
cfg.rifa.ultimaEdicao = edition.id; cfg.rifa.ligado = false;
api.watch({}); assert.equal(record.resultado, 'Não ganhou', 'Não sobrescrever edição concluída com OFF posterior');
edition = { id: '31-22', inicio: now + 7200000, abriu: true };
api.watch({});
assert.equal(cfg.rifa.historico.length, 2, 'Uma entrada nova para outra edição');
assert.equal(cfg.rifa.historico[1], record);
cfg.rifa.ligado = true; context.ocupado = true;
api.watch({});
now = edition.inicio + 91*60000; edition = null;
api.watch({}); assert.match(cfg.rifa.historico[0].resultado, /Não participou.*ocupado/);
assert.match(api.text(), /Comprados: 0/);
assert.match(api.text(), /Vencedor: Outra pessoa/);
vm.runInContext('rifaMenu = globalThis.menu;', Object.assign(context, { menu: { querySelector: () => historyElement } }));
api.reason({ id: 'next', inicio: now }, 'Fúria', 'Entrada falhou', 'NPC não encontrado');
assert.match(historyElement.textContent, /NPC não encontrado/, 'Atualizar histórico aberto na hora');
assert.equal(historyElement.children.length, 3, 'Cada horário tem seu próprio grupo');
assert.ok(historyElement.children.every(x => x.tagName === 'details' && !x.open), 'Todas as edições começam recolhidas');
assert.equal(historyElement.children[0].children[0].tagName, 'summary', 'Seta nativa por edição');
assert.match(historyElement.children[0].children[0].textContent, /Fúria.*0 bilhete/);
historyElement.children[1].open = true;
const openedId = historyElement.children[1].dataset.rifaEdicao;
api.reason({ id: 'next', inicio: now }, 'Fúria', 'Parada', 'sem saldo');
assert.equal(historyElement.children.find(x => x.dataset.rifaEdicao === openedId).open, true, 'Atualizações preservam a edição expandida');
assert.match(historyElement.children[0].children[1].textContent, /sem saldo/);
assert.doesNotMatch(historyElement.children[1].children[1].textContent, /sem saldo/, 'Detalhes não se misturam entre horários');
console.log('OK: edições ignoradas, OFF, prêmio tardio, motivos sem spam, mudança de ajustes, rotina ocupada, prazo encerrado, resultados preservados e painel atualizado.');
