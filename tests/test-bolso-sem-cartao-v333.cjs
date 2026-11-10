const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const ini = source.indexOf('  const venderNoMapa =');
const fim = source.indexOf('  let bolsoPrecisaKafra', ini);
assert.ok(ini > 0 && fim > ini, 'trecho de venderNoMapa encontrado');
const ctx = { cfg: null, guardarTudo: () => ctx.cfg.armazem.modoInventario === 'guardar' };
vm.createContext(ctx);
vm.runInContext(source.slice(ini, fim) + '\nglobalThis.api = { venderNoMapa, cartaoNoMapa };', ctx);
const base = () => ({ ferreiro: false, lojaBolso: true, venda: { ligado: true },
  armazem: { ligado: false, usarCartao: false, tudoNoMapa: false, modoInventario: 'vender' } });

ctx.cfg = base();
assert.equal(ctx.api.venderNoMapa(), true, 'Loja de Bolso sem Cartao Kafra vende no mapa');
assert.equal(ctx.api.cartaoNoMapa(), false, 'sem cartao nao tenta depositar');
ctx.cfg = { ...base(), armazem: { ligado: true, usarCartao: true, tudoNoMapa: true, modoInventario: 'vender' } };
assert.equal(ctx.api.venderNoMapa(), true);
assert.equal(ctx.api.cartaoNoMapa(), true, 'com cartao tambem deposita');
ctx.cfg = { ...base(), lojaBolso: false };
assert.equal(ctx.api.venderNoMapa(), false, 'sem Loja de Bolso vai a cidade');
ctx.cfg = { ...base(), ferreiro: true };
assert.equal(ctx.api.venderNoMapa(), false, 'Ferreiro so existe na cidade');
ctx.cfg = { ...base(), venda: { ligado: false } };
assert.equal(ctx.api.venderNoMapa(), false, 'venda desligada nao vende');
ctx.cfg = base(); ctx.cfg.armazem.modoInventario = 'guardar';
assert.equal(ctx.api.venderNoMapa(), false, 'modo Guardar tudo nao vende');
assert.match(source, /bolsoPrecisaKafra = true;/, 'peso que nao baixa sem cartao manda uma vez a Kafra');
console.log('OK: Loja de Bolso vende no mapa sem exigir Cartao Kafra.');
