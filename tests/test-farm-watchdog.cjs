const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const start = source.indexOf('  let foraFarmDesde = 0');
const end = source.indexOf('  const dispensarAvisoDiario', start);
assert.ok(start >= 0 && end > start, 'A vigia de mapa deve existir');

let now = 5000;
let position = { mapa: 'prontera' };
const logs = [];
const context = {
  Date: { now: () => now },
  cfg: { mapaFarmManual: 'mag_dun02', destinoFarm: { mapa: 'mag_dun02' }, covil: { ligado: false } },
  rifaRodando: false, recuperacao: null, vigia: null, chegadaAtrasada: null, ocupado: false,
  posicao: () => position, mapaDeRenascer: () => false,
  log: (message) => logs.push(message), etapa: () => {}, Math,
};
vm.createContext(context);
vm.runInContext(source.slice(start, end) + '\nglobalThis.conferir = conferirMapaFarm;', context);

context.conferir({});
assert.equal(context.recuperacao, null, 'Nao deve retornar por uma leitura isolada');
now = 15000;
context.conferir({});
assert.equal(context.recuperacao, null, 'Deve aguardar a confirmacao do desvio');
now = 22000;
context.conferir({});
assert.equal(context.recuperacao?.motivo, 'fora do mapa de farm');
assert.ok(logs.some((entry) => entry.includes('iniciando retorno')));

position = { mapa: 'mag_dun02' };
now = 27000;
context.conferir({});
assert.ok(logs.some((entry) => entry.includes('destino confirmado')));

context.recuperacao = null;
context.rifaRodando = true;
position = { mapa: 'prontera' };
now = 32000;
context.conferir({});
now = 52000;
context.conferir({});
assert.equal(context.recuperacao, null, 'Nao interfere durante a rifa');
console.log('OK: vigia confirma o desvio, inicia recuperacao e respeita a rifa.');
