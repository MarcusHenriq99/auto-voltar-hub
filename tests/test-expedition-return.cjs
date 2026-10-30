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
const cfg = { expedicaoFase: 'Portal do Abismo' };
const cards = ['Calabouço I', 'Calabouço II', 'Portal do Abismo'].map((nome) => {
  const card = { innerText: `${nome} DESBLOQUEADO Entrar`, parentElement: null };
  const button = { innerText: 'Entrar', parentElement: card, disabled: false };
  return { card, button };
});
const w = { document: { querySelectorAll: () => cards.map(c => c.button) } };
const context = {
  cfg, normalizar: (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(),
  textoDe: (e) => e.innerText, visivel: () => true,
};
vm.createContext(context);
vm.runInContext(section('  const faseExpedicaoNoTexto =', '  const entrarExpedicao =') +
  '\nglobalThis.entradaDaExpedicao = entradaDaExpedicao;', context);
for (const [i, fase] of ['Calabouço I', 'Calabouço II', 'Portal do Abismo'].entries()) {
  cfg.expedicaoFase = fase;
  assert.equal(context.entradaDaExpedicao(w), cards[i].button, `Seleciona somente ${fase}`);
}
cfg.expedicaoFase = 'Portal do Abismo';
cards[2].button.disabled = true;
assert.equal(context.entradaDaExpedicao(w), null, 'Não entra quando o terceiro mapa está indisponível');
const fluxo = section('  const voltarAoMapa =', '  const TENTATIVAS_VOLTAR =');
assert.ok(fluxo.indexOf("cfg.conteudo.modo === 'expedicao'") < fluxo.indexOf('const pesquisar ='),
  'O modo Expedição é tratado antes da busca do mapa comum');
assert.ok(fluxo.includes('entrada somente pelo NPC em Prontera'), 'Modo especial não cai no mapa comum');
console.log('OK: seleção exata dos três mapas e retorno da Expedição somente pelo NPC.');
