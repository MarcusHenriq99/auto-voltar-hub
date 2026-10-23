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
  'globalThis.api={cfg,precisaVender,pesoSeguroParaVoltar};'
);
const saved = new Map();
const context = {
  console, setInterval: () => 0,
  document: { querySelectorAll: () => [] },
  localStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  },
};
vm.createContext(context);
vm.runInContext(source, context);
const { cfg, precisaVender, pesoSeguroParaVoltar } = context.api;
cfg.venda.ligado = true;
const weightLabel = { textContent: 'Peso 6.000 / 6.400', ownerDocument: null, isConnected: false };
const game = { document: { querySelectorAll: () => [weightLabel], body: { innerText: '' } } };

(async () => {
  assert.strictEqual(cfg.rotinaLimites, true, 'Por padrao os limites continuam ativos');
  assert.strictEqual(precisaVender(game), true, 'Peso alto dispara com controle ON');
  cfg.rotinaLimites = false;
  assert.strictEqual(precisaVender(game), false, 'Peso alto e mochila cheia nao iniciam rotina com OFF');
  assert.strictEqual(await pesoSeguroParaVoltar(game), true, 'OFF permite voltar ao farm mesmo pesado');
  console.log('OK: controle por conta ignora limites em OFF e conserva gatilho em ON.');
})().catch(error => { console.error(error); process.exitCode = 1; });

