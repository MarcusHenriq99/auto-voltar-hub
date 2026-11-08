// ==UserScript==
// @name         Yggidle — voltar ao mapa apos morrer (com cura na Kafra)
// @namespace    https://jogo.yggidle.com.br/
// @version      3.24
// @description  Rotina de peso/espacos por conta; protege e avisa sobre lucky drops.
// @match        https://jogo.yggidle.com.br/*
// @noframes
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// ==/UserScript==

(() => {
  'use strict';

  // O Hub descarta os timers antes de reaplicar o arquivo. O marcador precisa
  // acompanhar esse descarte, ou a próxima cópia retorna sem iniciar o vigia.
  const noHub = typeof FZN_onDispose === 'function';
  const instanciaAnterior = window.__fznAutoVoltarInstancia;
  if (instanciaAnterior && !(noHub && instanciaAnterior === true)) return;
  const limparInterfaceAutoVoltar = () => {
    document.querySelectorAll('[data-fzn-auto-voltar], [data-fzn-av-aux], .fzn-rifa-menu')
      .forEach(el => el.remove());
  };
  // Migração do marcador booleano da v2.74–2.76, já descartado pelo Hub.
  if (instanciaAnterior === true && noHub) limparInterfaceAutoVoltar();
  const instanciaAutoVoltar = { ativa: true };
  window.__fznAutoVoltarInstancia = instanciaAutoVoltar;
  if (noHub) FZN_onDispose(() => {
    instanciaAutoVoltar.ativa = false;
    if (window.__fznAutoVoltarInstancia !== instanciaAutoVoltar) return;
    delete window.__fznAutoVoltarInstancia;
    limparInterfaceAutoVoltar();
  });

  const fznBypassIsTrusted = (win) => {
    if (!win || win.__fznIsTrustedHook) return;
    win.__fznIsTrustedHook = true;
    try {
      const desc = Object.getOwnPropertyDescriptor(win.Event.prototype, 'isTrusted');
      if (desc && desc.get) win.__fznIsTrustedGetter = desc.get;
    } catch (e) {}
    try {
      Object.defineProperty(win.Event.prototype, 'isTrusted', { get: function() { return true; }, configurable: true });
    } catch (e) {}
    const proto = win.EventTarget && win.EventTarget.prototype;
    if (!proto || typeof proto.addEventListener !== 'function') return;
    if (!win.__fznAddEventListenerNativo) win.__fznAddEventListenerNativo = proto.addEventListener;
    const origAdd = proto.addEventListener;
    const origRemove = proto.removeEventListener;
    const cache = new WeakMap();
    proto.addEventListener = function (type, listener, opts) {
      if (typeof listener !== 'function') return origAdd.call(this, type, listener, opts);
      if (listener.__fznNoWrap) return origAdd.call(this, type, listener, opts);
      let wrapped = cache.get(listener);
      if (!wrapped) {
        wrapped = function (event) {
          if (!event || typeof event !== 'object' || event.isTrusted === true) return listener.call(this, event);
          const fake = new Proxy(event, { get(t, p, r) { return p === 'isTrusted' ? true : Reflect.get(t, p, t); } });
          return listener.call(this, fake);
        };
        wrapped.__fznNoWrap = true; wrapped.__fznOrig = listener; cache.set(listener, wrapped);
      }
      return origAdd.call(this, type, wrapped, opts);
    };
    proto.removeEventListener = function (type, listener, opts) {
      if (typeof listener === 'function') {
        const wrapped = cache.get(listener);
        if (wrapped) return origRemove.call(this, type, wrapped, opts);
      }
      return origRemove.call(this, type, listener, opts);
    };
  };

  const fznHackClick = (win) => {
    if (!win || win.__fznClickHacked) return;
    win.__fznClickHacked = true;
    const origClick = win.HTMLElement.prototype.click;
    win.HTMLElement.prototype.click = function() {
      if (!this.isConnected) return origClick.call(this);
      if (this.closest && this.closest('.fzn-ygg,[data-fzn-auto-voltar]')) return origClick.call(this);
      const r = this.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return origClick.call(this);
      const base = { bubbles: true, cancelable: true, composed: true, view: win, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
      const alvo = win.document.elementFromPoint(base.clientX, base.clientY) || this;
      for (const tipo of ['pointerover', 'pointerenter', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        const Ev = tipo.startsWith('pointer') && win.PointerEvent ? win.PointerEvent : win.MouseEvent;
        try { alvo.dispatchEvent(new Ev(tipo, { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(tipo) ? 1 : 0 })); } catch {}
      }
    };
  };

  const fznInjetar = () => {
    for (const f of document.querySelectorAll('iframe')) {
      try { const w = f.contentWindow; if (w) { fznBypassIsTrusted(w); fznHackClick(w); } } catch {}
    }
  };
  fznBypassIsTrusted(window);
  fznHackClick(window);
  fznInjetar();
  setInterval(fznInjetar, 500);

  function fznRedimensionavel(painel, chave) {
    if (!painel || painel.dataset.fznRedim) return;
    painel.dataset.fznRedim = '1';
    const doc = painel.ownerDocument;
    const win = doc.defaultView;
    const orig = { width: painel.style.width, height: painel.style.height, maxWidth: painel.style.maxWidth, maxHeight: painel.style.maxHeight, minHeight: painel.style.minHeight, overflow: painel.style.overflow, boxSizing: painel.style.boxSizing };
    let tam = null;
    try { tam = JSON.parse(localStorage.getItem(chave)); } catch {}
    const aplicar = () => {
      if (!tam) { Object.assign(painel.style, orig); return; }
      Object.assign(painel.style, { width: tam.w + 'px', height: 'auto', minHeight: tam.h + 'px', maxWidth: '98vw', maxHeight: '98vh', overflow: 'auto', boxSizing: 'border-box' });
    };
    aplicar();
    const alca = doc.createElement('div');
    alca.dataset.fznAvAux = '1';
    alca.title = 'Arraste para redimensionar · dois cliques: tamanho automatico';
    Object.assign(alca.style, { position: 'fixed', zIndex: 2147483647, width: '12px', height: '12px', display: 'none', touchAction: 'none',
      background: 'linear-gradient(135deg, transparent 45%, rgba(255,255,255,.55) 45%, rgba(255,255,255,.55) 55%, transparent 55%, transparent 70%, rgba(255,255,255,.55) 70%, rgba(255,255,255,.55) 80%, transparent 80%)', opacity: '0.6' });
    alca.addEventListener('mouseenter', () => { alca.style.opacity = '1'; });
    alca.addEventListener('mouseleave', () => { alca.style.opacity = '0.6'; });
    const posicionar = () => {
      const r = painel.getBoundingClientRect();
      const visivel = painel.isConnected && painel.dataset.fznEncolhido !== '1' && r.width > 0 && r.height > 0 && win.getComputedStyle(painel).visibility !== 'hidden';
      if (!visivel) { alca.style.display = 'none'; return; }
      alca.style.left = r.left + 'px'; alca.style.top = (r.bottom - 12) + 'px'; alca.style.transform = 'scaleX(-1)'; alca.style.cursor = 'nesw-resize'; alca.style.display = 'block';
    };
    let arr = null;
    alca.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); const r = painel.getBoundingClientRect(); arr = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, dir: r.right, topo: r.top }; alca.setPointerCapture(e.pointerId); });
    alca.addEventListener('pointermove', (e) => { if (!arr) return; const dx = e.clientX - arr.x, dy = e.clientY - arr.y; const w = Math.round(Math.min(win.innerWidth - 8, Math.max(140, arr.w - dx))); const h = Math.round(Math.min(win.innerHeight - 8, Math.max(60, arr.h + dy))); tam = { w, h }; aplicar(); Object.assign(painel.style, { left: Math.max(0, arr.dir - w) + 'px', top: Math.max(0, arr.topo) + 'px', right: 'auto', bottom: 'auto' }); posicionar(); });
    alca.addEventListener('pointerup', () => { if (!arr) return; arr = null; try { localStorage.setItem(chave, JSON.stringify(tam)); } catch {} });
    alca.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); tam = null; aplicar(); posicionar(); try { localStorage.removeItem(chave); } catch {} });
    (doc.body || doc.documentElement).appendChild(alca);
    posicionar();
    win.setInterval(() => { if (!alca.isConnected && doc.body) doc.body.appendChild(alca); if (!arr) posicionar(); }, 400);
    win.addEventListener('resize', posicionar);
  }

  const fznEncolhivel = (painel, chave) => {
    if (!painel || painel.dataset.fznEnc) return;
    painel.dataset.fznEnc = '1'; fznRedimensionavel(painel, chave + '-tamanho');
    const doc = painel.ownerDocument;
    const win = doc.defaultView;
    if (!doc.getElementById('fzn-enc-css')) {
      const css = doc.createElement('style'); css.id = 'fzn-enc-css';
      css.textContent = '[data-fzn-encolhido="1"]{display:none!important}';
      doc.head.appendChild(css);
    }
    let est = { e: false, x: null, y: null };
    try { est = { ...est, ...JSON.parse(localStorage.getItem(chave)) }; } catch {}
    const gravar = () => { try { localStorage.setItem(chave, JSON.stringify(est)); } catch {} };
    const btn = doc.createElement('div');
    btn.dataset.fznAvAux = '1';
    btn.textContent = '–'; btn.title = 'Encolher';
    Object.assign(btn.style, { position: 'fixed', zIndex: 2147483647, width: '14px', height: '14px', lineHeight: '12px', textAlign: 'center', font: 'bold 12px sans-serif', color: '#fff', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.35)', borderRadius: '4px', cursor: 'pointer', userSelect: 'none', display: 'none' });
    const bola = doc.createElement('div');
    bola.dataset.fznAvAux = '1';
    bola.title = 'Abrir';
    Object.assign(bola.style, { position: 'fixed', zIndex: 2147483647, width: '14px', height: '14px', borderRadius: '50%', background: '#999', border: '1px solid #fff', opacity: '0.25', cursor: 'pointer', display: 'none', transition: 'opacity .15s' });
    bola.addEventListener('mouseenter', () => { bola.style.opacity = '0.9'; });
    bola.addEventListener('mouseleave', () => { bola.style.opacity = '0.25'; });
    const posicionar = () => {
      const visivel = painel.isConnected && painel.style.display !== 'none' && win.getComputedStyle(painel).visibility !== 'hidden';
      if (est.e) {
        painel.dataset.fznEncolhido = '1'; btn.style.display = 'none';
        bola.style.left = Math.min(Math.max(0, est.x ?? win.innerWidth - 22), win.innerWidth - 16) + 'px';
        bola.style.top = Math.min(Math.max(0, est.y ?? win.innerHeight - 22), win.innerHeight - 16) + 'px';
        bola.style.display = painel.isConnected && painel.style.display !== 'none' ? 'block' : 'none';
        return;
      }
      delete painel.dataset.fznEncolhido; bola.style.display = 'none';
      const r = painel.getBoundingClientRect();
      if (!visivel || !r.width) { btn.style.display = 'none'; return; }
      btn.style.left = Math.min(r.right - 7, win.innerWidth - 16) + 'px';
      btn.style.top = Math.max(0, r.top - 7) + 'px';
      btn.style.display = 'block';
    };
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); const r = painel.getBoundingClientRect(); est = { e: true, x: Math.round(r.right - 14), y: Math.round(r.top) }; gravar(); posicionar(); });
    bola.addEventListener('click', (ev) => { ev.stopPropagation(); est.e = false; gravar(); posicionar(); });
    doc.body.append(btn, bola); posicionar();
    win.setInterval(posicionar, 400);
  };

  const fznArrastavel = (painel, alca, chave) => {
    const aplicar = (p) => {
      if (!p) return null;
      const w = painel.offsetWidth, h = painel.offsetHeight;
      const x = Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - w));
      const bruto = Number.isFinite(p.b) ? p.b : window.innerHeight - p.y - h;
      const b = Math.min(Math.max(0, bruto), Math.max(0, window.innerHeight - h));
      Object.assign(painel.style, { left: x + 'px', bottom: b + 'px', top: 'auto', right: 'auto' });
      return { x, b };
    };
    try { const p = JSON.parse(localStorage.getItem(chave) || 'null'); if (p && Number.isFinite(p.x) && (Number.isFinite(p.b) || Number.isFinite(p.y))) requestAnimationFrame(() => aplicar(p)); } catch {}
    let apertado = false, dx = 0, dy = 0;
    alca.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.target.closest?.('button,select,input,textarea')) return;
      const r = painel.getBoundingClientRect(); dx = ev.clientX - r.left; dy = ev.clientY - r.top; apertado = true;
      alca.style.cursor = 'grabbing'; try { alca.setPointerCapture(ev.pointerId); } catch {} ev.preventDefault();
    });
    alca.addEventListener('pointermove', (ev) => { if (apertado) aplicar({ x: ev.clientX - dx, y: ev.clientY - dy }); });
    const soltar = (ev) => { if (!apertado) return; apertado = false; alca.style.cursor = 'grab'; try { alca.releasePointerCapture(ev.pointerId); } catch {} const r = painel.getBoundingClientRect(); const p = aplicar({ x: r.left, y: r.top }); try { localStorage.setItem(chave, JSON.stringify(p)); } catch {} };
    alca.addEventListener('pointerup', soltar); alca.addEventListener('pointercancel', soltar);
    painel.style.maxHeight = 'calc(100vh - 16px)'; painel.style.overflowY = 'auto';
    const manterNaTela = () => { const r = painel.getBoundingClientRect(); if (!r.width || !r.height) return; if (r.top < 0 || r.right > window.innerWidth + 1 || r.left < 0 || r.bottom > window.innerHeight + 1) aplicar({ x: r.left, b: window.innerHeight - r.bottom }); };
    try { new ResizeObserver(() => requestAnimationFrame(manterNaTela)).observe(painel); } catch {}
    window.addEventListener('resize', manterNaTela);
  };

  // Versao do painel: do gerenciador (GM_info) ou, sem ele, a constante abaixo
  // -- mantida igual ao @version a cada versao.
  const VERSAO_SCRIPT = (() => { try { return String(GM_info.script.version || '3.24'); } catch { return '3.24'; } })();
  const CHAVE_CFG = 'fzn-autovoltar-ygg-v1';
  const CHAVE_LOG = 'fzn-autovoltar-ygg-log-v1';
  const CHAVE_PROBLEMAS = 'fzn-autovoltar-ygg-problemas-v1';
  const CHAVE_BACKUP = 'fzn-autovoltar-ygg-backup-v1';
  const PREFIXO_BACKUP_HUB = 'fzn-autovoltar-ajustes-v2:';

  const KAFRA_PADRAO = { 'prontera:149,172': { dx: -63, dy: -200 }, 'prontera:155,183': { dx: -63, dy: -200 } };
  const VENDEDOR_PADRAO = {};

  const lerJson = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
  const gravarJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const lerBackupSessao = () => { try { return JSON.parse(sessionStorage.getItem(CHAVE_BACKUP) || 'null'); } catch { return null; } };
  const abrirBackup = () => new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let resolvido = false;
    const concluir = (db) => { if (!resolvido) { resolvido = true; resolve(db); } else db?.close(); };
    setTimeout(() => concluir(null), 2000);
    try {
      const req = indexedDB.open('fzn-autovoltar-ygg-backup', 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('dados')) req.result.createObjectStore('dados'); };
      req.onsuccess = () => concluir(req.result);
      req.onerror = () => concluir(null);
      req.onblocked = () => concluir(null);
    } catch { concluir(null); }
  });
  const lerBackupDisco = async () => {
    const db = await abrirBackup();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('dados', 'readonly');
        const req = tx.objectStore('dados').get(CHAVE_BACKUP);
        req.onsuccess = () => resolve(req.result?.cfg || null);
        req.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      } catch { db.close(); resolve(null); }
    });
  };
  const gravarBackupDisco = async (dados) => {
    const db = await abrirBackup();
    if (!db) return;
    try {
      const tx = db.transaction('dados', 'readwrite');
      tx.objectStore('dados').put({ cfg: dados, salvoEm: Date.now() }, CHAVE_BACKUP);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch { db.close(); }
  };
  const cfgLocal = lerJson(CHAVE_CFG, null);
  const cfgSessao = cfgLocal ? null : lerBackupSessao();

  const cfg = Object.assign({
    ligado: true, curarNaKafra: true, kafra: {}, retornoEvento: false, rotinaLimites: true,
    comprar: true, compras: [{ nome: 'Poção Laranja', aba: 'Consumíveis', alvo: 200 }],
    vendedor: {}
  }, cfgLocal || cfgSessao || {});
  const novoIdBackup = () => (typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  if (!cfg.backupId) cfg.backupId = novoIdBackup();
  cfg.conteudo = { modo: 'normal', expiraEm: 0, ...(cfg.conteudo || {}) };
  if (!['normal', 'bio4', 'lhz', 'cheffenia', 'expedicao'].includes(cfg.conteudo.modo)) cfg.conteudo.modo = 'normal';
  cfg.expedicaoFase = ['Calabouço I', 'Calabouço II', 'Portal do Abismo'].includes(cfg.expedicaoFase)
    ? cfg.expedicaoFase : 'Portal do Abismo';
  cfg.lucky = Array.isArray(cfg.lucky) ? cfg.lucky.filter((s) => typeof s === 'string' && s.trim()) : ['Ovo da La Voisin'];
  cfg.rifa = { ligado: false, premios: [], limiteGasto: 0, personagem: '', historico: [], ...(cfg.rifa || {}) };
  delete cfg.rifa.reserva;
  cfg.rifa.limiteGasto = Math.max(0, Math.floor(Number(cfg.rifa.limiteGasto) || 0));
  if (!Array.isArray(cfg.rifa.historico)) cfg.rifa.historico = [];
  if ('comprarPocao' in cfg) {
    cfg.comprar = cfg.comprarPocao;
    for (const k of ['comprarPocao', 'pocaoNome', 'pocaoId', 'pocaoMinimo', 'pocaoAlvo']) delete cfg[k];
  }
  const salvarCfg = () => {
    gravarJson(CHAVE_CFG, cfg);
    try { sessionStorage.setItem(CHAVE_BACKUP, JSON.stringify(cfg)); } catch {}
    try { void gravarBackupDisco(JSON.parse(JSON.stringify(cfg))); } catch {}
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(PREFIXO_BACKUP_HUB + cfg.backupId, JSON.stringify({
          formato: 'fzn-autovoltar-backup', versao: 1, cfg,
          salvoEm: new Date().toISOString()
        }));
      }
    } catch (e) { console.warn('[autovoltar-ygg] Backup do Hub falhou:', e); }
  };
  const backupsDoHub = () => {
    if (typeof GM_listValues !== 'function' || typeof GM_getValue !== 'function') return [];
    try {
      return GM_listValues().filter((k) => k.startsWith(PREFIXO_BACKUP_HUB))
        .map((k) => { try { return JSON.parse(GM_getValue(k, 'null')); } catch { return null; } })
        .filter((x) => x?.formato === 'fzn-autovoltar-backup' && x.cfg && typeof x.cfg === 'object')
        .sort((a, b) => String(b.salvoEm || '').localeCompare(String(a.salvoEm || '')));
    } catch (e) { console.warn('[autovoltar-ygg] Leitura dos backups do Hub falhou:', e); return []; }
  };
  const relerCalibracao = () => {
    const salvo = lerJson(CHAVE_CFG, {});
    for (const tipo of ['kafra','vendedor']) {
      if (salvo[tipo] && typeof salvo[tipo] === 'object') Object.assign(cfg[tipo], salvo[tipo]);
    }
  };

  const andamento = { etapa: 'Aguardando', detalhe: 'Monitorando peso e morte', desde: Date.now() };
  let detalhesProcesso = false;
  let controlesAbertos = true;
  let ajustesAbertos = false;
  // Etapas que ficam paradas por natureza (nao sao trava quando demoram).
  const ETAPA_PARADA = /^(Aguardando|Vigia|Recuperando|Desligado|Covil|Concluid|Concluíd|Retomando|Rotina interrompida|Caça não retomada|Aguardando jogo)/i;
  const etapa = (nome, detalhe = '') => {
    if (andamento.etapa === nome && andamento.detalhe === detalhe) return;
    const durou = Date.now() - andamento.desde;
    if (andamento.etapa !== nome && durou > 2 * 60 * 1000 && !ETAPA_PARADA.test(andamento.etapa)) {
      problema('Etapa demorada: ' + andamento.etapa + ' levou ' + Math.round(durou / 60000) + ' min', andamento.etapa);
    }
    andamento.etapa = nome; andamento.detalhe = detalhe; andamento.desde = Date.now();
    log(nome + (detalhe ? ': ' + detalhe : ''));
  };
  let historicoMem = null;
  const historicoLog = () => (historicoMem ??= lerJson(CHAVE_LOG, []));
  // v2.98: historico com 300 linhas e repetidas juntas ("x12"); aba Problemas
  // so com erros/travas/avisos/morte/etapa demorada, sempre com a etapa.
  const HIST_MAX = 300;
  let problemasMem = null;
  const problemasLog = () => (problemasMem ??= lerJson(CHAVE_PROBLEMAS, []));
  let abaHistorico = 'problemas';
  // Texto sem numeros (hora, contagens, coordenadas) para achar "a mesma mensagem".
  const assinatura = (msg) => String(msg).replace(/\d+([.,:]\d+)*/g, '#').replace(/\s+/g, ' ').trim();
  const empilhar = (lista, texto, max) => {
    const hora = new Date().toLocaleTimeString();
    const sig = assinatura(texto);
    for (let i = lista.length - 1; i >= Math.max(0, lista.length - 8); i--) {
      const e = lista[i];
      if (e && typeof e === 'object' && e.sig === sig) {
        lista.splice(i, 1);
        lista.push({ ...e, ultima: hora, texto, n: (e.n || 1) + 1 });
        return;
      }
    }
    lista.push({ hora, ultima: hora, texto, sig, n: 1 });
    if (lista.length > max) lista.splice(0, lista.length - max);
  };
  const linhaHist = (e) => typeof e === 'string' ? e
    : e.hora + (e.n > 1 ? '–' + e.ultima : '') + ' ' + e.texto + (e.n > 1 ? '  (x' + e.n + ')' : '');
  const RE_PROBLEMA = /PROBLEMA|Recuperando|cancelad|interrompid|falh|erro|nao (?:encontr|abriu|fechou|consegui|confirm|detect)|não (?:encontr|abriu|fechou|consegui|confirm|detect)|desabilitado|recus|NAO entrou|nada foi comprado|sem resposta|ilegivel|travad|Vigia|Peso \d[\d.]*%|abaixo do minimo|Projeteis|Suprimentos:|mochila (?:ainda )?(?:acima|cheia)|Mochila em \d|Morreu|morte|Renascer|desisto|DESLIGADO|Desligado|Religado/i;
  const problema = (texto, etapaAtual = andamento.etapa) => {
    const onde = etapaAtual && !/^Aguardando/.test(etapaAtual) && !texto.startsWith(etapaAtual) ? '[' + etapaAtual + '] ' : '';
    empilhar(problemasLog(), onde + texto, HIST_MAX);
    gravarJson(CHAVE_PROBLEMAS, problemasLog());
  };
  const log = (msg) => {
    const l = historicoLog();
    empilhar(l, String(msg), HIST_MAX);
    gravarJson(CHAVE_LOG, l);
    if (RE_PROBLEMA.test(msg)) problema(String(msg));
    console.log('[autovoltar-ygg]', msg);
    atualizarPainel();
  };

  let canceladoAte = 0;
  const cancelando = () => Date.now() < canceladoAte;
  const esperar = (ms) => new Promise((r, rej) => setTimeout(() => (cancelando() ? rej(new Error('cancelado pelo usuario')) : r()), ms));

  const jogo = () => {
    for (const f of document.querySelectorAll('iframe')) {
      try { if (f.contentWindow?.document?.body && f.contentWindow.__elragEngine) return f.contentWindow; } catch {}
    }
    return null;
  };

  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };

  const diagEm = {};
  const diagTela = (motivo) => {
    if (Date.now() - (diagEm[motivo] || 0) < 300000) return;
    diagEm[motivo] = Date.now();
    try {
      const w = jogo();
      const partes = [];
      for (const [nome, win] of [['topo', window], ['jogo', w]]) {
        if (!win) continue;
        const d = win.document;
        const todos = [...d.querySelectorAll('button')];
        const vis = todos.filter((b) => { const r = b.getBoundingClientRect(); return r.width > 2 && r.height > 2; });
        const ifr = nome === 'topo' ? [...d.querySelectorAll('iframe')].map((f) => { const r = f.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height) + (getComputedStyle(f).display === 'none' ? ' none' : '') + (getComputedStyle(f).visibility === 'hidden' ? ' hidden' : ''); }).join(',') : '';
        partes.push(nome + ': ' + d.visibilityState + ' ' + win.innerWidth + 'x' + win.innerHeight + (ifr ? ' iframes ' + ifr : '') + ' botoes ' + vis.length + '/' + todos.length + ' [' + vis.map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 18)).filter(Boolean).slice(0, 14).join(' | ') + '] inputs [' + [...d.querySelectorAll('input')].map((i) => (i.placeholder || i.type).slice(0, 18) + (i.getBoundingClientRect().width > 2 ? '' : '(0)')).slice(0, 5).join(' | ') + ']');
      }
      if (w) partes.push('mapa-btn ' + (w.document.querySelector('button[aria-label="Mundo de Midgard"]') ? 'sim' : 'nao') + ', tutorial ' + (w.document.querySelector('[data-tutorial="mapa-mundi"]') ? 'sim' : 'nao') + ', dialogo "' + ((w.document.body.innerText || '').match(/Dialogo.{0,80}/)?.[0] || '-') + '"');
      log('DIAG ' + motivo + ' — ' + partes.join(' || ').slice(0, 900));
    } catch (e) { log('DIAG ' + motivo + ': erro ' + String(e).slice(0, 80)); }
  };
  const textoDe = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');

  const botaoPorTexto = (doc, teste) => cancelando() ? undefined : [...doc.querySelectorAll('button, [role="button"]')]
    .find((b) => visivel(b) && !b.disabled && teste(textoDe(b)));

  const esperarAte = async (fn, ms, passo = 125) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      const v = fn();
      if (v) return v;
      await esperar(passo);
    }
    return null;
  };

  const posicao = (w) => {
    try {
      const m = w.__elragEngine.getMinimapInfoSnapshot();
      return m ? { mapa: String(m.mapId || ''), x: m.x, y: m.y, nome: m.mapName } : null;
    } catch { return null; }
  };
  const chaveCelula = (p) => `${p.mapa}:${p.x},${p.y}`;

  const canvasDoJogo = (w) => [...w.document.querySelectorAll('canvas')]
    .sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0] || null;

  const quadros = (w, n) => new Promise((r) => {
    const teto = setTimeout(r, 1500);
    const passo = (i) => (i <= 0 ? (clearTimeout(teto), r()) : w.requestAnimationFrame(() => passo(i - 1)));
    passo(n);
  });

  const espelhados = new WeakSet();
  const espelharQuadros = () => {
    for (const f of document.querySelectorAll('iframe')) {
      let w;
      try { w = f.contentWindow; if (!w || !w.document) continue; } catch { continue; }
      fznBypassIsTrusted(w); fznHackClick(w);
      if (espelhados.has(w)) continue;
      espelhados.add(w);
      const ids = new Map();
      let seq = 0;
      w.requestAnimationFrame = function (cb) {
        const id = ++seq;
        const rodar = () => {
          const p = ids.get(id);
          if (!p) return;
          ids.delete(id);
          window.cancelAnimationFrame(p.raf);
          clearTimeout(p.timer);
          cb(w.performance.now());
        };
        ids.set(id, { raf: window.requestAnimationFrame(rodar), timer: setTimeout(rodar, 125) });
        return id;
      };
      w.cancelAnimationFrame = function (id) {
        const p = ids.get(id);
        if (!p) return;
        ids.delete(id);
        window.cancelAnimationFrame(p.raf);
        clearTimeout(p.timer);
      };
    }
  };
  setInterval(espelharQuadros, 30);

  const contarQuadros = (w, ms) => new Promise((r) => {
    let n = 0; let ativo = true;
    const passo = () => { if (!ativo) return; n++; w.requestAnimationFrame(passo); };
    w.requestAnimationFrame(passo);
    setTimeout(() => { ativo = false; r(n); }, ms);
  });

  const clicarBotao = (w, el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const base = { bubbles: true, cancelable: true, composed: true, view: w, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    const encontrado = w.document.elementFromPoint(base.clientX, base.clientY);
    // Um aviso ou camada do mapa pode cobrir o centro do botão. Nesse caso,
    // enviar o evento ao botão solicitado, nunca ao elemento sobreposto.
    const alvo = encontrado && (encontrado === el || el.contains(encontrado)) ? encontrado : el;
    for (const tipo of ['pointerover', 'pointerenter', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Ev = tipo.startsWith('pointer') && w.PointerEvent ? w.PointerEvent : w.MouseEvent;
      try { alvo.dispatchEvent(new Ev(tipo, { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(tipo) ? 1 : 0 })); } catch {}
    }
    return true;
  };

  const clicarNoCanvas = async (w, canvas, x, y) => {
    const base = { bubbles: true, cancelable: true, composed: true, view: w, clientX: x, clientY: y, screenX: x, screenY: y, button: 0 };
    try { w.__elragEngine.setMouseIntersect(true); } catch {}
    for (let i = 0; i < 3; i++) { 
      canvas.dispatchEvent(new w.MouseEvent('mousemove', base)); 
      await esperar(120); 
    }
    await quadros(w, 3);
    await esperar(200);
    const EvDown = w.PointerEvent ? w.PointerEvent : w.MouseEvent;
    canvas.dispatchEvent(new EvDown('pointerdown', { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }));
    canvas.dispatchEvent(new w.MouseEvent('mousedown', { ...base, buttons: 1 }));
    await esperar(60);
    const EvUp = w.PointerEvent ? w.PointerEvent : w.MouseEvent;
    canvas.dispatchEvent(new EvUp('pointerup', { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }));
    canvas.dispatchEvent(new w.MouseEvent('mouseup', base));
    canvas.dispatchEvent(new w.MouseEvent('click', base));
  };

  const sairDaEconomia = async (w) => {
    if (!/Economia de energia/.test(w.document.body.innerText || '')) return false;
    const b = botaoPorTexto(w.document, (t) => /^Voltar ao jogo$/i.test(t));
    if (!b) return false;
    b.click();
    economiaParaReligar = true;
    log('Economia de energia do jogo: cliquei em "Voltar ao jogo"');
    await esperar(1500);
    return true;
  };

  let economiaParaReligar = false;
  const apertarEsc = (w) => {
    const ev = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    for (const alvo of [w.document.activeElement || w.document.body, w.document, w]) {
      try { alvo.dispatchEvent(new w.KeyboardEvent('keydown', ev)); alvo.dispatchEvent(new w.KeyboardEvent('keyup', ev)); } catch {}
    }
  };
  const religarEconomia = async (w) => {
    if (!economiaParaReligar) return;
    economiaParaReligar = false;
    await esperar(3000);
    if (/Economia de energia/.test(w.document.body.innerText || '') && botaoPorTexto(w.document, (t) => /^Voltar ao jogo$/i.test(t))) return;
    let botao = botaoPorTexto(w.document, (t) => /^Economia de energia$/i.test(t));
    if (!botao) {
      apertarEsc(w);
      botao = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Economia de energia$/i.test(t)), 3000);
    }
    if (!botao) { log('Economia de energia: nao achei o botao no menu (Esc); fica desligada'); return; }
    botao.click();
    const ligou = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Voltar ao jogo$/i.test(t)), 3000);
    log(ligou ? 'Economia de energia religada' : 'Economia de energia: cliquei, mas a tela dela nao apareceu');
    if (!ligou && botaoPorTexto(w.document, (t) => /^Sair do jogo$/i.test(t))) apertarEsc(w);
  };

  const dialogoKafraAberto = (doc) => /Bem-vindo aos servicos Kafra|\[Kafra\]/.test(doc.body.innerText || '');

  const NPCS_PRONTERA = { kafra: [153,191], vendedor: [161,184], ferreiro: [158,191] };
  const pontesNpc = new WeakMap();
  const carregarEntidadesNpc = async (w) => {
    if (pontesNpc.has(w)) return pontesNpc.get(w);
    const carregar = (async () => {
      if (!w.__fznNpcBridge) {
        const script = w.document.createElement('script');
        script.type = 'module';
        script.textContent = "import('Renderer/EntityManager.js').then(m=>{window.__fznNpcBridge={manager:m.default};}).catch(e=>{window.__fznNpcBridge={erro:String(e)};});";
        w.document.head.appendChild(script);
      }
      const ponte = await esperarAte(() => w.__fznNpcBridge, 4000);
      return ponte?.manager && typeof ponte.manager.forEach === 'function' ? ponte.manager : null;
    })();
    pontesNpc.set(w, carregar);
    const manager = await carregar;
    if (!manager) pontesNpc.delete(w);
    return manager;
  };

  const localizarNpc = (manager,tipo) => {
    const regexNome = tipo === 'kafra' ? /kafra/i : tipo === 'vendedor' ? /mercador|vendedor/i : /ferreiro/i;
    const [x,y] = NPCS_PRONTERA[tipo];
    let melhor = null, menorDist = Infinity;
    manager.forEach(e => {
      const c=e?.constructor;
      const npc=c && ((Number.isFinite(c.TYPE_NPC) && e.objecttype===c.TYPE_NPC) || (Number.isFinite(c.TYPE_NPC2) && e.objecttype===c.TYPE_NPC2));
      if (npc && e.GID>0 && !e.remove_tick && e.position) {
         const d = Math.abs(e.position[0]-x) + Math.abs(e.position[1]-y);
         if (d < menorDist && d < 15) {
            const nome = e.display?.name || e._job || e.name || '';
            if (regexNome.test(nome) || !melhor) {
                menorDist = d; melhor = e;
            }
         }
      }
    });
    return melhor ? {entidade: melhor} : null;
  };

  const falarComNpc = async (w, tipo, aberto) => {
    if (aberto()) return true;
    const nome = tipo === 'kafra' ? 'Kafra' : tipo === 'ferreiro' ? 'Ferreiro' : 'Vendedor';
    if (!NPCS_PRONTERA[tipo] || posicao(w)?.mapa !== 'prontera') { log(nome + ': mapa invalido para conversar'); return false; }

    const canvas = canvasDoJogo(w);
    if (!canvas) { log(nome + ': canvas nao encontrado'); return false; }

    let ultPos = null;
    await esperarAte(() => {
      const p = posicao(w);
      if (!p) return false;
      if (ultPos && p.x === ultPos.x && p.y === ultPos.y) return true;
      ultPos = p;
      return false;
    }, 3000);

    const manager = await carregarEntidadesNpc(w);
    const alvo = manager ? await esperarAte(() => localizarNpc(manager, tipo), 2000) : null;

    for (let tentativa = 1; tentativa <= 3; tentativa++) {
        let sx = null, sy = null;
        if (alvo?.entidade) {
          try {
            const camera = w.__elragEngine.renderer?.camera || w.__elragEngine.camera;
            if (camera && camera.worldToScreen) {
              const p = camera.worldToScreen(alvo.entidade.position[0], alvo.entidade.position[1], 0);
              if (p && p.length >= 2) { sx = p[0]; sy = p[1]; }
            }
          } catch (e) {}
        }
        if (sx !== null && sy !== null) {
          const grade = [[0,0], [0,-8], [0,8], [-8,0], [8,0], [-8,-8], [8,8], [-8,8], [8,-8]];
          for (const [dx, dy] of grade) {
            log(nome + `: clique no canvas (worldToScreen t${tentativa} ${dx},${dy})`);
            const r = canvas.getBoundingClientRect();
            await clicarNoCanvas(w, canvas, r.left + sx + dx, r.top + sy + dy);
            if (await esperarAte(aberto, 3000)) return true;
          }
        }
        if (alvo?.entidade) {
          log(nome + ': fallback onMouseDown da entidade (t' + tentativa + ')');
          try { alvo.entidade.onMouseDown(); } catch (e) {}
          if (await esperarAte(aberto, 3000)) return true;
        }
        const p = posicao(w);
        const r = canvas.getBoundingClientRect();
        const ponto = p && (cfg[tipo]?.[chaveCelula(p)] || (tipo === 'kafra' ? KAFRA_PADRAO : VENDEDOR_PADRAO)[chaveCelula(p)]);
        if (ponto) {
          log(nome + ': clique no canvas (offset t' + tentativa + ')');
          await clicarNoCanvas(w, canvas, r.left + r.width / 2 + ponto.dx, r.top + r.height / 2 + ponto.dy);
          if (await esperarAte(aberto, 3000)) return true;
        }
        await esperar(500);
    }

    try { w.__elragEngine.cancelNpcDialog?.(); w.__elragEngine.closeNpcDialog?.(); } catch {}
    diagTela('dialogo-' + tipo); log(nome + ': o dialogo nao abriu apos 3 tentativas. ' + (janelaOculta(w) ? 'A janela do jogo esta minimizada/oculta: deixe-a aberta (a calibracao provavelmente esta certa).' : 'Verifique a calibracao.'));
    return false;
  };

  const curarNaKafra = async (w) => {
    if (!await falarComNpc(w, 'kafra', () => dialogoKafraAberto(w.document))) { log('Kafra: cura pulada porque o diálogo não abriu'); return false; }
    const curar = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Curar\b/.test(t)), 3000);
    if (!curar) { diagTela('curar'); log('Kafra: botao Curar nao apareceu'); w.__elragEngine.cancelNpcDialog?.(); return false; }
    curar.click();
    log('Kafra: Curar');
    for (let i = 0; i < 8; i++) {
      await esperar(250);
      if (!dialogoKafraAberto(w.document) && !botaoPorTexto(w.document, (t) => /^(Pr[oó]ximo|Fechar|OK|Continuar)$/i.test(t))) break;
      const b = botaoPorTexto(w.document, (t) => /^(Pr[oó]ximo|Fechar|OK|Continuar|Cancelar)$/i.test(t));
      if (b) b.click();
      else { try { w.__elragEngine.closeNpcDialog(); w.__elragEngine.dismissNpcDialog(); } catch {} }
    }
    return true;
  };

  const donoGancho = {};
  const ehEquipado = (item) => ['equipped', 'isEquipped', 'equipado', 'isWorn'].some((k) => verdadeiro(item[k])) || Number(item.wearState) > 0;
  const contarPilhas = (snap) => Object.values(snap || {}).reduce((n, itens) =>
    n + (Array.isArray(itens) ? itens.filter((item) => item && !ehEquipado(item)).length : 0), 0);
  const estadoLoja = { janela: null, mochila: null, mochilaEm: 0, mochilaSeq: 0, equipamento: null, equipamentoSeq: 0, armazem: null, armazemSeq: 0, armazemEm: 0 };
  const instalarGanchos = (w) => {
    if (estadoLoja.janela !== w) {
      Object.assign(estadoLoja, { janela: w, mochila: null, mochilaEm: 0, mochilaSeq: 0, equipamento: null, equipamentoSeq: 0, armazem: null, armazemSeq: 0, armazemEm: 0 });
    }
    const ui = w.__elragUI;
    if (!ui) return;
    for (const [metodo, chave] of [['updateInventorySnapshot', 'mochila'], ['updateEquipmentSnapshot', 'equipamento'], ['updateStorageSnapshot', 'armazem'], ['updatePouchShopAdmission', 'admissaoBolsa']]) {
      const original = ui[metodo];
      if (original?.__fznAutovoltar === donoGancho) continue;
      // O painel React pode ainda nao ter registrado o receptor da mochila.
      // requestInventorySnapshot publica mesmo fechado; capture essa resposta.
      if (typeof original !== 'function' && !['mochila', 'equipamento'].includes(chave)) continue;
      const gancho = function (snap) {
        if (estadoLoja.janela === w) {
          estadoLoja[chave] = snap;
          estadoLoja[chave + 'Seq']++;
          if (chave === 'armazem') estadoLoja.armazemEm = Date.now();
          if (chave === 'mochila') {
            const agora = Date.now();
            const pilhas = contarPilhas(snap);
            if (agora - estadoLoja.mochilaEm > 2000) estadoLoja.rajadaMax = pilhas;
            else estadoLoja.rajadaMax = Math.max(estadoLoja.rajadaMax || 0, pilhas);
            estadoLoja.mochilaEm = agora;
          }
        }
        return typeof original === 'function' ? original.apply(this, arguments) : undefined;
      };
      gancho.__fznAutovoltar = donoGancho;
      ui[metodo] = gancho;
    }
  };

  const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  const quantosNaMochila = (nome) => {
    const alvo = normalizar(nome);
    let total = 0;
    const fila = [estadoLoja.mochila];
    const vistos = new Set();
    while (fila.length && vistos.size < 5000) {
      const o = fila.shift();
      if (!o || typeof o !== 'object' || vistos.has(o)) continue;
      vistos.add(o);
      if (typeof o.name === 'string' && o.itemId !== undefined) {
        if (normalizar(o.name) === alvo) total += Number(o.count) || 0;
        continue;
      }
      for (const v of Array.isArray(o) ? o : Object.values(o)) if (v && typeof v === 'object') fila.push(v);
    }
    return total;
  };

  const naBolsa = (w, nome) => {
    let raiz;
    try { raiz = w.__elragEngine.getConsumablePouchSnapshot?.(); } catch { return 0; }
    const alvo = normalizar(nome);
    let total = 0;
    const fila = [raiz];
    const vistos = new Set();
    while (fila.length && vistos.size < 5000) {
      const o = fila.shift();
      if (!o || typeof o !== 'object' || vistos.has(o)) continue;
      vistos.add(o);
      const n = o.name ?? o.itemName ?? o.label;
      const q = o.count ?? o.amount ?? o.quantity ?? o.qty;
      if (typeof n === 'string' && q !== undefined) {
        if (normalizar(n) === alvo) total += Number(q) || 0;
        continue;
      }
      for (const v of Array.isArray(o) ? o : Object.values(o)) if (v && typeof v === 'object') fila.push(v);
    }
    return total;
  };

  const lerMochila = async (w) => {
    instalarGanchos(w);
    const antes = estadoLoja.mochilaSeq;
    try { w.__elragEngine.requestInventorySnapshot(); } catch {}
    if (!await esperarAte(() => estadoLoja.mochilaSeq > antes, 3000, 200)) return false;
    const limite = Date.now() + 3000;
    let visto = estadoLoja.mochilaSeq, quietoDesde = Date.now();
    while (Date.now() < limite && Date.now() - quietoDesde < 700) {
      await esperar(100);
      if (estadoLoja.mochilaSeq !== visto) { visto = estadoLoja.mochilaSeq; quietoDesde = Date.now(); }
    }
    return true;
  };

  // v2.97: compra que a loja recusou (zeny ou peso) nao dispara nova viagem
  // por "abaixo do minimo" durante COMPRA_FALHOU_MS. Antes: Morango 0/21 sem
  // zeny -> volta a cidade, nao compra, volta a cacar, 2 min depois volta de novo.
  const COMPRA_FALHOU_MS = 30 * 60 * 1000;
  const compraFalhou = new Map();
  const compraRecusada = (nome) => Date.now() - (compraFalhou.get(normalizar(nome)) || 0) < COMPRA_FALHOU_MS;
  // v2.99: com "gatilho baixo" a volta so acontece com 20% do alvo (ou o minimo,
  // o que for MENOR). Menos viagens, cada uma trazendo mais.
  const minimoEfetivo = (c) => {
    const m = Number(c.minimo) || 0;
    if (!(m > 0)) return 0;
    return cfg.gatilhoBaixo ? Math.max(1, Math.min(m, Math.ceil(Number(c.alvo) * 0.2))) : m;
  };
  // completar=true (compra/retirada durante a viagem): enche TODOS os itens ate o
  // alvo, mesmo os que ainda estao acima do minimo -- assim um item nao gera
  // outra viagem 2 min depois da primeira.
  // v3.00: "Estoque Bolsa" + "Lote" por item. Alem do alvo, a compra traz no
  // maximo 1 lote por vez ate a Bolsa ALT+B chegar ao estoque (ex.: 999) --
  // enche aos poucos, sem gastar todo o zeny de uma vez.
  const qtdDaCompra = (w, c, completar) => {
    const tem = quantosNaMochila(c.nome) + naBolsa(w, c.nome);
    const paraAlvo = Number(c.alvo) - tem;
    const estoque = Number(c.estoque) || 0;
    if (!completar || !cfg.usarBolsa || !(estoque > 0)) return paraAlvo;
    const lote = Math.max(1, Number(c.lote) || 100);
    const paraBolsa = Math.min(lote, estoque - naBolsa(w, c.nome));
    return Math.max(paraAlvo, paraBolsa);
  };
  // v3.05: gatilho pelo CONSUMO. Elixir Azul caiu 142 -> 111 -> 20 -> 0 entre
  // conferencias de 1 min: com minimo 20 nunca dava tempo. Mede quanto o item
  // gasta por minuto e compra quando sobrar menos de 3 min de uso (ou no
  // minimo, o que for maior; teto de 80% do alvo).
  const consumo = new Map();
  const registrarConsumo = (nome, tem) => {
    const k = normalizar(nome), agora = Date.now();
    const a = consumo.get(k);
    if (!a || tem > a.tem) { consumo.set(k, { tem, t: agora, porMin: a && tem > a.tem ? a.porMin : 0 }); return; }
    const min = (agora - a.t) / 60000;
    if (min < 0.25) return;
    const taxa = (a.tem - tem) / min;
    consumo.set(k, { tem, t: agora, porMin: a.porMin ? a.porMin * 0.5 + taxa * 0.5 : taxa });
  };
  const gatilhoDe = (c, tem) => {
    const base = minimoEfetivo(c);
    if (!(base > 0)) return 0;
    registrarConsumo(c.nome, tem);
    const porMin = consumo.get(normalizar(c.nome))?.porMin || 0;
    const tresMin = Math.ceil(porMin * 3);
    const teto = Math.max(base, Math.floor(Number(c.alvo) * 0.8));
    return Math.min(teto, Math.max(base, tresMin));
  };
  const calcularFaltas = (w, lista, completar = false) => lista
    .map((c) => ({ ...c, tem: quantosNaMochila(c.nome) + naBolsa(w, c.nome) }))
    .map((c) => ({ ...c, qtd: qtdDaCompra(w, c, completar), minimo: completar ? minimoEfetivo(c) : gatilhoDe(c, c.tem) }))
    // v2.96: projetil compra sempre que estiver abaixo da trava, mesmo com minimo menor
    // v3.05: "<=" -- 20/20 (no minimo) ja compra; antes so abaixo.
    .filter((c) => c.qtd > 0 && (completar || !(Number(c.minimo) > 0) || c.tem <= Number(c.minimo) || (ehMunicao(c.nome) && c.tem < MUNICAO_MIN)));

  const textoTela = (w) => w.document.body.innerText || '';
  const dialogoMercadorAberto = (w) => /\[Mercador\]/.test(textoTela(w)) || Boolean(botaoPorTexto(w.document, (t) => /^Comprar suprimentos/.test(t)));

  const tituloLojaSuprimentos = (w) => [...w.document.querySelectorAll('h1, h2, h3, h4, div, span, strong')]
    .find((el) => visivel(el) && /^loja\s*[—–-]\s*suprimentos$/.test(normalizar(textoDe(el))));

  const lojaAberta = (w) => Boolean(tituloLojaSuprimentos(w)) ||
    [...w.document.querySelectorAll('button')].some((b) => visivel(b) && /^Confirmar compra$/i.test(textoDe(b)));

  const linhaDoProduto = (w, nome) => {
    const alvo = normalizar(nome);
    for (const el of w.document.querySelectorAll('div, span, p, strong, b, td, li')) {
      if (el.children.length || !visivel(el)) continue;
      const txt = normalizar(el.textContent);
      if (!txt.includes(alvo)) continue;
      let p = el.parentElement;
      for (let i = 0; p && i < 6; i++, p = p.parentElement) {
        const campos = p.querySelectorAll('input');
        if (campos.length === 1) return campos[0];
        if (campos.length > 1) break;
      }
    }
    return null;
  };

  const digitar = (w, campo, valor) => {
    const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
    campo.focus();
    setter.call(campo, String(valor));
    campo.dispatchEvent(new w.Event('input', { bubbles: true, composed: true }));
    campo.dispatchEvent(new w.Event('change', { bubbles: true, composed: true }));
    campo.blur();
  };

  const fecharLoja = async (w) => {
    const fechada = () => !lojaAberta(w) && !dialogoMercadorAberto(w);
    for (let i = 0; i < 3 && !fechada(); i++) {
      const titulo = tituloLojaSuprimentos(w);
      let fechar = null;
      for (let area = titulo?.parentElement, nivel = 0;
        area && area !== w.document.body && !/^(ui-root|elrag-dialogs)$/.test(area.id || '') && nivel < 6;
        area = area.parentElement, nivel++) {
        const botoes = [...area.querySelectorAll('button')].filter((b) => visivel(b) && !b.disabled &&
          [b.getAttribute('aria-label'), b.title, textoDe(b)].some((t) => /^(fechar|close|×|✕|x)$/i.test(t || '')));
        if (botoes.length !== 1) continue;
        fechar = botoes[0];
        break;
      }
      if (fechar) fechar.click();
      else {
        try { w.__elragEngine.closeNpcStore?.(); } catch {}
        try { w.__elragEngine.cancelNpcDialog?.(); } catch {}
      }
      if (await esperarAte(fechada, 1000, 150)) return true;
    }
    if (fechada()) return true;
    log('Loja: fechamento não confirmado após 3 tentativas; ' +
      (lojaAberta(w) ? 'janela Suprimentos continua aberta' : 'diálogo do vendedor continua aberto'));
    return false;
  };

  const buscarNaLoja = async (w, nome) => {
    const caixa = [...w.document.querySelectorAll('input')].find((i) => visivel(i) && /buscar/i.test(i.placeholder || i.getAttribute('aria-label') || ''));
    if (!caixa) return null;
    digitar(w, caixa, ''); 
    await esperar(100);
    digitar(w, caixa, nome);
    await esperar(500); 
    const campo = await esperarAte(() => linhaDoProduto(w, nome), 2000, 150);
    return campo || null;
  };

  let compraCidadeBloqueadaAte = 0;
  // --- Bolsa de consumiveis (ALT+B), v2.99 ----------------------------------
  // Do proprio cliente (src/Engine/MapEngine/ConsumablePouch.js): o que esta na
  // Bolsa NAO pesa e o Autopilot consome dela antes da mochila. O servidor decide
  // o que e admitido (admissibleInventoryIndexes) e o teto de cada slot.
  const pedirBolsa = async (w) => {
    const antes = w.__elragEngine.getConsumablePouchSnapshot?.();
    try { w.__elragEngine.requestConsumablePouchSnapshot?.(); } catch { return antes; }
    await esperarAte(() => w.__elragEngine.getConsumablePouchSnapshot?.() !== antes, 2500, 150);
    return w.__elragEngine.getConsumablePouchSnapshot?.() || antes;
  };
  const guardarNaBolsa = async (w) => {
    if (!cfg.usarBolsa) return 0;
    if (typeof w?.__elragEngine?.depositIntoConsumablePouch !== 'function') { log('Bolsa ALT+B: o jogo nao expos a funcao de guardar; nada guardado'); return 0; }
    try {
      let snap = await pedirBolsa(w);
      // Preservar as asas já guardadas na ALT+B; não retirar durante depósito.
      const ehAsa = (nome, id) => Number(id) === 601 || /\basas? de mosca\b|\bfly wings?\b/.test(normalizar(nome));
      // v3.01: o Set vem do iframe do jogo (outro "realm"): `instanceof Set` da
      // falso aqui fora. Testar pelo metodo. Sem lista, tenta assim mesmo -- a
      // regra de admissao e do servidor, que recusa o que nao puder.
      const aceita = snap?.admissibleInventoryIndexes;
      const temLista = aceita && typeof aceita.has === 'function' && aceita.size > 0;
      await lerMochila(w);
      const equipados = (await lerEquipados(w)) || new Set();
      const nomes = new Set((cfg.compras || []).filter((c) => c && c.nome).map((c) => normalizar(c.nome)));
      const daLista = itensMochila().filter(({ item }) => item && Number(item.count) > 0 && Number.isInteger(item.index) &&
        !equipados.has(item.index) && nomes.has(nomeBase(item.name)) && !ehAsa(item.name, item.itemId));
      const guardar = temLista ? daLista.filter(({ item }) => aceita.has(item.index)) : daLista;
      if (!guardar.length) {
        if (daLista.length) log('Bolsa ALT+B: a bolsa nao aceita ' + daLista.map(({ item }) => item.name).join(', ') + ' (item nao admitido ou sem slot livre)');
        return 0;
      }
      const antes = new Map(guardar.map(({ item }) => [item.name, naBolsa(w, item.name)]));
      for (const { item } of guardar) {
        w.__elragEngine.depositIntoConsumablePouch(item.index, Number(item.count));
        await esperar(450);
      }
      await esperar(700);
      await pedirBolsa(w);
      await lerMochila(w);
      const entrou = guardar.map(({ item }) => ({ nome: item.name, n: naBolsa(w, item.name) - (antes.get(item.name) || 0) }));
      const ok = entrou.filter((e) => e.n > 0);
      const nao = entrou.filter((e) => e.n <= 0).map((e) => e.nome);
      if (!ok.length) { log('Bolsa ALT+B: a bolsa recusou ' + nao.join(', ') + ' (sem slot livre, slot cheio ou item nao admitido)'); return 0; }
      const sobrou = guardar.filter(({ item }) => quantosNaMochila(item.name) > 0).map(({ item }) => item.name);
      log('Bolsa ALT+B: guardei ' + ok.map((e) => e.nome + ' +' + e.n).join(', ') +
        (nao.length ? '; recusou ' + nao.join(', ') : '') +
        (sobrou.length ? ' (parte ficou na mochila: slot cheio ou travado: ' + sobrou.join(', ') + ')' : ''));
      return guardar.length;
    } catch (e) { log('Bolsa ALT+B: falhou ao guardar: ' + String(e?.message || e).slice(0, 80)); return 0; }
  };
  // Antes de viajar por suprimento: "Completar" do jogo enche as pilhas da Bolsa
  // com o que houver na mochila e, para VIP, no Armazem. Se resolver, nao viaja.
  let completarBolsaEm = 0;
  const completarBolsa = async (w) => {
    if (!cfg.usarBolsa || Date.now() - completarBolsaEm < 5 * 60 * 1000) return false;
    if (typeof w?.__elragEngine?.autoFillConsumablePouch !== 'function') return false;
    completarBolsaEm = Date.now();
    try { w.__elragEngine.autoFillConsumablePouch(); } catch { return false; }
    await esperar(1500);
    await pedirBolsa(w);
    return true;
  };

  const comprarItens = async (w, bolso = false, { mochilaLida = false, aoEnviar = null, aoRetentar = null } = {}) => {
    const lista = (cfg.compras || []).filter((c) => c && c.nome && (Number(c.alvo) > 0 || (cfg.usarBolsa && Number(c.estoque) > 0)));
    if (!lista.length) { if (!bolso) log('Loja: compras puladas; lista sem itens com quantidade-alvo válida'); return false; }
    const rapido = bolso && aoEnviar;
    let fresca = mochilaLida || await lerMochila(w);
    // v3.04: projetil SEMPRE primeiro: antes, Morango x333 vinha antes na lista,
    // gastava o zeny e o projetil era recusado -> Sniper/Gunslinger sem atacar.
    const municaoPrimeiro = (xs) => xs.slice().sort((a, b) => Number(ehMunicao(b.nome)) - Number(ehMunicao(a.nome)));
    let faltas = municaoPrimeiro(calcularFaltas(w, lista, true));
    if (!faltas.length && fresca) { log('Loja: mochila completa, nada a comprar'); return false; }
    if (!fresca) log('Loja: mochila nao atualizou; vou conferir com a loja aberta');
    if (!bolso && Date.now() < compraCidadeBloqueadaAte) { log('Loja: compra na cidade em espera; venda continua independente'); return false; }

    if (bolso) {
      if (!await abrirLojaDeBolso(w)) return false;
    } else {
      if (!await falarComNpc(w, 'vendedor', () => dialogoMercadorAberto(w))) {
          log('Loja: compras puladas; diálogo do vendedor não abriu. Nova tentativa na cidade liberada em 15 min');
          compraCidadeBloqueadaAte = Date.now() + 15 * 60000;
          return false; 
      }
      const sup = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Comprar suprimentos/.test(t)), 3000);
      if (!sup) { 
          log('Loja: botao "Comprar suprimentos" nao apareceu'); 
          await fecharLoja(w); 
          compraCidadeBloqueadaAte = Date.now() + 15 * 60000;
          return false; 
      }
      sup.click();
      compraCidadeBloqueadaAte = 0;
    }
    if (!await esperarAte(() => lojaAberta(w), 6000)) { log('Loja: janela Suprimentos não detectada em 6 s após abrir; compra pulada'); await fecharLoja(w); return false; }
    if (!fresca) {
      fresca = await lerMochila(w);
      if (!fresca && !estadoLoja.mochila) { log('Loja: mochila ilegivel mesmo com a loja aberta; pulando'); await fecharLoja(w); return false; }
      faltas = municaoPrimeiro(calcularFaltas(w, lista, true));
      const contas = lista.map((c) => `${c.nome} ${quantosNaMochila(c.nome)}+${naBolsa(w, c.nome)}`).join(', ');
      log(`Loja: conferido com a loja aberta (${fresca ? 'mochila nova' : 'mochila AINDA velha'}): ${contas}`);
      if (!faltas.length) { log('Loja: compra pulada após nova leitura; suprimentos já completos'); await fecharLoja(w); return false; }
    }

    // v3.00: compra DIRETO na Bolsa quando a loja aberta admite o item
    // (beneficio VIP do jogo). O que nao entrar segue a compra normal e depois
    // e guardado na Bolsa.
    const diretos = [];
    if (cfg.usarBolsa && typeof w.__elragEngine?.buyIntoConsumablePouch === 'function') {
      const admitidos = estadoLoja.admissaoBolsa?.itemIds;
      const idDoItem = (nome) => {
        const n = normalizar(nome);
        const naBolsaSlot = (w.__elragEngine.getConsumablePouchSnapshot?.()?.slots || []).find((sl) => sl.itemId && normalizar(sl.name) === n);
        if (naBolsaSlot) return naBolsaSlot.itemId;
        return itensMochila().find(({ item }) => nomeBase(item?.name) === n)?.item.itemId;
      };
      for (const c of faltas) {
        const id = Number(idDoItem(c.nome));
        if (!id || typeof admitidos?.has !== 'function' || !admitidos.has(id)) continue;
        const antes = naBolsa(w, c.nome);
        w.__elragEngine.buyIntoConsumablePouch(id, c.qtd);
        await esperar(rapido ? 500 : 900);
        await pedirBolsa(w);
        const depois = naBolsa(w, c.nome);
        if (depois > antes) diretos.push({ c, n: depois - antes });
      }
    }
    if (diretos.length) {
      log('Bolsa ALT+B: comprei direto na bolsa ' + diretos.map((d) => d.c.nome + ' +' + d.n).join(', '));
      faltas = faltas.filter((c) => !diretos.some((d) => d.c === c && d.n >= c.qtd))
        .map((c) => { const d = diretos.find((x) => x.c === c); return d ? { ...c, qtd: c.qtd - d.n, tem: c.tem + d.n } : c; });
      if (!faltas.length) { await fecharLoja(w); return true; }
    }

    const porAba = new Map();
    for (const c of faltas) {
      const aba = c.aba || 'Consumíveis';
      if (!porAba.has(aba)) porAba.set(aba, []);
      porAba.get(aba).push(c);
    }
    const feitos = [];
    for (const [aba, itens] of porAba) {
      const alvoAba = normalizar(aba), raizAba = alvoAba.replace(/s$/, '');
      const botaoAba = botaoPorTexto(w.document, (t) => normalizar(t) === alvoAba)
        || botaoPorTexto(w.document, (t) => { const n = normalizar(t); return n.length < 30 && (n.startsWith(raizAba) || n.includes(raizAba)); });
      if (botaoAba) { botaoAba.click(); await esperar(250); }
      else if (!lojaSemAbasAvisada) { lojaSemAbasAvisada = true; log('Loja: sem aba "' + aba + '"; procurando pelos nomes na lista'); }

      let pendentes = itens.slice();
      for (let fator = 1; pendentes.length && fator >= 1 / 8; fator /= 2) {
        if (fator < 1 && !lojaAberta(w)) break;
        if (fator < 1 && aoRetentar) await aoRetentar();
        const tentados = [];
        for (const c of pendentes) {
          const qtd = Math.max(1, Math.floor(c.qtd * fator));
          const campo = (await esperarAte(() => linhaDoProduto(w, c.nome), botaoAba ? 2000 : 600)) || (await buscarNaLoja(w, c.nome));
          if (!campo) { log(`Loja: "${c.nome}" nao encontrado (aba ${aba}, lista e busca)`); continue; }
          digitar(w, campo, qtd);
          await esperar(rapido ? 150 : 300);
          tentados.push({ ...c, qtdTentada: qtd });
        }
        if (!tentados.length) break;
        await esperar(rapido ? 200 : 400);
        const confirmar = botaoPorTexto(w.document, (t) => /^Confirmar compra$/.test(t));
        if (!confirmar) { compraTravada = true; log('Loja: "Confirmar compra" desabilitado (zeny ou peso?) com ' + tentados.map((c) => c.nome + ' x' + c.qtdTentada).join(', ')); pendentes = tentados; continue; }
        confirmar.click();
        await esperar(rapido ? 600 : 1500);
        botaoPorTexto(w.document, (t) => /^(OK|Sim|Confirmar)$/i.test(t))?.click();
        await esperar(rapido ? 200 : 500);
        await lerMochila(w);
        pendentes = [];
        for (const c of tentados) {
          const agora = quantosNaMochila(c.nome) + naBolsa(w, c.nome);
          if (agora > c.tem) feitos.push(`${c.nome} ${c.tem}+${agora - c.tem}`);
          else pendentes.push(c);
        }
        if (aoEnviar) await aoEnviar();
        if (pendentes.length) log('Loja: compra NAO entrou (' + pendentes.map((c) => c.nome + ' x' + c.qtdTentada).join(', ') + '); peso ou zeny? ' + (fator > 1 / 8 ? 'tento com metade' : 'desisto por agora'));
      }
    }
    await fecharLoja(w);
    for (const c of faltas) {
      const n = normalizar(c.nome);
      if (feitos.some((x) => normalizar(x).startsWith(n + ' '))) compraFalhou.delete(n);
      else compraFalhou.set(n, Date.now());
    }
    log(feitos.length ? `Loja: comprei ${feitos.join(', ')}` : 'Loja: nada foi comprado');
    if (feitos.length) await guardarNaBolsa(w);
    const recusados = faltas.filter((c) => compraRecusada(c.nome)).map((c) => c.nome);
    if (recusados.length) log('Loja: sem conseguir comprar ' + recusados.join(', ') + ' (zeny ou peso?). Nao volto a cidade por esse item nos proximos 30 min');
    return feitos.length > 0;
  };

  const LOJA_BOLSO_ID = 1280330;
  cfg.lojaBolso = cfg.lojaBolso === true;
  // v2.99: guardar suprimentos na Bolsa ALT+B (nao pesa; o Autopilot usa dela
  // primeiro) e gatilho baixo (volta so com 20% do alvo). Ligados por padrao.
  cfg.usarBolsa = cfg.usarBolsa !== false;
  cfg.gatilhoBaixo = cfg.gatilhoBaixo !== false;
  const lojaDeBolso = () => itensMochila().find(({ item }) => Number(item.itemId) === LOJA_BOLSO_ID || /loja de bolso/.test(normalizar(item.name)));

  const abrirLojaDeBolso = async (w) => {
    const lb = lojaDeBolso();
    if (!lb || !Number.isInteger(lb.item.index)) { log('Loja de Bolso: item nao esta na mochila'); return false; }
    await esperar(500); 
    try { w.__elragEngine.useInventoryItem(lb.item.index); } catch (e) { log('Loja de Bolso: falhou ao usar ' + String(e).slice(0, 60)); return false; }
    const passo = await esperarAte(() => {
      if (lojaAberta(w)) return 'loja';
      const btn = botaoPorTexto(w.document, (t) => /^Comprar\s*$/i.test(t));
      if (btn) return btn;
      return null;
    }, 5000, 150);
    if (!passo) { bolsoNaoAbriu = true; log('Loja de Bolso: a janela comprar/vender nao apareceu'); await fecharLoja(w); return false; }
    if (passo !== 'loja') {
      log('Loja de Bolso: clicando em Comprar');
      clicarBotao(w, passo); 
      await esperar(1000); 
      if (!await esperarAte(() => lojaAberta(w), 4000)) { 
          log('Loja de Bolso: tentando clicar em Comprar novamente...');
          clicarBotao(w, passo);
          await esperar(1000);
          if (!await esperarAte(() => lojaAberta(w), 4000)) { 
              log('Loja de Bolso: a loja nao abriu apos o clique'); 
              return false; 
          }
      }
    }
    return true;
  };

  const abrirVendaDeBolso = async (w) => {
    const lb = lojaDeBolso();
    if (!lb || !Number.isInteger(lb.item.index)) { log('Loja de Bolso: item nao esta na mochila'); return false; }
    try { w.__elragEngine.useInventoryItem(lb.item.index); } catch (e) { log('Loja de Bolso: falhou ao usar ' + String(e).slice(0, 60)); return false; }
    const passo = await esperarAte(() => vendaAberta(w) ? 'venda' : botaoPorTexto(w.document, (t) => /^Vender\b/i.test(t) && !/^Vender tudo/i.test(t)), 5000, 150);
    if (!passo) { log('Loja de Bolso: opcao "Vender" nao apareceu'); await fecharLoja(w); return false; }
    if (passo !== 'venda') passo.click();
    return Boolean(await esperarAte(() => vendaAberta(w), 6000));
  };

  let bolsoNaoAbriu = false, bolsoFalhasSeguidas = 0;
  let compraTravada = false, venderParaComprar = false, vendeuParaComprarEm = 0;
  let compraBolsoEm = 0, bolsoDesligouAutopilot = false, lojaDiagnosticada = false, lojaSemAbasAvisada = false;
  const COMPRA_BOLSO_INTERVALO_MS = 60000;

  const compraNaHunt = async (w) => {
    compraBolsoEm = Date.now();
    const lista = (cfg.compras || []).filter((c) => c && c.nome && Number(c.alvo) > 0);
    if (!lista.length) return;
    if (/Renascer agora|Voltar ao ponto de salvamento/.test(w.document.body.innerText || '')) { compraBolsoEm = Date.now() - COMPRA_BOLSO_INTERVALO_MS + 15000; return; }
    if (!await lerMochila(w)) return;
    if (!itensMochila().length) return;
    const faltas = calcularFaltas(w, lista);
    if (!faltas.length) {
      const detalhes = lista.map(c => `${c.nome}: ${quantosNaMochila(c.nome)+naBolsa(w,c.nome)}/${c.alvo} (min ${c.minimo})`).join(', ');
      log(`Loja de Bolso: nada a comprar (${detalhes})`);
      return;
    }
    if (!lojaDeBolso()) { log('Loja de Bolso: ligada, mas o item nao esta na mochila'); return; }
    ocupado = true;
    bolsoNaoAbriu = false; compraTravada = false;
    const tinhaAutopilot = autopilotLigado(w);
    try {
      etapa('Loja de Bolso', 'Repondo suprimentos sem sair da cacada');
      if (tinhaAutopilot) await pausarCacada(w);
      const religar = async () => {
        if (!tinhaAutopilot) return;
        if (huntsPausados.has(w)) { botaoHunt(w, false)?.click(); huntsPausados.delete(w); }
        if (!autopilotLigado(w)) ligarAutopilot(w, true);
      };
      const comprou = await comprarItens(w, true, {
        mochilaLida: true,
        aoEnviar: religar,
        aoRetentar: async () => { if (tinhaAutopilot) await pausarCacada(w); },
      });
      if (comprou) bolsoFalhasSeguidas = 0;
      else if (compraTravada && cfg.venda.ligado && Date.now() - vendeuParaComprarEm > 5 * 60000) { venderParaComprar = true; compraBolsoEm = Date.now() - COMPRA_BOLSO_INTERVALO_MS + 3000; log('Loja de Bolso: compra recusada (peso?); vendo pela Loja de Bolso e compro de novo'); }
      else if (bolsoNaoAbriu && bolsoFalhasSeguidas < 5) { bolsoFalhasSeguidas++; compraBolsoEm = Date.now() - COMPRA_BOLSO_INTERVALO_MS + 20000; log('Loja de Bolso: a loja nao abriu; tento de novo em 20 s (' + bolsoFalhasSeguidas + '/5)'); }
      else { bolsoFalhasSeguidas = 0; compraBolsoEm = Date.now() + 14 * 60000; log('Loja de Bolso: nada comprado; proxima tentativa em 15 min (confira a aba dos itens em Compras)'); }
    } catch (e) {
      log('Loja de Bolso: falha — ' + String(e?.message || e).slice(0, 100));
    } finally {
      if (tinhaAutopilot) {
        if (huntsPausados.has(w)) { botaoHunt(w, false)?.click(); huntsPausados.delete(w); }
        const voltou = await esperarAte(() => { if (autopilotLigado(w)) return true; ligarAutopilot(w, true); return false; }, 6000, 300);
        bolsoDesligouAutopilot = !voltou;
        log(voltou ? 'Loja de Bolso: autopilot religado' : 'Loja de Bolso: autopilot NAO confirmou religar; tentando de novo no proximo ciclo');
        if (!voltou) compraBolsoEm = Date.now() - COMPRA_BOLSO_INTERVALO_MS + 5000;
      }
      try { if (lojaAberta(w)) await fecharLoja(w); } catch {}
      etapa('Aguardando', 'Monitorando peso e morte');
      ocupado = false;
    }
  };

  const TIPOS_VENDA = [['card', 'Cartas'], ['equip', 'Equipamentos'], ['usable', 'Consumiveis'], ['etc', 'Outros (materiais, drops)']];
  const RARIDADES = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico'];

  cfg.venda = Object.assign({
    ligado: false, limite: 70,
    proteger: { card: true, equip: false, usable: true, etc: false },
    comCarta: true, raridadeMin: 0, nomes: []
  }, cfg.venda || {});
  cfg.venda.proteger = Object.assign({ card: true, equip: false, usable: true, etc: false }, cfg.venda.proteger);

  if (!cfg.venda.__v207_raridade) {
    if (Number(cfg.venda.raridadeMin) === 3) cfg.venda.raridadeMin = 0;
    cfg.venda.__v207_raridade = true;
    salvarCfg();
  }

  cfg.armazem = Object.assign({ ligado: true, usarCartao: true, tudoNoMapa: false }, cfg.armazem || {});
  if (!['guardar', 'vender'].includes(cfg.armazem.modoInventario)) {
    cfg.armazem.modoInventario = cfg.armazem.tudoNoMapa ? 'guardar' : 'vender';
  }
  const guardarTudo = () => cfg.armazem.modoInventario === 'guardar';
  const guardarNoMapa = () => guardarTudo() && cfg.armazem.tudoNoMapa;
  const venderNoMapa = () => !cfg.ferreiro && !guardarTudo() && cfg.venda.ligado && cfg.lojaBolso &&
    cfg.armazem.ligado && cfg.armazem.usarCartao && cfg.armazem.tudoNoMapa;
  const cartaoKafra = (item) => /cartao (?:de )?kafra/.test(normalizar(item.name));
  const itensMochila = () => Object.entries(estadoLoja.mochila || {}).flatMap(([tipo, itens]) =>
    Array.isArray(itens) ? itens.filter(Boolean).map((item) => ({ tipo, item })) : []);

  const lerEquipados = async (w) => {
    instalarGanchos(w);
    const antes = estadoLoja.equipamentoSeq;
    try { w.__elragEngine.requestEquipmentSnapshot(); } catch { return null; }
    if (!await esperarAte(() => estadoLoja.equipamentoSeq > antes, 3000, 200)) return null;
    const indices = new Set();
    const fila = [estadoLoja.equipamento], vistos = new Set();
    while (fila.length && vistos.size < 5000) {
      const o = fila.shift();
      if (!o || typeof o !== 'object' || vistos.has(o)) continue;
      vistos.add(o);
      if (Number.isInteger(o.index) && o.itemId !== undefined) indices.add(o.index);
      for (const v of Object.values(o)) if (v && typeof v === 'object') fila.push(v);
    }
    return indices;
  };

  const itemDeCompra = (item) => {
    const n = nomeBase(item?.name);
    return Boolean(n) && (cfg.compras || []).some((c) => c && c.nome && normalizar(c.nome) === n);
  };
  const reservadoNoFarm = (item) => itemDeCompra(item) || /\bflechas?\b|\barrows?\b|\basas? de mosca\b|\bfly wings?\b/.test(normalizar(item.name));
  const verdadeiro = (v) => v === true || v === 1 || v === '1' || v === 'true';
  const ovoDePet = (item) => verdadeiro(item?.isPetEgg) || verdadeiro(item?.petEgg) ||
    /^ovo (?:de|do|da) \S+/.test(nomeBase(item?.name)) || /\bpet egg\b/.test(nomeBase(item?.name));
  const alvoLucky = (item) => (cfg.lucky || []).find((alvo) => nomeBase(alvo) === nomeBase(item?.name));
  const itemFavorito = (item) => verdadeiro(item?.favorite) ||
    Object.entries(item || {}).some(([k, v]) => /fav/i.test(k) && verdadeiro(v));
  const itemEquipado = (item, equipados) => equipados.has(item.index) ||
    ['equipped', 'isEquipped', 'equipado', 'isWorn'].some((k) => verdadeiro(item[k])) || Number(item.wearState) > 0;
  cfg.armazem.itensPresos = Array.isArray(cfg.armazem.itensPresos) ? cfg.armazem.itensPresos : [];
  const chavePreso = (item) => `${item.itemId}:${nomeBase(item.name)}`;
  const itemPreso = (item) => /\bgarfo (?:de|do) glutao\b/.test(nomeBase(item.name)) ||
    cfg.armazem.itensPresos.includes(chavePreso(item)) ||
    ['bound', 'isBound', 'accountBound', 'characterBound', 'isAccountBound', 'isCharacterBound', 'notStorable', 'cannotStore'].some((k) => verdadeiro(item[k])) ||
    ['canStore', 'canDeposit', 'storageAllowed', 'canMoveToStorage'].some((k) => item[k] === false) ||
    ['bindType', 'boundType', 'binding'].some((k) => item[k] != null &&
      !['', '0', 'false', 'none', 'unbound'].includes(String(item[k]).toLowerCase()));
  const registrarPreso = (item) => {
    const chave = chavePreso(item);
    if (!cfg.armazem.itensPresos.includes(chave)) {
      cfg.armazem.itensPresos.push(chave);
      salvarCfg();
      log('Armazem: ' + item.name + ' preso ao personagem; ignorado nos proximos ciclos');
    }
  };
  const itemTravado = (item) => Object.entries(item || {}).some(([k, v]) =>
    /^(?:locked|isLocked|lock|isLock|travado|isTravado|storageLocked|isStorageLocked)$/i.test(k) && verdadeiro(v));
  const nuncaGuardar = (item, equipados) => itemEquipado(item, equipados) || itemTravado(item) || itemFavorito(item) || ovoDePet(item) || itemPreso(item);
  const observarRecusaPreso = (w) => {
    let recusado = false;
    const re = /bound(?:ed)? item cannot be stor(?:e|ed)|(?:item|equipamento) (?:preso|vinculado|ligado).*(?:armaz[eé]m|guardar|armazen)|n[aã]o (?:pode|e poss[ií]vel) (?:guardar|armazenar).*vinculado/i;
    const obs = new w.MutationObserver((mudancas) => {
      for (const m of mudancas) {
        if ([...m.addedNodes].some((n) => re.test(n.textContent || '')) ||
            (m.type === 'characterData' && re.test(m.target.textContent || ''))) recusado = true;
      }
    });
    obs.observe(w.document.body, { childList: true, characterData: true, subtree: true });
    return { recusado: () => recusado, parar: () => obs.disconnect() };
  };
  const candidatosArmazem = (equipados, todos = false) => itensMochila().filter(({ item, tipo }) =>
    Number.isInteger(item.index) && Number(item.count) > 0 &&
    !nuncaGuardar(item, equipados) && !cartaoKafra(item) && !reservadoNoFarm(item) && (todos || Boolean(motivoProtecao(item, tipo))));

  const itensArmazem = () => Object.entries(estadoLoja.armazem || {}).flatMap(([tipo, itens]) =>
    Array.isArray(itens) ? itens.filter(Boolean).map((item) => ({ tipo, item })) : []);
  const totalLucky = (alvo, lista) => lista.reduce((n, { item }) =>
    n + (nomeBase(item.name) === nomeBase(alvo) ? Math.max(1, Number(item.count) || 1) : 0), 0);
  const vistoLucky = new Map();
  let seqLuckyMochila = -1;
  let alertaLucky = null;
  const avisarLucky = (alvo, quantidade) => {
    const mensagem = `${alvo}: ${quantidade} na mochila. Protegido de venda e desmantelamento.`;
    log('Lucky drop detectado! ' + mensagem);
    if (!alertaLucky?.isConnected) {
      alertaLucky = document.createElement('div');
      alertaLucky.dataset.fznAutoVoltar = '1';
      Object.assign(alertaLucky.style, { position: 'fixed', top: '14px', right: '14px', zIndex: 2147483647,
        maxWidth: '320px', padding: '10px 12px', background: '#172235', color: '#fff7d6',
        border: '2px solid #facc15', borderRadius: '10px', boxShadow: '0 4px 18px #0009',
        font: 'bold 13px/1.4 system-ui,sans-serif' });
      document.body.appendChild(alertaLucky);
    }
    alertaLucky.replaceChildren();
    const titulo = document.createElement('div'); titulo.textContent = '★ LUCKY DROP ENCONTRADO';
    const descricao = document.createElement('div'); descricao.textContent = mensagem;
    const fechar = document.createElement('button'); fechar.textContent = 'Entendi';
    fechar.addEventListener('click', () => alertaLucky?.remove());
    alertaLucky.append(titulo, descricao, fechar);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification('Lucky drop encontrado', { body: mensagem });
    } catch {}
  };
  const vigiarLucky = () => {
    if (estadoLoja.mochilaSeq === seqLuckyMochila || !estadoLoja.mochila) return;
    seqLuckyMochila = estadoLoja.mochilaSeq;
    const mochila = itensMochila();
    for (const alvo of cfg.lucky || []) {
      const quantidade = totalLucky(alvo, mochila);
      const anterior = vistoLucky.get(nomeBase(alvo)) || 0;
      if (quantidade > anterior) avisarLucky(alvo, quantidade);
      vistoLucky.set(nomeBase(alvo), quantidade);
    }
    atualizarStatus();
  };
  const ponteRetirar = (w) => {
    if (w.__fznRetirar || w.__fznRetirarPedido) return;
    w.__fznRetirarPedido = 1;
    const sc = w.document.createElement('script'); sc.type = 'module';
    sc.textContent = "import('UI/Components/Storage/Storage.js').then((m)=>{window.__fznRetirar=(i,c)=>m.default.reqRemoveItem(i,c);}).catch((e)=>{window.__fznRetirarErro=String(e);});";
    w.document.head.appendChild(sc);
  };
  const retirarDoArmazem = async (w) => {
    const lista = (cfg.compras || []).filter((c) => c && c.nome && Number(c.alvo) > 0);
    if (!lista.length) { log('Armazém: retirada pulada porque a lista de compras não tem quantidades-alvo válidas'); return; }
    await lerMochila(w);
    const faltas = calcularFaltas(w, lista, true);
    if (!faltas.length) { log('Armazém: retirada pulada porque a mochila já tem os suprimentos da lista'); return; }
    etapa('6/8 Armazem', 'Pegando do armazem os itens da lista de Compras');
    ponteRetirar(w);
    const seq0 = estadoLoja.armazemSeq;
    if (!await abrirArmazem(w, true)) { log('Armazem: nao abriu para retirar; sigo para a compra'); return; }
    const limite = Date.now() + 4000; let visto = estadoLoja.armazemSeq, quieto = Date.now();
    while (Date.now() < limite && (estadoLoja.armazemSeq === seq0 || Date.now() - quieto < 700)) { await esperar(100); if (estadoLoja.armazemSeq !== visto) { visto = estadoLoja.armazemSeq; quieto = Date.now(); } }
    if (!await esperarAte(() => w.__fznRetirar || w.__fznRetirarErro, 3000, 100) || !w.__fznRetirar) { log('Armazem: nao consegui a funcao de retirar (' + (w.__fznRetirarErro || 'sem resposta') + '); sigo para a compra'); await fecharArmazem(w); return; }
    const feitos = [];
    for (const c of faltas) {
      const alvo = normalizar(c.nome);
      const no = itensArmazem().find(({ item }) => nomeBase(item.name) === alvo && Number(item.count) > 0 && Number.isInteger(item.index));
      if (!no) continue;
      const qtd = Math.min(c.qtd, Number(no.item.count));
      try { w.__fznRetirar(no.item.index, qtd); feitos.push(c.nome + ' x' + qtd); } catch (e) { log('Armazem: falhou ao retirar ' + c.nome + ': ' + String(e).slice(0, 60)); }
      await esperar(500);
    }
    log(feitos.length ? 'Armazem: retirei ' + feitos.join(', ') + ' (antes de comprar)' : 'Armazem: nenhum item da lista de Compras guardado' + (itensArmazem().length ? '' : ' (armazem nao leu)'));
    await fecharArmazem(w);
    await lerMochila(w);
  };
  const armazemAberto = (w) => [...w.document.querySelectorAll('h1,h2,h3,div,span')]
    .some((el) => visivel(el) && normalizar(textoDe(el)) === 'armazem (kafra)');
  const ocupacaoArmazem = (w) => {
    if (!armazemAberto(w)) return false;
    const texto = w.document.body.innerText || w.document.body.textContent || '';
    const contagens = [...texto.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)]
      .map(([, usados, capacidade]) => ({ usados: Number(usados), capacidade: Number(capacidade) }))
      // Peso (ex.: 12.354/19.400) tambem aparece no body; nao e a lotacao da Kafra.
      .filter(({ capacidade }) => capacidade >= 300 && capacidade <= 2000);
    return contagens[0] || null;
  };
  const armazemCheio = (w) => {
    const ocupacao = ocupacaoArmazem(w);
    return Boolean(ocupacao && ocupacao.usados >= ocupacao.capacidade);
  };

  const fecharMochilaDoCartao = async (w) => {
    const achar = () => {
      for (const titulo of w.document.querySelectorAll('h1,h2,h3,div,span')) {
        if (!visivel(titulo) || normalizar(textoDe(titulo)) !== 'mochila') continue;
        let cabecalho = titulo;
        for (let i = 0; cabecalho && i < 3; i++, cabecalho = cabecalho.parentElement) {
          const fechar = [...cabecalho.querySelectorAll('button')].find(b => visivel(b) &&
            normalizar(b.getAttribute('aria-label') || b.title || textoDe(b)) === 'fechar');
          if (fechar) return fechar;
        }
      }
      return null;
    };
    const fechar = achar();
    if (!fechar) return true;
    fechar.click();
    return Boolean(await esperarAte(() => !achar(), 3000, 250));
  };
  const fecharArmazem = async (w) => {
    if (!armazemAberto(w)) return fecharMochilaDoCartao(w);
    etapa('Fechando armazem', 'A cacada so pode continuar com a janela fechada');
    try { w.__elragEngine.closeStorage(); } catch (e) { log('Fechamento pela API: ' + String(e)); }
    let fechou = await esperarAte(() => !armazemAberto(w), 3000, 250);
    if (!fechou) {
      const titulo = [...w.document.querySelectorAll('h1,h2,h3,div,span')]
        .find(el => visivel(el) && normalizar(textoDe(el)) === 'armazem (kafra)');
      let painelAr = titulo;
      for (let i = 0; painelAr && i < 6; i++, painelAr = painelAr.parentElement) {
        const fechar = [...painelAr.querySelectorAll('button')].find(b => visivel(b) &&
          /^(fechar|fechar armazem|close|×|✕|x)$/.test(normalizar(b.getAttribute('aria-label') || b.title || textoDe(b))));
        if (fechar) { fechar.click(); break; }
      }
      fechou = await esperarAte(() => !armazemAberto(w), 3000, 250);
    }
    if (!fechou) log('Armazem: nao fechou; retorno permanece bloqueado');
    if (fechou && !await fecharMochilaDoCartao(w)) { log('Mochila nao fechou apos o cartao'); return false; }
    return Boolean(fechou);
  };

  const abrirArmazem = async (w, naCidade) => {
    if (armazemAberto(w)) return true;
    if (cfg.armazem.usarCartao || cfg.armazem.tudoNoMapa) {
      const cartao = itensMochila().find(({ item }) => cartaoKafra(item) && item.canUse && Number(item.count) > 0 && Number.isInteger(item.index));
      if (cartao && typeof w.__elragEngine.useInventoryItem === 'function') {
        log(`Armazem: usando ${cartao.item.name}${naCidade ? ' em Prontera' : ''}`);
        w.__elragEngine.useInventoryItem(cartao.item.index);
        if (await esperarAte(() => armazemAberto(w), 8000, 250)) return true;
        log('Armazem: cartao nao abriu a janela');
      }
    }
    if (!naCidade) return false;
    if (normalizar(posicao(w)?.mapa) !== 'prontera') {
      log('Armazem: a chegada nao foi em Prontera; nao vou procurar Kafra em outro mapa');
      return false;
    }
    if (!dialogoKafraAberto(w.document) && !await falarComNpc(w, 'kafra', () => dialogoKafraAberto(w.document))) return false;
    const opcao = await esperarAte(() => botaoPorTexto(w.document, (t) => {
      const n = normalizar(t);
      return /\barmazem\b/.test(n) && !/guild|cla|fechar|cancelar/.test(n);
    }), 3000);
    if (!opcao) {
      log('Armazem: opcao de armazem nao apareceu na conversa da Kafra');
      try { w.__elragEngine.cancelNpcDialog?.(); } catch {}
      return false;
    }
    opcao.click();
    for (let i = 0; i < 24 && !armazemAberto(w); i++) {
      await esperar(250);
      if (armazemAberto(w)) break;
      if (dialogoKafraAberto(w.document)) {
        botaoPorTexto(w.document, (t) => /^(proximo|continuar|ok)$/.test(normalizar(t)))?.click();
      }
    }
    if (!armazemAberto(w)) {
      log('Armazem: a Kafra nao abriu a janela');
      try { w.__elragEngine.cancelNpcDialog?.(); } catch {}
      return false;
    }
    return true;
  };

  const painelMochila = (w) => {
    for (const titulo of w.document.querySelectorAll('h1,h2,h3,div,span')) {
      if (!visivel(titulo) || normalizar(textoDe(titulo)) !== 'mochila') continue;
      for (let p = titulo.parentElement, i = 0; p && i < 6; p = p.parentElement, i++) {
        const tem = [...p.querySelectorAll('button')].some((b) => normalizar(textoDe(b)) === 'selecionar todos');
        if (tem) return p;
      }
    }
    return null;
  };
  const botaoNoPainel = (painel, re) => [...painel.querySelectorAll('button')]
    .find((b) => visivel(b) && !b.disabled && re.test(normalizar(textoDe(b))));
  const contagemSelecionados = (painel) => {
    const t = normalizar(textoDe(painel));
    if (/nenhum item selecionado/.test(t)) return 0;
    const m = t.match(/(\d+) (?:itens?|pilhas?) selecionad/);
    return m ? Number(m[1]) : null;
  };
  const guardarEquipamentosPeloBotao = async (w, equipados, todos) => {
    const equipLivres = itensMochila().filter(({ tipo, item }) => tipo === 'equip' && Number.isInteger(item.index) && !itemEquipado(item, equipados));
    if (!equipLivres.length) return 0;
    const chaves = new Set(candidatosArmazem(equipados, todos).filter(({ tipo }) => tipo === 'equip').map(({ item }) => item.index));
    if (equipLivres.some(({ item }) => !chaves.has(item.index))) {
      log('Armazem: ha equipamento que nao deve ser guardado; equipamentos vao pelo lote');
      return 0;
    }
    const painel = painelMochila(w);
    if (!painel) { log('Armazem: janela Mochila com "Selecionar todos" nao encontrada; usando lote'); return 0; }
    const aba = botaoNoPainel(painel, /^equipamentos$/);
    if (!aba) { log('Armazem: aba Equipamentos nao encontrada; usando lote'); return 0; }
    aba.click();
    await esperar(300);
    const selTodos = botaoNoPainel(painel, /^selecionar todos$/);
    if (!selTodos) return 0;
    etapa('Depositando equipamentos', equipLivres.length + ' pelo Selecionar todos');
    selTodos.click();
    const n = await esperarAte(() => { const c = contagemSelecionados(painel); return c ? c : null; }, 2000, 150);
    if (n !== equipLivres.length) {
      log('Armazem: Selecionar todos marcou ' + (n ?? '?') + ', esperado ' + equipLivres.length + '; cancelado, usando lote');
      botaoNoPainel(painel, /^cancelar$/)?.click();
      return 0;
    }
    const enviar = botaoNoPainel(painel, /^enviar pro kafra$/);
    if (!enviar) { botaoNoPainel(painel, /^cancelar$/)?.click(); return 0; }
    enviar.click();
    const foi = await esperarAte(() => {
      try { w.__elragEngine.requestInventorySnapshot(); } catch {}
      return itensMochila().filter(({ tipo, item }) => tipo === 'equip' && chaves.has(item.index)).length === 0;
    }, 6000, 300);
    log('Armazem: ' + (foi ? 'guardados ' : 'enviados (sem confirmacao) ') + equipLivres.length + ' equipamentos pelo botao');
    return foi ? equipLivres.length : 0;
  };

  const guardarProtegidos = async (w, naCidade, todos = false) => {
    if (!todos && !cfg.armazem.ligado) { log('Armazém: depósito pulado porque está desativado nos ajustes'); return { ok: true, depositados: 0 }; }
    if (!await lerMochila(w)) return { ok: false, motivo: 'mochila nao atualizou' };
    const equipados = await lerEquipados(w);
    if (!equipados) return { ok: false, motivo: 'nao consegui conferir os itens equipados' };
    const lista = candidatosArmazem(equipados, todos);
    log('Armazem: ' + lista.length + (todos ? ' pilhas para guardar no maximo' : ' pilhas protegidas para guardar') + ' (ovos de pet, equipados, travados, favoritos, cartao, flechas e Asa de Mosca preservados)');
    if (!lista.length) {
      const fechou = await fecharArmazem(w);
      return { ok: fechou, depositados: 0, motivo: fechou ? null : 'janela de armazem nao fechou' };
    }
    if (!await abrirArmazem(w, naCidade)) return { ok: false, motivo: 'armazem nao abriu' };
    await esperarAte(() => ocupacaoArmazem(w), 1200, 100);
    if (armazemCheio(w)) {
      log('Armazem cheio: nenhum item sera enviado nesta visita; pulando deposito');
      const fechou = await fecharArmazem(w);
      return { ok: fechou, cheio: true, depositados: 0, motivo: fechou ? null : 'janela de armazem nao fechou' };
    }
    if (typeof w.__elragEngine.moveItemToStorage !== 'function') {
      await fecharArmazem(w);
      return { ok: false, motivo: 'funcao de deposito indisponivel' };
    }
    let depositados = 0, motivo = null, cheio = false;
    const mantidos = new Set();
    const chaveItem = item => `${item.index}:${item.itemId}:${item.name}`;
    let restantes = lista;
    let equipadosDeposito = equipados;
    try {
      if (await lerMochila(w)) {
        const eqLote = await lerEquipados(w);
        if (eqLote && cfg.ligado && armazemAberto(w)) {
          try { depositados += await guardarEquipamentosPeloBotao(w, eqLote, todos); } catch (e) { log('Armazem: botao falhou — ' + String(e?.message || e).slice(0, 80)); }
          await lerMochila(w);
          const enviados = [];
          for (const { item: planejado } of candidatosArmazem(eqLote, todos)) {
            if (!cfg.ligado || !armazemAberto(w)) break;
            if (armazemCheio(w)) { cheio = true; break; }
            const atual = itensMochila().find(({ item: i }) => chaveItem(i) === chaveItem(planejado));
            if (!atual || nuncaGuardar(atual.item, eqLote)) continue;
            const quantidade = Math.floor(Number(atual.item.count));
            if (!(quantidade > 0)) continue;
            etapa('Depositando em lote', atual.item.name + ' x' + quantidade + ' (' + (enviados.length + 1) + ')');
            const recusa = observarRecusaPreso(w);
            try {
              w.__elragEngine.moveItemToStorage(atual.item.index, quantidade);
              await esperar(200);
              if (recusa.recusado()) registrarPreso(atual.item);
            } finally { recusa.parar(); }
            enviados.push({ item: atual.item, quantidade });
          }
          if (enviados.length) {
            await esperar(350);
            if (await lerMochila(w)) {
              const naoAceitos = [];
              for (const { item, quantidade } of enviados) {
                const resto = itensMochila().find(({ item: i }) => chaveItem(i) === chaveItem(item));
                if (!resto || Number(resto.item.count) <= Number(item.count) - quantidade) {
                  depositados += quantidade;
                  log(`Armazem: guardado ${item.name} x${quantidade} (lote)`);
                } else {
                  mantidos.add(chaveItem(resto.item));
                  naoAceitos.push(resto.item.name);
                }
              }
              if (naoAceitos.length) log('Armazem: ' + naoAceitos.length + ' pilhas nao aceitas no lote; mantidas na mochila sem repetir nesta visita (' + naoAceitos.slice(0, 4).join(', ') + (naoAceitos.length > 4 ? ', ...' : '') + ')');
              const finais = await lerEquipados(w);
              if (finais) equipadosDeposito = finais;
              const tentados = new Set(enviados.map(({ item }) => chaveItem(item)));
              restantes = candidatosArmazem(equipadosDeposito, todos).filter(({ item }) => !tentados.has(chaveItem(item)));
              log('Armazem: lote de ' + enviados.length + ' pilhas; ' + restantes.length + ' novas pilhas para conferir');
            }
          }
        }
      }
      for (const planejado of restantes) {
        if (!cfg.ligado || !armazemAberto(w)) { motivo = 'automacao pausada ou armazem fechado'; break; }
        if (armazemCheio(w)) { cheio = true; break; }
        const atual = candidatosArmazem(equipadosDeposito, todos).find(({ item }) =>
          item.index === planejado.item.index && item.itemId === planejado.item.itemId && item.name === planejado.item.name);
        if (!atual) continue;
        const item = atual.item, quantidade = Math.floor(Number(item.count));
        const seq = estadoLoja.mochilaSeq;
        etapa('Depositando', item.name + ' x' + quantidade + ' (' + (depositados + 1) + ')');
        const recusa = observarRecusaPreso(w);
        let resultado;
        try {
          w.__elragEngine.moveItemToStorage(item.index, quantidade);
          resultado = await esperarAte(() => {
            if (recusa.recusado()) return 'preso';
            try { w.__elragEngine.requestInventorySnapshot(); } catch {}
            if (estadoLoja.mochilaSeq <= seq) return false;
            const restante = itensMochila().find(({ item: i }) => i.index === item.index && i.itemId === item.itemId);
            return (!restante || Number(restante.item.count) <= Number(item.count) - quantidade) ? 'guardado' : false;
          }, 1800, 150);
        } finally { recusa.parar(); }
        if (resultado === 'preso') { registrarPreso(item); mantidos.add(chaveItem(item)); continue; }
        const confirmou = resultado === 'guardado';
        if (!confirmou && todos && cfg.ligado && armazemAberto(w)) {
          if (!await lerMochila(w)) { motivo = 'mochila nao atualizou ao conferir item nao enviado'; break; }
          const intacto = itensMochila().find(({item:i}) => chaveItem(i) === chaveItem(item));
          if (intacto && Number(intacto.item.count) === quantidade) {
            mantidos.add(chaveItem(item));
            log('Armazem: ' + item.name + ' x' + quantidade + ' nao aceito; mantido na mochila, seguindo os demais');
            continue;
          }
        }
        if (!confirmou) {
          motivo = `deposito de ${item.name} nao confirmado (armazem cheio, item restrito ou conexao)`;
          log(`Armazem: ${motivo}; parei os envios`);
          break;
        }
        depositados += quantidade;
        log(`Armazem: guardado ${item.name} x${quantidade}`);
      }
      if (!motivo && !cheio) {
        if (!await lerMochila(w)) motivo = 'mochila nao atualizou na conferencia final';
        else {
          const finaisEquipados = await lerEquipados(w);
          if (!finaisEquipados) motivo = 'equipamentos nao atualizaram na conferencia final';
          else if (candidatosArmazem(finaisEquipados, todos).some(({item}) => !mantidos.has(chaveItem(item)))) motivo = 'ainda ha itens previstos para guardar';
        }
      }
    } catch (e) {
      motivo = String(e?.message || e).slice(0, 140);
      log(`Armazem: falha — ${motivo}`);
    } finally {
      if (!await fecharArmazem(w)) motivo = motivo || 'janela de armazem nao fechou';
      try { w.__elragEngine.cancelNpcDialog?.(); } catch {}
    }
    if (cheio) log('Armazem cheio durante o deposito: encerrando envios e seguindo para venda dos permitidos');
    return { ok: !motivo, cheio, depositados, mantidos: mantidos.size, motivo };
  };

  const RE_PESO = /Peso\s*([\d.]+)\s*\/\s*([\d.]+)/;
  const textoHudRotulado = (w, nome) => {
    // No modo compacto o jogo remove "Peso"/"Zeny" do texto, mas mantém
    // o significado no tooltip/aria-label. Nunca interpretar qualquer X/Y
    // da página (HP, slots, quests) como peso.
    for (const el of w.document.querySelectorAll('[title], [aria-label]')) {
      const rotulos = [el.getAttribute?.('title'), el.getAttribute?.('aria-label')];
      if (!rotulos.some(r => r && new RegExp('^' + nome + '(?:\\s*:|$)', 'i').test(r.trim()))) continue;
      if (!visivel(el) || el.closest?.('[data-fzn-auto-voltar], .fzn-ygg')) continue;
      const texto = (el.innerText || el.textContent || '').trim();
      if (texto && texto.length < 80) return texto;
    }
    return '';
  };
  let elPeso = null;
  const textoPeso = (w) => {
    const rotulado = textoHudRotulado(w, 'Peso');
    if (rotulado) return /^Peso\b/i.test(rotulado) ? rotulado : 'Peso ' + rotulado;
    if (elPeso && elPeso.ownerDocument === w.document && elPeso.isConnected && visivel(elPeso) && RE_PESO.test(elPeso.textContent || '')) return elPeso.textContent;
    elPeso = null;
    for (const el of w.document.querySelectorAll('div, span')) {
      const t = el.textContent || '';
      if (t.length <= 40 && visivel(el) && !el.closest?.('[data-fzn-auto-voltar]') && RE_PESO.test(t)) elPeso = el;
    }
    return elPeso ? elPeso.textContent : (w.document.body.innerText || '');
  };
  const lerPeso = (w) => {
    const m = RE_PESO.exec(textoPeso(w));
    if (!m) return null;
    const atual = Number(m[1].replace(/\./g, ''));
    const max = Number(m[2].replace(/\./g, ''));
    return max > 0 && atual >= 0 ? { atual, max, pct: (atual / max) * 100 } : null;
  };

  const nomeBase = (s) => normalizar(String(s || '')
    .replace(/^\+\d+\s*/, '')
    .replace(/\s*\+\d+$/, '')
    .replace(/(\s*\[[^\]]*\])+\s*$/, '')
    .replace(/\s+/g, ' ').trim());

  const ITENS_ALFHEIM = new Set([
    'Armadura de Placas de Ossos', 'Armadura Monárquica', 'Boina Alada',
    'Bota Monárquica', 'Botas do ArchAngeling', 'Botas Veteranas',
    'Caixa de Gemas Angel Poring', 'Capa Monárquica', 'Chapéu Macabro de Cetim',
    'Coelho Macabro', 'Elmo do Senhor da Morte', 'Emerald Ring',
    'Escudo do Abismo', 'Luva da Agilidade', 'Luva da Destreza',
    'Luva da Força', 'Luva da Inteligência', 'Luva da Sorte',
    'Luva da Vitalidade', 'Luvas do Alquimista', 'Machado Veterano',
    'Marionete de Thanatos', 'Orelhas do Ifrit', 'Origem dos Elementos',
    'Para-raios', 'Peixeira', 'Tatuagem Amuleto de Bakonawa',
    'Tatuagem Amuleto de Bangungot', 'Tatuagem Amuleto de Buwaya',
  ].map((n) => normalizar(n)));
  const ITENS_YGG_CORROMPIDA = new Set([
    'Aura Fantasma', 'Bata de Operação Verde', 'Bíblia da Promessa (Volume 2)',
    'Capa Anti-Magia', 'CD Antiquado', 'Chapéu de Chaleira',
    'Chapéu Transformacento', 'Diadema do Paraíso', 'Livro Amaldiçoado',
    'Luvas de H. Motto', 'Luvas do Ferreiro', 'Luvas Felpudas',
    'Manoplas de Sicário', 'Manto dos Esquecidos', 'Máscara Azulada',
    'Máscara de Oni', 'Pena de Águia',
  ].map((n) => normalizar(n)));
  const ITENS_MIDGARDIAN = new Set([
    'Adaga do Perseguidor', 'Alaúde Oriental', 'Amarra Dupla',
    'Anel de Diabolus', 'Armadura de Diabolus', 'Bastão da Destruição',
    'Cajado Perfurador', 'Chakram', 'Chicote da Rainha', 'Diário do Sábio',
    'Escudo Cruzado', 'Espada Veterana', 'Fúria do Furacão', 'Fúria Insana',
    'Maça Carga', 'Manto de Diabolus', 'Martelo Veterano', 'Nêmesis',
    'Pedaço de Pele do Guardião', 'Sapatos Divergentes', 'Traje de Atirador',
    'Vara Sagrada',
    'Boneca de Alice', 'Boneca de Bianca', 'Chapéu de Bebê Dragão',
    'Chapéu de Cangaceiro', 'Chapéu do Bicho Preguiça', 'Chapéu do Capitão',
    'Chapéu Formoso', 'Chifres Majestosos Gigantes', 'Chifres Majestosos Malignos',
    'Chifres Místicos de Bafomé', 'Elmo de Anubis', 'Espírito Olímpico',
    'Máscara Colorida', 'Máscara de Fugitivo', 'Máscara do Ifrit',
    'Óculos Escuros', 'Olhos Biônicos', 'Peixe Fresco', 'Piercing de Umbala',
    'Rosa Escarlate', 'Sol Radiante', 'Torrada Crocante',
  ].map((n) => normalizar(n)));
  const CAIXAS_GUARDADAS = /^caixa (?:midgardian\b|alfheim\b|de yggdrasil corrompida\b|de gemas angel poring\b)|^gema de (?:leao|peixes|capricornio|aquario|escorpiao|touro)\b/;
  
  const protecaoDeCaixa = (item) => {
    const n = nomeBase(item?.name);
    if (ITENS_MIDGARDIAN.has(n)) return 'item da Caixa Midgardian';
    if (ITENS_ALFHEIM.has(n)) return 'item da Caixa Alfheim';
    if (ITENS_YGG_CORROMPIDA.has(n)) return 'item da Caixa de Yggdrasil Corrompida';
    if (CAIXAS_GUARDADAS.test(n)) return 'caixa/gema guardada';
    return null;
  };

  // v2.54: trava absoluta — nunca vender nem desmantelar, vale antes de qualquer outra regra
  const NUNCA_VENDER_FIXO = ['Mana Coagulada', 'Cristal do Tempo', 'Energia Instável', 'Frio dos Mortos', 'Mana Sombria', 'Ascensão de LHZ'];
  const nomeProtegidoDaConta = (nome) => {
    const n = nomeBase(nome);
    return (cfg.venda.nomes || []).map(normalizar).find(x => x &&
      (x.length <= 3 ? n.split(/[^a-z0-9]+/).includes(x) : n.includes(x)));
  };
  const nuncaVenderNome = (nome) => {
    const n = nomeBase(nome);
    if (!n) return null;
    if (/\basas? de mosca\b|\bfly wings?\b/.test(n)) return 'NUNCA VENDER (Asa de Mosca reservada para o farm)';
    if (NUNCA_VENDER_FIXO.some((x) => n.includes(normalizar(x)))) return 'NUNCA VENDER (item raro)';
    if (PREMIOS_RIFA.some((x) => n.includes(normalizar(x)))) return 'NUNCA VENDER (premio da rifa)';
    if (NOMES_CONSOLACAO_RIFA.has(n.replace(/^\[evento\]\s*/, ''))) return 'NUNCA VENDER (consolacao da rifa)';
    const pessoal = nomeProtegidoDaConta(nome);
    if (pessoal) return `NUNCA VENDER (lista desta conta: "${pessoal}")`;
    return null;
  };
  const nuncaVender = (item) => {
    if (Number(item?.itemId) === 601) return 'NUNCA VENDER (Asa de Mosca reservada para o farm)';
    const porNome = nuncaVenderNome(item?.name);
    if (porNome) return porNome;
    // tier do jogo (src-ui/itemRarity.ts): 5 = Lendario (fundo dourado), 6 = Mitico
    if (Number(item?.rarity?.tier) >= 5 || /lendari|mitic/.test(normalizar(item?.rarity?.label || ''))) return 'NUNCA VENDER (lendario)';
    return null;
  };

  const motivoProtecao = (item, tipo) => {
    const v = cfg.venda;
    const trava = nuncaVender(item);
    if (trava) return trava;
    if (alvoLucky(item)) return 'lucky drop procurado';
    const deCaixa = protecaoDeCaixa(item);
    if (deCaixa) return deCaixa;
    if (/cartao (?:de )?kafra/.test(normalizar(item.name))) return 'Cartao Kafra reservado';
    if (ovoDePet(item)) return 'ovo de pet preservado na mochila';
    if (itemTravado(item)) return 'cadeado';
    if (itemDeCompra(item)) return 'item da lista de Compras';
    if (itemFavorito(item)) return 'favorito';
    if (item.isCard && v.proteger.card) return 'carta';
    if (v.proteger[tipo]) return TIPOS_VENDA.find(([k]) => k === tipo)?.[1] || tipo;
    if (v.comCarta && (item.cards || []).some(Boolean)) return 'tem carta encaixada';
    if (Number(v.raridadeMin) > 0 && Number(item.rarity?.tier) >= Number(v.raridadeMin)) return item.rarity.label || 'raridade';
    return null;
  };

  const protecaoDaLinha = (nomeLinha) => {
    if (!nomeLinha) return null;
    const travaNome = nuncaVenderNome(nomeLinha);
    if (travaNome) return travaNome;
    const alvo = nomeBase(nomeLinha);
    const mochila = estadoLoja.mochila || {};
    const correspondentes = [];
    for (const tipo of Object.keys(mochila)) {
      for (const item of Array.isArray(mochila[tipo]) ? mochila[tipo] : []) {
        const b = nomeBase(item.name);
        if (b !== alvo && !b.startsWith(`${alvo} `)) continue;
        correspondentes.push({ item, tipo });
      }
    }
    // A loja nao permite vender exemplares com cadeado. Um deles nao pode
    // proteger por nome todos os exemplares destravados do mesmo equipamento.
    const livres = correspondentes.filter(({item}) => !itemTravado(item));
    if (livres.length) {
      for (const {item,tipo} of livres) {
        const motivo = motivoProtecao(item, tipo);
        if (motivo) return motivo;
      }
      return null;
    }
    if (correspondentes.length) return motivoProtecao(correspondentes[0].item, correspondentes[0].tipo);
    return null; 
  };

  const linhasDeVenda = (w) => [...w.document.querySelectorAll('input[aria-label="Quantidade"]')].filter(visivel).map((campo) => {
    const linha = campo.parentElement;
    const add = linha && [...linha.querySelectorAll('button[aria-label^="Adicionar 1 de "]')][0];
    let nome = '';
    if (add) {
      nome = add.getAttribute('aria-label').replace(/^Adicionar 1 de /, '');
    } else if (linha) {
      const texto = linha.innerText || '';
      nome = texto.split('\n').map(s => s.trim()).find(s => s.length > 2 && !/^[0-9]+$/.test(s)) || '';
    }
    return { campo, linha, nome };
  });

  const botaoQualquer = (w, re) => [...w.document.querySelectorAll('button')].find((b) => visivel(b) && re.test(textoDe(b)));
  const vendaAberta = (w) => Boolean(botaoQualquer(w, /^Confirmar venda$/i));

  const zerarLinha = async (w, l) => {
    digitar(w, l.campo, 0);
    await esperar(150);
    for (let i = 0; i < 400 && Number(l.campo.value) > 0; i++) {
      const menos = l.linha.querySelector('button[aria-label="Diminuir quantidade"]');
      if (!menos || menos.disabled) break;
      menos.click();
      await esperar(20);
    }
  };

  const venderUmaTentativa = async (w, simular = false, bolso = false) => {
    if (!await lerMochila(w)) { log('Venda: nao consegui atualizar a mochila; pulando'); return false; }
    const equipados = await lerEquipados(w);
    if (equipados && !itensMochila().some(({item,tipo}) =>
      Number(item.count) > 0 && !equipados.has(item.index) &&
      !cartaoKafra(item) && !motivoProtecao(item,tipo))) {
      vendaVaziaEm = Date.now(); log('Venda: nada vendavel na mochila atual; etapa concluida');
      await fecharVenda(w);
      return true;
    }
    if (bolso) { if (!await abrirVendaDeBolso(w)) { log('Venda: Loja de Bolso nao abriu a venda'); return false; } }
    else if (!await falarComNpc(w, 'vendedor', () => dialogoMercadorAberto(w))) { log('Venda: pulando'); return false; }
    await esperar(350);
    const opcao = vendaAberta(w) ? null : await esperarAte(() => botaoPorTexto(w.document, (t) => /^Vender\b/.test(t) && !/^Vender tudo/i.test(t)), 3000);
    if (!opcao && !vendaAberta(w)) { diagTela('vender'); log('Venda: botao "Vender" nao apareceu'); await fecharVenda(w); return false; }
    opcao?.click();
    if (!await esperarAte(() => vendaAberta(w), 6000)) { diagTela('janela-venda'); log('Venda: a janela Vender nao abriu'); await fecharVenda(w); return false; }
    if (!await lerMochila(w)) { log('Venda: mochila nao atualizou com a loja aberta; cancelada'); await fecharVenda(w); return false; }
    await esperar(600);
    
    const tudo = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Vender tudo$/i.test(t)), 5000);
    if (!tudo) {
      const vazio = [...w.document.querySelectorAll('button')].some(b =>
        visivel(b) && b.disabled && /^Vender tudo$/i.test(textoDe(b)));
      if (vazio) {
        await esperar(1500); // Espera carregar a lista antes de assumir que está vazia
        if (linhasDeVenda(w).length === 0) { log('Venda: loja sem itens negociaveis; etapa concluida'); await fecharVenda(w); return true; }
      }
      if (!tudo) { log('Venda: "Vender tudo" nao encontrado'); await fecharVenda(w); return false; }
    }
    
    tudo.click();
    await esperarAte(() => linhasDeVenda(w).some(l => Number(l.campo.value) > 0), 3000);
    botaoPorTexto(w.document, (t) => /^Tudo no m[aá]ximo$/i.test(t))?.click();
    await esperar(400);

    log(`Venda: (Aviso: Protecao Equipamentos = ${cfg.venda.proteger.equip ? 'SIM' : 'NAO'}, Raridade Min = ${cfg.venda.raridadeMin})`);
    
    const tirados = [];
    for (const l of linhasDeVenda(w)) {
      if (!(Number(l.campo.value) > 0)) continue;
      const motivo = l.nome ? protecaoDaLinha(l.nome) : 'linha sem nome';
      if (!motivo) continue;
      await zerarLinha(w, l);
      tirados.push(`${l.nome || '?'} (${motivo})`);
    }
    await esperar(500);
    const vendendo = [];
    for (const l of linhasDeVenda(w)) {
      if (!(Number(l.campo.value) > 0)) continue;
      if (l.nome && protecaoDaLinha(l.nome)) {
        log(`Venda: CANCELADA — "${l.nome || '?'}" protegido continuou marcado`);
        botaoPorTexto(w.document, (t) => /^Limpar sele[cç][aã]o$/i.test(t))?.click();
        await fecharVenda(w);
        return false;
      }
      vendendo.push(`${l.nome || 'Item'} x${l.campo.value}`);
    }
    if (tirados.length) log(`Venda: protegidos ${tirados.slice(0, 12).join(', ')}${tirados.length > 12 ? ` e mais ${tirados.length - 12}` : ''}`);
    if (!vendendo.length) { vendaVaziaEm = Date.now(); log('Venda: nada vendavel; etapa concluida'); await fecharVenda(w); return true; }
    if (simular) {
      log(`Venda (TESTE, nao confirmei): ${vendendo.join(', ')}`);
      botaoPorTexto(w.document, (t) => /^Limpar sele[cç][aã]o$/i.test(t))?.click();
      await esperar(400);
      await fecharVenda(w);
      return false;
    }
    const confirmar = botaoPorTexto(w.document, (t) => /^Confirmar venda$/i.test(t));
    if (!confirmar) { log('Venda: "Confirmar venda" desabilitado'); await fecharVenda(w); return false; }
    const quantidades = nome => itensMochila().filter(({item}) => {
      const b=nomeBase(item.name), alvo=nomeBase(nome);return b===alvo || b.startsWith(alvo+' ');
    }).reduce((total,{item})=>total+Number(item.count||0),0);
    const esperado = new Map();
    for (const l of linhasDeVenda(w)) if (Number(l.campo.value)>0 && l.nome) {
      const chave=nomeBase(l.nome);
      const anterior=esperado.get(chave);
      esperado.set(chave,{nome:l.nome,antes:anterior?.antes ?? quantidades(l.nome),qtd:(anterior?.qtd||0)+Number(l.campo.value)});
    }
    const seq=estadoLoja.mochilaSeq;
    confirmar.click();
    await esperar(1500);
    botaoPorTexto(w.document, (t) => /^(OK|Sim|Confirmar)$/i.test(t))?.click();
    const confirmou = await esperarAte(() => {
      try { w.__elragEngine.requestInventorySnapshot(); } catch {}
      return estadoLoja.mochilaSeq > seq && [...esperado.values()].every(v => v.antes >= v.qtd && quantidades(v.nome) <= v.antes-v.qtd);
    },8000,400);
    if (!confirmou) { log('Venda: quantidades ainda nao confirmadas; vou reler antes da proxima tentativa'); await fecharVenda(w); return false; }
    log(`Venda: vendi ${vendendo.join(', ')}`);
    await fecharVenda(w);
    return true;
  };

  const venderItens = async (w, simular = false, bolso = false) => {
    if (simular) return venderUmaTentativa(w, true, bolso);
    for (let tentativa=1;tentativa<=3;tentativa++) {
      if (!cfg.ligado) { log('Venda interrompida: Auto-voltar desligado antes da próxima tentativa'); return false; }
      etapa('5/8 Vendendo', 'Tentativa '+tentativa+'/3; conferindo mochila e resposta do vendedor');
      if (await venderUmaTentativa(w, false, bolso)) return true;
      if (tentativa<3 && cfg.ligado) {
        log('Venda: aguardando antes de tentar novamente ('+tentativa+'/3)');
        await fecharVenda(w); await esperar(900);
      }
    }
    log('Venda: nao concluiu depois de 3 tentativas');return false;
  };

  const fecharVenda = async (w) => {
    for (let i = 0; i < 3; i++) {
      if (!vendaAberta(w) && !dialogoMercadorAberto(w)) return;
      const x = [...w.document.querySelectorAll('button[data-hud-action="close-panel"], button[aria-label="Fechar"]')].find(visivel);
      if (x) x.click();
      else { try { w.__elragEngine.closeNpcStore(); w.__elragEngine.cancelNpcDialog?.(); } catch {} }
      await esperar(250);
    }
  };

  const VENDA_INTERVALO_MS = 2 * 60 * 1000;
  let ultimaViagemVenda = 0;
  let pesoLidoEm = 0;
  let conferindoLimite = false;

  const retomadaPlanejada = new WeakMap();
  const PESO_TEIMOSO_MS = 30 * 60 * 1000;
  let pesoTeimosoAte = 0, pesoTeimosoPct = 0;
  // v2.95: vendedor disse "nada vendavel" ha menos de 1 min -> o que sobrou nao se vende; evita refazer Kafra/venda para sempre
  let vendaVaziaEm = 0;
  const semVendaveis = () => !itensVendaveis() || Date.now() - vendaVaziaEm < 60 * 1000;
  const vendaForcada = new WeakSet();
  const fezReducao = new WeakSet();
  const limiteSeguro = () => Math.min(70, Math.max(10, Number(cfg.venda.limite) || 70));
  const itensVendaveis = () => itensMochila().some(({ item, tipo }) =>
    Number(item.count) > 0 && !ehEquipado(item) && !motivoProtecao(item, tipo));

  let recuperacao = null;
  const segurarRetorno = (w, motivo) => {
    etapa('Recuperando', motivo);
    const agora = Date.now();
    recuperacao = recuperacao
      ? { ...recuperacao, motivo, ultimaEm: agora }
      : { motivo, desde: agora, ultimaEm: agora, tentativas: 0, retomarAutopilot: retomadaPlanejada.get(w) !== false };
    delete cfg.retornoPendente;
    salvarCfg();
    vigia = null;
    log('PROBLEMA: ' + motivo + '. Nao desliguei: confiro de novo em 1 min e retomo sozinho.');
    return false;
  };

  if (cfg.ligado === false && cfg.retornoPendente) {
    const agora = Date.now();
    recuperacao = { motivo: 'bloqueio da versao anterior', desde: agora, ultimaEm: agora - 50000, tentativas: 0,
      retomarAutopilot: cfg.retornoPendente.retomarAutopilot !== false };
    cfg.ligado = true;
    delete cfg.retornoPendente;
    salvarCfg();
    setTimeout(() => log('Religado: a versao anterior tinha se desligado sozinha; recuperando'), 0);
  }
  const pesoSeguroParaVoltar = async (w) => {
    if (cfg.conteudo?.modo === 'bio4' || cfg.conteudo?.modo === 'lhz') return true;
    if (cfg.rotinaLimites === false) return true;
    await lerMochila(w);
    await esperar(500);
    const peso = lerPeso(w);
    if (!peso) return segurarRetorno(w, 'nao consegui conferir o peso');
    if (peso.pct >= limiteSeguro()) {
      if (peso.pct < 90 && semVendaveis() && (fezReducao.has(w) || normalizar(posicao(w)?.mapa) === 'prontera')) {
        pesoTeimosoAte = Date.now() + PESO_TEIMOSO_MS;
        log('Peso ' + peso.pct.toFixed(1) + '% depois de guardar e vender: o resto e de itens protegidos. Voltando mesmo assim; nova viagem por peso so em 30 min ou se passar de ' + (Math.ceil(peso.pct) + 5) + '%');
        pesoTeimosoPct = peso.pct;
        return true;
      }
      if (normalizar(posicao(w)?.mapa) === 'prontera') {
        vigia = { cidade: posicao(w).mapa, ultimaEm: Date.now(), refazerCidade: true, retomarAutopilot: Boolean(retomadaPlanejada.get(w)) };
        etapa('Vigia', 'Peso ' + peso.pct.toFixed(1) + '%: refaco Kafra e venda a cada 2 min');
        log('Peso ' + peso.pct.toFixed(1) + '% (90%+ o jogo impede atacar). Nao desliguei: refaco Kafra e venda a cada 2 min. Confira o que sobrou na mochila (protegidos/favoritos/cadeado)');
        return false;
      }
      return segurarRetorno(w, 'peso ' + peso.pct.toFixed(1) + '%; precisa ficar abaixo de ' + limiteSeguro() + '%');
    }
    pesoTeimosoAte = 0;
    const aindaCheia = mochilaCheia(w);
    if (aindaCheia && normalizar(posicao(w)?.mapa) === 'prontera') {
      vigia = { cidade: posicao(w).mapa, ultimaEm: Date.now(), refazerCidade: true, retomarAutopilot: Boolean(retomadaPlanejada.get(w)) };
      etapa('Vigia', 'Mochila ' + aindaCheia.usados + '/' + aindaCheia.max + ' (limite ' + Math.ceil(aindaCheia.max * 0.95) + '): refaco Ferreiro, Kafra e venda na cidade');
      log('Mochila ainda acima de 95% apos processar: nao pagarei outra entrada sem liberar espacos');
      return false;
    }
    if (aindaCheia) {
      espacoTeimosoAte = Date.now() + PESO_TEIMOSO_MS;
      log('Mochila ainda acima de 95% depois do deposito no mapa; nova tentativa por espaco so em 30 min');
    } else espacoTeimosoAte = 0;
    return true;
  };

  const OCUPACAO_MAXIMA_MOCHILA = 0.95;
  const RE_ESPACOS = /(\d+)\s*\/\s*(\d+)\s*·\s*(?:(\d+)\s*espa|Mochila cheia)/i;
  const CHAVE_CAPACIDADE = 'fzn-autovoltar-capacidade-mochila';
  const capacidadeValida = (valor) => Number.isInteger(Number(valor)) && Number(valor) >= 50 && Number(valor) <= 400;
  // A mochila comum tem 100 vagas; a caixa de expansao aumenta para 200.
  // A capacidade aprendida fica tambem no backup da conta para sobreviver
  // a limpeza do cache do jogo.
  let capacidadeMochila = capacidadeValida(cfg.capacidadeMochila) ? Number(cfg.capacidadeMochila)
    : capacidadeValida(lerJson(CHAVE_CAPACIDADE, null)) ? Number(lerJson(CHAVE_CAPACIDADE, null)) : 100;
  let snapshotEspacosEm = 0, espacoTeimosoAte = 0;
  const definirCapacidadeMochila = (valor, fonte) => {
    const lida = Number(valor);
    if (!capacidadeValida(lida)) return false;
    if (lida === capacidadeMochila && Number(cfg.capacidadeMochila) === lida) return true;
    capacidadeMochila = lida;
    cfg.capacidadeMochila = lida;
    gravarJson(CHAVE_CAPACIDADE, lida);
    salvarCfg();
    log('Mochila: capacidade ' + lida + ' confirmada por ' + fonte);
    return true;
  };
  const capacidadeNoSnapshot = () => {
    const snap = estadoLoja.mochila;
    for (const raiz of [snap, snap?.meta, snap?.metadata, snap?.inventory, snap?.bag]) {
      if (!raiz || typeof raiz !== 'object' || Array.isArray(raiz)) continue;
      for (const [chave, valor] of Object.entries(raiz)) {
        if (/^(?:inventoryCapacity|inventoryMax|inventorySlots|bagCapacity|bagSlots|backpackCapacity|backpackSlots|maxSlots|slotLimit|capacity)$/i.test(chave) && capacidadeValida(valor)) return Number(valor);
      }
    }
    return null;
  };

  const pilhasReais = () => {
    if (!estadoLoja.mochila) return null;
    // Mesma regra de countUsedInventorySlots da HUD: união por índice da
    // mochila e equipamento.all. Equipados ocupam vagas e não podem ser omitidos.
    const indices = new Set();
    const adicionar = item => {
      if (item && Number(item.itemId) > 0) indices.add(Number.isInteger(item.index) ? 'i:' + item.index : item);
    };
    for (const itens of Object.values(estadoLoja.mochila)) if (Array.isArray(itens)) itens.forEach(adicionar);
    if (Array.isArray(estadoLoja.equipamento?.all)) estadoLoja.equipamento.all.forEach(adicionar);
    return indices.size;
  };

  const lerEspacos = (w) => {
    const atual = Date.now();
    instalarGanchos(w);
    // A capacidade vem do motor (pacote do servidor), sem abrir a mochila.
    try {
      const capacidade = w.__elragEngine.getInventoryCapacity?.();
      if (capacidadeValida(capacidade)) definirCapacidadeMochila(capacidade, 'motor do jogo');
    } catch {}
    if (capacidadeValida(cfg.capacidadeMochila) && Number(cfg.capacidadeMochila) !== capacidadeMochila)
      capacidadeMochila = Number(cfg.capacidadeMochila);
    const pilhas = atual - estadoLoja.mochilaEm < 15_000 ? pilhasReais() : null;
    const capacidadeSnap = capacidadeNoSnapshot();
    if (capacidadeSnap && capacidadeSnap !== capacidadeMochila) definirCapacidadeMochila(capacidadeSnap, 'snapshot');
    try {
      for (const el of w.document.querySelectorAll('div, span')) {
        if (!visivel(el) || el.closest?.('[data-fzn-auto-voltar]')) continue;
        const t = el.textContent || '';
        if (t.length > 60) continue;
        const m = RE_ESPACOS.exec(t);
        if (m) {
          const usados = Number(m[1]), lida = Number(m[2]), livres = m[3] ? Number(m[3]) : 0;
          if (lida < 50 || lida > 400 || usados > lida || (m[3] && usados + livres !== lida)) continue;
          if (usados >= Math.ceil(lida * OCUPACAO_MAXIMA_MOCHILA) && pilhas !== null &&
              Math.abs(usados - pilhas) > Math.max(20, Math.ceil(lida * 0.1))) {
            log('Mochila: contador visual ' + usados + '/' + lida + ' sem confirmacao no snapshot (' + (pilhas ?? '?') + ' pilhas); aguardando');
            continue;
          }
          if (lida !== capacidadeMochila) definirCapacidadeMochila(lida, 'contador do jogo');
          return { usados, max: capacidadeMochila, livres, fonte: 'jogo' }; }
      }
    } catch {}
    if (Date.now() - snapshotEspacosEm > 10_000) {
      snapshotEspacosEm = Date.now();
      try { instalarGanchos(w); w.__elragEngine.requestInventorySnapshot(); } catch {}
      try { w.__elragEngine.requestEquipmentSnapshot?.(); } catch {}
    }
    if (!estadoLoja.mochila || Date.now() - estadoLoja.mochilaEm > 20_000) return null;
    // Cada callback traz a lista COMPLETA, publicada atomicamente pelo motor.
    // Drops/ícones podem atualizá-la continuamente: não esperar silêncio para
    // contar slots, pois isso impedia disparar a rotina com a mochila fechada.
    // O contador de vagas do jogo inclui equipamentos na mochila, mesmo quando equipados.
    const usados = pilhasReais();
    if (usados > capacidadeMochila) {
      definirCapacidadeMochila(Math.ceil(usados / 100) * 100, 'itens na mochila');
    }
    return { usados, max: capacidadeMochila, livres: Math.max(0, capacidadeMochila - usados), fonte: 'snapshot' };
  };

  const mochilaCheia = (w) => {
    const e = lerEspacos(w);
    return e && e.max > 0 && e.usados >= Math.ceil(e.max * OCUPACAO_MAXIMA_MOCHILA) ? e : null;
  };
  let espacoCriticoVisto = null;
  const mochilaCheiaConfirmada = (w) => {
    const e = mochilaCheia(w);
    if (!e) { espacoCriticoVisto = null; return null; }
    // Novos drops acima do limite nao devem reiniciar a confirmacao.
    const chave = String(e.max);
    if (espacoCriticoVisto?.chave !== chave) { espacoCriticoVisto = { chave, desde: Date.now() }; return null; }
    return Date.now() - espacoCriticoVisto.desde >= 1000 ? e : null;
  };
  const irAoFerreiroPorEspaco = (w) => Boolean(cfg.ferreiro && mochilaCheia(w));
  // Usado depois da confirmacao inicial e da releitura da mochila. Slots
  // criticos independem de haver um contador de peso visivel no painel.
  const limiteAtualConfirmado = (w) => {
    const peso = lerPeso(w), espacos = mochilaCheia(w);
    return { peso, espacos, atingido: Boolean(espacos || peso && peso.pct >= limiteSeguro()) };
  };

  const precisaVender = (w) => {
    if (cfg.conteudo?.modo === 'bio4' || cfg.conteudo?.modo === 'lhz') return false;
    if (cfg.rotinaLimites === false) return false;
    if ((cfg.armazem.ligado || cfg.ferreiro || cfg.venda.ligado) && Date.now() >= espacoTeimosoAte) {
      const cheia = mochilaCheiaConfirmada(w);
      if (cheia) {
        if (Date.now() - (precisaVender.logEm || 0) > 300_000) {
          precisaVender.logEm = Date.now();
          log('Mochila em ' + cheia.usados + '/' + cheia.max + ' espacos (95% = ' + Math.ceil(cheia.max * OCUPACAO_MAXIMA_MOCHILA) + ', ' + cheia.fonte + '); iniciando Ferreiro, armazem e venda conforme configuracao');
        }
        return true; 
      }
    }
    if (!cfg.venda.ligado && !guardarTudo()) return false;
    const p = lerPeso(w);
    if (!p || p.pct < limiteSeguro()) return false;
    if (Date.now() < pesoTeimosoAte && p.pct < pesoTeimosoPct + 5 && semVendaveis()) return false;
    return true;
  };

  const estadoAutopilot = (w) => {
    try {
      const estado = w.__elragEngine.getAutopilotSnapshot()?.runtimeState;
      return estado != null && estado !== '' && Number.isFinite(Number(estado)) ? Number(estado) : null;
    } catch { return null; }
  };
  const autopilotLigado = (w) => {
    const estado = estadoAutopilot(w);
    return estado !== null && estado !== 0 && estado !== 1;
  };
  const motivoAutopilotParado = (w) => {
    const estado = estadoAutopilot(w);
    return estado === null ? 'estado do Autopilot indisponível no motor do jogo' :
      'Autopilot não confirmou ativação (estado ' + estado + ')';
  };
  const ligarAutopilot = (w, ligar) => { try { w.__elragEngine.setAutopilotRunning(ligar); return true; } catch { return false; } };

  const huntsPausados = new WeakSet();
  const botaoHunt = (w, ligado) => {
    const esperado = ligado ? /^Hunt: ON$/i : /^Hunt: OFF$/i;
    const achar = (doc) => [...doc.querySelectorAll('button')].find((b) => !b.disabled && esperado.test(textoDe(b)));
    return achar(document) || achar(w.document);
  };
  const pausarCacada = async (w) => {
    const hunt = botaoHunt(w, true);
    if (hunt) {
      hunt.click();
      if (!await esperarAte(() => botaoHunt(w, false), 3000)) return false;
      huntsPausados.add(w);
    }
    return ligarAutopilot(w, false);
  };
  const retomadasEmCurso = new WeakSet();
  const retomarCacada = async (w) => {
    if (retomadasEmCurso.has(w)) return false;
    retomadasEmCurso.add(w);
    try {
      if (!await fecharArmazem(w)) return segurarRetorno(w, 'armazem aberto; cacada bloqueada');
      if (!validarChegadaFarm(w)) return false;
      const mapa = posicao(w)?.mapa;
      etapa('Retomando caça', 'Mapa ' + mapa + ' confirmado; verificando Hunt e Autopilot');
      let motivo = '', proximoComando = 0, confirmandoDesde = null;
      const confirmou = await esperarAte(() => {
        if (!cfg.ligado || cancelando()) { motivo = 'Auto-voltar desligado ou rotina cancelada'; return 'interrompido'; }
        if (posicao(w)?.mapa !== mapa || morteConfirmada(w)) {
          motivo = 'personagem mudou de mapa, está carregando ou morreu';
          return 'interrompido';
        }
        if (dispensarAvisoDiario(w) || fecharLojaCash(w) || armazemAberto(w)) {
          motivo = 'janela do jogo ainda aberta (aviso diário, loja Cash ou armazém)';
          confirmandoDesde = null;
          return false;
        }
        const agora = Date.now();
        if (huntsPausados.has(w) && !botaoHunt(w, true)) {
          const hunt = botaoHunt(w, false);
          motivo = hunt ? 'Hunt continuou OFF após o clique' : 'controle do Hunt indisponível após a pausa';
          if (hunt && agora >= proximoComando) {
            proximoComando = agora + 1500;
            hunt.click();
          }
          confirmandoDesde = null;
          return false;
        }
        if (autopilotLigado(w)) {
          confirmandoDesde ??= agora;
          return agora - confirmandoDesde >= 1000 ? 'confirmado' : false;
        }
        confirmandoDesde = null;
        motivo = motivoAutopilotParado(w);
        if (agora >= proximoComando) {
          proximoComando = agora + 1500;
          if (!ligarAutopilot(w, true)) motivo = 'motor do jogo não aceitou o comando de ligar o Autopilot';
        }
        return false;
      }, 10000, 250);
      if (confirmou !== 'confirmado') {
        etapa('Caça não retomada', 'Mapa ' + mapa + ' confirmado; ' + (motivo || 'Autopilot não permaneceu ligado pelo tempo de confirmação'));
        return false;
      }
      huntsPausados.delete(w);
      etapa('Concluído', 'Caça religada no mapa ' + mapa + '; Autopilot confirmado');
      return true;
    } finally {
      retomadasEmCurso.delete(w);
    }
  };

  const TITULO_FERREIRO = /Ferreiro\s*[—-]\s*Desmantelar/;
  const ferreiroAberto = (w) => TITULO_FERREIRO.test(textoTela(w));
  const dialogoFerreiro = (w) => /\[Ferreiro\]/.test(textoTela(w));
  const janelaFerreiro = (w) => {
    let menor = null;
    for (const el of w.document.querySelectorAll('div, section')) {
      const t = el.innerText || '';
      if (!TITULO_FERREIRO.test(t) || !/Selecionar vis/i.test(t) || !el.querySelector('input[type="checkbox"]')) continue;
      if (!menor || menor.contains(el)) menor = el;
    }
    return menor && visivel(menor) ? menor : null;
  };
  const linhasFerreiro = (raiz) => [...raiz.querySelectorAll('input[type="checkbox"]')].map((c) => {
    let linha = c.parentElement;
    for (let i = 0; i < 6 && linha && !/pe[cç]as?\b/i.test(linha.innerText || ''); i++) linha = linha.parentElement;
    if (!linha || /Apenas desmantel|Selecionar vis|Resumo do/i.test(linha.innerText || '')) return null;
    const partes = (linha.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const nome = partes.find((x) => !/^\d+\s*linhas?$/i.test(x) && !/pe[cç]as?$/i.test(x) && !/^(comum|incomum|raro|[eé]pico|lend[aá]rio|m[ií]tico|[IVX]+)$/i.test(x));
    return { caixa: c, nome: nome || '' };
  }).filter(Boolean);
  const fecharFerreiro = async (w) => {
    for (let i = 0; i < 4 && (ferreiroAberto(w) || dialogoFerreiro(w)); i++) {
      if (/Confirmar desmantelamento/.test(textoTela(w))) { botaoPorTexto(w.document, (t) => /^Voltar$/i.test(t))?.click(); await esperar(300); continue; }
      const x = [...w.document.querySelectorAll('button[data-hud-action="close-panel"], button[aria-label="Fechar"], button[aria-label="Close"]')].find(visivel);
      if (x) x.click();
      else { const c = botaoPorTexto(w.document, (t) => /^Cancelar$/i.test(t)); if (c) c.click(); else apertarEsc(w); }
      try { w.__elragEngine.cancelNpcDialog?.(); } catch {}
      await esperar(300);
    }
  };
  const desmantelarNoFerreiro = async (w) => {
    if (!await lerMochila(w) || !itensMochila().length) { log('Ferreiro: mochila nao leu; pulando'); return false; }
    const equipados = await lerEquipados(w);
    if (!equipados) { log('Ferreiro: equipados nao leram; pulando (nao arrisco desmontar equipado)'); return false; }
    const livres = new Map();
    for (const { item, tipo } of itensMochila()) {
      const b = nomeBase(item.name); if (!b) continue;
      const pode = !nuncaGuardar(item, equipados) && !motivoProtecao(item, tipo);
      livres.set(b, (livres.get(b) || 0) + (pode ? Math.max(1, Number(item.count) || 1) : 0));
    }
    if (![...livres.values()].some((n) => n > 0)) { log('Ferreiro: nada desmontavel na mochila'); return true; }
    if (!await falarComNpc(w, 'ferreiro', () => dialogoFerreiro(w) || ferreiroAberto(w))) { log('Ferreiro: desmantelamento pulado porque o diálogo não abriu'); return false; }
    if (!ferreiroAberto(w)) {
      const op = await esperarAte(() => botaoQualquer(w, /^Desmantelar item/i), 3000);
      if (!op) { log('Ferreiro: opcao "Desmantelar item" nao apareceu'); return false; }
      op.click();
    }
    let raiz = await esperarAte(() => janelaFerreiro(w), 6000, 200);
    if (!raiz) { log('Ferreiro: janela Desmantelar nao abriu'); return false; }
    const abaMochila = [...raiz.querySelectorAll('button')].find((b) => /^Mochila$/i.test(textoDe(b)));
    if (!abaMochila) { log('Ferreiro: aba Mochila nao encontrada; cancelado'); return false; }
    abaMochila.click(); await esperar(600);
    raiz = janelaFerreiro(w) || raiz;
    const apenas = [...raiz.querySelectorAll('input[type="checkbox"]')].find((c) => /Apenas desmantel/i.test(c.closest('label')?.innerText || c.parentElement?.innerText || ''));
    if (apenas && !apenas.checked) { apenas.click(); await esperar(400); }
    const limpar = () => [...raiz.querySelectorAll('button')].find((b) => /^Limpar sele/i.test(textoDe(b)) && !b.disabled)?.click();
    limpar(); await esperar(300);
    const sel = [...raiz.querySelectorAll('button, a, span, div')].find((b) => !b.children.length && /^Selecionar vis[ií]veis$/i.test(textoDe(b)));
    if (!sel) { log('Ferreiro: "Selecionar visiveis" nao encontrado'); return false; }
    (sel.closest('button, a, [role="button"]') || sel).click(); await esperar(700);
    const porNome = new Map(), tirados = [];
    for (const l of linhasFerreiro(raiz)) {
      if (!l.caixa.checked) continue;
      const b = nomeBase(l.nome);
      porNome.set(b, (porNome.get(b) || []).concat(l));
    }
    for (const [b, ls] of porNome) {
      const max = livres.get(b) || 0;
      if (!b || ls.length > max) { for (const l of ls) { l.caixa.click(); await esperar(30); } tirados.push((ls[0].nome || '?') + ' x' + ls.length + ' (livres ' + max + ')'); }
    }
    await esperar(400);
    if (tirados.length) log('Ferreiro: desmarcados (protegidos) ' + tirados.slice(0, 10).join(', '));
    const marcadas = linhasFerreiro(raiz).filter((l) => l.caixa.checked);
    const texto = raiz.innerText || '';
    const m = texto.match(/(\d+)\s+itens?\s+selecionados?/i);
    const contador = m ? Number(m[1]) : (/Nenhum item selecionado/i.test(texto) ? 0 : -1);
    if (!marcadas.length) { log('Ferreiro: nada a desmontar'); limpar(); return true; }
    if (contador !== marcadas.length) { log('Ferreiro: contador do jogo ' + contador + ' diferente dos marcados ' + marcadas.length + '; cancelado'); limpar(); return false; }
    const n = marcadas.length;
    const reN = new RegExp('^Desmantelar ' + n + ' ite', 'i');
    const botao = [...raiz.querySelectorAll('button')].find((b) => visivel(b) && !b.disabled && reN.test(textoDe(b)));
    if (!botao) { log('Ferreiro: botao "Desmantelar ' + n + ' itens" nao apareceu'); limpar(); return false; }
    botao.click();
    const reModal = new RegExp('\\b' + n + '\\s+equipamentos?\\s+ser');
    const modal = await esperarAte(() => /Confirmar desmantelamento/.test(textoTela(w)) && reModal.test(textoTela(w)), 3000);
    if (!modal) { log('Ferreiro: confirmacao nao apareceu ou com outro numero; cancelado'); await fecharFerreiro(w); return false; }
    const ok = [...w.document.querySelectorAll('button')].filter((b) => visivel(b) && !b.disabled && reN.test(textoDe(b))).find((b) => b !== botao);
    if (!ok) { log('Ferreiro: botao de confirmar nao encontrado'); await fecharFerreiro(w); return false; }
    const nomes = marcadas.map((l) => l.nome);
    const resumo = [...new Set(nomes)].map((x) => x + ' x' + nomes.filter((y) => y === x).length).join(', ');
    ok.click();
    await esperar(1500);
    log('Ferreiro: desmontei ' + n + ' itens (' + resumo.slice(0, 200) + ')');
    await lerMochila(w);
    return true;
  };

  const vendaNaInstancia = async (w, antes) => {
    if (cfg.ferreiro) { log('Ferreiro ON: venda no mapa adiada ate desmantelar em Prontera'); return false; }
    if (ocupado) return false;
    ocupado = true;
    ultimaViagemVenda = Date.now();
    const tinhaAutopilot = autopilotLigado(w) || !!botaoHunt(w, true);
    try {
      etapa('Venda na instancia', 'Loja de Bolso (nunca sai de ' + (antes?.mapa || '?') + ')');
      if (!lojaDeBolso()) await lerMochila(w);
      if (!lojaDeBolso()) { log('Venda: em ' + (antes?.mapa || '?') + ' sem Loja de Bolso; NAO saio daqui, sigo cacando'); ultimaViagemVenda = Date.now() + 13 * 60000; return false; }
      await sairDaEconomia(w);
      if (tinhaAutopilot) await pausarCacada(w);
      if (cfg.armazem.ligado && cfg.armazem.usarCartao && itensMochila().some(({ item }) => cartaoKafra(item) && item.canUse && Number(item.count) > 0)) {
        etapa('Venda na instancia', 'Cartao Kafra: guardando protegidos');
        const dep = await guardarProtegidos(w, false);
        if (!dep.ok) log('Venda na instancia: deposito pelo cartao falhou (' + dep.motivo + '); sigo para a venda');
        await fecharArmazem(w);
      }
      const ok = !guardarTudo() && cfg.venda.ligado ? await venderItens(w, false, true) : false;
      await lerMochila(w);
      const p = lerPeso(w);
      log('Venda na instancia: ' + (ok ? 'concluida' : 'nao concluida') + ' pela Loja de Bolso; peso ' + (p ? p.pct.toFixed(1) + '%' : '?'));
      if (!ok || (p && p.pct >= limiteSeguro()) || mochilaCheia(w)) {
        ultimaViagemVenda = Date.now() - VENDA_INTERVALO_MS + 30000;
        log('Venda na instancia: peso/espaco ainda alto ou venda incompleta; nova verificacao em 30 s');
      }
      return ok;
    } catch (e) {
      log('Venda na instancia: falha — ' + String(e?.message || e).slice(0, 100));
      return false;
    } finally {
      try { await fecharArmazem(w); if (vendaAberta(w)) await fecharVenda(w); if (lojaAberta(w)) await fecharLoja(w); } catch {}
      if (tinhaAutopilot) {
        if (huntsPausados.has(w)) { botaoHunt(w, false)?.click(); huntsPausados.delete(w); }
        const voltou = await esperarAte(() => { if (autopilotLigado(w)) return true; ligarAutopilot(w, true); return false; }, 6000, 300);
        log(voltou ? 'Venda na instancia: cacada religada' : 'Venda na instância: ' + motivoAutopilotParado(w));
      }
      etapa('Aguardando', 'Monitorando peso e morte');
      ocupado = false;
    }
  };

  let viagemPorSuprimento = '', suprimentoLidoEm = 0, suprimentoBaixoVezes = 0;
  // v2.96: trava de projeteis. Sem flecha/bala o personagem para de atacar
  // para sempre (Sniper, Gunslinger...). Abaixo de MUNICAO_MIN volta a cidade
  // na hora para comprar, sem as 2 leituras e os 2 min do minimo comum.
  const MUNICAO_MIN = 100, MUNICAO_ALVO_MIN = 300, MUNICAO_REPETE_MS = 3 * 60 * 1000;
  const ehMunicao = (nome) => /\b(?:flechas?|arrows?|balas?|bullets?|projeteis|projetil|cartuchos?|municao|esferas?|kunais?|shurikens?)\b/.test(normalizar(nome));
  let municaoViagemEm = 0, municaoAvisoEm = 0;
  const travaDeMunicao = (w) => {
    if (ocupado || Date.now() - municaoViagemEm < MUNICAO_REPETE_MS) return false;
    const pos = posicao(w);
    if (!pos?.mapa || normalizar(pos.mapa) === 'prontera' || mapaDeRenascer(pos) || !itensMochila().length) return false;
    // v3.04: a trava NAO respeita a espera de 30 min da compra recusada: sem
    // projetil o personagem nao ataca; tenta de novo a cada MUNICAO_REPETE_MS.
    const lista = (cfg.compras || []).filter((c) => c && c.nome && ehMunicao(c.nome));
    if (!lista.length) {
      const naMochila = itensMochila().find(({ item }) => ehMunicao(item?.name) && Number(item.count) < MUNICAO_MIN);
      if (naMochila && Date.now() - municaoAvisoEm > 10 * 60 * 1000) {
        municaoAvisoEm = Date.now();
        log('Projeteis: ' + naMochila.item.name + ' ' + naMochila.item.count + ' (menos de ' + MUNICAO_MIN + '). Coloque o nome dele na lista de Compras para eu repor sozinho');
      }
      return false;
    }
    for (const c of lista) {
      if (!(Number(c.alvo) >= MUNICAO_ALVO_MIN)) { c.alvo = MUNICAO_ALVO_MIN; salvarCfg(); log('Projeteis: compra de ' + c.nome + ' ajustada para ' + MUNICAO_ALVO_MIN + ' (a trava pede no minimo ' + MUNICAO_MIN + ')'); }
    }
    const baixa = lista.map((c) => ({ ...c, tem: quantosNaMochila(c.nome) + naBolsa(w, c.nome) })).filter((c) => c.tem < MUNICAO_MIN);
    if (!baixa.length) return false;
    municaoViagemEm = Date.now();
    if (cfg.lojaBolso && lojaDeBolso()) {
      log('Projeteis abaixo de ' + MUNICAO_MIN + ': comprando pela Loja de Bolso sem sair do mapa');
      compraBolsoEm = 0;
      void compraNaHunt(w);
      return true;
    }
    viagemPorSuprimento = baixa.map((c) => c.nome + ' ' + c.tem + '/' + MUNICAO_MIN).join(', ');
    log('Projeteis abaixo de ' + MUNICAO_MIN + ' (' + viagemPorSuprimento + '): voltando a cidade AGORA para comprar');
    void viagemDeVenda(w, true);
    return true;
  };
  const viagemDeVenda = async (w, manual = false, retomarForcado = false) => {
    if (ocupado) return false;
    if (cfg.conteudo?.modo === 'bio4' || cfg.conteudo?.modo === 'lhz') {
      if (!manual) return false;
      ocupado = true;
      try { return await rotinaDaCidade(w, true); }
      finally { ocupado = false; }
    }
    const atual = posicao(w);
    const ferreiroPorEspaco = irAoFerreiroPorEspaco(w);
    const processarNoMapa = guardarNoMapa() && !ferreiroPorEspaco;
    if (venderNoMapa() && lojaDeBolso() && !viagemPorSuprimento && atual?.mapa && normalizar(atual.mapa) !== 'prontera') {
      log('Cartao Kafra + Loja de Bolso: guardando protegidos e vendendo permitidos em ' + atual.mapa + ', sem ir a Prontera');
      return vendaNaInstancia(w, atual);
    }
    ocupado = true;
    etapa(processarNoMapa ? '1/4 Pausando cacada' : '1/8 Pausando cacada', viagemPorSuprimento ? 'Suprimentos abaixo do minimo' : manual ? 'Execucao manual, independente do peso' : ferreiroPorEspaco ? 'Mochila em 95%: indo ao Ferreiro de Prontera' : 'Limite de peso atingido');
    let pauseiAutopilot = false;
    let retornou = false;
    try {
      ultimaViagemVenda = Date.now();
      fezReducao.delete(w); vendaForcada.delete(w);
      if (ferreiroPorEspaco) log('Mochila acima de 95% e Ferreiro ativo: priorizando Prontera antes de vender ou guardar');
      const antes = posicao(w);
      if (mapaDeRenascer(antes)) { ocupado = false; return vendaNaInstancia(w, antes); }
      registrarDestinoFarm(w);
      retomadaPlanejada.set(w, retomarForcado || manual || Boolean(cfg.retornoPendente?.retomarAutopilot) || autopilotLigado(w) || !!botaoHunt(w, true));
      const p = lerPeso(w);
      if (!guardarTudo() && cfg.venda.ligado && (manual || ferreiroPorEspaco || (p && p.pct >= limiteSeguro()))) {
        vendaForcada.add(w);
        log('Venda programada nesta viagem; Ferreiro e deposito nao cancelam a venda dos itens permitidos');
      }
      if (normalizar(antes?.mapa) === 'prontera' && !processarNoMapa) {
        retornou = await rotinaDaCidade(w, retomadaPlanejada.get(w), true);
        return retornou;
      }
      if (viagemPorSuprimento) log('Suprimentos: ' + viagemPorSuprimento + ' abaixo do minimo; voltando a cidade para comprar');
    else log(ferreiroPorEspaco ? 'Mochila em 95%: voltando ao ponto de salvamento para usar o Ferreiro' : `Peso ${p ? Math.round(p.pct) : '?'}% (limite ${cfg.venda.limite}%): ${processarNoMapa ? 'deposito completo com cartao no mapa' : guardarTudo() ? 'voltando ao ponto de salvamento para guardar tudo' : 'voltando ao ponto de salvamento para vender'}`);
    viagemPorSuprimento = '';
      await sairDaEconomia(w);
      if (autopilotLigado(w) || botaoHunt(w, true)) {
        if (!await pausarCacada(w)) { segurarRetorno(w, 'nao consegui pausar a cacada'); return; }
        pauseiAutopilot = true;
        log('Venda: autopilot pausado durante a viagem');
      }
      if (processarNoMapa) {
        etapa('2/4 Cartao Kafra', 'Guardando tudo no maximo no mapa; flechas e Asa de Mosca ficam');
        if (!await lerMochila(w)) return segurarRetorno(w, 'mochila nao atualizou no modo Cartao Kafra');
        const temCartao = itensMochila().some(({item}) => cartaoKafra(item) && item.canUse && Number(item.count) > 0);
        if (!temCartao && !armazemAberto(w)) return segurarRetorno(w, 'modo Cartao Kafra ligado, mas nao ha cartao utilizavel; nao vou sair do farm');
        const deposito = await guardarProtegidos(w, false, true);
        if (!deposito.ok) {
          await fecharArmazem(w);
          return segurarRetorno(w, 'deposito completo no mapa falhou: ' + deposito.motivo);
        }
        if (posicao(w)?.mapa !== antes?.mapa) return segurarRetorno(w, 'mapa mudou durante o deposito');
        let vendaNoMapaConcluida = false;
        if (deposito.cheio && !cfg.ferreiro && cfg.lojaBolso && lojaDeBolso()) {
          etapa('3/4 Vendendo no mapa', 'Armazem cheio; vendendo somente itens permitidos pela Loja de Bolso');
          log('Armazem cheio: pulando deposito e usando Loja de Bolso sem sair do farm');
          vendaNoMapaConcluida = await venderItens(w, false, true);
          await fecharVenda(w);
          if (!vendaNoMapaConcluida) log('Loja de Bolso nao confirmou a venda; vou tentar o Mercador na cidade');
        }
        if (deposito.cheio && !vendaNoMapaConcluida && itensVendaveis()) {
          vendaForcada.add(w);
          log('Armazem cheio: venda pendente; indo a Prontera para vender os itens permitidos');
        } else {
          etapa('3/4 Conferindo peso', 'Armazem fechado; conferindo se pode continuar no farm');
          fezReducao.add(w);
          await lerMochila(w); await esperar(500);
          const depois = lerPeso(w);
          if (depois && depois.pct >= limiteSeguro() && itensVendaveis() &&
              ((!guardarTudo() && cfg.venda.ligado) || deposito.cheio)) {
            log('Cartao Kafra: peso ainda ' + depois.pct.toFixed(1) + '% com itens vendaveis; indo a cidade vender');
            vendaForcada.add(w);
          } else {
            if (!await pesoSeguroParaVoltar(w)) return false;
            if (!cfg.ligado) return false;
            delete cfg.retornoPendente; salvarCfg();
            const destino = cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
            if (!destino && !(cfg.retornoEvento && posicao(w)?.mapa === 'prontera')) return segurarRetorno(w, 'defina o codigo em Mapa de farm antes de retornar');
            if (posicao(w)?.mapa !== destino && !await voltarAoMapa(w)) return false;
            retornou = retomadaPlanejada.get(w) ? await retomarCacada(w) : true;
            if (retornou) {
              etapa('Concluido', 'Processo concluido; itens presos, flechas e Asa de Mosca preservados; cacada retomada no farm');
              log('Cartao Kafra: processo concluido ' + (vendaNoMapaConcluida ? 'com venda pela Loja de Bolso; ' : 'sem venda; ') + (antes?.mapa === destino ? 'no mesmo mapa, sem viagem ou taxa de entrada' : 'retorno ao farm confirmado: ' + destino));
            }
            return retornou;
          }
        }
      }
      if (cfg.armazem.ligado && !vendaForcada.has(w)) {
        etapa('2/8 Armazem no mapa', 'Conferindo protegidos e Cartao Kafra');
        if (!await lerMochila(w)) return segurarRetorno(w, 'nao consegui conferir mochila e cartao antes de sair do mapa');
        const temCartao = cfg.armazem.usarCartao && itensMochila().some(({item}) => cartaoKafra(item) && item.canUse && Number(item.count) > 0);
        const estavaAberto = armazemAberto(w);
        const deposito = await guardarProtegidos(w, false);
        if (!deposito.ok && (temCartao || estavaAberto)) {
          await fecharArmazem(w);
          return segurarRetorno(w, 'deposito no mapa falhou: ' + deposito.motivo + '. Nao sairei para Prontera com o cartao disponivel');
        }
        if (!deposito.ok) log('Sem Cartao Kafra utilizavel: seguirei para a Kafra de Prontera (' + deposito.motivo + ')');
        if (!cfg.ligado) { etapa('Rotina interrompida', 'Auto-voltar desligado após o depósito no mapa'); return; }
        if (armazemAberto(w)) { segurarRetorno(w, 'armazem nao fechou'); return; }
      }
      if (!await fecharArmazem(w)) { segurarRetorno(w, 'armazem nao fechou antes da viagem'); return; }
      etapa('3/8 Indo a Prontera', 'Saindo da instancia e aguardando o mapa carregar');
      
      const acharSair = () => {
        const t = w.document.querySelector('[data-tutorial="sair-da-instancia"]');
        if (t && visivel(t)) {
          if (t.getAttribute('aria-disabled') === 'true' || t.style.pointerEvents === 'none') {
             log('Venda: botao SAIR encontrado, mas desativado (aria-disabled)');
             return null;
          }
          return t;
        }
        const bTexto = [...w.document.querySelectorAll('button')].find((b) => visivel(b) && /sair/i.test(textoDe(b)) && !/Auto-voltar/i.test(textoDe(b)));
        if (bTexto) return bTexto;
        const bAria = [...w.document.querySelectorAll('button')].find((b) => visivel(b) && /sair/i.test(b.getAttribute('aria-label') || b.title || '') && !/Auto-voltar/i.test(b.getAttribute('aria-label') || b.title || ''));
        if (bAria) return bAria;
        const folha = [...w.document.querySelectorAll('div, span, button')].find((el) => visivel(el) && /^sair$/i.test(textoDe(el)) && !el.closest('[data-fzn-auto-voltar]') && ![...el.children].some((f) => /^sair$/i.test(textoDe(f))));
        if (!folha) return null;
        const proprio = folha.closest('button, [role="button"]');
        if (proprio) return proprio;
        for (let el = folha.parentElement, i = 0; el && i < 3; el = el.parentElement, i++) {
          const bs = [...el.querySelectorAll('button')].filter(visivel);
          if (bs.length === 1) return bs[0];
        }
        const r = folha.getBoundingClientRect();
        const perto = [...w.document.querySelectorAll('button.hud-focus')].filter(visivel)
          .map((b) => ({ b, d: Math.hypot(b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2 - (r.left + r.width / 2), b.getBoundingClientRect().bottom - r.top) }))
          .sort((a, b2) => a.d - b2.d)[0];
        return perto && perto.d < 60 ? perto.b : null;
      };
      
      let sair = await esperarAte(acharSair, 5000);
      if (!sair) {
        const pistas = [...w.document.querySelectorAll('*')]
          .filter((el) => !el.children.length && visivel(el) && /sair/i.test(`${textoDe(el)} ${el.getAttribute('aria-label') || ''} ${el.title || ''}`))
          .slice(0, 6).map((el) => `${el.tagName.toLowerCase()}[${textoDe(el).slice(0, 20)}|${el.getAttribute('aria-label') || ''}|${String(el.className).slice(0, 30)}]`);
        log(`Venda: botao SAIR (da instancia) nao encontrado ou ainda desativado. Com "sair" na tela: ${pistas.join(' ') || 'nada'}`);
        return;
      }
      
      const clicarHud = (el) => {
        const r = el.getBoundingClientRect();
        const base = { bubbles: true, cancelable: true, composed: true, view: w, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
        const alvo = w.document.elementFromPoint(base.clientX, base.clientY) || el;
        for (const tipo of ['pointerover', 'pointerenter', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          const Ev = tipo.startsWith('pointer') && w.PointerEvent ? w.PointerEvent : w.MouseEvent;
          try { alvo.dispatchEvent(new Ev(tipo, { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(tipo) ? 1 : 0 })); } catch {}
        }
        return alvo;
      };
      const descrever = (el) => `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''}[${textoDe(el).slice(0, 15)}]`;
      const docs = [w.document, document];
      const caixaAberta = () => docs.some((d) => /Sair da inst[aâ]ncia/i.test(d.body?.innerText || ''));
      
      const alvoSair = sair;
      const tentativas = [
        () => { alvoSair.click(); return alvoSair; },
        () => clicarHud(alvoSair),
        () => { const p = alvoSair.parentElement || alvoSair; p.click(); return p; }
      ];
      for (let i = 0; i < tentativas.length && !caixaAberta(); i++) {
        const alvo = tentativas[i]();
        log(`Venda: SAIR tentativa ${i + 1} (${descrever(alvo)})`);
        await esperarAte(caixaAberta, 4000);
      }
      if (!caixaAberta()) {
        let html = alvoSair;
        for (let i = 0; i < 2 && html.parentElement; i++) html = html.parentElement;
        log(`Venda: diagnostico SAIR. HTML: ${html.outerHTML.replace(/\s+/g, ' ').slice(0, 300)}`);
      }
      const acharConfirmar = () => {
        for (const d of docs) {
          if (!/Sair da inst[aâ]ncia/i.test(d.body?.innerText || '')) continue;
          const b = [...d.querySelectorAll('button')].find((x) => visivel(x) && !x.disabled && /^sair$/i.test(textoDe(x)) && !x.contains(alvoSair) && !alvoSair.contains(x));
          if (b) return b;
          const f = [...d.querySelectorAll('div, span, a')].filter((el) => !el.children.length && visivel(el) && /^sair$/i.test(textoDe(el)))
            .map((el) => el.closest('button, a, [role="button"], [onclick], [tabindex]') || el)
            .find((el) => !el.contains(alvoSair) && !alvoSair.contains(el));
          if (f) return f;
        }
        return null;
      };
      const confirmar = await esperarAte(acharConfirmar, 5000);
      if (!confirmar) {
        const botoes = docs.flatMap((d) => [...d.querySelectorAll('button')]).filter(visivel).map(textoDe).filter(Boolean).slice(0, 16).join(' | ');
        log(`Venda: a confirmacao "Sair da instancia?" nao apareceu. Botoes: ${botoes.slice(0, 260)}`);
        return;
      }
      log(`Venda: confirmacao na pagina ${confirmar.ownerDocument === document ? 'de cima' : 'do jogo'}`);
      confirmar.click();
      log(`Venda: confirmei a saida (${descrever(confirmar)})`);
      
      const chegou = await esperarAte(() => {
        const q = posicao(w);
        return q && antes && q.mapa && q.mapa !== antes.mapa;
      }, 90000, 1000);
      if (!chegou) { log('Venda: nao cheguei a cidade em 90 s'); return; }
      log(`Venda: cheguei em ${chaveCelula(posicao(w))}`);
      retornou = await rotinaDaCidade(w, pauseiAutopilot, true);
    } catch (e) {
      log(`erro na venda: ${String(e?.message || e).slice(0, 120)}`);
    } finally {
      if (!retornou && pauseiAutopilot && cfg.ligado) {
        segurarRetorno(w, 'viagem incompleta; nao vou religar o autopilot');
      }
      ocupado = false;
    }
  };

  const registrarDestinoFarm = (w) => {
    const p = posicao(w);
    if (!p?.mapa || normalizar(p.mapa) === 'prontera') return false;
    if (String(cfg.mapaFarmManual || p.mapa).includes('@')) return false;
    const mapa = cfg.mapaFarmManual || p.mapa;
    cfg.destinoFarm = { mapa, nome: mapa === p.mapa ? (p.nome || mapa) : mapa };
    salvarCfg();
    log('Destino de retorno salvo nesta conta: ' + cfg.destinoFarm.nome + ' [' + p.mapa + ']');
    return true;
  };
  
  const sincronizarMapaAtual = (w) => {
    const p = posicao(w);
    if (!p?.mapa || normalizar(p.mapa) === 'prontera' || ocupado || cfg.fimConteudoPendente) return false;
    // Saidas temporarias de Bio 4/Cheffenia nao mudam o destino da sessao paga.
    if (cfg.conteudo?.modo && cfg.conteudo.modo !== 'normal') return false;
    if (String(p.mapa).includes('@') || /^mid_vol/i.test(String(p.mapa))) return false;
    if (cfg.destinoPendente && p.mapa !== cfg.destinoPendente) return false;
    if (cfg.destinoPendente === p.mapa) { delete cfg.destinoPendente; salvarCfg(); }
    // Durante um retorno, um mapa intermediario nao e um novo destino de farm.
    if (recuperacao || vigia || chegadaAtrasada || cfg.retornoPendente) return false;
    if (/^(?:geffen|payon|morocc|alberta|izlude|aldebaran|yuno|lighthalzen|einbroch|einbech|hugel|rachel|veins|comodo|umbala|amatsu|gonryun|louyang|ayothaya|niflheim|jawaii|moscovia|brasilis|dewata|malangdo|malaya|mora|manuk|splendide|lasagna|eclage)$/.test(p.mapa)) return false;
    const bloqueado = andamento.etapa === 'Bloqueado' || Boolean(cfg.retornoPendente);
    if (cfg.mapaFarmManual !== p.mapa || cfg.destinoFarm?.mapa !== p.mapa || bloqueado) {
      const anterior = cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
      cfg.mapaFarmManual = p.mapa;
      registrarDestinoFarm(w);
      delete cfg.retornoPendente;
      vigia = null; chegadaAtrasada = null; ultimaViagemVenda = 0;
      salvarCfg();
      etapa('Aguardando', 'Mapa de farm atualizado automaticamente: ' + p.mapa + '; monitorando peso e morte');
      if (anterior !== p.mapa) log('Mapa de farm: ' + (anterior || 'nao definido') + ' → ' + p.mapa + ' (troca manual reconhecida)');
    }
    return true;
  };
  const retomarNoMapaAtual = async () => {
    if (ocupado) return;
    const w = jogo(), p = w && posicao(w);
    if (!p?.mapa || normalizar(p.mapa) === 'prontera') {
      log('Usar mapa atual: leve o personagem ao mapa de farm primeiro'); return;
    }
    const retomar = Boolean(cfg.retornoPendente?.retomarAutopilot);
    relerCalibracao();
    cfg.ligado = true;
    recuperacao = null; vigia = null; chegadaAtrasada = null;
    delete cfg.retornoPendente;
    delete cfg.destinoPendente;
    sincronizarMapaAtual(w);
    etapa('Aguardando', 'Retomado no mapa atual: ' + p.mapa);
    salvarCfg(); atualizarPainel();
    if (precisaVender(w)) { if (retomar && botaoHunt(w, false)) huntsPausados.add(w); await viagemDeVenda(w, true, retomar); return; }
    if (retomar) {
      ocupado = true;
      try { if (botaoHunt(w, false)) huntsPausados.add(w); await retomarCacada(w); }
      finally { ocupado = false; atualizarPainel(); }
    }
  };
  const destinoCorresponde = (texto, destino) => {
    if (!destino?.mapa || !/^voltar para /i.test(normalizar(texto))) return false;
    const oferta = normalizar(texto).replace(/^voltar para /, '').replace(/\s+sem taxa por mais \d+\s*(min|minutos?)$/, '').trim();
    const catalogo = { mag_dun02: 'Vulcão de Magma — 2º Andar' };
    const nomes = [destino.nome, destino.mapa, catalogo[destino.mapa]].filter(Boolean).map(normalizar);
    return nomes.some(nome => oferta === nome || oferta.startsWith(nome + ' (') || oferta.startsWith(nome + ' — ') || oferta.startsWith(nome + ' - '));
  };
  const validarChegadaFarm = (w) => {
    const destino = cfg.destinoFarm, atual = posicao(w);
    if (!destino?.mapa || !atual?.mapa ||
        (atual.mapa !== destino.mapa && !mapaConfereConteudo(atual.mapa)))
      return segurarRetorno(w, 'mapa de chegada ' + (atual?.mapa || '?') + '; esperado ' + (destino?.mapa || '?'));
    if (cfg.fimConteudoPendente) { delete cfg.fimConteudoPendente; salvarCfg(); }
    return true;
  };
  const entradaDoMapaPesquisado = (w,codigo) => {
    const alvo = codigo.toLowerCase();
    const entradas=[...w.document.querySelectorAll('button')].filter(b=>visivel(b) && !b.disabled && /^Entrar$/i.test(textoDe(b)));
    const correspondentes=[];
    for (const b of entradas) {
      let card=b.parentElement;
      for(let i=0;card && i<12;i++,card=card.parentElement){
        const txt = textoDe(card);
        if (!txt) continue;
        const ids=[...txt.matchAll(/Mapa:\s*([a-z0-9_]+)/gi)].map(m=>m[1].toLowerCase());
        if (!ids.length) continue;
        if (ids.length===1 && ids[0]===alvo) correspondentes.push(b);
        break;
      }
    }
    const unique = [...new Set(correspondentes)];
    return unique.length===1 ? unique[0] : null;
  };

  const mapaCheffenia = (mapa) => /^(?:moro_vol|mid_vol)/i.test(String(mapa || ''));
  const conteudoDireto = () => ['bio4', 'lhz'].includes(cfg.conteudo?.modo);
  const nomeConteudo = () => cfg.conteudo.modo === 'lhz' ? 'Invasão de LHZ' : 'Bio 4';
  const mapaDoConteudo = () => cfg.conteudo.modo === 'bio4' ? 'lhz_dun04'
    : cfg.conteudo.modo === 'lhz' ? (cfg.conteudo.mapa || 'invasao_lhz')
    : cfg.conteudo.modo === 'cheffenia' ? 'moro_vol'
    : cfg.conteudo.modo === 'expedicao' ? (cfg.conteudo.mapa || 'expedicao') : null;
  const mapaConfereConteudo = (mapa) => {
    const alvo = mapaDoConteudo();
    return Boolean(alvo && (cfg.conteudo.modo === 'cheffenia'
      ? mapaCheffenia(mapa) : cfg.conteudo.modo === 'expedicao'
        ? Boolean(cfg.conteudo.mapa && mapa === cfg.conteudo.mapa)
        : String(mapa || '').startsWith(alvo)));
  };
  let ultimoTimerConteudo = 0, timerVencidoLogado = false;
  const vigiarTempoConteudo = (w) => {
    const alvo = mapaDoConteudo();
    if (conteudoDireto() && mapaConfereConteudo(posicao(w)?.mapa)) {
      if (cfg.conteudo.cidadeRevalidada) {
        cfg.conteudo.cidadeRevalidada = false; delete cfg.conteudo.esgotado; salvarCfg();
      }
      const t = w.__elragEngine?.getTempoEvento?.();
      const fonte = cfg.conteudo.modo === 'bio4' ? 1 : 2;
      if (t?.fonte === fonte && Number.isInteger(t.secondsLeft) && t.secondsLeft >= 0) {
        // Usar o instante de RECEPÇÃO, não o relógio local do servidor.
        const resto = t.runningUntil > 0 ? Math.max(0, t.secondsLeft - (Date.now()/1000 - t.recebidoEm)) : t.secondsLeft;
        if (resto === 0) { encerrarAcessoConteudo(nomeConteudo() + ': tempo esgotado confirmado pelo servidor'); return; }
      }
    }
    if (!alvo || cfg.conteudo.modo === 'expedicao' || Date.now() - ultimoTimerConteudo < 3000) return;
    ultimoTimerConteudo = Date.now();
    if (!mapaConfereConteudo(posicao(w)?.mapa)) return;
    const pista = cfg.conteudo.modo === 'bio4' ? /bio\s*4/i : cfg.conteudo.modo === 'lhz' ? /invas[aã]o|lhz/i : /cheffenia|chefenia/i;
    for (const el of w.document.querySelectorAll('div, span')) {
      if (!visivel(el) || el.closest?.('[data-fzn-auto-voltar]')) continue;
      const s = (el.innerText || el.textContent || '').trim();
      if (s.length > 90 || !pista.test(s) || !/\d+\s*(?:h|min|s)\b/i.test(s)) continue;
      const h = Number(/(\d+)\s*h\b/i.exec(s)?.[1] || 0);
      const m = Number(/(\d+)\s*min\b/i.exec(s)?.[1] || 0);
      const seg = Number(/(\d+)\s*s\b/i.exec(s)?.[1] || 0);
      const resto = h * 3600 + m * 60 + seg;
      if (resto > 86400) continue;
      if (resto === 0) { encerrarAcessoConteudo('Tempo de ' + cfg.conteudo.modo + ' esgotado no contador do jogo'); return; }
      // O visor arredonda para minutos; a margem evita encerrar a sessao
      // quase um minuto antes de o jogo liberar a ultima entrada.
      const expira = Date.now() + resto * 1000 + (seg ? 0 : 60000);
      if (Math.abs(expira - Number(cfg.conteudo.expiraEm || 0)) > 60000) {
        cfg.conteudo.expiraEm = expira; salvarCfg();
        log((cfg.conteudo.modo === 'lhz' ? 'Invasão de LHZ' : cfg.conteudo.modo === 'bio4' ? 'Bio 4' : 'Cheffenia') + ': tempo restante ' + Math.ceil(resto / 60) + ' min');
      }
      timerVencidoLogado = false;
      return;
    }
  };
  const tempoConteudoEsgotado = () => {
    if (conteudoDireto() || cfg.conteudo.modo === 'cheffenia') return Boolean(cfg.conteudo.esgotado);
    const expira = Number(cfg.conteudo.expiraEm || 0);
    return Boolean(mapaDoConteudo() && expira && Date.now() >= expira);
  };
  const encerrarAcessoConteudo = (motivo) => {
    if (!['bio4', 'cheffenia', 'lhz'].includes(cfg.conteudo.modo)) return false;
    const modo = cfg.conteudo.modo, anterior = cfg.conteudo.anterior;
    cfg.conteudo = { modo: 'normal', expiraEm: 0 };
    cfg.mapaFarmManual = anterior?.mapaFarmManual || anterior?.destinoFarm?.mapa || '';
    cfg.destinoFarm = anterior?.destinoFarm || (cfg.mapaFarmManual ? { mapa: cfg.mapaFarmManual, nome: cfg.mapaFarmManual } : null);
    cfg.retornoEvento = Boolean(anterior?.retornoEvento);
    recuperacao = null; vigia = null; chegadaAtrasada = null;
    delete cfg.retornoPendente; delete cfg.destinoPendente;
    cfg.fimConteudoPendente = { modo, motivo };
    if (cfg.ligado && (cfg.mapaFarmManual || cfg.retornoEvento))
      recuperacao = { motivo, fimConteudo: true, desde: Date.now(), ultimaEm: Date.now()-60000, tentativas: 0, retomarAutopilot: true };
    salvarCfg();
    etapa('Voltando ao farm padrão', motivo + '; conteúdo desmarcado; destino ' + (cfg.mapaFarmManual || 'não configurado'));
    log(motivo + '; modo ' + modo + ' desligado, mapa anterior restaurado nesta conta');
    return false;
  };
  const avisosTempoVistos = new WeakMap();
  const conferirFimConteudo = (w) => {
    if (cfg.conteudo.esgotado) { encerrarAcessoConteudo(cfg.conteudo.esgotado); return; }
    // Registrar o histórico já visível evita reagir a avisos antigos ao relogar.
    let vistos = avisosTempoVistos.get(w.document);
    const primeiraLeitura = !vistos;
    if (!vistos) { vistos = new Set(); avisosTempoVistos.set(w.document, vistos); }
    const modo = cfg.conteudo.modo;
    for (const el of w.document.querySelectorAll('div, span')) {
      const t = normalizar(el.textContent || '');
      if (t.length > 220 || !/(?:sua hora|seu tempo|tempo|passe).*(?:acabou|esgotado|terminou)/.test(t)) continue;
      const conteudo = /invasao de lhz/.test(t) ? 'lhz' : /bio\s*4|biolaboratorio/.test(t) ? 'bio4' : /cheffenia|chefenia/.test(t) ? 'cheffenia' : null;
      if (!conteudo || vistos.has(t)) continue;
      vistos.add(t);
      if (!primeiraLeitura && cfg.ligado && conteudo === modo) { encerrarAcessoConteudo('Aviso do servidor: ' + t); return; }
    }
  };
  // Uma recarga por passagem pela cidade. Persistir ANTES da recarga evita
  // loops após login/reaplicação. Não deduzir limbo pela quantidade de pessoas.
  const revalidarProntera = (w) => {
    if (!conteudoDireto() || posicao(w)?.mapa !== 'prontera' || cfg.conteudo.cidadeRevalidada) return true;
    cfg.conteudo.cidadeRevalidada = true; salvarCfg();
    log(nomeConteudo() + ': atualizando o jogo uma vez em Prontera antes do retorno, para evitar a sessão do limbo');
    etapa('Revalidando Prontera', 'Atualizando o jogo antes de caminhar ao NPC');
    // O api.html interno não inicializa sozinho: reiniciar a aplicação completa.
    (w.top || w).location.reload();
    return false;
  };
  const PORTEIRO_BIO4 = [170, 184];
  cfg.caminhoBio4 = cfg.caminhoBio4 && typeof cfg.caminhoBio4 === 'object' ? cfg.caminhoBio4 : {};
  if (cfg.caminhoBio4Alvo !== "170,184") {
    cfg.caminhoBio4 = {}; cfg.caminhoBio4Alvo = "170,184";
    // Nao sobrescrever o backup de IndexedDB antes da recuperacao inicial.
    if (cfgLocal || cfgSessao) salvarCfg();
  }
  const janelaPorteiro = (w) => {
    const janela = w.document.querySelector('[data-hud-window="porteiro"]');
    if (janela && visivel(janela)) return janela;
    // HudPanel e um portal no body; windowId nao vira data-hud-window.
    // Na HUD real a moldura usa data-hud-presentation (active/idle/tela-cheia).
    return [...w.document.querySelectorAll('[data-hud-presentation]')].find(painel =>
      visivel(painel) && /Porteiro do Biolaborat[oó]rio/i.test(textoDe(painel)) &&
      /Tempo de passe|O que o Porteiro oferece/i.test(textoDe(painel))) || null;
  };
  const porteiroAberto = (w) => Boolean(janelaPorteiro(w)) || /Porteiro do Biolaborat/i.test(w.document.body.innerText || '');
  const carregarCaminhadaBio4 = async (w) => {
    if (typeof w.__fznBio4Caminhada?.andar === 'function') return w.__fznBio4Caminhada;
    if (!w.__fznBio4Caminhada?.carregando) {
      w.__fznBio4Caminhada = { carregando: true };
      const script = w.document.createElement('script'); script.type = 'module';
      // Mesmo pacote REQUEST_MOVE usado por sendWalkRequest no MapEngine.
      // Coordenadas do mapa dispensam foco, camera e cliques de tela.
      script.textContent = "Promise.all([import('Network/NetworkManager.js'),import('Network/PacketStructure.js'),import('Network/PacketVerManager.js')]).then(([n,p,v])=>{window.__fznBio4Caminhada={andar:(x,y)=>{if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>1023||y>1023)return false;const C=v.default.value>=20180307?p.default.CZ.REQUEST_MOVE2:p.default.CZ.REQUEST_MOVE;if(typeof C!=='function')return false;const pkt=new C();pkt.dest[0]=x;pkt.dest[1]=y;n.default.sendPacket(pkt);return true;}};}).catch(e=>{window.__fznBio4Caminhada={erro:String(e)};});";
      w.document.head.appendChild(script);
    }
    const ponte = await esperarAte(() => !w.__fznBio4Caminhada?.carregando && w.__fznBio4Caminhada, 4000);
    return typeof ponte?.andar === 'function' ? ponte : null;
  };

  const falarComPorteiro = async (w) => {
    if (!cfg.ligado || cancelando()) return false;
    if (porteiroAberto(w)) return true;
    const partida = posicao(w);
    if (!partida || partida.mapa !== 'prontera' || Math.hypot(partida.x - PORTEIRO_BIO4[0], partida.y - PORTEIRO_BIO4[1]) > 5) return false;
    const manager = await carregarEntidadesNpc(w);
    if (!manager) return false;
    const [x, y] = PORTEIRO_BIO4;
    let sx = null, sy = null;
    const alvo = await esperarAte(() => {
      let npc = null; 
      manager.forEach((e) => { 
        const c = e?.constructor; 
        const ehNpc = c && ((Number.isFinite(c.TYPE_NPC) && e.objecttype === c.TYPE_NPC) || (Number.isFinite(c.TYPE_NPC2) && e.objecttype === c.TYPE_NPC2)); 
        if (ehNpc && e.GID > 0 && !e.remove_tick && e.position && Math.abs(e.position[0] - x) < 0.75 && Math.abs(e.position[1] - y) < 0.75) npc = e; 
      }); 
      return npc; 
    }, 3000);

    if (!cfg.ligado || cancelando() || posicao(w)?.mapa !== 'prontera') return false;
    if (alvo) {
      // Interacao da propria entidade funciona tambem em segundo plano.
      if (typeof alvo.onMouseDown === 'function') {
        try { alvo.onMouseDown(); } catch (e) { log('Bio 4: interacao com Porteiro falhou: ' + String(e).slice(0, 80)); }
        if (await esperarAte(() => porteiroAberto(w), 2500)) return true;
      }
      try {
        const camera = w.__elragEngine.renderer?.camera || w.__elragEngine.camera;
        if (camera && camera.worldToScreen) {
          const p = camera.worldToScreen(alvo.position[0], alvo.position[1], 0);
          if (p) { sx = p[0]; sy = p[1]; }
        }
      } catch (e) {}
    }
    if (sx !== null && sy !== null) {
      const canvas = canvasDoJogo(w);
      if (!canvas) return false;
      const r = canvas.getBoundingClientRect();
      await clicarNoCanvas(w, canvas, r.left + sx, r.top + sy);
      return Boolean(await esperarAte(() => porteiroAberto(w), 3500));
    }
    log('Bio 4: Porteiro ainda sem resposta; verificarei a aproximacao');
    return false;
  };

  const aproximarPorteiro = async (w) => {
    if (!cfg.ligado || cancelando()) return false;
    const p = posicao(w);
    if (!p || p.mapa !== 'prontera') return false;
    const ponte = await carregarCaminhadaBio4(w);
    if (!cfg.ligado || cancelando() || posicao(w)?.mapa !== 'prontera') return false;
    if (!ponte) { log('Bio 4: caminhada do motor indisponivel'); return false; }
    // Chao livre observado no teste da conta 1: 168,181, junto ao NPC 170,184.
    // Limitar cada trecho evita pedir um percurso longo de outro canto da cidade.
    const alvo = [168, 181], distancia = Math.max(Math.abs(alvo[0] - p.x), Math.abs(alvo[1] - p.y));
    if (distancia <= 1) return true;
    const escala = Math.min(1, 12 / distancia);
    const x = Math.round(p.x + (alvo[0] - p.x) * escala), y = Math.round(p.y + (alvo[1] - p.y) * escala);
    log('Bio 4: caminhando de ' + p.x + ',' + p.y + ' para ' + x + ',' + y + ' junto ao Porteiro');
    if (!ponte.andar(x, y)) return false;
    // Mover um unico passo nao comprova chegada. Espere o fim do trecho.
    return Boolean(await esperarAte(() => {
      const q = posicao(w);
      return q && q.mapa === 'prontera' && Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) <= 1;
    }, 8000, 250));
  };

  const entrarBio4 = async (w) => {
    if (!cfg.ligado || cancelando()) return false;
    etapa('8/8 Voltando ao mapa', 'Porteiro do Biolaboratorio (lhz_dun04)');
    let abriu = await falarComPorteiro(w);
    if (!abriu) {
      const partida = posicao(w);
      const ponto = partida && cfg.caminhoBio4[chaveCelula(partida)];
      const canvas = canvasDoJogo(w);
      // A calibracao antiga continua como recurso para clientes sem a ponte.
      if (ponto && canvas && !await carregarCaminhadaBio4(w)) {
        const r = canvas.getBoundingClientRect();
        log('Bio4: andando pelo clique calibrado (' + ponto.dx + ',' + ponto.dy + ') a partir de ' + chaveCelula(partida));
        await clicarNoCanvas(w, canvas, r.left + r.width / 2 + ponto.dx, r.top + r.height / 2 + ponto.dy);
        await esperarAte(() => { const q = posicao(w); return q && chaveCelula(q) !== chaveCelula(partida); }, 4000, 200);
      }
      for (let i = 0; i < 6 && !abriu && cfg.ligado && !cancelando(); i++) {
        abriu = await falarComPorteiro(w);
        if (!abriu) await aproximarPorteiro(w);
      }
    }
    if (!cfg.ligado || cancelando()) return false;
    if (!abriu) return segurarRetorno(w, 'conversa com o Porteiro do Biolaboratorio nao abriu depois da caminhada; verifique o acesso em Prontera');
    const janela = janelaPorteiro(w);
    if (janela) {
      const entrar = [...janela.querySelectorAll('button')].find(b => visivel(b) && !b.disabled &&
        /^(?:Entrar(?: no 4[ºo°.\s]*andar(?: agora)?)?|Voltar para a dupla)$/i.test(textoDe(b)));
      if (!entrar) {
        const fechar = [...janela.querySelectorAll('button')].find(b => visivel(b) && !b.disabled && /^Fechar$/i.test(textoDe(b)));
        if (fechar) { fechar.click(); await esperarAte(() => !janelaPorteiro(w), 2000); }
        return encerrarAcessoConteudo('Bio 4: Porteiro sem entrada disponível (sem passe/tempo/acesso)');
      }
      entrar.click();
    } else {
      const entrar4 = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Entrar no 4.? andar agora/i.test(t)), 3000);
      if (!entrar4) {
        try { w.__elragEngine.cancelNpcDialog?.(); } catch {}
        return encerrarAcessoConteudo('Bio 4: Porteiro sem entrada disponível');
      }
      entrar4.click();
      const entrar = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Entrar$/i.test(t)), 3000);
      if (!entrar) return segurarRetorno(w, 'botao Entrar do Porteiro nao apareceu');
      entrar.click();
    }
    const chegou = await esperarAte(() => /^lhz_dun04/.test(String(posicao(w)?.mapa || '')), 20000, 250);
    if (!chegou) return segurarRetorno(w, 'entrada na lhz_dun04 sem confirmacao');
    if (!validarChegadaFarm(w)) return false;
    delete cfg.retornoPendente; salvarCfg(); log('Retorno confirmado: lhz_dun04 pelo Porteiro'); await religarEconomia(w); return true;
  };

  const dialogoLhz = (w) => [...w.document.querySelectorAll('[data-hud-presentation], [role="dialog"]')]
    .find(el => visivel(el) && /\[Invas[aã]o de LHZ\]/i.test(textoDe(el))) || null;
  // Ceifador validado ao vivo: 140,194. O nome pode ainda não estar disponível
  // após login/recarga; aproximar pelo chão 142,194 permite carregar a entidade.
  const localizarNpcLhz = (manager) => {
    const porNome = [], porPosicao = [];
    manager.forEach(e => {
      const c = e?.constructor;
      if (!c || ![c.TYPE_NPC, c.TYPE_NPC2].some(t => Number.isFinite(t) && t === e.objecttype) ||
        !(e.GID > 0) || e.remove_tick || !e.position) return;
      if ([e.display?.name, e.name, e._name, e.entityName].some(n => /^invasao de lhz(?:#.*)?$/.test(normalizar(String(n || ''))))) porNome.push(e);
      if (Math.abs(e.position[0] - 140) < 0.75 && Math.abs(e.position[1] - 194) < 0.75) porPosicao.push(e);
    });
    if (porNome.length > 1) return null;
    return porNome[0] || (porPosicao.length === 1 ? porPosicao[0] : null);
  };
  const entrarLhz = async (w) => {
    etapa('Voltando à Invasão de LHZ', 'Caminhando ao NPC à esquerda de Prontera');
    const manager = await carregarEntidadesNpc(w);
    if (!manager) return segurarRetorno(w, 'LHZ: entidades ainda indisponíveis');
    let painel = dialogoLhz(w);
    for (let i = 0; i < 10 && !painel; i++) {
      if (!cfg.ligado || cancelando() || posicao(w)?.mapa !== 'prontera') return false;
      let npc = localizarNpcLhz(manager);
      const p = posicao(w), alvo = npc?.position || [140,194];
      if (Math.hypot(p.x - alvo[0], p.y - alvo[1]) <= 5) {
        if (!npc) npc = await esperarAte(() => localizarNpcLhz(manager), 5000, 200);
        if (!cfg.ligado || cancelando() || posicao(w)?.mapa !== 'prontera') return false;
        if (!npc) return segurarRetorno(w, 'LHZ: cheguei junto ao ceifador, mas a entidade NPC ainda não carregou');
        npc.onMouseDown?.();
        painel = await esperarAte(() => dialogoLhz(w), 3000, 200);
      } else {
        const ponte = await carregarCaminhadaBio4(w);
        if (!ponte) return segurarRetorno(w, 'LHZ: caminhada do motor indisponível');
        // Parar duas células em frente ao NPC, sem tentar ocupar sua célula.
        const dx = alvo[0] + 2 - p.x, dy = alvo[1] - p.y;
        const escala = Math.min(1, 10 / Math.max(Math.abs(dx), Math.abs(dy)));
        const x = Math.round(p.x + dx * escala), y = Math.round(p.y + dy * escala);
        log('LHZ: caminhando de ' + p.x + ',' + p.y + ' para ' + x + ',' + y);
        if (!cfg.ligado || cancelando() || !ponte.andar(x,y)) return false;
        if (!await esperarAte(() => { const q = posicao(w); return q?.mapa === 'prontera' && Math.max(Math.abs(q.x-x), Math.abs(q.y-y)) <= 1; }, 8000, 250))
          return segurarRetorno(w, 'LHZ: caminhada sem chegada confirmada');
      }
    }
    if (!painel) return segurarRetorno(w, 'LHZ: diálogo não abriu após caminhada');
    const texto = normalizar(textoDe(painel));
    const saldo = /(?:ainda tem|restam?)\s+(\d+)\s*min/.exec(texto);
    if (saldo && Number(saldo[1]) === 0 || /tempo.*(?:esgot|acab)|limite.*(?:atingid|esgot)|nao.*(?:tem|possui).*tempo/.test(texto))
      return encerrarAcessoConteudo('Invasão de LHZ: tempo diário esgotado');
    if (!saldo || Number(saldo[1]) <= 0) return segurarRetorno(w, 'LHZ: saldo de minutos não confirmado pelo NPC');
    const entrar = [...painel.querySelectorAll('button, [role="button"]')].find(b => visivel(b) && !b.disabled && /^ir para a cidade tomada$/.test(normalizar(textoDe(b))));
    if (!cfg.ligado || cancelando()) return false;
    const fecharLhz = () => {
      const painelAtual = dialogoLhz(w);
      return painelAtual && [...painelAtual.querySelectorAll('button')].find(b => visivel(b) && !b.disabled && /^fechar$/.test(normalizar(textoDe(b))));
    };
    // O servidor aguarda fechar a fala após a escolha para executar o warp.
    // Aceitar também a fala pendente de uma tentativa anterior interrompida.
    if (entrar) entrar.click();
    else if (!fecharLhz()) return segurarRetorno(w, 'LHZ: opção Ir para a cidade tomada indisponível');
    const fechamento = await esperarAte(() => posicao(w)?.mapa !== 'prontera' || fecharLhz(), 4000, 150);
    if (!cfg.ligado || cancelando()) return false;
    if (fechamento && typeof fechamento.click === 'function') {
      log('LHZ: fechando o diálogo para concluir a entrada'); fechamento.click();
    }
    const chegou = await esperarAte(() => {
      const p = posicao(w), t = w.__elragEngine?.getTempoEvento?.();
      return p?.mapa && p.mapa !== 'prontera' && t?.fonte === 2 && t.secondsLeft > 0 ? p : null;
    }, 20000, 250);
    if (!chegou) return segurarRetorno(w, 'LHZ: mapa e contador do servidor não confirmaram entrada');
    cfg.conteudo.mapa = chegou.mapa; cfg.conteudo.cidadeRevalidada = false;
    cfg.mapaFarmManual = chegou.mapa; cfg.destinoFarm = { mapa: chegou.mapa, nome: 'Invasão de LHZ' };
    delete cfg.retornoPendente; delete cfg.conteudo.esgotado; salvarCfg();
    log('Invasão de LHZ: chegada confirmada em ' + chegou.mapa + ' com tempo ativo');
    await religarEconomia(w);
    return validarChegadaFarm(w);
  };

  const entrarCheffenia = async (w) => {
    etapa('8/8 Voltando ao mapa', 'Arauto da Cheffenia');
    const dialogo = () => /Arauto da Cheffenia/i.test(w.document.body?.innerText || '') &&
      botaoPorTexto(w.document, (t) => /^Entrar$/i.test(t));
    let entrar = dialogo();
    if (!entrar) {
      const manager = await carregarEntidadesNpc(w);
      const canvas = canvasDoJogo(w);
      if (!manager || !canvas) return segurarRetorno(w, 'Arauto da Cheffenia ou canvas indisponivel');
      let npc = null;
      const personagem = posicao(w);
      manager.forEach((e) => {
        const c = e?.constructor;
        const tipoNpc = c && ((Number.isFinite(c.TYPE_NPC) && e.objecttype === c.TYPE_NPC) ||
          (Number.isFinite(c.TYPE_NPC2) && e.objecttype === c.TYPE_NPC2));
        if (!tipoNpc || !(e.GID > 0) || e.remove_tick || !e.position) return;
        if (![e.display?.name, e.name, e._name, e.entityName].some((s) => /Arauto da Cheffenia/i.test(String(s || '')))) return;
        const distancia = personagem ? Math.hypot(e.position[0] - personagem.x, e.position[1] - personagem.y) : 0;
        if (!npc || distancia < npc.distancia) npc = { entidade: e, distancia };
      });
      if (!npc) return segurarRetorno(w, 'Arauto da Cheffenia nao encontrado em Prontera');
      for (let i = 0; i < 3 && !entrar; i++) {
        try {
          const camera = w.__elragEngine.renderer?.camera || w.__elragEngine.camera;
          const xy = camera?.worldToScreen?.(npc.entidade.position[0], npc.entidade.position[1], 0);
          const r = canvas.getBoundingClientRect();
          if (!xy || xy.length < 2 || xy[0] < 0 || xy[1] < 0 || xy[0] > r.width || xy[1] > r.height) {
            if (typeof npc.entidade.onMouseDown !== 'function')
              return segurarRetorno(w, 'Arauto fora da tela e sem interacao disponivel');
            npc.entidade.onMouseDown();
          } else {
            await clicarNoCanvas(w, canvas, r.left + xy[0], r.top + xy[1]);
          }
        } catch (e) { log('Cheffenia: clique no Arauto falhou: ' + String(e).slice(0, 80)); }
        entrar = await esperarAte(dialogo, 3000, 200);
      }
    }
    if (!entrar) return segurarRetorno(w, 'conversa com Arauto da Cheffenia nao abriu');
    entrar.click();
    const chegou = await esperarAte(() => mapaCheffenia(posicao(w)?.mapa), 20000, 250);
    if (!chegou) return segurarRetorno(w, 'entrada na Cheffenia sem confirmacao');
    if (!validarChegadaFarm(w)) return false;
    delete cfg.retornoPendente; salvarCfg();
    log('Retorno confirmado: Cheffenia pelo Arauto');
    await religarEconomia(w);
    return true;
  };

  const faseExpedicaoNoTexto = (texto, fase) => {
    const t = normalizar(texto);
    return fase === 'Portal do Abismo' ? /portal do abismo/.test(t)
      : fase === 'Calabouço II' ? /calabouco ii\b/.test(t)
      : /calabouco i\b/.test(t);
  };
  const entradaDaExpedicao = (w) => {
    const fases = ['Calabouço I', 'Calabouço II', 'Portal do Abismo'];
    const encontrados = [];
    for (const b of w.document.querySelectorAll('button')) {
      if (!visivel(b) || b.disabled || !/^Entrar$/i.test(textoDe(b))) continue;
      for (let card = b.parentElement, i = 0; card && i < 7; card = card.parentElement, i++) {
        const texto = textoDe(card);
        if (!faseExpedicaoNoTexto(texto, cfg.expedicaoFase)) continue;
        if (fases.filter(f => faseExpedicaoNoTexto(texto, f)).length === 1) encontrados.push(b);
        break;
      }
    }
    return encontrados.length === 1 ? encontrados[0] : null;
  };
  const entrarExpedicao = async (w) => {
    etapa('8/8 Voltando a Expedição', 'NPC Expedições de Yggdrasil · ' + cfg.expedicaoFase);
    if (posicao(w)?.mapa !== 'prontera') return segurarRetorno(w, 'Expedição exige entrada pelo NPC em Prontera');
    let entrar = entradaDaExpedicao(w);
    if (!entrar) {
      const manager = await carregarEntidadesNpc(w), canvas = canvasDoJogo(w);
      if (!manager || !canvas) return segurarRetorno(w, 'NPC da Expedição ou canvas indisponível');
      let npc = null;
      manager.forEach((e) => {
        const c = e?.constructor;
        const tipoNpc = c && ((Number.isFinite(c.TYPE_NPC) && e.objecttype === c.TYPE_NPC) ||
          (Number.isFinite(c.TYPE_NPC2) && e.objecttype === c.TYPE_NPC2));
        if (!tipoNpc || !(e.GID > 0) || e.remove_tick || !e.position) return;
        if (![e.display?.name, e.name, e._name, e.entityName].some(n => /expedi(?:ç|c)(?:ões|oes) de yggdrasil/i.test(String(n || '')))) return;
        npc = e;
      });
      if (!npc) return segurarRetorno(w, 'NPC Expedições de Yggdrasil não encontrado em Prontera');
      for (let i = 0; i < 7 && !entrar; i++) {
        const camera = w.__elragEngine.renderer?.camera || w.__elragEngine.camera;
        const xy = camera?.worldToScreen?.(npc.position[0], npc.position[1], 0);
        if (!xy || xy.length < 2) {
          try { npc.onMouseDown?.(); } catch (e) { log('Expedição: clique no NPC falhou: ' + String(e).slice(0, 80)); }
          entrar = await esperarAte(() => entradaDaExpedicao(w), 2500, 200);
          if (!entrar && typeof npc.onMouseDown !== 'function')
            return segurarRetorno(w, 'posição e clique do NPC da Expedição indisponíveis');
          continue;
        }
        const r = canvas.getBoundingClientRect();
        const x = Math.max(24, Math.min(r.width - 24, xy[0]));
        const y = Math.max(24, Math.min(r.height - 24, xy[1]));
        await clicarNoCanvas(w, canvas, r.left + x, r.top + y);
        entrar = await esperarAte(() => entradaDaExpedicao(w), 2500, 200);
      }
    }
    if (!entrar) return segurarRetorno(w, 'janela da Expedição ou entrada de ' + cfg.expedicaoFase + ' indisponível');
    entrar.click();
    const chegou = await esperarAte(() => {
      const p = posicao(w);
      return p?.mapa && p.mapa !== 'prontera' ? p : null;
    }, 20000, 250);
    if (!chegou) return segurarRetorno(w, 'entrada da Expedição sem confirmação; não tentarei pelo mapa comum');
    cfg.conteudo.mapa = chegou.mapa;
    cfg.mapaFarmManual = chegou.mapa;
    cfg.destinoFarm = { mapa: chegou.mapa, nome: chegou.nome || cfg.expedicaoFase };
    delete cfg.retornoPendente; salvarCfg();
    log('Expedição: ' + cfg.expedicaoFase + ' confirmada em ' + chegou.mapa + ' pelo NPC');
    await religarEconomia(w);
    return validarChegadaFarm(w);
  };

  const nomeGerenteEventos = (nome) => /gerente (?:de )?(?:eventos?|premios?)|event manager/.test(normalizar(nome));
  const npcGerenteEventos = (manager) => {
    const encontrados = [];
    manager.forEach((e) => {
      const c = e?.constructor;
      const npc = c && ((Number.isFinite(c.TYPE_NPC) && e.objecttype === c.TYPE_NPC) ||
        (Number.isFinite(c.TYPE_NPC2) && e.objecttype === c.TYPE_NPC2));
      if (!npc || !(e.GID > 0) || e.remove_tick || !e.position) return;
      const nomes = [e.display?.name, e.name, e._name, e.entityName, e._job].filter(Boolean);
      if (nomes.some(nomeGerenteEventos)) encontrados.push(e);
    });
    return encontrados.length === 1 ? encontrados[0] : null;
  };
  const opcaoTeleportEvento = (w) => {
    const botoes = [...w.document.querySelectorAll('button, [role="button"]')]
      .filter((b) => visivel(b) && !b.disabled && !b.closest('[data-fzn-auto-voltar]'));
    const opcoes = botoes.filter((b) => {
      const t = normalizar(textoDe(b));
      return /evento/.test(t) && !/trocar|premio|recompensa|loja|cancelar|sair/.test(t) &&
        (/ir|entrar|teleport|viajar|acessar|participar|levar|voltar/.test(t) || t === 'evento');
    });
    return opcoes.length === 1 ? opcoes[0] : null;
  };
  const dialogoGerenteAberto = (w) => nomeGerenteEventos(w.document.body?.innerText || '') && Boolean(opcaoTeleportEvento(w));
  const falarComGerenteEventos = async (w) => {
    if (dialogoGerenteAberto(w)) return true;
    const manager = await carregarEntidadesNpc(w);
    if (!manager) { log('Evento: entidades NPC indisponiveis'); return false; }
    const npc = await esperarAte(() => npcGerenteEventos(manager), 5000, 300);
    if (!npc) { log('Evento: Gerente de Premios nao encontrado entre os NPCs de Prontera'); return false; }
    const canvas = canvasDoJogo(w);
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      if (canvas) {
        try {
          const camera = w.__elragEngine.renderer?.camera || w.__elragEngine.camera;
          const p = camera?.worldToScreen?.(npc.position[0], npc.position[1], 0);
          if (p && p.length >= 2) {
            const r = canvas.getBoundingClientRect();
            await clicarNoCanvas(w, canvas, r.left + p[0], r.top + p[1]);
            if (await esperarAte(() => dialogoGerenteAberto(w), 2500)) return true;
          }
        } catch (e) { log('Evento: falha no clique pelo canvas: ' + String(e).slice(0, 80)); }
      }
      try { npc.onMouseDown?.(); } catch (e) { log('Evento: clique no NPC falhou: ' + String(e).slice(0, 80)); }
      if (await esperarAte(() => dialogoGerenteAberto(w), 3500)) return true;
      log('Evento: dialogo nao abriu, tentativa ' + tentativa + '/3');
    }
    return false;
  };
  const entrarNoEvento = async (w) => {
    etapa('8/8 Voltando ao evento', 'Falando com o Gerente de Premios em Prontera');
    if (posicao(w)?.mapa !== 'prontera') return segurarRetorno(w, 'retorno pelo Gerente exige estar em Prontera');
    if (!await falarComGerenteEventos(w)) return segurarRetorno(w, 'Gerente de Premios ou dialogo de teleporte nao encontrado');
    const opcao = opcaoTeleportEvento(w);
    if (!opcao) return segurarRetorno(w, 'opcao unica de teleporte do evento nao encontrada; nao escolhi premios');
    log('Evento: escolhendo ' + textoDe(opcao));
    opcao.click();
    let chegou = await esperarAte(() => {
      const p = posicao(w);
      return p?.mapa && p.mapa !== 'prontera' ? p : null;
    }, 12000, 300);
    if (!chegou && nomeGerenteEventos(w.document.body?.innerText || '')) {
      const confirmar = botaoPorTexto(w.document, t => /^(sim|confirmar|entrar|ir agora|teleportar)$/i.test(t));
      if (confirmar) { log('Evento: confirmando teleporte'); confirmar.click(); }
      chegou = await esperarAte(() => {
        const p = posicao(w);
        return p?.mapa && p.mapa !== 'prontera' ? p : null;
      }, 20000, 300);
    }
    if (!chegou) return segurarRetorno(w, 'teleporte do Gerente nao confirmado; permanecendo em Prontera');
    cfg.mapaFarmManual = chegou.mapa;
    cfg.destinoFarm = { mapa: chegou.mapa, nome: chegou.nome || chegou.mapa };
    delete cfg.retornoPendente;
    salvarCfg();
    log('Evento: chegada confirmada em ' + chegou.mapa + '; destino atualizado nesta conta');
    await religarEconomia(w);
    return validarChegadaFarm(w);
  };

  // v3.02: sem NENHUM projetil (Sniper/Gunslinger nao atacam) e a loja recusando
  // a compra (zeny): voltar ao mapa so faz o personagem morrer em ciclo. Fica na
  // cidade, avisa em Problemas e a recuperacao tenta comprar de novo sozinha.
  let semMunicaoAvisoEm = 0;
  const semMunicaoParaCacar = (w) => {
    const muni = (cfg.compras || []).filter((c) => c && c.nome && ehMunicao(c.nome));
    if (!muni.length || !itensMochila().length) return null;
    const total = muni.reduce((t, c) => t + quantosNaMochila(c.nome) + naBolsa(w, c.nome), 0);
    if (total > 0) return null;
    return muni.some((c) => compraRecusada(c.nome)) ? muni.map((c) => c.nome).join(', ') : null;
  };

  // v3.02: janela do navegador minimizada/em segundo plano: o jogo para de
  // desenhar e cliques em NPC e no mapa-mundi falham. Avisa (1x a cada 10 min).
  let ocultaDesde = 0, ocultaAvisoEm = 0;
  const janelaOculta = (w) => { try { return document.visibilityState === 'hidden' || w.document.visibilityState === 'hidden'; } catch { return false; } };
  const avisarJanelaOculta = (w) => {
    if (!janelaOculta(w)) { ocultaDesde = 0; return; }
    if (!ocultaDesde) ocultaDesde = Date.now();
    if (Date.now() - ocultaDesde > 60 * 1000 && Date.now() - ocultaAvisoEm > 10 * 60 * 1000) {
      ocultaAvisoEm = Date.now();
      problema('Janela do jogo minimizada ou em segundo plano ha ' + Math.round((Date.now() - ocultaDesde) / 60000) + ' min: cliques em Kafra, vendedor e mapa-mundi podem falhar. Deixe a janela aberta (pode ficar atras de outras)', andamento.etapa);
    }
  };

  const voltarAoMapa = async (w) => {
    // Bio 4 tem retorno proprio. Nao passe por peso, slots, Kafra, armazem,
    // Ferreiro, vendedor ou suprimentos antes de procurar o Porteiro.
    if (cfg.conteudo?.modo === 'bio4' || cfg.conteudo?.modo === 'lhz') {
      if (!cfg.ligado || cancelando()) return false;
      cfg.destinoFarm = { ...cfg.destinoFarm, mapa: mapaDoConteudo(), nome: nomeConteudo() };
      salvarCfg();
      if (mapaConfereConteudo(posicao(w)?.mapa)) return validarChegadaFarm(w);
      if (tempoConteudoEsgotado()) return false;
      await sairDaEconomia(w);
      if (posicao(w)?.mapa !== 'prontera' && !await sairParaRifa(w))
        return segurarRetorno(w, 'Bio 4: nao consegui chegar a Prontera para retornar pelo Porteiro');
      if (!cfg.ligado || cancelando()) return false;
      if (!await pausarCacada(w)) return segurarRetorno(w, 'Bio 4: nao consegui pausar a cacada antes do Porteiro');
      if (!revalidarProntera(w)) return false;
      return cfg.conteudo.modo === 'lhz' ? entrarLhz(w) : entrarBio4(w);
    }
    const semMuni = typeof semMunicaoParaCacar === 'function' ? semMunicaoParaCacar(w) : null;
    if (semMuni && normalizar(posicao(w)?.mapa) === 'prontera') {
      if (Date.now() - semMunicaoAvisoEm > 10 * 60 * 1000) {
        semMunicaoAvisoEm = Date.now();
        problema('Sem projetil (' + semMuni + ') e a loja recusou a compra (zeny?). Fico em Prontera em vez de morrer no mapa; tento comprar de novo sozinho', 'Sem municao');
      }
      return segurarRetorno(w, 'sem projetil e sem zeny para comprar; aguardando em Prontera');
    }
    if (mapaDeRenascer(posicao(w))) { log('Voltar ao mapa: estou em ' + posicao(w).mapa + ' (protegido); nao saio daqui'); return true; }
    if (!cfg.mapaFarmManual && String(cfg.destinoFarm?.mapa || '').includes('@')) {
      const antigo = historicoLog().map((l) => /pesquisa exata ([a-z0-9_]+)/.exec(linhaHist(l))?.[1]).filter(Boolean).pop();
      if (antigo) { cfg.destinoFarm = { mapa: antigo, nome: antigo }; salvarCfg(); log('Mapa de farm recuperado do historico: ' + antigo + ' (o covil tinha gravado ' + '1@tower)'); }
    }
    const codigo=mapaDoConteudo() || cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
    if((!cfg.retornoEvento || posicao(w)?.mapa !== 'prontera') && (!codigo || !/^[a-z0-9_]+$/.test(codigo))) return segurarRetorno(w,'configure o codigo em Mapa de farm');
    if(codigo && /^[a-z0-9_]+$/.test(codigo)) { cfg.destinoFarm={...cfg.destinoFarm,mapa:codigo};salvarCfg(); }
    etapa('7/8 Conferindo retorno','Peso precisa estar abaixo de '+limiteSeguro()+'%');
    if(!await fecharArmazem(w)) return segurarRetorno(w,'armazem nao fechou antes do retorno');
    if (!await fecharLoja(w)) return segurarRetorno(w, 'Loja de Suprimentos ou diálogo do vendedor ainda aberto; retorno bloqueado');
    if (!cfg.ligado) { log('Retorno ao mapa interrompido: Auto-voltar desligado'); return false; }
    if (!await pesoSeguroParaVoltar(w)) return false;
    if(posicao(w)?.mapa===codigo || mapaConfereConteudo(posicao(w)?.mapa)) return true;
    await sairDaEconomia(w);
    if (tempoConteudoEsgotado()) {
      if (!timerVencidoLogado) { log('Tempo de ' + cfg.conteudo.modo + ' esgotado; nao tentarei uma nova entrada paga'); timerVencidoLogado = true; }
      etapa('Aguardando', 'Tempo do conteudo esgotado; escolha outro modo ou entre manualmente');
      return false;
    }
    if (cfg.conteudo.modo !== 'normal' && posicao(w)?.mapa !== 'prontera') {
      etapa('8/8 Indo a Prontera', 'Saindo do mapa atual para entrar pelo NPC do conteúdo');
      if (!await sairParaRifa(w))
        return segurarRetorno(w, 'não consegui chegar a Prontera para falar com o NPC do conteúdo');
    }
    if (cfg.conteudo.modo === 'bio4' && posicao(w)?.mapa === 'prontera') return entrarBio4(w);
    if (cfg.conteudo.modo === 'cheffenia' && posicao(w)?.mapa === 'prontera') return entrarCheffenia(w);
    if (cfg.conteudo.modo === 'expedicao' && posicao(w)?.mapa === 'prontera') return entrarExpedicao(w);
    if (cfg.conteudo.modo !== 'normal')
      return segurarRetorno(w, 'modo ' + cfg.conteudo.modo + ': entrada somente pelo NPC em Prontera; mapa comum não será usado');
    if(cfg.retornoEvento && posicao(w)?.mapa==='prontera') return entrarNoEvento(w);
    if(codigo==='lhz_dun04' && posicao(w)?.mapa==='prontera') return entrarBio4(w);

    const pesquisar = () => [...w.document.querySelectorAll('input')].find(i => visivel(i) && /Buscar cidade, mapa/.test(i.placeholder || ''));

    const tentarEntrar = async (limparFiltros) => {
      if (!pesquisar()) {
        const mapa = w.document.querySelector('button[aria-label="Mundo de Midgard"]') || botaoPorTexto(w.document, t => /Mundo de Midgard/i.test(t));
        if (!mapa) { log('Mapa: botao Mundo de Midgard nao encontrado'); return false; }
        mapa.click();
        await esperar(500);
      }
      let input = await esperarAte(pesquisar, 8000);
      if (!input) { diagTela('mapa-busca'); log('Mapa: pesquisa do mapa-mundi nao abriu'); return false; }
      if (limparFiltros) {
        const todos = botaoPorTexto(w.document, t => /^Todos \(\d+\)$/.test(t));
        if (todos) { todos.click(); await esperar(300); }
        const limpar = botaoPorTexto(w.document, t => /^Limpar filtros$/i.test(t));
        if (limpar) { limpar.click(); await esperar(300); }
        input = await esperarAte(pesquisar, 2000);
        if (!input) { log('Mapa: campo de pesquisa indisponivel apos limpar filtros'); return false; }
      }
      input.focus();
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, '');
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
      await esperar(200);
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, codigo);
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
      input.dispatchEvent(new w.Event('change', { bubbles: true }));
      await esperar(500);

      const entrar = await esperarAte(() => entradaDoMapaPesquisado(w, codigo), 10000);
      if (!entrar) { log('Mapa: entrada de ' + codigo + ' nao apareceu na busca'); return false; }
      if (entradaDoMapaPesquisado(w, codigo) !== entrar) { log('Mapa: resultado da busca mudou antes do clique'); return false; }

      const antes = new WeakSet();
      w.document.querySelectorAll('button').forEach(b => { if (visivel(b)) antes.add(b); });

      log('Mapa de farm: pesquisa exata ' + codigo + '; clicando Entrar');
      try {
        if (!clicarBotao(w, entrar)) { log('Mapa: botão Entrar sumiu antes do clique'); return false; }
      } catch (e) { log('Mapa: erro ao clicar Entrar: ' + String(e).slice(0, 60)); return false; }

      const resultado = await esperarAte(() => {
        if (posicao(w)?.mapa === codigo) return 'chegou';
        const novos = [...w.document.querySelectorAll('button')].filter(b =>
          !antes.has(b) && visivel(b) && !b.disabled &&
          /^(Confirmar|Viajar|Ir agora|Teleportar|OK)$/i.test(textoDe(b))
        );
        return novos.length ? { confirmar: novos[0] } : null;
      }, 15000, 250);

      if (resultado === 'chegou') { log('Mapa: teleporte confirmado'); return true; }

      if (resultado?.confirmar) {
        const txt = textoDe(resultado.confirmar);
        log('Mapa: modal detectado ("' + txt.slice(0, 30) + '"); clicando');
        try { clicarBotao(w, resultado.confirmar); } catch (e) { log('Mapa: erro: ' + String(e).slice(0, 60)); }
        const chegou = await esperarAte(() => posicao(w)?.mapa === codigo, 40000, 250);
        if (chegou) { log('Mapa: teleporte confirmado apos modal'); return true; }
        log('Mapa: modal clicado, mas o mapa nao mudou em 40 s');
        return false;
      }

      log('Mapa: nenhum modal; aguardando teleporte');
      const chegou = await esperarAte(() => posicao(w)?.mapa === codigo, 40000, 250);
      if (chegou) { log('Mapa: teleporte confirmado'); return true; }
      const erro = normalizar(w.document.body.innerText || '').match(/zeny insuficiente|peso (?:excedido|acima do limite)|entrada (?:bloqueada|indisponivel)|nao (?:pode|e possivel) (?:entrar|teleportar)/i);
      if (erro) log('Mapa: possivel bloqueio: "' + erro[0] + '"');
      log('Mapa: chegada a ' + codigo + ' sem confirmação após 40 s; mapa atual ' + (posicao(w)?.mapa || 'indisponível'));
      diagTela('mapa-sem-teleporte');
      return false;
    };

    for (let i = 1; i <= 2; i++) {
      if (!cfg.ligado) { log('Entrada em ' + codigo + ' interrompida: Auto-voltar desligado'); return false; }
      if (!await pesoSeguroParaVoltar(w)) return false;
      if (!await fecharLoja(w))
        return segurarRetorno(w, 'Loja de Suprimentos reabriu antes da tentativa de retorno; mapa-múndi não acionado');
      etapa('8/8 Voltando ao mapa', 'Tentativa ' + i + '/2: ' + codigo);
      if (await tentarEntrar(i === 1)) {
        delete cfg.retornoPendente; salvarCfg();
        log('Retorno confirmado: ' + codigo);
        await religarEconomia(w);
        return true;
      }
      if (i === 1) {
        log('Mapa: 1a tentativa falhou; fechando e tentando de novo');
        apertarEsc(w);
        await esperar(1000);
      }
    }
    return segurarRetorno(w, 'entrada em ' + codigo + ' sem confirmacao apos 2 tentativas; nao repetirei a cobranca');
  };

  const TENTATIVAS_VOLTAR = 3;
  const VIGIA_INTERVALO_MS = 120000;
  let vigia = null;

  const voltarComInsistencia = async (w) => {
    const cidade = posicao(w)?.mapa;
    for (let i = 1; i <= TENTATIVAS_VOLTAR; i++) {
      if (await voltarAoMapa(w)) { vigia = null; return true; }
      if (!cfg.ligado) { vigia = null; return false; }
      if (vigia?.refazerCidade) return false;
      if (cidade && posicao(w)?.mapa && posicao(w).mapa !== cidade) { vigia = null; return validarChegadaFarm(w); }
      if (i < TENTATIVAS_VOLTAR) await esperar(5000);
    }
    vigia = { cidade, ultimaEm: Date.now() };
    log(`Mapa: ${TENTATIVAS_VOLTAR} tentativas falharam; tento de novo a cada 2 min enquanto estiver na cidade`);
    return false;
  };

  const rondaDaVigia = async (w) => {
    const p = posicao(w);
    if (!p?.mapa) return;
    if (p.mapa !== vigia.cidade) { vigia = null; return; }
    if (Date.now() - vigia.ultimaEm < VIGIA_INTERVALO_MS) return;
    ocupado = true;
    try {
      vigia.ultimaEm = Date.now();
      log('Vigia: ainda na cidade, tentando voltar ao mapa');
      const retomar = vigia.retomarAutopilot;
      const voltou = vigia.refazerCidade
        ? await rotinaDaCidade(w, retomar, true)
        : await voltarAoMapa(w);
      if (voltou) {
        vigia = null;
        if (retomar && cfg.ligado) await retomarCacada(w);
      }
    } catch (e) {
      log(`erro na vigia: ${String(e?.message || e).slice(0, 120)}`);
    } finally {
      ocupado = false;
    }
  };

  let ocupado = false;

  setInterval(() => {
    try {
      if (!rifaRodando && (ocupado || vigia || chegadaAtrasada || recuperacao || cfg.retornoPendente)) window.top.__FZN_ECONOMIA_YGG__?.acordar('autovoltar', 1500);
    } catch {}
  }, 250);

  const mapaDeRenascer = (p) => {
    const mapa = normalizar(p?.mapa || ''), nome = normalizar(p?.nome || '');
    return (cfg.conteudo?.modo === 'lhz' && mapaConfereConteudo(mapa)) || /^lhz_dun04/.test(mapa) || /chef/.test(mapa) || mapaCheffenia(mapa) || mapa.includes('@') || /inv$/.test(mapa) || /chefenia|instancia|covil|invas|maldicao/.test(nome);
  };
  instanciaAutoVoltar.controlaRenascimento = (mapa) => cfg.ligado && mapaDeRenascer({ mapa });
  const estadosRenascer = new WeakMap();
  const prepararRenascer = (w) => {
    const ui = w.__elragUI;
    if (ui && ui.updateEscapeSnapshot?.__fznRenascer !== instanciaAutoVoltar) {
      const original = ui.updateEscapeSnapshot;
      const gancho = function (snapshot) {
        estadosRenascer.set(w, snapshot);
        return typeof original === 'function' ? original.apply(this, arguments) : undefined;
      };
      gancho.__fznRenascer = instanciaAutoVoltar;
      ui.updateEscapeSnapshot = gancho;
    }
    // openEscape republica o snapshot com hasLeaf e o prazo real do servidor.
    // Nao troca de mapa nem recarrega a sessao.
    try { w.__elragEngine.openEscape?.(); } catch {}
    return estadosRenascer.get(w);
  };
  const renascerNoLugar = async (w) => {
    if (!morteConfirmada(w)) return;
    if (mapaCovil(posicao(w)) || covil.mortePendente) return renascerNoCovil(w);
    ocupado = true;
    try {
      const p = posicao(w);
      await sairDaEconomia(w);
      const fim = Date.now() + 120000;
      let ultimoPedido = 0, aviso = '';
      while (cfg.ligado && !cancelando() && Date.now() < fim && posicao(w)?.mapa === p?.mapa) {
        if (!morteConfirmada(w)) {
          await retomarCacada(w);
          log('Renascer: vida confirmada e cacada retomada no mesmo mapa ' + p.mapa);
          return;
        }
        const estado = prepararRenascer(w);
        const botao = botaoPorTexto(w.document, (t) => /^Renascer agora/i.test(t));
        const liberado = estado?.isDead === true && estado.hasLeaf === true &&
          Number(estado.reviveAvailableAt) > 0 && Number(estado.reviveAvailableAt) <= Date.now();
        if ((botao || liberado) && Date.now() - ultimoPedido >= 1500) {
          ultimoPedido = Date.now();
          log('Morreu em ' + p.mapa + ': usando Folha para Renascer agora, sem sair do mapa');
          if (liberado && typeof w.__elragEngine.reviveNow === 'function') w.__elragEngine.reviveNow();
          else if (botao) botao.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: w }));
          await esperarAte(() => posicao(w)?.mapa !== p.mapa || !morteConfirmada(w), 6000, 200);
          continue;
        }
        const motivo = estado?.hasLeaf === false ? 'Aguardando Folha/reconhecimento do servidor' : 'Aguardando liberar Renascer agora';
        if (aviso !== motivo) { aviso = motivo; etapa('Renascer no mapa', motivo + '; nao volto ao ponto de salvamento'); }
        await esperar(250);
      }
      log(posicao(w)?.mapa !== p?.mapa
        ? 'Renascer: mapa mudou de ' + p?.mapa + ' para ' + posicao(w)?.mapa + '; retorno pelo NPC se necessario'
        : 'Renascer ainda indisponivel em ' + p?.mapa + '; continuo no mapa, sem salvamento nem recarga');
    } catch (e) {
      log('Renascer: erro ' + String(e?.message || e).slice(0, 100));
    } finally {
      ocupado = false;
    }
  };

  const aoMorrer = async (w, botaoSalvamento) => {
    if (!morteConfirmada(w)) return;
    if (mapaCovil(posicao(w)) || covil.mortePendente) {
      if (!ocupado) await renascerNoCovil(w);
      return;
    }
    if (mapaDeRenascer(posicao(w))) return renascerNoLugar(w);
    ocupado = true;
    try {
      const retomar = autopilotLigado(w) || !!botaoHunt(w, true);
      retomadaPlanejada.set(w, retomar);
      if (!await pausarCacada(w)) { segurarRetorno(w, 'nao consegui pausar a cacada antes de renascer'); return; }
      if (await sairDaEconomia(w)) botaoSalvamento = botaoPorTexto(w.document, (t) => t === 'Voltar ao ponto de salvamento') || botaoSalvamento;
      const antes = posicao(w);
      if (!cfg.mapaFarmManual && !cfg.destinoFarm?.mapa) registrarDestinoFarm(w);
      log(`Morreu${antes ? ` em ${antes.nome}` : ''}. Voltando ao ponto de salvamento`);
      botaoSalvamento.click();
      contarQuadros(w, 2000).then((n) => log(`Quadros do jogo: ${n} em 2 s (${espelhados.has(w) ? 'espelhado' : 'NAO espelhado'})`));
      const chegou = await esperarAte(() => {
        const p = posicao(w);
        return p && antes && (p.mapa !== antes.mapa || p.x !== antes.x || p.y !== antes.y);
      }, 30000, 500);
      if (!chegou) {
        chegadaAtrasada = { mapaMorte: antes?.mapa || '', desde: Date.now(), retomarAutopilot: retomar };
        log('Nao chegou na cidade em 30 s; sigo conferindo a chegada e a tela de morte');
        return;
      }
      await rotinaDaCidade(w, retomar);
    } catch (e) {
      log(`erro: ${String(e?.message || e).slice(0, 120)}`);
    } finally {
      ocupado = false;
    }
  };
  let ponteMorteJanela = null, ultimaPonteMorte = 0, ultimaAberturaMenuMorte = 0;
  let morteSemDialogoJanela = null, morteSemDialogoDesde = 0, morteSemDialogoAviso = 0;
  const hpMortal = (w) => {
    const texto = w.document.body?.innerText || '';
    const hp = /\bHP\s*([\d.]+)\s*\/\s*([\d.]+)\s*([\d.,]+)\s*%/i.exec(texto);
    if (!hp) return false;
    const atual = Number(hp[1].replace(/\./g, ''));
    const maximo = Number(hp[2].replace(/\./g, ''));
    const percentual = Number(hp[3].replace(',', '.'));
    return maximo > 1 && atual <= 1 && percentual <= 0.1;
  };
  const morteConfirmada = (w) => {
    try {
      const eu = w.__fznEu?.() || w.__fznAutoVoltarEu?.();
      if ((eu?.ACTION && eu.action === eu.ACTION.DIE) || eu?.isDead?.()) return true;
    } catch {}
    if (w !== ponteMorteJanela || (!w.__fznAutoVoltarEu && Date.now() - ultimaPonteMorte > 5000)) {
      ponteMorteJanela = w;
      ultimaPonteMorte = Date.now();
      try {
        const script = w.document.createElement('script'); script.type = 'module';
        script.textContent = "import('Engine/SessionStorage.js').then(m=>{window.__fznAutoVoltarEu=()=>m.default.Entity;}).catch(()=>{});";
        w.document.head.appendChild(script);
      } catch {}
    }
    // O menu comum também oferece Renascer agora e salvamento a personagens
    // vivos. Esses botões não comprovam morte e não autorizam gastar Folha.
    return hpMortal(w);
  };
  const recuperarMorteSemDialogo = (w) => {
    if (mapaDeRenascer(posicao(w))) { if (!ocupado) void renascerNoLugar(w); return; }
    if (morteSemDialogoJanela !== w) { morteSemDialogoJanela = w; morteSemDialogoDesde = 0; }
    if (!morteSemDialogoDesde) morteSemDialogoDesde = Date.now();
    if (Date.now() - morteSemDialogoDesde < 8000) { abrirMenuMorte(w); return; }
    // O cliente pode deixar HP em 1/0,0% e exibir o menu comum. Nessa
    // dessincronia nao existe botao de salvamento; recarregar apenas o jogo
    // permite ao auto login retomar o personagem sem limpar cache/configuracao.
    const chave = 'fzn-autovoltar-reload-morte';
    let ultimo = 0;
    try { ultimo = Number(w.sessionStorage.getItem(chave)) || 0; } catch {}
    if (ultimo && Date.now() - ultimo < 120000) {
      if (Date.now() - morteSemDialogoAviso > 30000) {
        morteSemDialogoAviso = Date.now();
        log('HP em 0%, mas o jogo nao abriu o menu de morte; aguardando nova tentativa de recarga');
      }
      return;
    }
    try {
      w.sessionStorage.setItem(chave, String(Date.now()));
      log('HP em 0% sem opcoes de renascimento; recarregando somente o jogo para recuperar a sessao');
      w.location.reload();
      morteSemDialogoDesde = Date.now();
    } catch (e) { log('Morte: falha ao recarregar o jogo: ' + String(e).slice(0, 100)); }
  };
  const abrirMenuMorte = (w) => {
    if (Date.now() - ultimaAberturaMenuMorte < 3000) return;
    if (/Voltar ao ponto de salvamento/.test(w.document.body?.innerText || '')) return;
    const menu = w.document.querySelector('button[aria-label="Menu"]') || botaoPorTexto(w.document, (t) => /^Menu$/i.test(t));
    if (!menu) { log('Morte detectada, mas o botao Menu nao apareceu; tentarei novamente'); return; }
    ultimaAberturaMenuMorte = Date.now();
    menu.click();
    log('Morte detectada: abrindo Menu para voltar ao ponto de salvamento');
  };

  const interromperTudo = () => {
    canceladoAte = Date.now() + 15000;
    cfg.ligado = false; salvarCfg();
    ocupado = false; recuperacao = null; vigia = null; chegadaAtrasada = null;
    const w = jogo();
    if (w) { for (const fn of ['closeStorage', 'closeNpcStore', 'cancelNpcDialog']) { try { w.__elragEngine?.[fn]?.(); } catch {} } }
    etapa('Desligado', 'Processo interrompido pelo usuario');
    log('DESLIGADO: processo interrompido na hora (nada mais sera vendido, comprado ou guardado)');
    atualizarPainel();
  };
  const rotinaDaCidade = async (w, retomarAutopilot = false, viagemPorPeso = false) => {
    const retomar = retomarAutopilot || autopilotLigado(w) || !!botaoHunt(w, true);
    retomadaPlanejada.set(w, retomar);
    if (cfg.conteudo?.modo === 'bio4' || cfg.conteudo?.modo === 'lhz') {
      log(nomeConteudo() + ': retorno direto pelo NPC; storage, venda e demais servicos da cidade ignorados');
      const voltou = await voltarAoMapa(w);
      if (voltou && retomar && cfg.ligado) await retomarCacada(w);
      return voltou;
    }
    if (!await pausarCacada(w)) return segurarRetorno(w, 'nao consegui pausar a cacada na cidade');
    let ultimaCelula = '', amostras = 0;
    if (!await esperarAte(() => {
      const p = posicao(w), atual = p && chaveCelula(p);
      if (!atual || !canvasDoJogo(w)) return false;
      amostras = atual === ultimaCelula ? amostras + 1 : 0; ultimaCelula = atual;
      return amostras >= 2;
    }, 10000, 150)) return segurarRetorno(w, 'personagem ainda carregando ou andando na cidade');
    await sairDaEconomia(w);
    const forcada = vendaForcada.has(w); vendaForcada.delete(w);
    const pesoAlto = async () => { await lerMochila(w); await esperar(500); const p = lerPeso(w); return !p || p.pct >= limiteSeguro(); };
    const pesoAltoNaChegada = await pesoAlto();
    etapa('4/8 Kafra na cidade', 'Cura e deposito dos itens protegidos');
    if (!await fecharArmazem(w)) return segurarRetorno(w, 'armazem nao fechou antes de falar com a Kafra');
    if (cfg.curarNaKafra) await curarNaKafra(w);
    else log('Kafra: cura pulada porque está desativada nos ajustes');
    if (cfg.ferreiro) {
      etapa('5/8 Ferreiro', 'Desmantelando equipamentos da mochila');
      let desmantelamentoOk = false;
      try { desmantelamentoOk = await desmantelarNoFerreiro(w); }
      catch (e) { log('Ferreiro: falha — ' + String(e?.message || e).slice(0, 100)); }
      await fecharFerreiro(w);
      if (!desmantelamentoOk) {
        vigia = { cidade: posicao(w)?.mapa || 'prontera', ultimaEm: Date.now(), refazerCidade: true, retomarAutopilot: retomar };
        etapa('Vigia', 'Ferreiro nao concluiu; venda suspensa. Tento novamente na cidade em 2 min');
        log('Ferreiro nao concluiu: nao vendo antes de desmantelar nem pago nova entrada no mapa');
        return false;
      }
    }
    const deposito = await guardarProtegidos(w, true, guardarTudo());
    if (!deposito.ok) log('Armazem na cidade: ' + deposito.motivo);
    fezReducao.add(w);
    if (!cfg.ligado) { etapa('Rotina interrompida', 'Auto-voltar desligado após o depósito, antes da venda e do retorno'); return false; }
    const venderNestaVisita = (deposito.cheio && itensVendaveis()) ||
      (!guardarTudo() && cfg.venda.ligado &&
      (forcada || pesoAltoNaChegada || ((!cfg.armazem.tudoNoMapa) && viagemPorPeso) || await pesoAlto()));
    if (venderNestaVisita) {
      etapa('5/8 Vendendo', 'Vendendo somente os itens permitidos na configuracao');
      let vendaConcluida = await venderItens(w);
      if (vendaConcluida && await pesoAlto() && itensVendaveis()) {
        log('Peso ainda alto e ha itens vendaveis; mais uma rodada de venda');
        vendaConcluida = await venderItens(w);
      }
      if (!vendaConcluida) {
        vendaForcada.add(w);
        vigia = { cidade: posicao(w)?.mapa || 'prontera', ultimaEm: Date.now(), refazerCidade: true, retomarAutopilot: retomar };
        etapa('Vigia', 'Venda nao confirmada; tento novamente na cidade em 2 min');
        log('Venda nao concluiu: mantenho o personagem na cidade para repetir sem pagar outra entrada');
        return false;
      }
    } else {
      log('Venda pulada: ' + (guardarTudo() ? 'modo Guardar tudo ativo' : !cfg.venda.ligado ? 'venda desativada nos ajustes' : 'peso abaixo do limite e venda não programada para esta visita'));
    }
    if (!deposito.ok) return segurarRetorno(w, 'nao consegui guardar todos os protegidos: ' + deposito.motivo);
    if (cfg.comprar && !guardarTudo()) {
      try { await retirarDoArmazem(w); } catch (e) { if (cancelando()) throw e; log('Armazem: falha ao retirar — ' + String(e?.message || e).slice(0, 100)); await fecharArmazem(w); }
      etapa('6/8 Comprando', 'Repondo os itens da lista de Compras');
      try { await comprarItens(w); }
      catch (e) {
        if (cancelando()) throw e;
        log('Loja: reposição interrompida por erro: ' + String(e?.message || e).slice(0, 120));
      }
    } else {
      log('Compras puladas: ' + (guardarTudo() ? 'modo Guardar tudo ativo' : 'reposição desligada nos ajustes'));
    }
    const voltou = await voltarComInsistencia(w);
    if (voltou && retomar && cfg.ligado) {
      await retomarCacada(w);
    } else if (voltou) {
      etapa('Concluído', 'Mapa confirmado; retomada da caça pulada porque ' + (cfg.ligado ? 'Hunt e Autopilot já estavam desligados antes da rotina' : 'Auto-voltar foi desligado'));
    } else if (!voltou && cfg.ligado) {
      if (vigia) vigia.retomarAutopilot = retomar;
    }
    return voltou;
  };

  let chegadaAtrasada = null;
  const CHEGADA_MAX_MS = 90 * 1000;

  const rondaDaRecuperacao = async (w) => {
    if (tempoConteudoEsgotado()) { recuperacao = null; return; }
    const r = recuperacao;
    const espera = r.tentativas < 5 ? 20000 : 120000;
    if (Date.now() - r.ultimaEm < espera) return;
    const p = posicao(w);
    r.ultimaEm = Date.now();
    if (!p?.mapa) { log('Recuperando: personagem fora do mapa; aguardo'); return; }
    ocupado = true;
    try {
      r.tentativas++;
      if (r.fimConteudo && mapaDeRenascer(p)) {
        // A saída pode chegar depois do contador zero; não rearmar o conteúdo.
        if (!await sairParaRifa(w)) return;
        recuperacao = null;
        await rotinaDaCidade(w, r.retomarAutopilot);
        return;
      }
      if (cfg.conteudo?.modo === 'bio4' || cfg.conteudo?.modo === 'lhz') {
        recuperacao = null;
        const voltou = await voltarAoMapa(w);
        if (voltou) { if (r.retomarAutopilot && cfg.ligado) await retomarCacada(w); }
        else if (!recuperacao && !tempoConteudoEsgotado()) recuperacao = { ...r, ultimaEm: Date.now() };
        return;
      }
      const destino = mapaDoConteudo() || cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
      if (destino && (p.mapa === destino || mapaConfereConteudo(p.mapa))) {
        log('Recuperando (' + r.tentativas + '): ja estou no mapa de farm; religando a cacada');
        recuperacao = null;
        if (await fecharArmazem(w)) {
          if (botaoHunt(w, false)) huntsPausados.add(w);
          await retomarCacada(w);
          etapa('Aguardando', 'Recuperado no mapa ' + p.mapa);
        }
        return;
      }
      if (mapaDeRenascer(p)) {
        log('Recuperando (' + r.tentativas + '): em ' + p.mapa + ' (mapa protegido); fico aqui e religo a cacada');
        recuperacao = null;
        delete cfg.retornoPendente; salvarCfg();
        if (await fecharArmazem(w)) {
          if (botaoHunt(w, false)) huntsPausados.add(w);
          await retomarCacada(w);
          etapa('Aguardando', 'Recuperado no mapa ' + p.mapa);
        }
        return;
      }
      // v2.52: peso e mochila tranquilos -> volta direto (Bio4 pelo Porteiro), sem refazer a cidade
      const pesoAgora = lerPeso(w);
      if (normalizar(p.mapa) === 'prontera' && !cfg.retornoEvento && destino && !r.atalhoFalhou &&
          pesoAgora && pesoAgora.pct < limiteSeguro() - 5 && !mochilaCheia(w)) {
        log('Recuperando (' + r.tentativas + '): em Prontera com peso ' + pesoAgora.pct.toFixed(0) + '%; volta direta a ' + destino);
        recuperacao = null;
        const voltou = await voltarAoMapa(w);
        if (voltou) { if (r.retomarAutopilot) await retomarCacada(w); }
        else if (!recuperacao) recuperacao = { ...r, atalhoFalhou: true, ultimaEm: Date.now() - 45000 };
        else recuperacao.atalhoFalhou = true;
        return;
      }
      if (normalizar(p.mapa) === 'prontera') {
        log('Recuperando (' + r.tentativas + '): em Prontera; refazendo Kafra, venda e volta');
        recuperacao = null;
        const voltou = await rotinaDaCidade(w, r.retomarAutopilot, true);
        if (!voltou && !recuperacao) recuperacao = { ...r, ultimaEm: Date.now() };
        return;
      }
      log('Recuperando (' + r.tentativas + '): em ' + p.mapa + '; voltando ao mapa de farm');
      recuperacao = null;
      const voltou = await voltarAoMapa(w);
      if (voltou) { if (r.retomarAutopilot) await retomarCacada(w); }
      else if (!recuperacao && !tempoConteudoEsgotado()) recuperacao = { ...r, ultimaEm: Date.now() };
    } catch (e) {
      log('erro na recuperacao: ' + String(e?.message || e).slice(0, 120));
      if (!recuperacao) recuperacao = { ...r, ultimaEm: Date.now() };
    } finally {
      ocupado = false;
      atualizarPainel();
    }
  };

  const conferirChegadaAtrasada = async (w) => {
    const p = posicao(w);
    if (Date.now() - chegadaAtrasada.desde > CHEGADA_MAX_MS) {
      log('Chegada atrasada: 90 s sem mudar de mapa; vou conferir novamente o destino');
      chegadaAtrasada = null;
      return;
    }
    if (!p?.mapa || p.mapa === chegadaAtrasada.mapaMorte) return;
    const retomar = chegadaAtrasada.retomarAutopilot;
    chegadaAtrasada = null;
    ocupado = true;
    try {
      log(`Chegou atrasado em ${p.nome || p.mapa}; seguindo com Kafra e volta`);
      await rotinaDaCidade(w, retomar);
    } catch (e) {
      log(`erro: ${String(e?.message || e).slice(0, 120)}`);
    } finally {
      ocupado = false;
    }
  };

  const COVIS = [
    [20419,'Rigid Muspellskoll',5,'muspellskoll_covil:31'], [20601,'Jewel Ungoliant',5,'ungoliant_covil:32'], [3220,'Guillotine Cross Eremes',5,'nightmare_biolab_covils:33'],
    [3221,'Arch Bishop Margaretha',5,'nightmare_biolab_covils:34'], [3222,'Ranger Cecil',5,'nightmare_biolab_covils:35'], [3223,'Mechanic Howard',5,'nightmare_biolab_covils:36'],
    [3224,'Warlock Kathryne',5,'nightmare_biolab_covils:37'], [3225,'Rune Knight Seyren',5,'nightmare_biolab_covils:38'], [3240,'Royal Guard Randel',5,'nightmare_biolab_covils:39'],
    [3241,'Genetic Flamel',5,'nightmare_biolab_covils:40'], [3242,'Sorcerer Celia',5,'nightmare_biolab_covils:41'], [3243,'Sura Chen',5,'nightmare_biolab_covils:42'],
    [3244,'Shadow Chaser Gertie',5,'nightmare_biolab_covils:43'], [3245,'Minstrel Alphoccio',5,'nightmare_biolab_covils:44'], [3246,'Wanderer Trentini',5,'nightmare_biolab_covils:45'],
    [1583,'Tao Gunka',4,'taogunka_covil:9'], [1312,'Turtle General',4,'turtlegeneral_covil:10'], [2202,'Kraken',4,'kraken_covil:19'],
    [1685,'Vesper',4,'vesper_covil:21'], [1623,'RSX-0806',4,'rsx_covil:22'], [1658,'Egnigem Cenia',4,'egnigem_covil:23'],
    [1719,'Detardeurus',4,'detardeurus_covil:24'], [1768,'Gloom Under Night',4,'gloom_covil:25'], [1785,'Atroce',4,'atroce_covil:26'],
    [1832,'Ifrit',4,'ifrit_covil:27'], [1734,'Kiel D-01',4,'kiel_covil:28'], [1871,'Bispo Decadente',4,'falling_bishop_covil:46'],
    [1874,'Belzebu',4,'beelzebub_covil:47'], [2109,'Valkyrie Randgris',4,'valkyrie_randgris_covil:48'], [1492,'Samurai Encarnado',4,'incantation_samurai_covil:56'],
    [1418,'Serpente Suprema',4,'evil_snake_lord_covil:57'], [1917,'Morroc Ferido',4,'wounded_morocc_covil:58'], [2022,'Nidhogg Sombrio',4,'nidhogg_shadow_covil:59'],
    [2087,'Rainha Scaraba',4,'queen_scaraba_covil:60'], [1038,'Osiris',3,'osiris_covil:3'], [1150,'Moonlight Flower',3,'moonlight_covil:5'],
    [1389,'Dracula',3,'dracula_covil:6'], [1039,'Baphomet',3,'baphomet_covil:7'], [1046,'Doppelganger',3,'doppelganger_covil:8'],
    [1511,'Amon Ra',3,'amonra_covil:14'], [1159,'Phreeoni',3,'phreeoni_covil:15'], [1059,'Mistress',3,'mistress_covil:16'],
    [1157,'Pharaoh',3,'pharaoh_covil:17'], [1112,'Drake',3,'drake_covil:18'], [1272,'Dark Lord',3,'darklord_covil:20'],
    [1779,'Ktullanux',3,'ktullanux_covil:29'], [1708,'Thanatos',3,'thanatos_covil:30'], [1251,'Stormy Knight',3,'stormy_knight_covil:49'],
    [1373,'Lord of Death',3,'lord_of_death_covil:50'], [1688,'Lady Tanee',3,'lady_tanee_covil:51'], [2068,'Boitatá',3,'boitata_covil:52'],
    [1885,'Gorynych',3,'gorynych_covil:53'], [1630,'Lady Branca',3,'white_lady_covil:54'], [1252,'Hatii',3,'hatii_covil:55'],
    [1086,'Golden Thief Bug',2,'gtb_covil:2'], [1147,'Maya',2,'maya_covil:4'], [1087,'Orc Hero',2,'orchero_covil:11'],
    [1190,'Orc Lord',2,'orclord_covil:12'], [1115,'Eddga',2,'eddga_covil:13'], [3810,'Rei Poring',1,'vila_poring:1'],
  ].map(([mobId, nome, tier, codigo]) => ({ mobId, nome, tier, codigo }));
  const GRAU = ['', 'I', 'II', 'III', 'IV', 'V'];
  cfg.covil = Object.assign({ ligado: false, mobId: 1312, dia: '', hoje: 0, total: 0, mortesHoje: 0 }, cfg.covil || {});
  const covilAlvo = () => COVIS.find((c) => c.mobId === Number(cfg.covil.mobId)) || COVIS.find((c) => c.mobId === 1312);
  const pedraDoCovil = (c) => 'Pedra de Convocação (Grau ' + GRAU[c.tier] + ')';
  // A reaplicação do Hub corta timers, mas o encontro no jogo continua.
  // Compartilhar a tentativa mantém GID/abate inclusive nos ganchos anteriores.
  const covil = window.__fznCovilEstado || { dentro: false, entrouEm: 0, viuEm: 0, viu: false, falhas: 0, lutaEm: 0 };
  window.__fznCovilEstado = covil;
  covil.ganchoAtivo = false; covil.ganchoTentouEm = 0; covil.renascendo = false;
  const COVIL_SEM_MVP_MS = 25000, COVIL_LOOT_MS = 1000, COVIL_TETO_MS = 28 * 60000;
  const contarCovil = (campo) => {
    const dia = new Date().toLocaleDateString('pt-BR');
    if (cfg.covil.dia !== dia) { cfg.covil.dia = dia; cfg.covil.hoje = 0; cfg.covil.mortesHoje = 0; }
    if (campo === 'kill') { cfg.covil.hoje++; cfg.covil.total++; } else cfg.covil.mortesHoje++;
    salvarCfg();
  };
  const emInstancia = (p) => String(p?.mapa || '').includes('@');
  const mapaCovil = (p) => /@tower$/i.test(String(p?.mapa || ''));
  const renascerNoCovil = async (w) => {
    if (!morteConfirmada(w)) return;
    if (covil.renascendo || Date.now() - (covil.renascerTentouEm || 0) < 3000) return;
    covil.mortePendente = true;
    covil.renascendo = true;
    covil.renascerTentouEm = Date.now();
    ocupado = true;
    const mapa = posicao(w)?.mapa;
    try {
      if (!mapaCovil({ mapa })) {
        etapa('Covil', 'Morte pendente fora da instância; retorno ao salvamento bloqueado');
        return;
      }
      const achar = () => botaoPorTexto(w.document, t => /^Renascer agora\b/i.test(t));
      if (!achar()) abrirMenuMorte(w);
      const botao = await esperarAte(achar, 3000, 200);
      if (!botao || botao.disabled || botao.getAttribute('aria-disabled') === 'true') {
        etapa('Covil', 'Aguardando Renascer agora com Folha de Yggdrasil; permaneço no covil');
        return;
      }
      if (posicao(w)?.mapa !== mapa || !morteConfirmada(w)) return;
      log('Covil: usando Renascer agora com Folha de Yggdrasil, sem sair da instância');
      // O .click() global redireciona por coordenadas e emite vários eventos.
      // Aqui só o botão de renascer pode receber um único click.
      botao.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: w }));
      const vivo = await esperarAte(() => posicao(w)?.mapa === mapa && !morteConfirmada(w), 6000, 200);
      if (!vivo) {
        etapa('Covil', 'Renascimento ainda não confirmado no mesmo mapa; salvamento bloqueado');
        return;
      }
      covil.mortePendente = false;
      covil.morteRegistrada = false;
      if (huntsPausados.has(w)) { botaoHunt(w, false)?.click(); huntsPausados.delete(w); }
      const ok = await esperarAte(() => {
        if (posicao(w)?.mapa !== mapa || morteConfirmada(w)) return false;
        if (autopilotLigado(w)) return true;
        ligarAutopilot(w, true); return false;
      }, 6000, 300);
      log(ok ? 'Covil: renasceu no mesmo mapa; caça religada para terminar o MVP' : 'Covil: ' + motivoAutopilotParado(w) + ' após renascimento');
    } catch (e) {
      log('Covil: falha ao renascer; não saio da instância: ' + String(e?.message || e).slice(0, 100));
    } finally {
      covil.renascendo = false;
      ocupado = false;
    }
  };
  const gidDoMvp = (w, c) => {
    try { const m = (w.__elragEngine.getAutopilotRadarSnapshot()?.mobs || []).find((x) => x && Number(x.mobId) === c.mobId); return m ? m.gid : null; } catch { return null; }
  };
  const recuperarCovilParado = async (w, c) => {
    const agora = Date.now(), p = posicao(w);
    if (!mapaCovil(p) || morteConfirmada(w) || covil.mortePendente || covil.morteConfirmadaEm) return;
    let ap;
    try { ap = w.__elragEngine.getAutopilotSnapshot(); } catch { return; }
    if (!ap) return;
    // Nunca reiniciar durante ataque, conjuração ou deslocamento. O estado
    // Aguardando é confirmado pela interface, além de não haver alvo fixado.
    const ocioso = /Autopilot:\s*Aguardando/i.test(w.document.body?.innerText || '') && !Number(ap.targetGid);
    const chave = p.mapa + ':' + p.x + ':' + p.y;
    if (!ocioso || covil.paradoChave !== chave) {
      covil.paradoChave = chave; covil.paradoDesde = agora; return;
    }
    if (agora - (covil.paradoDesde || agora) < 12000 || agora - (covil.recuperouEm || 0) < 15000) return;
    covil.recuperouEm = agora;
    const manager = await carregarEntidadesNpc(w);
    if (posicao(w)?.mapa !== p.mapa || morteConfirmada(w)) return;
    const atual = posicao(w);
    const apAtual = w.__elragEngine.getAutopilotSnapshot();
    if (atual?.x !== p.x || atual?.y !== p.y || Number(apAtual?.targetGid) ||
        !/Autopilot:\s*Aguardando/i.test(w.document.body?.innerText || '')) return;
    const entidade = covil.gid ? manager?.get?.(covil.gid) : null;
    // Um cadáver do GID acompanhado é evidência positiva caso o evento de
    // morte tenha ocorrido durante uma atualização. Radar vazio não é prova.
    if (covil.viu && entidade && Number(entidade._job || entidade.job || entidade.mobId) === c.mobId && entidade.isDead?.() === true) {
      covil.morteConfirmadaEm = Date.now(); covil.gidMorto = covil.gid;
      log('Covil: morte confirmada pela entidade do MVP; retomando conclusão');
      return;
    }
    let alvo = null;
    try { alvo = (w.__elragEngine.getAutopilotRadarSnapshot()?.mobs || []).find(m => Number(m?.mobId) === c.mobId); } catch {}
    if (!cfg.ligado || !cfg.covil.ligado || covil.mortePendente) return;
    if (alvo?.gid) {
      w.__elragEngine.setAutopilotPinnedTarget?.(alvo.gid);
      log('Covil: personagem parado sem alvo; fixei novamente ' + c.nome);
    } else {
      w.__elragEngine.setAutopilotPinnedTarget?.(0);
      ligarAutopilot(w, false);
      await esperar(600);
      if (!cfg.ligado || !cfg.covil.ligado || posicao(w)?.mapa !== p.mapa || morteConfirmada(w)) return;
      log('Covil: busca sem progresso; reiniciei o Autopilot dentro da instância');
    }
    ligarAutopilot(w, true);
    covil.paradoDesde = Date.now();
  };
  const mvpNoRadar = (w, c) => {
    try { return (w.__elragEngine.getAutopilotRadarSnapshot()?.mobs || []).some((m) => m && Number(m.mobId) === c.mobId); } catch { return false; }
  };
  // O radar deixa de listar monstros fora da tela. Só removeLife confirma a
  // morte; a ausência temporária do alvo nunca autoriza sair da instância.
  const ganchosMorteCovil = new WeakSet();
  const observarMorteCovil = async (w) => {
    const manager = await carregarEntidadesNpc(w);
    if (!manager || typeof manager.removeLife !== 'function') return false;
    if (ganchosMorteCovil.has(manager)) return true;
    const original = manager.removeLife;
    manager.removeLife = function (gid) {
      try {
        const mob = manager.get?.(gid);
        const mobId = Number(mob?._job || mob?.job || mob?.mobId || 0);
        const alvo = covilAlvo();
        // A entidade pode ser removida ao trocar de mapa ou sincronizar a cena.
        // Só aceitamos o GID que vimos vivo nesta entrada, depois de a luta começar.
        if (cfg.covil.ligado && covil.dentro && covil.viu && covil.gid && !covil.morteConfirmadaEm &&
            emInstancia(posicao(w)) && mobId === alvo.mobId &&
            Number(gid) === Number(covil.gid) && Date.now() - covil.entrouEm >= 3000) {
          covil.morteConfirmadaEm = Date.now();
          covil.gidMorto = Number(gid);
          log('Covil: morte de ' + alvo.nome + ' confirmada pelo jogo (GID ' + gid + ')');
        }
      } catch (e) { log('Covil: erro ao conferir morte: ' + String(e).slice(0, 80)); }
      return original.apply(this, arguments);
    };
    ganchosMorteCovil.add(manager);
    return true;
  };
  const clicarCompleto = (w, el) => {
    const r = el.getBoundingClientRect();
    const base = { bubbles: true, cancelable: true, composed: true, view: w, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    const alvo = w.document.elementFromPoint(base.clientX, base.clientY) || el;
    for (const tipo of ['pointerover', 'pointerenter', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Ev = tipo.startsWith('pointer') && w.PointerEvent ? w.PointerEvent : w.MouseEvent;
      try { alvo.dispatchEvent(new Ev(tipo, { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(tipo) ? 1 : 0 })); } catch {}
    }
    return alvo;
  };
  const sairDoCovil = async (w) => {
    if (covil.mortePendente || covil.renascendo || morteConfirmada(w)) return false;
    let foraVezes = 0;
    const fora = () => { const q = posicao(w); foraVezes = q?.mapa && !emInstancia(q) ? foraVezes + 1 : 0; return foraVezes >= 2; };
    if (fora() || (await esperar(300), fora())) return true;
    const docs = [w.document, document];
    const caixa = () => docs.some((d) => /Sair da inst[aâ]ncia/i.test(d.body?.innerText || ''));
    const acharSair = () => {
      const t = w.document.querySelector('[data-tutorial="sair-da-instancia"]');
      if (t && visivel(t)) {
         if (t.getAttribute('aria-disabled') === 'true' || t.style.pointerEvents === 'none') return null;
         return t;
      }
      const bTexto = [...w.document.querySelectorAll('button')].find((b) => visivel(b) && /sair/i.test(textoDe(b)) && !/Auto-voltar/i.test(textoDe(b)));
      if (bTexto) return bTexto;
      const bAria = [...w.document.querySelectorAll('button')].find((b) => visivel(b) && /sair/i.test(b.getAttribute('aria-label') || b.title || '') && !/Auto-voltar/i.test(b.getAttribute('aria-label') || b.title || ''));
      if (bAria) return bAria;
      const folha = [...w.document.querySelectorAll('div, span, button')].find((el) => visivel(el) && /^sair$/i.test(textoDe(el)) && !el.closest('[data-fzn-auto-voltar]') && ![...el.children].some((f) => /^sair$/i.test(textoDe(f))));
      if (!folha) return null;
      const proprio = folha.closest('button, [role="button"]');
      if (proprio) return proprio;
      for (let el = folha.parentElement, i = 0; el && i < 3; el = el.parentElement, i++) {
        const bs = [...el.querySelectorAll('button')].filter(visivel);
        if (bs.length === 1) return bs[0];
      }
      const r = folha.getBoundingClientRect();
      const perto = [...w.document.querySelectorAll('button.hud-focus')].filter(visivel)
        .map((b) => ({ b, d: Math.hypot(b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2 - (r.left + r.width / 2), b.getBoundingClientRect().bottom - r.top) }))
        .sort((a, b2) => a.d - b2.d)[0];
      return perto && perto.d < 60 ? perto.b : null;
    };
    const alvo = await esperarAte(acharSair, 5000);
    if (alvo && !covil.sairLogado) { covil.sairLogado = true; log('Covil: SAIR = ' + alvo.tagName.toLowerCase() + '.' + String(alvo.className || '').split(' ')[0] + ' [' + (textoDe(alvo) || alvo.getAttribute('aria-label') || alvo.title || 'sem texto').slice(0, 20) + ']'); }
    if (!alvo) {
      const botoes = [...w.document.querySelectorAll('button')].filter(visivel).map((b) => textoDe(b) || b.getAttribute('aria-label') || b.title || '?').slice(0, 20).join(' | ');
      log('Covil: botao SAIR da instancia nao encontrado. Botoes: ' + botoes.slice(0, 260));
      return false;
    }
    for (let i = 0; i < 3 && !caixa(); i++) {
      if (fora()) return true;
      if (i < 2) clicarCompleto(w, alvo); else alvo.click();
      await esperarAte(() => caixa() || fora(), 3000);
    }
    if (fora()) return true;
    const confirmar = await esperarAte(() => {
      for (const d of docs) {
        if (!/Sair da inst[aâ]ncia/i.test(d.body?.innerText || '')) continue;
        const b = [...d.querySelectorAll('button')].find((x) => visivel(x) && !x.disabled && /^sair$/i.test(textoDe(x)) && !x.contains(alvo) && !alvo.contains(x));
        if (b) return b;
      }
      return null;
    }, 5000);
    if (!confirmar) { if (fora()) return true; diagTela('covil-sair'); log('Covil: confirmacao "Sair da instancia?" nao apareceu'); return false; }
    confirmar.click();
    const saiu = await esperarAte(fora, 45000, 250);
    if (!saiu) { log('Covil: saida sem confirmacao em 45 s'); return false; }
    return true;
  };
  const entrarNoCovil = async (w, c) => {
    // Nunca convocar dentro da instância: a resposta pode atrasar e uma
    // saída de fallback acabaria abandonando o MVP recém-convocado vivo.
    if (emInstancia(posicao(w))) return false;
    // A convocação em grupo é recusada fora da cidade. Confirmar Prontera
    // antes de abrir a convocação evita ciclos de falha após outra rotina.
    if (posicao(w)?.mapa !== 'prontera' && !await sairParaRifa(w)) return false;
    const [base] = c.codigo.split(':');
    const pesquisar = () => [...w.document.querySelectorAll('input')].find((i) => visivel(i) && /Buscar cidade, mapa/.test(i.placeholder || ''));
    if (!pesquisar()) {
      const mapa = w.document.querySelector('button[aria-label="Mundo de Midgard"]') || botaoPorTexto(w.document, t => /Mundo de Midgard/i.test(t));
      if (!mapa) { log('Covil: botao Mundo de Midgard nao encontrado'); return false; }
      mapa.click();
    }
    let input = await esperarAte(pesquisar, 8000);
    if (!input) { diagTela('covil-mapa'); log('Covil: pesquisa do mapa-mundi nao abriu'); return false; }
    botaoPorTexto(w.document, (t) => /^Todos \(\d+\)$/.test(t))?.click();
    botaoPorTexto(w.document, (t) => /^Limpar filtros$/i.test(t))?.click();
    input = await esperarAte(pesquisar, 2000);
    if (!input) { log('Covil: campo de busca indisponível após limpar os filtros'); return false; }
    etapa('Covil', 'Pesquisando ' + c.codigo + ' (' + c.nome + ')');
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, base);
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    const opcao = await esperarAte(() => [...w.document.querySelectorAll('button')].find((b) => visivel(b) && textoDe(b).endsWith('#' + c.codigo)), 6000);
    if (opcao) opcao.click();
    const invocarDoAlvo = () => {
      const bs = [...w.document.querySelectorAll('button')].filter((b) => visivel(b) && !b.disabled && /^Invocar$/i.test(textoDe(b)));
      for (const b of bs) {
        for (let el = b.parentElement, i = 0; el && i < 6; el = el.parentElement, i++) {
          const t = textoDe(el);
          if (t.includes(c.nome) && /MVP ID/.test(t)) {
            const ids = [...t.matchAll(/MVP ID (\d+)/g)].map((m) => m[1]);
            if (ids.length === 1) return ids[0] === c.codigo.split(':')[1] ? b : null;
          }
        }
      }
      return bs.length === 1 ? bs[0] : null;
    };
    const invocar = await esperarAte(invocarDoAlvo, 8000);
    if (!invocar) { log('Covil: botao Invocar de ' + c.nome + ' nao apareceu'); return false; }
    if (!cfg.covil.ligado || !cfg.ligado || emInstancia(posicao(w))) {
      log('Covil: convocação cancelada antes do clique. ' + (!cfg.ligado ? 'Auto-voltar desligado' : !cfg.covil.ligado ? 'modo Covil desligado' : 'personagem já está em uma instância'));
      return false;
    }
    invocar.click();
    const convocar = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Convocar$/i.test(t)) || botaoPorTexto(document, (t) => /^Convocar$/i.test(t)), 5000);
    if (!convocar) { log('Covil: confirmacao "Convocar o MVP?" nao apareceu'); return false; }
    log('Covil: convocando ' + c.nome + ' (T' + c.tier + ', ' + pedraDoCovil(c) + ': ' + quantosNaMochila(pedraDoCovil(c)) + ')');
    if (emInstancia(posicao(w))) return false;
    convocar.click();
    const entrou = await esperarAte(() => emInstancia(posicao(w)), 30000, 250);
    if (!entrou) { log('Covil: entrada sem confirmacao em 30 s; nao repito a cobranca agora'); return false; }
    return true;
  };
  const voltarAoFarmDoCovil = (motivo) => {
    log('Covil: ' + motivo + '; desligo o Covil e volto ao mapa de farm');
    cfg.covil.ligado = false; salvarCfg();
    recuperacao = { motivo: 'fim do covil', desde: Date.now(), ultimaEm: Date.now() - 55000, tentativas: 0, retomarAutopilot: true };
    atualizarPainel();
  };
  const rodadaCovil = async (w) => {
    const c = covilAlvo();
    const p = posicao(w);
    if (!p?.mapa) return;
    ocupado = true;
    try {
      if (!covil.ganchoAtivo && Date.now() - (covil.ganchoTentouEm || 0) > 10000) {
        covil.ganchoTentouEm = Date.now();
        covil.ganchoAtivo = await observarMorteCovil(w);
        if (!covil.ganchoAtivo && !covil.ganchoAvisado) {
          covil.ganchoAvisado = true;
          log('Covil: sinal de morte indisponível; não sairei sem confirmação');
        }
      }
      if (emInstancia(p) && covil.dentro) {
        covil.foraDesde = 0;
        if (!autopilotLigado(w)) ligarAutopilot(w, true);
        await recuperarCovilParado(w, c);
        const agora = Date.now();
        if (!covil.morteConfirmadaEm && mvpNoRadar(w, c)) {
          covil.viu = true; covil.viuEm = agora; covil.gid = gidDoMvp(w, c);
          etapa('Covil', 'Lutando com ' + c.nome + ' (' + cfg.covil.hoje + ' hoje)'); return;
        }
        if (covil.morteConfirmadaEm && mvpNoRadar(w, c)) {
          log('Covil: MVP voltou ao radar; descartei a remoção anterior como morte');
          covil.morteConfirmadaEm = 0;
          covil.gidMorto = 0;
        }
        if (covil.morteConfirmadaEm && agora - covil.morteConfirmadaEm >= COVIL_LOOT_MS) {
          if (!covil.morto) {
            covil.morto = true;
            contarCovil('kill');
            log('Covil: ' + c.nome + ' derrotado em ' + Math.round((agora - covil.entrouEm) / 1000) + ' s (' + cfg.covil.hoje + ' hoje, ' + cfg.covil.total + ' no total, +' + c.tier * 100 + ' pontos)');
          }
          etapa('Covil', 'MVP derrotado; saindo da instância');
          if (!await sairDoCovil(w)) {
            covil.sairFalhas = (covil.sairFalhas || 0) + 1;
            if (covil.sairFalhas === 10) log('Covil: saída ainda não confirmou; mantenho a tentativa atual sem convocar outro MVP');
            return;
          }
          covil.sairFalhas = 0;
          covil.dentro = false;
          return;
        }
        if (!covil.viu && agora - covil.entrouEm > COVIL_SEM_MVP_MS && !covil.semMvpAvisado) {
          covil.semMvpAvisado = true; log('Covil: MVP ainda não apareceu no radar; aguardando dentro da instância');
        }
        if (agora - covil.entrouEm > COVIL_TETO_MS && !covil.tetoAvisado) {
          covil.tetoAvisado = true; log('Covil: 28 min sem morte confirmada; aguardando o limite do jogo, sem sair antes do MVP');
        }
        if (covil.morteConfirmadaEm) etapa('Covil', 'Morte confirmada; aguardando 1 s para o drop');
        else if (covil.viu) etapa('Covil', 'MVP fora do radar; continuo na instância aguardando confirmação');
        return;
      }
      if (emInstancia(p)) {
        covil.dentro = true; covil.entrouEm = Date.now(); covil.viu = false; covil.viuEm = 0; covil.gid = 0; covil.gidMorto = 0; covil.morteConfirmadaEm = 0; covil.morto = false; covil.foraDesde = 0;
        log('Covil: ja estou em ' + p.mapa + '; aguardo morte confirmada do MVP');
        return;
      }
      // Uma leitura transitória fora do mapa não inicia outra convocação.
      if (!covil.foraDesde) covil.foraDesde = Date.now();
      if (Date.now() - covil.foraDesde < 1000) return;
      covil.dentro = false; covil.viu = false; covil.gid = 0; covil.gidMorto = 0; covil.morto = false; covil.morteConfirmadaEm = 0;
      await lerMochila(w);
      const pedras = quantosNaMochila(pedraDoCovil(c));
      if (pedras <= 0 && itensMochila().length < 5) { diagTela('covil-mochila'); log('Covil: mochila nao foi lida (' + itensMochila().length + ' itens); tento de novo'); return; }
      if (pedras <= 0) { voltarAoFarmDoCovil('sem ' + pedraDoCovil(c) + ' na mochila'); return; }
      if (precisaVender(w)) {
        if (Date.now() - (covil.vendaTentouEm || 0) < 30000) {
          etapa('Covil', 'Aguardando nova verificação do peso antes da próxima convocação'); return;
        }
        covil.vendaTentouEm = Date.now();
        etapa('Covil', 'Liberando mochila; retomo o Covil automaticamente enquanto houver pedras');
        // viagemDeVenda controla o próprio bloqueio. Só é chamada fora da
        // instância, depois de sair do encontro anterior.
        ocupado = false;
        await viagemDeVenda(w, true, true);
        return;
      }
      etapa('Covil', 'Entrando: ' + c.nome + ' (' + pedras + ' pedras)');
      if (await entrarNoCovil(w, c)) {
        covil.dentro = true; covil.entrouEm = Date.now(); covil.viu = false; covil.gid = 0; covil.gidMorto = 0; covil.morto = false; covil.morteConfirmadaEm = 0; covil.semMvpAvisado = false; covil.tetoAvisado = false; covil.foraDesde = 0; covil.falhas = 0;
        ligarAutopilot(w, true);
        return;
      }
      covil.falhas++;
      if (covil.falhas >= 3) { covil.falhas = 0; voltarAoFarmDoCovil('3 entradas seguidas falharam'); }
    } catch (e) {
      log('Covil: erro ' + String(e?.message || e).slice(0, 100));
    } finally {
      ocupado = false;
    }
  };

  let cidadeSemRotinaDesde = 0;
  const vigiarCidadeSemRotina = (w) => {
    if (tempoConteudoEsgotado()) return false;
    const p = posicao(w);
    const naCidade = normalizar(p?.mapa || '') === 'prontera';
    const destino = mapaDoConteudo() || cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
    if (!naCidade || !destino || recuperacao || vigia || chegadaAtrasada || cfg.retornoPendente) {
      cidadeSemRotinaDesde = 0;
      return false;
    }
    if (!cidadeSemRotinaDesde) { cidadeSemRotinaDesde = Date.now(); return false; }
    if (Date.now() - cidadeSemRotinaDesde < (mapaDoConteudo() ? 1000 : 5000)) return false;
    cidadeSemRotinaDesde = 0;
    log('Prontera sem rotina ativa; retomando o retorno a ' + destino);
    etapa('Recuperando', cfg.conteudo?.modo === 'bio4'
      ? 'Em Prontera; retorno direto ao Porteiro de Bio 4, sem storage/venda'
      : 'Em Prontera com Auto-voltar ON; retomando Kafra, venda e retorno a ' + destino);
    recuperacao = { motivo: 'parado na cidade', desde: Date.now(), ultimaEm: Date.now() - 60000, tentativas: 0, retomarAutopilot: true };
    return true;
  };
  let foraFarmDesde = 0, ultimaConferenciaFarmEm = 0;
  const conferirMapaFarm = (w) => {
    if (tempoConteudoEsgotado()) return;
    const agora = Date.now();
    if (agora - ultimaConferenciaFarmEm < 5000) return;
    ultimaConferenciaFarmEm = agora;
    const p = posicao(w), destino = mapaDoConteudo() || cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
    if (!p?.mapa || !destino || cfg.covil.ligado || rifaRodando) { foraFarmDesde = 0; return; }
    if (p.mapa === destino || mapaConfereConteudo(p.mapa)) {
      if (foraFarmDesde) log('Conferencia do farm: destino confirmado em ' + destino);
      foraFarmDesde = 0;
      return;
    }
    // Instancias e mapas com renascimento proprio seguem suas rotinas dedicadas.
    if (mapaDeRenascer(p) && !cfg.destinoPendente) { foraFarmDesde = 0; return; }
    if (!foraFarmDesde) {
      foraFarmDesde = agora;
      log('Conferencia do farm: em ' + p.mapa + ', destino ' + destino + '; verificarei o retorno');
      return;
    }
    if (agora - foraFarmDesde < (mapaDoConteudo() ? 1500 : 15000) || recuperacao || vigia || chegadaAtrasada || ocupado) return;
    etapa('Recuperando', 'Fora do mapa de farm: ' + p.mapa + '; retorno a ' + destino);
    log('Conferencia do farm: fora de ' + destino + ' por ' + Math.round((agora - foraFarmDesde) / 1000) + ' s; iniciando retorno');
    recuperacao = { motivo: 'fora do mapa de farm', desde: agora, ultimaEm: agora - 20000, tentativas: 0, retomarAutopilot: true };
  };

  const avisosDiarios = new WeakMap();
  const dispensarAvisoDiario = (w) => {
    if (!cfg.ligado) return false;
    // O aviso diario cobre a cacada. Identificar pelo controle exclusivo evita
    // fechar por engano uma conversa de NPC ou uma janela de venda.
    const caixas = [...w.document.querySelectorAll('input[type="checkbox"]')].filter(caixa => {
      const nomes = [caixa.getAttribute('aria-label'), ...[...(caixa.labels || [])].map(l => l.innerText || l.textContent),
        caixa.closest('label')?.innerText, caixa.parentElement?.innerText].filter(Boolean);
      return nomes.some(nome => normalizar(nome).includes('nao mostrar novamente hoje'));
    });
    let fechar = null;
    const titulos = [...w.document.querySelectorAll('h1, h2, h3, h4, div, span, strong')].filter(el =>
      visivel(el) && /^(?:logue\s*(?:e|&)\s*ganhe|recompensas? diarias?)(?:\s*[—–-].{0,60})?$/.test(normalizar(textoDe(el))));
    const referencias = [...caixas, ...titulos];
    for (const referencia of referencias) {
      let area = referencia.parentElement;
      for (let i = 0; i < 8 && area && area !== w.document.body && !/^(ui-root|elrag-dialogs)$/.test(area.id || ''); i++, area = area.parentElement) {
        if (!visivel(area)) continue;
        const botoes = [...area.querySelectorAll('button')].filter(b => visivel(b) && !b.disabled &&
          /^(fechar|x|×|✕)$/i.test(b.getAttribute('aria-label') || b.title || textoDe(b)));
        if (botoes.length === 1) { fechar = botoes[0]; break; }
      }
      if (fechar) break;
    }
    const anterior = avisosDiarios.get(w);
    if (!fechar) {
      if (anterior && (!anterior.botao.isConnected || !visivel(anterior.botao))) {
        log('Aviso diario: fechamento confirmado; recompensa e lembrete preservados');
        avisosDiarios.delete(w);
      }
      return false;
    }
    if (anterior?.botao === fechar && Date.now() - anterior.em < 1500) return true;
    // Não marcar "Não mostrar novamente hoje" nem coletar por conta do
    // usuário. Um único click no fechar, mesmo quando é apenas um ícone.
    fechar.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: w }));
    avisosDiarios.set(w, { botao: fechar, em: Date.now() });
    return true;
  };

  const fecharLojaCash = (w) => {
    const titulos = [...w.document.querySelectorAll('div, span, h1, h2, h3')]
      .filter(el => visivel(el) && normalizar(textoDe(el)) === 'yggidle · loja de cash');
    if (!titulos.length) return false;
    for (const titulo of titulos) {
      let area = titulo.parentElement;
      for (let i = 0; i < 7 && area && area !== w.document.body; i++, area = area.parentElement) {
        const botoes = [...area.querySelectorAll('button')]
          .filter(b => visivel(b) && /^(fechar|x|×|✕)$/i.test(textoDe(b) || b.getAttribute('aria-label') || ''));
        if (botoes.length !== 1) continue;
        botoes[0].click();
        log('Loja de Cash: janela fechada para liberar a automacao');
        return true;
      }
    }
    return false;
  };

  const PREMIOS_RIFA = [
    'Vigília de Heimdall','Fúria do Berserker','Banquete de Yule','Arca de Fáfnir',
    'Runa Eterna de Fogo','Runa Eterna de Água','Runa Eterna de Terra','Runa Eterna de Vento',
    'Lágrima de Mímir','Semente de Herói','Aljava de Ullr','Semente da Magia',
    'Semente dos Deuses','Doce do Infinito','Runa Eterna de Thanatos',
    'Festim de Fenrir','Festim de Sleipnir','Olho de Odin','Brasa de Surtur',
    'Âmbar de Freya','Hino de Bragi','Maçã de Idunn','Lágrima de Hel',
    'Fogo de Muspelheim','Bile de Nidhogg','Peçonha de Jörmungandr',
    'Bênção de Baldur','Esporo de Yggdrasil','Hidromel de Kvasir'
  ];
  // https://yggidle.com.br/atualizacoes/premios-da-rifa-yggidle
  const CONSOLACAO_RIFA = [
    'Garrafa de Veneno', 'Caixa da Sonolência', 'Caixa do Ressentimento',
    'Medicina Milagrosa', 'Fruto de Yggdrasil Amargo', 'Sobremesa de Noel',
    'Suco Celular Enriquecido', 'Abrasivo', 'Pílula de Combate',
    'Poção de Regeneração', 'Poção Ilimitada', 'Poção Infinita',
    'Elixir Rubro', 'Bolinho Divino', 'Fruto de Yggdrasil Desidratado',
    'Poção Menor de Defesa', 'Poção Menor de Mana', 'Poção Menor de Vida',
    'Suco de Gato', 'Manual & Chiclete', 'Pergaminho da Bênção',
    'Pergaminho para Aumentar Agilidade'
  ];
  const NOMES_CONSOLACAO_RIFA = new Set([
    ...CONSOLACAO_RIFA, 'Pergaminho de Aumentar Agilidade'
  ].map(normalizar));
  const rifaEstado = { etapa: 'Aguardando', premio: '', edicao: '', compras: 0, detalhe: '' };
  let rifaRodando = false, rifaFarmPausado = false, rifaMenu = null, rifaModalAtual = null;
  let ultimaConferenciaResultadoRifa = 0;
  let tentativaEntradaRifa = { id: '', quantidade: 0, depois: 0 };
  const registroRifa = (edicao,premio='') => {
    let registro = cfg.rifa.historico.find(x => x.id === edicao.id);
    if (!registro) {
      registro = { id: edicao.id, inicio: edicao.inicio, premio, tentativas: 0,
        confirmados: 0, gasto: 0, resultado: 'Aguardando sorteio', vencedor: '' };
      cfg.rifa.historico.unshift(registro);
      cfg.rifa.historico = cfg.rifa.historico.slice(0,30);
      salvarCfg();
    } else if (premio && !registro.premio) registro.premio = premio;
    return registro;
  };
  const textoHistoricoRifa = (registros = cfg.rifa.historico) => (registros.length
    ? registros.map(r => {
      const quando = new Date(r.inicio).toLocaleString('pt-BR');
      return quando+' · '+(r.premio||'Prêmio a confirmar')+'\n'+
        'Tentativas: '+r.tentativas+' · Comprados: '+r.confirmados+
        ' · Gasto: '+Number(r.gasto||0).toLocaleString('pt-BR')+'z\n'+
        'Resultado: '+r.resultado+(r.vencedor?' · Vencedor: '+r.vencedor:'')+
        ((r.auditoriaCompras || []).length ? '\nTentativas de compra:\n'+r.auditoriaCompras.map(a =>
          new Date(a.em).toLocaleTimeString('pt-BR')+' · '+a.estado+
          (Number.isFinite(a.intervaloMs) ? ' · intervalo '+a.intervaloMs+' ms' : '')+
          (Number.isFinite(a.latenciaMs) ? ' · resposta '+a.latenciaMs+' ms' : '')+
          (a.resposta ? ' · '+a.resposta : '')).join('\n') : '')+
        ((r.ocorrencias || []).length ? '\nMotivos e andamento:\n'+r.ocorrencias.map(o =>
          new Date(o.em).toLocaleTimeString('pt-BR')+' · '+o.etapa+' — '+o.detalhe).join('\n') : '');
    }).join('\n\n') : 'Nenhuma edição observada neste personagem. O histórico é registrado enquanto o jogo e o script estão abertos.');
  const atualizarHistoricoRifa = () => {
    const h = rifaMenu?.querySelector('[data-rifa-historico]');
    if (!h) return;
    const rolagem = h.scrollTop;
    const abertos = new Set([...h.querySelectorAll('details[data-rifa-edicao]')]
      .filter(el => el.open).map(el => el.dataset.rifaEdicao));
    const doc = h.ownerDocument;
    const linhas = cfg.rifa.historico.map(r => {
      const grupo = doc.createElement('details');
      grupo.dataset.rifaEdicao = r.id;
      grupo.open = abertos.has(r.id);
      Object.assign(grupo.style, { borderBottom: '1px solid #445967', padding: '6px 0' });
      const titulo = doc.createElement('summary');
      titulo.style.cursor = 'pointer';
      titulo.textContent = new Date(r.inicio).toLocaleString('pt-BR')+' · '+
        (r.premio || 'Prêmio a confirmar')+' · '+Number(r.confirmados || 0)+' bilhete(s)';
      const detalhe = doc.createElement('pre');
      Object.assign(detalhe.style, { whiteSpace: 'pre-wrap', font: '12px/1.4 Arial,sans-serif', margin: '6px 0' });
      detalhe.textContent = textoHistoricoRifa([r]);
      grupo.append(titulo, detalhe);
      return grupo;
    });
    h.replaceChildren(...linhas);
    if (!linhas.length) h.textContent = textoHistoricoRifa();
    h.scrollTop = rolagem;
  };
  const registrarMotivoRifa = (edicao, premio, etapa, detalhe) => {
    const premioAnterior = cfg.rifa.historico.find(r => r.id === edicao.id)?.premio;
    const registro = registroRifa(edicao, premio);
    const ocorrencias = registro.ocorrencias || [];
    const ultima = ocorrencias[ocorrencias.length - 1];
    if (ultima?.etapa === etapa && ultima?.detalhe === detalhe && (!premio || premioAnterior)) return registro;
    ocorrencias.push({ em: Date.now(), etapa, detalhe });
    registro.ocorrencias = ocorrencias.slice(-12);
    if (!registro.confirmados) registro.resultado = etapa+' — '+detalhe;
    salvarCfg();
    atualizarHistoricoRifa();
    return registro;
  };
  const encerrarObservacoesRifa = () => {
    let mudou = false;
    for (const r of cfg.rifa.historico) {
      if (!r.confirmados && r.ocorrencias?.length && Date.now() > r.inicio + 90*60000 &&
          /^(Aguardando|Preparando|Entrada falhou)/.test(r.resultado)) {
        r.resultado = 'Não participou — '+r.ocorrencias[r.ocorrencias.length - 1].detalhe;
        mudou = true;
      }
    }
    if (mudou) {
      salvarCfg();
      atualizarHistoricoRifa();
    }
  };
  const conferirResultadoRifa = (w) => {
    if (Date.now() - ultimaConferenciaResultadoRifa < 1500) return;
    ultimaConferenciaResultadoRifa = Date.now();
    const texto = w.document.body.innerText || '';
    const anuncios = [...texto.matchAll(/\[Rifa YggIdle\]\s*([^\n]+?)\s+tirou o n[uú]mero da sorte e levou\s+([^\n]+?)\s+x\d+[!.]?/gi)];
    // v3.19: um vencedor NOVO anunciado durante a edicao a encerra de vez
    // (gravado em cfg, vale tambem depois de recarregar a conta).
    const edicaoAtual = edicaoRifaAtual();
    if (edicaoAtual) {
      if (rifaEstado.baseAnuncios?.id !== edicaoAtual.id)
        rifaEstado.baseAnuncios = { id: edicaoAtual.id, n: anuncios.length };
      else if (anuncios.length > rifaEstado.baseAnuncios.n && cfg.rifa.ultimaEdicao !== edicaoAtual.id) {
        rifaEstado.baseAnuncios.n = anuncios.length;
        cfg.rifa.ultimaEdicao = edicaoAtual.id; salvarCfg();
        log('Rifa: vencedor anunciado; edição ' + edicaoAtual.id + ' marcada como encerrada');
      }
    }
    if (!anuncios.length) return;
    const registro = cfg.rifa.historico.find(r => r.confirmados > 0 &&
      Date.now() >= r.inicio && Date.now() <= r.inicio + 95*60000 &&
      !/^(Ganhou|Não ganhou)$/.test(r.resultado));
    if (!registro || /^(Ganhou|Não ganhou)$/.test(registro.resultado)) return;
    const premioNormal = normalizar(registro.premio || '');
    const anuncio = anuncios.reverse().find(m => premioNormal && normalizar(m[2]).includes(premioNormal));
    if (!anuncio) return;
    const vencedor = anuncio[1].trim();
    const personagem = String(cfg.rifa.personagem || '').trim();
    registro.vencedor = vencedor;
    registro.resultado = personagem ?
      (normalizar(vencedor) === normalizar(personagem) ? 'Ganhou' : 'Não ganhou') :
      'Vencedor anunciado; informe o nome do personagem para conferir';
    salvarCfg();
    log('Rifa: '+registro.resultado+' · '+registro.premio+' · vencedor '+vencedor);
    atualizarHistoricoRifa();
  };
  const rifaStatus = (etapa, detalhe = '') => {
    const mudou = rifaEstado.etapa !== etapa || rifaEstado.detalhe !== detalhe;
    if (!mudou) return;
    rifaEstado.etapa = etapa; rifaEstado.detalhe = detalhe;
    const linha = rifaMenu?.querySelector('[data-rifa-status]');
    if (linha) linha.textContent = 'Estado: '+etapa+(detalhe?' · '+detalhe:'');
    if (mudou && detalhe) log('Rifa: ' + etapa + ' — ' + detalhe);
    atualizarPainel();
  };
  const premioMarcadoRifa = (texto) => (cfg.rifa.premios || [])
    .some(nome => normalizar(texto).includes(normalizar(nome)));
  const janelaRifa = (w) => {
    if (rifaModalAtual?.isConnected && rifaModalAtual.ownerDocument === w.document && visivel(rifaModalAtual)) return rifaModalAtual;
    rifaModalAtual = null;
    const folhas = [...w.document.querySelectorAll('h1,h2,h3,div,span,strong')]
      .filter(el => visivel(el) && normalizar(textoDe(el)) === 'rifa yggidle' &&
        ![...el.children].some(c => normalizar(textoDe(c)) === 'rifa yggidle'));
    for (const folha of folhas) {
      let p = folha;
      for (let i = 0; p && i < 7; i++, p = p.parentElement) {
        if (/seus n[uú]meros nesta edi[cç][aã]o/i.test(p.innerText || '') &&
            /comprar n[uú]mero/i.test(p.innerText || '')) {
          rifaModalAtual = p;
          return p;
        }
      }
    }
    return null;
  };
  const zenyRifa = (w) => {
    const doc = w.document;
    const hud = doc.getElementById?.('ui-root') || doc;
    const numero = texto => {
      const limpo = String(texto || '').trim().replace(/^[Ƶℤⓩ🪙Z]\s*(?=\d)/u, '').replace(/(\d)\s*z$/i, '$1');
      const m = /^(?:Zeny\s*:?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:\s*Zeny)?$/i.exec(limpo);
      if (!m) return NaN;
      const n = Number(m[1].replace(/[^\d]/g, ''));
      return Number.isSafeInteger(n) && n >= 0 ? n : NaN;
    };
    // Na HUD compacta o tooltip pode estar somente no ícone, enquanto o
    // valor é seu irmão. O primeiro nó "Zeny" sozinho não é o saldo.
    for (const el of hud.querySelectorAll('[title], [aria-label], [aria-description], [data-tooltip], [data-tooltip-content], [aria-describedby], svg title')) {
      const rotulos = ['title', 'aria-label', 'aria-description', 'data-tooltip', 'data-tooltip-content']
        .map(a => el.getAttribute?.(a));
      const descrito = el.getAttribute?.('aria-describedby');
      if (descrito) for (const id of descrito.split(/\s+/)) rotulos.push(doc.getElementById?.(id)?.textContent);
      if (String(el.tagName).toLowerCase() === 'title') rotulos.push(el.textContent);
      if (!rotulos.some(r => /^Zeny(?:\s|:|$)/i.test(String(r || '').trim()) || /^[\d.,]+\s+Zeny$/i.test(String(r || '').trim()))) continue;
      for (let area = el, i = 0; area && area !== hud && area !== doc.body && i <= 3; area = area.parentElement, i++) {
        if (!visivel(area) || area.closest?.('[data-fzn-auto-voltar], .fzn-ygg')) continue;
        const n = numero(area.innerText || area.textContent);
        if (Number.isFinite(n)) return n;
        const valores = new Set([...(area.querySelectorAll?.('span') || [])]
          .filter(visivel).map(e => numero(e.innerText || e.textContent)).filter(Number.isFinite));
        if (valores.size === 1) return [...valores][0];
      }
      if (visivel(el)) for (const rotulo of rotulos) {
        const n = numero(rotulo);
        if (Number.isFinite(n)) return n;
      }
    }
    const texto = hud === doc ? doc.body?.innerText : hud.innerText;
    const m = /(?:^|\n)\s*Zeny\s*:?\s*([\d.,]+)(?=\s*(?:\n|$))/i.exec(texto || '');
    if (m) return numero(m[1]);
    if (typeof rifaMenu !== 'undefined' && rifaMenu?.isConnected &&
        Date.now() - (w.__fznSaldoRifaDiagEm || 0) > 10000) {
      w.__fznSaldoRifaDiagEm = Date.now();
      const marcadores = [...doc.querySelectorAll('[title], [aria-label], [aria-description], [data-tooltip], [data-hud-tooltip], svg title')]
        .filter(e => /zeny/i.test(['title','aria-label','aria-description','data-tooltip','data-hud-tooltip'].map(a => e.getAttribute(a)).join(' ') + (String(e.tagName).toLowerCase() === 'title' ? e.textContent : '')))
        .slice(0, 12).map(e => {
          const pais = [];
          for (let p = e, i = 0; p && p !== doc.body && i < 4; p = p.parentElement, i++)
            pais.push({ tag: p.tagName, texto: String(p.innerText || p.textContent || '').slice(0, 220), visivel: visivel(p), atributos: [...p.attributes].filter(a => /title|aria|data-hud|class|id/.test(a.name)).map(a => [a.name, a.value]).slice(0, 8) });
          return pais;
        });
      gravarJson('fzn-rifa-saldo-diagnostico-v1', { em: Date.now(), marcadores });
    }
    return NaN;
  };
  const precoBotaoRifa = (botao) => {
    const m = /comprar n[uú]mero\s*[—–-]\s*([\d.,]+)\s*z/i.exec(textoDe(botao) || '');
    return m ? Number(m[1].replace(/[^\d]/g, '')) : NaN;
  };
  const RIFA_INTERVALO_MS = 600;
  // v3.21: o servidor aceita 1 compra a cada 500 ms (fixo). A cadencia conta
  // do clique anterior e nao espera a confirmacao; no maximo 2 compras sem
  // confirmacao ao mesmo tempo, e o gasto maximo ja conta as pendentes.
  const RIFA_CADENCIA_MS = 500;
  const RIFA_MAX_PENDENTES = 2;
  const RIFA_SEM_RESPOSTA_MS = 23000;
  const comprasRifaEmCurso = new WeakSet();
  // A UI pode tirar o disabled antes de terminar o carregamento. Comprar
  // somente quando o controle estiver visível, disponível e de fato verde.
  const botaoCompraRifaAtivo = (botao) => {
    if (!botao?.isConnected || botao.disabled || botao.matches?.(':disabled') ||
        botao.getAttribute('aria-disabled') === 'true' || botao.getAttribute('aria-busy') === 'true' ||
        /carregando|comprando|aguarde|processando/i.test(textoDe(botao)) ||
        botao.querySelector?.('[aria-busy="true"], [role="progressbar"]')) return false;
    try {
      const estilo = botao.ownerDocument.defaultView.getComputedStyle(botao);
      if (estilo.display === 'none' || /hidden|collapse/.test(estilo.visibility) ||
          estilo.pointerEvents === 'none' || Number(estilo.opacity || 1) < 0.9 ||
          (botao.getClientRects && !botao.getClientRects().length)) return false;
      const cor = estilo.backgroundColor || '';
      const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(cor);
      if (rgb) {
        const r = Number(rgb[1]), g = Number(rgb[2]), b = Number(rgb[3]), a = Number(rgb[4] ?? 1);
        return a >= 0.9 && g >= 60 && g > r + 10 && g > b + 10;
      }
      // Tailwind moderno pode manter o fundo em OKLCH no estilo computado.
      const oklch = /^oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+))?\s*\)$/i.exec(cor);
      return Boolean(oklch && Number(oklch[1]) / (oklch[2] ? 100 : 1) >= 0.25 &&
        Number(oklch[3]) >= 0.05 && Number(oklch[4]) >= 100 && Number(oklch[4]) <= 175 &&
        Number(oklch[5] ?? 1) >= 0.9);
    } catch { return false; }
  };
  // O .click() global simula oito eventos e troca o alvo por elementFromPoint.
  // Na rifa use apenas um click no controle exato, mesmo com outro painel por cima.
  const clicarControleRifa = (botao) => {
    if (!botao?.isConnected || botao.disabled || botao.getAttribute('aria-disabled') === 'true') return false;
    const w = botao.ownerDocument.defaultView;
    botao.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: w }));
    return true;
  };
  const clicarCompraRifa = (botao) => botaoCompraRifaAtivo(botao) && clicarControleRifa(botao);
  const numerosCompradosRifa = (modal) => {
    const texto = modal?.innerText || '';
    const trecho = /Seus n[uú]meros nesta edi[cç][aã]o\s*([\s\S]*?)(?=Comprar n[uú]mero|Comprando\b|Aguarde\b|$)/i.exec(texto)?.[1];
    if (trecho == null) return NaN;
    if (/ainda n[aã]o comprou nenhum n[uú]mero/i.test(trecho)) return 0;
    return (trecho.match(/\b\d{1,4}\b/g) || []).length;
  };
  const rifaEsgotada = (texto) => {
    const vendidos = /(\d+)\s+de\s+(\d+)\s+n[uú]meros vendidos/i.exec(texto || '');
    return Boolean(vendidos && Number(vendidos[2]) > 0 && Number(vendidos[1]) >= Number(vendidos[2]));
  };
  const anuncioRifa = (w) => {
    const t = w.document.body.innerText || '';
    const matches = [...t.matchAll(/\[Rifa YggIdle\]\s*Em\s*(?:10|5|1)\s*minuto[^\n]{0,150}?Pr[eê]mio:\s*([^\n]+)/gi)];
    return matches.length ? matches[matches.length - 1][1].replace(/\s+x\d+\.?\s*$/i, '').trim() : '';
  };
  const edicaoRifaAtual = () => {
    const d = new Date(), agora = d.getTime();
    for (const h of [0,14,16,18,20,22]) {
      const inicio = new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,10).getTime();
      if (agora >= inicio - 10*60000 && agora <= inicio + 90*60000)
        return { id: new Date(inicio).toLocaleDateString('sv-SE') + '-' + h, inicio, abriu: agora >= inicio };
    }
    return null;
  };
  const acharNpcRifa = async (w) => {
    const manager = await carregarEntidadesNpc(w);
    if (!manager) return null;
    let achou = null;
    manager.forEach(e => {
      const c = e?.constructor;
      const npc = c && ((Number.isFinite(c.TYPE_NPC) && e.objecttype === c.TYPE_NPC) ||
        (Number.isFinite(c.TYPE_NPC2) && e.objecttype === c.TYPE_NPC2));
      const nome = e?.display?.name || e?._job || e?.name || '';
      if (npc && e.GID > 0 && !e.remove_tick && /yggidle\s*bet/i.test(String(nome))) achou = e;
    });
    return achou;
  };
  // v3.22: o NPC YggIdle Bet agora pergunta "Qual máquina você quer usar?" e
  // lista cartões (Recicladora de Cartas, Rifa YggIdle, Escambo) com título e
  // descrição. Acha o título "Rifa YggIdle" e clica no cartão que o contém.
  const opcaoRifaNoMenu = (w) => {
    const antigo = botaoPorTexto(w.document,t => /^Rifa Yggidle$/i.test(t));
    if (antigo) return antigo;
    const titulos = [...w.document.querySelectorAll('button,[role="button"],a,li,div,span,strong,b,p,h3,h4')]
      .filter(el => visivel(el) && normalizar(textoDe(el)) === 'rifa yggidle' &&
        ![...el.children].some(c => normalizar(textoDe(c)) === 'rifa yggidle'));
    for (const titulo of titulos) {
      let p = titulo;
      for (let i = 0; p && i < 5; i++, p = p.parentElement) {
        const t = p.innerText || '';
        if (/seus n[uú]meros nesta edi[cç][aã]o/i.test(t)) break; // já é a janela da rifa
        if (p.matches?.('button,[role="button"],a,li') || /sorteio a cada|n[uú]mero a/i.test(t)) {
          const clicavel = p.closest?.('button,[role="button"],a,li');
          if (clicavel) return clicavel;
          // sobe até o cartão inteiro, sem englobar as outras máquinas
          while (p.parentElement && !/recicladora|escambo|qual m[aá]quina/i.test(p.parentElement.innerText || '')) p = p.parentElement;
          return p;
        }
      }
      return titulo;
    }
    return null;
  };
  const abrirRifaNoNpc = async (w) => {
    if (janelaRifa(w)) return true;
    if (posicao(w)?.mapa !== 'prontera') return false;
    for (let i = 0; i < 3; i++) {
      const npc = await acharNpcRifa(w);
      if (!npc) { await esperar(700); continue; }
      try { npc.onMouseDown?.(); } catch {}
      const opcao = await esperarAte(() => opcaoRifaNoMenu(w),2500);
      if (opcao) clicarControleRifa(opcao);
      if (await esperarAte(() => janelaRifa(w),3500)) return true;
    }
    return false;
  };
  const sairParaRifa = async (w) => {
    if (mapaCovil(posicao(w)) || covil.mortePendente || covil.renascendo) return false;
    if (posicao(w)?.mapa === 'prontera') return true;
    const sair = w.document.querySelector('[data-tutorial="sair-da-instancia"]') ||
      botaoPorTexto(w.document,t => /^Sair$/i.test(t));
    if (!sair || !visivel(sair)) return false;
    sair.click();
    const confirmar = await esperarAte(() => /Sair da inst[aâ]ncia/i.test(w.document.body.innerText || '') &&
      [...w.document.querySelectorAll('button')].find(b => b !== sair && visivel(b) && !b.disabled &&
        /^sair$/i.test(textoDe(b))),5000);
    if (!confirmar) return false;
    confirmar.click();
    return Boolean(await esperarAte(() => posicao(w)?.mapa === 'prontera',90000,500));
  };
  const fecharRifa = (w) => {
    const modal = janelaRifa(w);
    const fechar = modal && [...modal.querySelectorAll('button')].find(b =>
      visivel(b) && /^(x|×|fechar)$/i.test(textoDe(b) || b.getAttribute('aria-label') || ''));
    fechar?.click();
  };
  const comprarRifa = async (w,edicao,premioAvisado) => {
    if (comprasRifaEmCurso.has(w)) return;
    comprasRifaEmCurso.add(w);
    try {
    let premio = premioAvisado, semBotaoDesde = 0, semJanelaDesde = 0, semSaldoDesde = null, registro = null;
    // Compras enviadas e ainda sem comprovante, mais referencias da sessao.
    const pendentes = [];
    let sessao = null, ultimoClique = 0;
    const parar = (etapa, detalhe) => {
      registrarMotivoRifa(edicao, premio, etapa, detalhe);
      rifaStatus(etapa, detalhe);
    };
    while (cfg.rifa.ligado && cfg.ligado && posicao(w)?.mapa === 'prontera') {
      const modal = janelaRifa(w);
      if (!modal) {
        if (!semJanelaDesde) semJanelaDesde = Date.now();
        if (!await abrirRifaNoNpc(w)) {
          if (Date.now() - semJanelaDesde > 30000) { parar('Parada','janela da rifa não abriu em 30 s'); return; }
          rifaStatus('Procurando NPC','tentando reabrir a rifa');
          await esperar(1000);
        }
        continue;
      }
      semJanelaDesde = 0;
      const texto = modal.innerText || '';
      if (/n[aã]o est[aá] aberta para compras/i.test(texto) && Date.now() < edicao.inicio + 10000) {
        rifaStatus('Aguardando abertura','servidor ainda não liberou as compras');
        await esperar(500); continue;
      }
      if (/edi[cç][aã]o encerrada|n[aã]o est[aá] aberta para compras/i.test(texto) || rifaEsgotada(texto)) {
        parar('Encerrada',rifaEsgotada(texto) ? 'todos os números vendidos' : 'edição finalizada'); return;
      }
      if (/nenhuma edi[cç][aã]o aberta/i.test(texto)) {
        if (Date.now() > edicao.inicio + 120000) { parar('Encerrada','nenhuma edição aberta'); return; }
        await esperar(350); continue;
      }
      // O botão pode aparecer antes de o servidor aceitar compras. O texto
      // "Abre em" e o horário da edição evitam uma tentativa prematura.
      if (/abre em/i.test(texto) || Date.now() < edicao.inicio + 250) {
        rifaStatus('Aguardando abertura','compra começa no horário anunciado');
        await esperar(250); continue;
      }
      const premiosNoModal = PREMIOS_RIFA.filter(nome => normalizar(texto).includes(normalizar(nome)));
      premio = premiosNoModal.join(' + ');
      if (!premio || !premioMarcadoRifa(premio)) {
        parar('Ignorada',premio ? 'prêmio não selecionado: '+premio : 'prêmio não confirmado');
        return;
      }
      rifaEstado.premio = premio;
      registro = registroRifa(edicao,premio);
      const limite = Math.max(0, Math.floor(Number(cfg.rifa.limiteGasto) || 0));
      const saldo = zenyRifa(w);
      if (!Number.isFinite(saldo)) {
        if (semSaldoDesde === null) semSaldoDesde = Date.now();
        if (Date.now() - semSaldoDesde >= 8000) { parar('Parada','saldo de zeny não identificado após 8 s; nenhuma compra enviada'); return; }
        rifaStatus('Aguardando saldo','conferindo zeny antes de enviar qualquer compra');
        await esperar(250); continue;
      }
      semSaldoDesde = null;
      if (!Number.isFinite(registro.saldoInicial)) {
        registro.saldoInicial = saldo;
        gravarJson(CHAVE_CFG,cfg);
      }
      let comprar = [...modal.querySelectorAll('button')].find(b => /comprar n[uú]mero/i.test(textoDe(b)));
      const preco = comprar ? precoBotaoRifa(comprar) : NaN;
      if (botaoCompraRifaAtivo(comprar) && (!Number.isFinite(preco) || preco <= 0)) {
        parar('Parada','preço do bilhete não identificado no botão'); return;
      }
      if (!Number.isFinite(preco) || preco <= 0) {
        if (!semBotaoDesde) semBotaoDesde = Date.now();
        if (!comprar && Date.now() - semBotaoDesde > 10000) {
          rifaStatus('Reabrindo rifa','botão de compra não apareceu');
          fecharRifa(w); rifaModalAtual = null; semBotaoDesde = 0;
          await esperar(500); continue;
        }
        rifaStatus('Aguardando botão verde','preço do bilhete ainda não apareceu');
        await esperar(20); continue;
      }
      const numerosAgora = numerosCompradosRifa(modal);
      if (!sessao || sessao.preco !== preco) {
        sessao = { preco, saldo, numeros: numerosAgora, confirmados: 0 };
      }
      if (!Number.isFinite(sessao.numeros) && Number.isFinite(numerosAgora) && !pendentes.length)
        sessao.numeros = numerosAgora;
      // --- conciliacao: quantas das compras enviadas o servidor ja confirmou ---
      const porNumeros = Number.isFinite(sessao.numeros) && Number.isFinite(numerosAgora)
        ? numerosAgora - sessao.numeros : 0;
      const porZeny = Math.floor((sessao.saldo - saldo) / preco);
      let confirmadosAgora = Math.max(0, porNumeros, porZeny);
      while (confirmadosAgora > sessao.confirmados) {
        sessao.confirmados++;
        const env = pendentes.shift();
        if (env) {
          env.auditoria.estado = 'confirmada';
          env.auditoria.latenciaMs = Date.now() - env.em;
          env.auditoria.saldoDepois = saldo;
          env.auditoria.numerosDepois = numerosAgora;
        }
        registro.confirmados++;
        registro.gasto += preco;
        if (!registro.vencedor) registro.resultado = 'Aguardando sorteio';
        rifaEstado.compras++;
        if (registro.confirmados % 5 === 0) salvarCfg(); else gravarJson(CHAVE_CFG,cfg);
        atualizarHistoricoRifa();
        rifaStatus('Comprando',rifaEstado.compras+' número(s); '+premio);
      }
      if (pendentes.length && Date.now() - pendentes[0].em > RIFA_SEM_RESPOSTA_MS) {
        for (const env of pendentes) {
          env.auditoria.estado = 'sem confirmação';
          env.auditoria.latenciaMs = Date.now() - env.em;
          env.auditoria.saldoDepois = saldo;
          env.auditoria.numerosDepois = numerosAgora;
          env.auditoria.resposta = String(modal.innerText || '').replace(/\s+/g, ' ').slice(0, 500);
        }
        gravarJson(CHAVE_CFG,cfg);
        // Sem retorno do servidor, outra tentativa poderia comprar um bilhete
        // duplicado e ultrapassar o limite configurado pelo jogador.
        parar('Parada','compra sem resposta após 23 s; confira saldo e números antes de tentar novamente'); return;
      }
      // Janela antiga de confirmacao ("Comprar — 500.000z"), caso volte.
      const confirmacao = [...w.document.querySelectorAll('button')]
        .find(b => visivel(b) && botaoCompraRifaAtivo(b) &&
          /^comprar\s*[—–-]\s*[\d.,]+\s*z?$/i.test(textoDe(b)) &&
          /confirmar compra|voc[eê] vai gastar/i.test(b.parentElement?.parentElement?.innerText || ''));
      if (confirmacao && pendentes.length) {
        const precoConfirmacao = Number((textoDe(confirmacao).match(/[\d.,]+/) || [''])[0].replace(/[^\d]/g, ''));
        if (precoConfirmacao !== preco) { parar('Parada','preço da confirmação difere do botão'); return; }
        if (!pendentes[0].confirmouJanela) {
          pendentes[0].confirmouJanela = true;
          clicarCompraRifa(confirmacao);
        }
        await esperar(20); continue;
      }
      // --- orcamento: o que ja foi gasto + o que esta a caminho + o proximo ---
      const gastoEfetivo = Math.max(Number(registro.gasto) || 0,
        Math.max(0, Number(registro.saldoInicial) - saldo));
      const aCaminho = pendentes.length * preco;
      if (gastoEfetivo + aCaminho + preco > limite) {
        if (pendentes.length) { rifaStatus('Conferindo compra','aguardando confirmação das últimas compras'); await esperar(20); continue; }
        parar('Limite atingido','máximo de '+limite.toLocaleString('pt-BR')+'z nesta edição'); return;
      }
      const saldoProjetado = Math.min(saldo, sessao.saldo - sessao.confirmados * preco) - aCaminho;
      if (saldoProjetado < preco) {
        if (pendentes.length) { await esperar(20); continue; }
        parar('Sem saldo','menos de '+preco.toLocaleString('pt-BR')+'z para outro bilhete'); return;
      }
      if (rifaEsgotada(texto)) {
        if (pendentes.length) { await esperar(20); continue; }
        parar('Encerrada','todos os números vendidos'); return;
      }
      if (pendentes.length >= RIFA_MAX_PENDENTES) { await esperar(10); continue; }
      // --- cadencia: 500 ms cravados desde o clique anterior ---
      const falta = ultimoClique + RIFA_CADENCIA_MS - Date.now();
      if (falta > 0) { await esperar(Math.min(falta, 50)); continue; }
      if (!botaoCompraRifaAtivo(comprar)) {
        if (!semBotaoDesde) semBotaoDesde = Date.now();
        if (!comprar && Date.now() - semBotaoDesde > 10000) {
          rifaStatus('Reabrindo rifa','botão de compra não apareceu');
          fecharRifa(w); rifaModalAtual = null; semBotaoDesde = 0;
          await esperar(500); continue;
        }
        if (!pendentes.length)
          rifaStatus('Aguardando botão verde','compra indisponível há '+(Math.floor((Date.now()-semBotaoDesde)/10000)*10)+' s');
        await esperar(10); continue;
      }
      semBotaoDesde = 0;
      if (!cfg.rifa.ligado || !cfg.ligado || posicao(w)?.mapa !== 'prontera') {
        parar('Interrompida','participação interrompida antes do próximo clique'); return;
      }
      const envioEm = Date.now();
      if (!clicarCompraRifa(comprar)) { await esperar(10); continue; }
      // Só consumir a edição quando uma compra realmente foi enviada.
      cfg.rifa.ultimaEdicao = edicao.id;
      registro.tentativas++;
      const auditoria = { em: envioEm, estado: 'enviada', preco, saldoAntes: saldo, numerosAntes: numerosAgora,
        intervaloMs: registro.ultimoCliqueEm ? envioEm - registro.ultimoCliqueEm : null };
      registro.ultimoCliqueEm = envioEm;
      registro.auditoriaCompras = [...(registro.auditoriaCompras || []), auditoria].slice(-30);
      gravarJson(CHAVE_CFG,cfg);
      pendentes.push({ em: envioEm, auditoria });
      ultimoClique = envioEm;
      await esperar(10);
    }
    parar('Interrompida', !cfg.rifa.ligado ? 'Rifa desligada durante a participação' :
      !cfg.ligado ? 'Auto-voltar desligado durante a participação' : 'personagem saiu de Prontera durante a participação');
    } finally {
      comprasRifaEmCurso.delete(w);
    }
  };
  const executarRifa = async (w,edicao) => {
    if (cfg.covil?.ligado || covil.mortePendente) return;
    if (ocupado || rifaRodando || !cfg.rifa.ligado || !cfg.ligado) return;
    rifaRodando = true; ocupado = true;
    if (tentativaEntradaRifa.id !== edicao.id) tentativaEntradaRifa = { id: edicao.id, quantidade: 0, depois: 0 };
    tentativaEntradaRifa.quantidade++;
    tentativaEntradaRifa.depois = Date.now() + 10000;
    const origem = posicao(w), cacava = autopilotLigado(w) || !!botaoHunt(w,true);
    const premioAvisado = rifaEstado.premio;
    rifaEstado.compras = 0;
    try {
      registrarMotivoRifa(edicao, premioAvisado, 'Preparando participação', 'saindo do farm para conferir a rifa no NPC');
      if (origem?.mapa !== 'prontera') registrarDestinoFarm(w);
      rifaStatus('Saindo do farm',premioAvisado || 'conferindo o prêmio');
      await sairDaEconomia(w);
      if (cacava && !await pausarCacada(w)) throw new Error('não consegui pausar a caça');
      rifaFarmPausado = true;
      rifaStatus('Farm pausado para rifa',premioAvisado || 'aguardando edição');
      if (!await sairParaRifa(w)) throw new Error('não consegui chegar a Prontera');
      rifaStatus('Falando com YggIdle Bet');
      if (!await abrirRifaNoNpc(w)) throw new Error('NPC YggIdle Bet não encontrado');
      // comprarRifa marca a edição ao enviar o primeiro clique. Uma falha de
      // leitura sem compra enviada ainda permite a reentrada limitada.
      await comprarRifa(w,edicao,premioAvisado);
    } catch(e) {
      const motivo = String(e?.message||e).slice(0,160);
      registrarMotivoRifa(edicao, premioAvisado,
        cfg.rifa.ultimaEdicao === edicao.id ? 'Parada' : 'Entrada falhou', motivo);
      rifaStatus('Parada',motivo);
    }
    finally {
      try {
        fecharRifa(w);
        if (posicao(w)?.mapa === 'prontera') {
          const peso = lerPeso(w);
          const precisaLimparMochila = cfg.rotinaLimites !== false &&
            (!peso || peso.pct >= limiteSeguro() || Boolean(mochilaCheiaConfirmada(w)));
          rifaStatus(precisaLimparMochila ? 'Liberando mochila antes do farm' : 'Voltando ao farm');
          const voltou = precisaLimparMochila
            ? await rotinaDaCidade(w, cacava, true)
            : await voltarAoMapa(w);
          if (voltou) {
            rifaFarmPausado = false;
            if (cacava) await retomarCacada(w);
          }
          if (!voltou) {
            if (vigia?.refazerCidade) vigia.ultimaEm = Date.now() - VIGIA_INTERVALO_MS + 10000;
            rifaStatus('Aguardando retorno','rotina da cidade será repetida automaticamente se necessário');
          }
        } else if (cacava && posicao(w)?.mapa === origem?.mapa) {
          rifaFarmPausado = false;
          ligarAutopilot(w,true);
        }
      } catch(e) { rifaStatus('Aguardando retorno',String(e?.message||e).slice(0,120)); }
      salvarCfg();
      tentativaEntradaRifa.depois = Date.now() + 10000;
      rifaFarmPausado = false; rifaRodando = false; ocupado = false; atualizarPainel();
    }
  };
  let rifaIdaPendente = '';
  const vigiarRifa = (w) => {
    if (cfg.covil?.ligado || mapaCovil(posicao(w)) || covil.mortePendente || covil.renascendo) return;
    encerrarObservacoesRifa();
    const edicao = edicaoRifaAtual();
    if (!edicao) return;
    if (rifaEstado.edicao !== edicao.id) { rifaEstado.edicao = edicao.id; rifaEstado.premio = ''; }
    const anunciado = anuncioRifa(w);
    if (anunciado) rifaEstado.premio = anunciado;
    if (rifaRodando || cfg.rifa.ultimaEdicao === edicao.id) return;
    const registrar = (etapa, detalhe) => {
      registrarMotivoRifa(edicao, rifaEstado.premio, etapa, detalhe);
      rifaStatus(etapa, detalhe);
    };
    if (!cfg.rifa.ligado) { registrar('Ignorada','Rifa desligada nesta conta'); return; }
    // v3.20: com a rifa marcada a ida a cidade e OBRIGATORIA 1 min antes do
    // inicio, sem depender de premio, anuncio ou orcamento (a compra continua
    // filtrando premio marcado e gasto maximo). Se outra rotina estiver no meio,
    // a ida fica pendente e acontece assim que ela terminar.
    const agoraRifa = Date.now();
    // v3.23: a ida obrigatoria vale so para premio MARCADO. Premio anunciado e
    // desmarcado: fica no farm. Sem anuncio ainda: vai e confere no NPC.
    if (rifaEstado.premio && !premioMarcadoRifa(rifaEstado.premio)) {
      registrar('Ignorada','prêmio não marcado: '+rifaEstado.premio); return;
    }
    if (agoraRifa < edicao.inicio - 60000) {
      registrar('Aguardando último minuto',rifaEstado.premio || 'prêmio ainda não identificado'); return;
    }
    if (agoraRifa > edicao.inicio + 60000 && rifaIdaPendente !== edicao.id) {
      registrar('Ignorada','fora do horário: só sai do farm 1 minuto antes da rifa'); return;
    }
    if (ocupado) {
      rifaIdaPendente = edicao.id;
      registrar('Aguardando rotina','personagem ocupado com outra rotina; a ida à rifa é obrigatória e sai assim que ela terminar'); return;
    }
    if (tentativaEntradaRifa.id === edicao.id) {
      if (tentativaEntradaRifa.quantidade >= 3) {
        registrar('Parada','não cheguei ao NPC após 3 tentativas nesta edição'); return;
      }
      if (Date.now() < tentativaEntradaRifa.depois) return;
    }
    rifaIdaPendente = '';
    if (!cfg.ligado) { cfg.ligado = true; log('Rifa: Auto-voltar ligado automaticamente para disputar e retornar ao farm'); }
    void executarRifa(w,edicao);
  };
  const abrirMenuRifa = () => {
    if (rifaMenu?.isConnected) { rifaMenu.remove(); rifaMenu = null; return; }
    const menu = document.createElement('section');
    menu.className = 'fzn-rifa-menu';
    Object.assign(menu.style,{position:'fixed',right:'22px',bottom:'140px',width:'390px',maxHeight:'72vh',
      overflow:'auto',zIndex:'2147483647',background:'#142331',color:'#f5f7f8',border:'1px solid #7891a5',
      borderRadius:'10px',padding:'12px',boxShadow:'0 8px 28px #0009',font:'13px Arial,sans-serif'});
    const topo = document.createElement('div');
    topo.textContent = 'Rifa YggIdle · 500.000z por número';
    Object.assign(topo.style,{fontWeight:'bold',cursor:'move',marginBottom:'9px'});
    const ajuda = document.createElement('div');
    ajuda.textContent = 'Marque os prêmios que deseja disputar. ON: sai do farm faltando 1 minuto e compra até acabar a edição, faltar zeny ou atingir o gasto máximo definido para esta rifa. Depois volta ao mapa. Se o prêmio não estiver marcado, permanece no farm.';
    Object.assign(ajuda.style,{lineHeight:'1.4',marginBottom:'8px',color:'#d2dce4'});
    const status = document.createElement('div');
    status.textContent = 'Estado: '+rifaEstado.etapa+(rifaEstado.detalhe?' · '+rifaEstado.detalhe:'');
    status.style.marginBottom = '8px';
    status.dataset.rifaStatus = '1';
    const saldo = document.createElement('div');
    saldo.dataset.rifaSaldo = '1';
    saldo.textContent = 'Conferindo saldo da conta…';
    saldo.style.marginBottom = '8px';
    const lista = document.createElement('div');
    Object.assign(lista.style,{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px',maxHeight:'360px',overflowY:'auto'});
    for (const nome of PREMIOS_RIFA) {
      const linha = document.createElement('label');
      Object.assign(linha.style,{display:'flex',alignItems:'flex-start',gap:'5px',cursor:'pointer',padding:'4px',
        border:'1px solid #445967',borderRadius:'5px',fontSize:'12px'});
      const check = document.createElement('input');
      check.type='checkbox'; check.checked=(cfg.rifa.premios||[]).includes(nome);
      check.onchange=()=>{cfg.rifa.premios=check.checked
        ? [...new Set([...(cfg.rifa.premios||[]),nome])]
        : (cfg.rifa.premios||[]).filter(x=>x!==nome); salvarCfg(); atualizarPainel();};
      linha.append(check,document.createTextNode(nome)); lista.appendChild(linha);
    }
    const limiteLinha=document.createElement('label');
    limiteLinha.textContent='Quanto gastar por rifa (zeny): ';
    Object.assign(limiteLinha.style,{display:'block',margin:'10px 0'});
    const limiteCampo=document.createElement('input');
    limiteCampo.type='number';limiteCampo.min='0';limiteCampo.step='500000';limiteCampo.value=String(cfg.rifa.limiteGasto||0);
    Object.assign(limiteCampo.style,{width:'145px',padding:'4px',color:'#17212b',background:'#fff'});
    limiteCampo.onchange=()=>{cfg.rifa.limiteGasto=Math.max(0,Math.floor(Number(limiteCampo.value)||0));
      limiteCampo.value=String(cfg.rifa.limiteGasto);salvarCfg();rifaStatus('Aguardando','limite de '+cfg.rifa.limiteGasto.toLocaleString('pt-BR')+'z por edição');};
    limiteLinha.appendChild(limiteCampo);
    const personagemLinha=document.createElement('label');
    personagemLinha.textContent='Nome do personagem para conferir vitória: ';
    Object.assign(personagemLinha.style,{display:'block',margin:'8px 0'});
    const personagem=document.createElement('input');
    personagem.type='text';personagem.value=cfg.rifa.personagem||'';
    Object.assign(personagem.style,{width:'180px',padding:'4px',color:'#17212b',background:'#fff'});
    personagem.onchange=()=>{cfg.rifa.personagem=personagem.value.trim();
      for (const r of cfg.rifa.historico) if (r.vencedor && r.resultado.startsWith('Vencedor anunciado'))
        r.resultado=normalizar(r.vencedor)===normalizar(cfg.rifa.personagem)?'Ganhou':'Não ganhou';
      salvarCfg();atualizarHistoricoRifa();};
    personagemLinha.appendChild(personagem);
    const historicoRifa=document.createElement('details');
    Object.assign(historicoRifa.style,{margin:'9px 0',border:'1px solid #445967',padding:'7px',borderRadius:'5px'});
    const tituloHistorico=document.createElement('summary');tituloHistorico.textContent='Histórico de edições, bilhetes e motivos';
    tituloHistorico.style.cursor='pointer';
    const conteudoHistorico=document.createElement('div');conteudoHistorico.dataset.rifaHistorico='1';
    Object.assign(conteudoHistorico.style,{font:'12px/1.4 Arial,sans-serif',maxHeight:'260px',overflowY:'auto'});
    historicoRifa.append(tituloHistorico,conteudoHistorico);
    const acoes=document.createElement('div');
    Object.assign(acoes.style,{display:'flex',gap:'6px',justifyContent:'space-between'});
    const botao=(txt,fn)=>{const b=document.createElement('button');b.textContent=txt;b.onclick=fn;
      Object.assign(b.style,{padding:'7px',background:'#24516c',color:'white',border:'1px solid #9cb9c9',
        borderRadius:'6px',cursor:'pointer'});return b;};
    acoes.append(
      botao('Executar agora',()=>{const w=jogo(),edicao=edicaoRifaAtual();
        if (!w||!edicao) {rifaStatus('Aguardando','não há edição próxima ou aberta');return;}
        if (!cfg.rifa.ligado) {rifaStatus('Desligada','ligue Rifa');return;}
        if (!(Number(cfg.rifa.limiteGasto)>=500000)) {rifaStatus('Sem limite','defina quanto gastar por rifa');return;}
        if (!cfg.ligado) {cfg.ligado=true;log('Rifa: Auto-voltar ligado para disputar e retornar ao farm');}
        void executarRifa(w,edicao);}),
      botao('Fechar',()=>{menu.remove();rifaMenu=null;})
    );
    menu.append(topo,ajuda,status,saldo,lista,limiteLinha,personagemLinha,historicoRifa,acoes);
    document.body.appendChild(menu);rifaMenu=menu;
    atualizarHistoricoRifa();
    fznArrastavel(menu,topo,'fzn-rifa-ygg-pos-v1');
  };
  const verificar = () => {
    atualizarPainel();
    const w = jogo();
    if (!w) return;
    if (retomadasEmCurso.has(w) || (cfg.ligado && dispensarAvisoDiario(w))) return;
    conferirResultadoRifa(w);
    if (rifaRodando) {
      // A caça já foi pausada e confirmada por executarRifa. Não gerar cliques
      // paralelos enquanto o servidor processa bilhetes ou o retorno ao farm.
      return;
    }
    if (cfg.ligado && fecharLojaCash(w)) return;
    ligarCalibracao(w);
    instalarGanchos(w);
    vigiarLucky();
    conferirFimConteudo(w);
    vigiarTempoConteudo(w);
    if (!cfg.covil?.ligado && !mapaCovil(posicao(w)) && !covil.mortePendente) vigiarRifa(w);
    if (rifaRodando) return;
    // A tela de tres mortes oferece Renascer agora. Trate-a antes de uma
    // rotina ocupada deixar o personagem esperando no menu.
    if (cfg.ligado && (cfg.covil.ligado && emInstancia(posicao(w)) || mapaCovil(posicao(w)) || covil.mortePendente) && morteConfirmada(w)) {
      covil.mortePendente = true;
      if (!covil.morteRegistrada && cfg.covil.ligado) {
        covil.morteRegistrada = true; contarCovil('morte');
        log('Covil: morte na instância; usando Renascer agora sem voltar a Prontera');
      }
      if (!ocupado) {
        void renascerNoCovil(w);
      }
      return;
    }
    if (!morteConfirmada(w)) {
      covil.morteRegistrada = false;
      covil.mortePendente = false;
    }
    if (cfg.ligado && mapaDeRenascer(posicao(w)) && morteConfirmada(w)) {
      if (!ocupado) void renascerNoLugar(w);
      return;
    }
    if (!cfg.ligado || ocupado) return;
    const cheffRecovery = window.top.__FZN_CHEFF_RECOVERY__;
    const mapaCheff = posicao(w)?.mapa || '';
    if (cheffRecovery?.active && Date.now() - (cheffRecovery.desde || 0) < 45000 && (mapaCheffenia(mapaCheff) || /^prontera$/i.test(mapaCheff) || /cheffenia|chefenia/i.test(mapaCheff))) return;
    const morreu = morteConfirmada(w);
    if (cfg.covil.ligado) {
      if (morreu) { etapa('Covil', 'Aguardando renascimento; não uso retorno ao salvamento'); return; }
      rodadaCovil(w); return;
    }
    if (mapaCovil(posicao(w))) {
      etapa('Covil', 'Ainda na instância; não volto ao farm antes de sair dela');
      return;
    }
    sincronizarMapaAtual(w);
    if (!posicaoInicialVista) {
      const p0 = posicao(w);
      if (p0?.mapa) {
        posicaoInicialVista = true;
        const destino = mapaDoConteudo() || cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
        if ((normalizar(p0.mapa) === 'prontera' || cfg.fimConteudoPendente) && (destino || cfg.retornoEvento) && !recuperacao && !tempoConteudoEsgotado()) {
          log('Carreguei em Prontera; retorno ' + (cfg.retornoEvento ? 'pelo Gerente de Eventos' : 'ao mapa de farm ' + destino) + ': iniciando em instantes');
          recuperacao = { motivo: 'carregou na cidade', fimConteudo: Boolean(cfg.fimConteudoPendente), desde: Date.now(), ultimaEm: Date.now() - 15000, tentativas: 0, retomarAutopilot: true };
        }
      }
    }
    if (!armazemInicialConferido) {
      armazemInicialConferido = true;
      if (armazemAberto(w)) { liberarArmazemInicial(w); return; }
    }
    const salvar = botaoPorTexto(w.document, (t) => t === 'Voltar ao ponto de salvamento');
    if (morreu && !salvar) { recuperarMorteSemDialogo(w); return; }
    if (morreu && salvar) {
      morteSemDialogoDesde = 0;
      if (mapaDeRenascer(posicao(w))) { renascerNoLugar(w); return; }
      aoMorrer(w, salvar); return;
    }
    avisarJanelaOculta(w);
    conferirMapaFarm(w);
    vigiarCidadeSemRotina(w);
    if ((chegadaAtrasada || vigia) && /Economia de energia/.test(w.document.body.innerText || '')) { sairDaEconomia(w); return; }
    if (chegadaAtrasada) { conferirChegadaAtrasada(w); return; }
    if (recuperacao) { rondaDaRecuperacao(w); return; }
    if (vigia) { rondaDaVigia(w); return; }
    if (!conteudoDireto() && cfg.rotinaLimites !== false && (cfg.venda.ligado || guardarTudo() || cfg.ferreiro || cfg.armazem.ligado) && Date.now() - pesoLidoEm > 3000) {
      pesoLidoEm = Date.now();
      const espacoCritico = Date.now() >= espacoTeimosoAte && Boolean(mochilaCheiaConfirmada(w));
      const peso = lerPeso(w);
      const pesoCritico = Boolean(peso && peso.pct >= limiteSeguro());
      const intervalo = espacoCritico || pesoCritico ? 15000 : VENDA_INTERVALO_MS;
      if (Date.now() - ultimaViagemVenda > intervalo && !conferindoLimite) {
        // A proteção por peso consulta os itens da mochila. Sem um snapshot
        // recente, um inventário antigo pode parecer conter só protegidos e
        // manter a venda em espera mesmo após novos drops vendáveis.
        if (pesoCritico || espacoCritico) {
          pesoLidoEm = Date.now() + 12000;
          conferindoLimite = true;
          void (async () => {
            try {
              const atualizou = await lerMochila(w);
              if (!cfg.ligado || ocupado || cfg.rotinaLimites === false || conteudoDireto()) return;
              const limiteAtual = limiteAtualConfirmado(w);
              if (!limiteAtual.atingido) return;
              if (limiteAtual.espacos || precisaVender(w)) {
                log('Limite confirmado com mochila ' + (atualizou ? 'atualizada' : 'sem resposta') +
                  ': peso ' + (limiteAtual.peso ? limiteAtual.peso.pct.toFixed(1) + '%' : 'indisponivel') +
                  (limiteAtual.espacos ? '; espacos ' + limiteAtual.espacos.usados + '/' + limiteAtual.espacos.max : '') + '; iniciando rotina automatica');
                await viagemDeVenda(w);
              }
            } catch (e) {
              log('Conferencia automatica do peso falhou: ' + String(e?.message || e).slice(0, 120));
            } finally { conferindoLimite = false; }
          })();
        } else if (precisaVender(w)) void viagemDeVenda(w);
      }
    }
    if (travaDeMunicao(w)) return;
    // v3.05: com Loja de Bolso, a viagem por suprimento ficava desligada; se a
    // compra na cacada nao acontecia, o item zerava e nada mais o repunha.
    const zerado = cfg.lojaBolso && lojaDeBolso() && itensMochila().length &&
      (cfg.compras || []).some((c) => c && c.nome && Number(c.alvo) > 0 && Number(c.minimo) > 0 && !compraRecusada(c.nome) &&
        quantosNaMochila(c.nome) + naBolsa(w, c.nome) === 0);
    if ((!cfg.lojaBolso || !lojaDeBolso() || zerado) && Date.now() - suprimentoLidoEm > 5000 && Date.now() - ultimaViagemVenda > VENDA_INTERVALO_MS) {
      suprimentoLidoEm = Date.now();
      const pos = posicao(w);
      const listaMin = (cfg.compras || []).filter((c) => c && c.nome && Number(c.alvo) > 0 && Number(c.minimo) > 0 && !compraRecusada(c.nome));
      if (listaMin.length && pos?.mapa && normalizar(pos.mapa) !== 'prontera' && !mapaDeRenascer(pos) && autopilotLigado(w) && itensMochila().length) {
        const baixo = calcularFaltas(w, listaMin);
        suprimentoBaixoVezes = baixo.length ? suprimentoBaixoVezes + 1 : 0;
        if (suprimentoBaixoVezes >= 2) {
          suprimentoBaixoVezes = 0;
          if (cfg.usarBolsa && Date.now() - completarBolsaEm >= 5 * 60 * 1000) {
            ocupado = true;
            completarBolsa(w).then(async (pediu) => {
              ocupado = false;
              if (!pediu) return;
              await lerMochila(w);
              const ainda = calcularFaltas(w, listaMin);
              if (ainda.length) { viagemPorSuprimento = ainda.map((c) => c.nome + ' ' + c.tem + '/' + c.minimo).join(', '); viagemDeVenda(w, true); }
              else log('Bolsa ALT+B: Completar repos ' + baixo.map((c) => c.nome).join(', ') + ' sem sair do mapa');
            }, () => { ocupado = false; });
            return;
          }
          viagemPorSuprimento = baixo.map((c) => c.nome + ' ' + c.tem + '/' + c.minimo).join(', '); viagemDeVenda(w, true); return;
        }
      }
    }
    if (venderParaComprar && cfg.lojaBolso && !ocupado && normalizar(posicao(w)?.mapa) !== 'prontera') {
      venderParaComprar = false; vendeuParaComprarEm = Date.now();
      (cfg.ferreiro ? viagemDeVenda(w, true) : vendaNaInstancia(w, posicao(w))).then(() => { compraBolsoEm = Date.now() - COMPRA_BOLSO_INTERVALO_MS + 2000; });
      return;
    }
    if (cfg.lojaBolso && !ocupado && bolsoDesligouAutopilot && !autopilotLigado(w) && normalizar(posicao(w)?.mapa) !== 'prontera') { ligarAutopilot(w, true); if (autopilotLigado(w)) { bolsoDesligouAutopilot = false; log('Loja de Bolso: autopilot religado (2a tentativa)'); } }
    if (cfg.lojaBolso && !ocupado && Date.now() - compraBolsoEm > COMPRA_BOLSO_INTERVALO_MS && normalizar(posicao(w)?.mapa) !== 'prontera' && autopilotLigado(w)) compraNaHunt(w);
  };

  const calibrando = new WeakSet();
  const ligarCalibracao = (w) => {
    if (calibrando.has(w)) return;
    calibrando.add(w);
    let ultimoClique = 0;
    const onCalibMouseDown = (e) => {
      let isTrusted = false;
      try {
        const desc = Object.getOwnPropertyDescriptor(w.Event.prototype, 'isTrusted');
        if (desc && desc.get) isTrusted = desc.get.call(e);
        else isTrusted = e.isTrusted;
      } catch { isTrusted = e.isTrusted; }
      if (!isTrusted || ocupado || e.target?.tagName !== 'CANVAS') return;
      if (capturando) {
        const p = posicao(w);
        const r = e.target.getBoundingClientRect();
        if (p) {
          const dx = Math.round(e.clientX - (r.left + r.width / 2));
          const dy = Math.round(e.clientY - (r.top + r.height / 2));
          cfg[capturando][chaveCelula(p)] = { dx, dy };
          salvarCfg();
          log(`${capturando === 'kafra' ? 'Kafra' : capturando === 'caminhoBio4' ? 'Caminho Bio4' : 'Vendedor'} calibrado pelo menu em ${chaveCelula(p)}: ${dx},${dy}`);
        }
        capturando = null;
        desenharCalibracao();
        return;
      }
      if (dialogoMercadorAberto(w) || dialogoKafraAberto(w.document)) return;
      const id = ++ultimoClique;
      const p = posicao(w);
      const r = e.target.getBoundingClientRect();
      const dx = Math.round(e.clientX - (r.left + r.width / 2));
      const dy = Math.round(e.clientY - (r.top + r.height / 2));
      esperarAte(() => (dialogoKafraAberto(w.document) ? 'kafra' : (dialogoMercadorAberto(w) ? 'vendedor' : null)), 6000).then((qual) => {
        if (!qual || id !== ultimoClique) return;
        const depois = posicao(w);
        if (!p || !depois || chaveCelula(p) !== chaveCelula(depois)) return;
        cfg[qual][chaveCelula(p)] = { dx, dy };
        salvarCfg();
        log(`${qual === 'kafra' ? 'Kafra' : 'Vendedor'} calibrado em ${chaveCelula(p)}: ${dx},${dy}`);
      });
    };
    onCalibMouseDown.__fznNoWrap = true;
    w.document.addEventListener('mousedown', onCalibMouseDown, true);
  };

  let posicaoInicialVista = false;
  let armazemInicialConferido = false;
  const liberarArmazemInicial = async (w) => {
    ocupado = true;
    try {
      if (!await fecharArmazem(w)) segurarRetorno(w, 'armazem aberto ao iniciar');
      else etapa('Aguardando', 'Armazem inicial fechado; monitorando peso e morte');
    } finally { ocupado = false; atualizarPainel(); }
  };
  const executarAgora = async () => {
    if (ocupado) return;
    const w = jogo();
    if (!w) { etapa('Aguardando jogo', 'A conta ainda nao carregou'); return; }
    relerCalibracao(); cfg.ligado = true; sincronizarMapaAtual(w); salvarCfg(); vigia = null; chegadaAtrasada = null;
    instalarGanchos(w);
    await viagemDeVenda(w, true);
    atualizarPainel();
  };
  const atualizarStatus = () => {
    if (!painel) return;
    const abrir = painel.querySelector('[data-abrir]');
    if (abrir) { abrir.textContent = (rifaRodando ? 'Auto-voltar PAUSADO • Rifa' : 'Auto-voltar ' + (cfg.ligado ? 'ON' : 'OFF')) + ' • ' + andamento.etapa + (controlesAbertos ? ' ▾' : ' ▸'); abrir.title = rifaRodando ? 'Farm pausado até a rifa terminar e o retorno ao mapa concluir' : andamento.detalhe; }
    const controles = painel.querySelector('[data-controles]');
    if (controles) controles.style.display = controlesAbertos ? 'flex' : 'none';
    const w = jogo(), peso = w && lerPeso(w), mapaAtual = w && posicao(w)?.mapa;
    const saldoRifa = rifaMenu?.querySelector('[data-rifa-saldo]');
    if (saldoRifa) {
      const saldo = w ? zenyRifa(w) : NaN;
      saldoRifa.textContent = Number.isFinite(saldo) ? 'Saldo identificado: '+saldo.toLocaleString('pt-BR')+'z' : 'Saldo não identificado — compra aguardará leitura';
    }
    const destinoAtual = mapaDoConteudo() || cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
    const texto = painel.querySelector('[data-status]');
    const espacosStatus = estadoLoja.mochila && Date.now() - estadoLoja.mochilaEm < 20000 ? pilhasReais() : null;
    if (texto) texto.textContent = andamento.etapa + ' · Peso ' + (peso ? peso.pct.toFixed(0) + '%' : '?') +
      ' · Mochila ' + (espacosStatus === null ? '?' : espacosStatus + '/' + capacidadeMochila) +
      (destinoAtual ? ' · Farm: ' + destinoAtual : '') +
      (mapaAtual && destinoAtual && mapaAtual !== destinoAtual ? ' · Fora: ' + mapaAtual : '') +
      (cfg.rifa?.ligado && rifaEstado.etapa && rifaEstado.etapa !== 'Aguardando' ? ' · Rifa: ' + rifaEstado.etapa : '') +
      (ocupado ? ' · ' + Math.floor((Date.now() - andamento.desde) / 1000) + 's' : '') +
      (detalhesProcesso ? ' ▾' : ' ▸');
    const gaveta = painel.querySelector('[data-gaveta]');
    if (gaveta) gaveta.style.display = ajustesAbertos ? 'flex' : 'none';
    const ajustesBtn = painel.querySelector('[data-ajustes]');
    if (ajustesBtn) ajustesBtn.className = ajustesAbertos ? 'fzn-av--on' : '';
    const detalhe = painel.querySelector('[data-detalhe]');
    if (detalhe) detalhe.textContent = andamento.detalhe;
    const alternarHistorico = painel.querySelector('[data-historico-toggle]');
    if (alternarHistorico) {
      alternarHistorico.textContent = detalhesProcesso ? '− Histórico' : '+ Histórico';
      alternarHistorico.title = detalhesProcesso ? 'Recolher histórico' : 'Mostrar histórico';
      alternarHistorico.setAttribute('aria-expanded', String(detalhesProcesso));
    }
    const cartao = painel.querySelector('[data-cartao-farm]');
    if (cartao) { cartao.textContent = 'Cartao Kafra'; cartao.setAttribute('aria-pressed', String(cfg.armazem.tudoNoMapa)); cartao.disabled = ocupado; cartao.className = cfg.armazem.tudoNoMapa ? 'fzn-av--on' : 'fzn-av--off'; }
    const modo = painel.querySelector('[data-modo-inventario]');
    if (modo) { modo.textContent = guardarTudo() ? 'Guardar tudo' : 'Vender permitidos'; modo.disabled = ocupado; modo.className = ''; }
    const evento = painel.querySelector('[data-evento]');
    if (evento) { evento.textContent = 'Evento'; evento.disabled = ocupado; evento.className = cfg.retornoEvento ? 'fzn-av--on' : 'fzn-av--off'; evento.setAttribute('aria-pressed', String(Boolean(cfg.retornoEvento))); }
    for (const modo of ['bio4', 'lhz', 'cheffenia', 'expedicao']) {
      const botao = painel.querySelector('[data-conteudo="' + modo + '"]');
      if (!botao) continue;
      const ligado = cfg.conteudo.modo === modo;
      const minutos = ligado && cfg.conteudo.expiraEm > Date.now()
        ? ' · ' + Math.ceil((cfg.conteudo.expiraEm - Date.now()) / 60000) + 'min' : '';
      botao.textContent = (modo === 'bio4' ? 'Bio 4' : modo === 'lhz' ? 'Invasão LHZ' : modo === 'cheffenia' ? 'Cheffenia' : 'Expedição') + (ligado && cfg.conteudo.esgotado ? ' · sem acesso' : minutos);
      botao.className = ligado ? 'fzn-av--on' : 'fzn-av--off';
      botao.disabled = ocupado;
      botao.setAttribute('aria-pressed', String(ligado));
    }
    const faseExpedicao = painel.querySelector('[data-expedicao-fase]');
    if (faseExpedicao) faseExpedicao.value = cfg.expedicaoFase;
    const limites = painel.querySelector('[data-rotina-limites]');
    if (limites) { limites.textContent = 'Rotina por limite'; limites.disabled = ocupado; limites.className = cfg.rotinaLimites === false ? 'fzn-av--off' : 'fzn-av--on'; limites.setAttribute('aria-pressed', String(cfg.rotinaLimites !== false)); }
    const lucky = painel.querySelector('[data-lucky]');
    if (lucky) {
      const encontrados = (cfg.lucky || []).filter((alvo) => estadoLoja.mochila && totalLucky(alvo, itensMochila()) > 0).length;
      lucky.textContent = `Lucky ${encontrados}/${cfg.lucky.length}`;
      lucky.className = encontrados ? 'fzn-av--on' : '';
      lucky.title = 'Configurar nomes procurados e ver mochila/Kafra. Itens da lista nunca sao vendidos nem desmantelados.';
    }
    if (menuLucky?.isConnected) atualizarMenuLucky();
    const executar = painel.querySelector('[data-executar]');
    if (executar) { executar.disabled = ocupado; executar.textContent = ocupado ? '⏳ Em andamento' : '▶ Executar'; }
    const historico = painel.querySelector('[data-historico]');
    const abasHist = painel.querySelector('[data-abas-hist]');
    if (abasHist) {
      abasHist.style.display = detalhesProcesso ? 'flex' : 'none';
      for (const b of abasHist.querySelectorAll('[data-aba-hist]')) b.className = b.dataset.abaHist === abaHistorico ? 'fzn-av--on' : '';
      const np = problemasLog().length;
      const bp = abasHist.querySelector('[data-aba-hist="problemas"]');
      if (bp) bp.textContent = '⚠ Problemas' + (np ? ' (' + np + ')' : '');
    }
    if (historico) { historico.style.display = detalhesProcesso ? 'block' : 'none'; historico.textContent =
      (cfg.rotinaLimites === false ? 'Rotina por limite OFF: peso e espacos nao iniciam viagens automaticas. Executar agora continua disponivel; morte e falta de suprimentos seguem suas rotinas.\n' : 'Rotina por limite ON: peso inicia em 70%; espacos em 95/100 ou 190/200. Com Ferreiro ON, vai a Prontera para desmantelar antes de guardar e vender.\n') +
      (cfg.retornoEvento ? 'Evento ON: depois da rotina na cidade, fala com o Gerente de Premios e escolhe Ir para o evento. Se falhar, aguarda em Prontera sem usar o mapa-mundi.\n' : '') +
      (mapaDoConteudo() ? (cfg.conteudo.modo === 'bio4' ? 'Bio 4 ON: tempo acompanhado; retorno pelo Porteiro do Biolaboratorio em Prontera.\n' : cfg.conteudo.modo === 'lhz' ? 'Invasão LHZ ON: retorno pelo NPC à esquerda; confirma tempo e revalida Prontera.\n' : cfg.conteudo.modo === 'cheffenia' ? 'Cheffenia ON: tempo acompanhado; retorno pelo Arauto em Prontera.\n' : 'Expedição ON: ' + cfg.expedicaoFase + '; retorno somente pelo NPC Expedições de Yggdrasil em Prontera.\n') : '') +
      (guardarNoMapa() ? 'Passos: pausar cacada → cartao → guardar tudo no maximo → fechar armazem → conferir peso → cacar no mesmo mapa.\n\n' : venderNoMapa() ? 'Passos: pausar cacada → cartao/guardar protegidos → fechar armazem → Loja de Bolso/vender permitidos → conferir peso → cacar no mesmo mapa.\n\n' : guardarTudo() ? 'Passos: pausar cacada → Prontera/Kafra → guardar tudo no maximo → conferir peso → voltar e cacar.\n\n' : 'Passos: pausar cacada → guardar protegidos → Prontera/Kafra → vender permitidos → comprar → conferir peso → voltar e cacar.\n\n') + (abaHistorico === 'problemas' ? (problemasLog().slice(-60).map(linhaHist).join('\n') || 'Nenhum problema registrado.') : historicoLog().slice(-60).map(linhaHist).join('\n')); }
  };

  let painel = null;
  const abrirSubjanela = (el, largura) => {
    el.dataset.fznAutoVoltar = '1';
    const r = painel?.getBoundingClientRect();
    const left = r ? Math.min(Math.max(0, r.left), Math.max(0, window.innerWidth - largura - 8)) : 12;
    const bottom = r ? Math.max(8, window.innerHeight - r.top + 6) : 60;
    const maxH = Math.max(120, window.innerHeight - bottom - 8);
    Object.assign(el.style, { position: 'fixed', left: left + 'px', bottom: bottom + 'px', top: 'auto', zIndex: 2147483001, width: largura + 'px', maxWidth: '95vw', maxHeight: maxH + 'px', overflow: 'auto', padding: '10px 12px' });
  };
  let menuLucky = null;
  const atualizarMenuLucky = () => {
    const resultado = menuLucky?.querySelector('[data-lucky-resultado]');
    if (!resultado) return;
    const mochila = estadoLoja.mochila ? itensMochila() : null;
    const armazem = estadoLoja.armazemEm ? itensArmazem() : null;
    const hora = estadoLoja.armazemEm ? new Date(estadoLoja.armazemEm).toLocaleTimeString() : '';
    resultado.textContent = (cfg.lucky.length ? cfg.lucky : ['Nenhum item configurado']).map((alvo) => {
      if (!cfg.lucky.length) return alvo;
      const bag = mochila ? `${totalLucky(alvo, mochila)} na mochila` : 'mochila ainda sem leitura';
      const kafra = armazem ? `${totalLucky(alvo, armazem)} na Kafra (ultima leitura ${hora})` : 'Kafra ainda sem leitura nesta sessao';
      return `${alvo}: ${bag}; ${kafra}`;
    }).join('\n');
  };
  const abrirMenuLucky = () => {
    if (menuLucky) { menuLucky.remove(); menuLucky = null; return; }
    const p = document.createElement('div'); menuLucky = p;
    abrirSubjanela(p, 380);
    const titulo = document.createElement('b'); titulo.textContent = 'Lucky drops desta conta';
    const dica = document.createElement('p'); dica.textContent = 'Um nome exato por linha. O script avisa quando o item aparece na mochila e impede venda e desmantelamento. Ovos de pet tambem ficam fora do deposito.';
    const campo = document.createElement('textarea');
    campo.setAttribute('aria-label', 'Nomes dos lucky drops');
    campo.value = cfg.lucky.join('\n');
    Object.assign(campo.style, { width: '100%', minHeight: '68px', boxSizing: 'border-box' });
    const salvar = document.createElement('button'); salvar.textContent = 'Salvar lista';
    salvar.addEventListener('click', () => {
      cfg.lucky = [...new Map(campo.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((s) => [nomeBase(s), s])).values()];
      salvarCfg();
      vistoLucky.clear(); seqLuckyMochila = -1;
      vigiarLucky();
 atualizarMenuLucky(); atualizarStatus();
      log('Lucky drops: lista salva (' + cfg.lucky.length + ' itens)');
    });
    const conferir = document.createElement('button'); conferir.textContent = 'Conferir mochila';
    conferir.addEventListener('click', async () => {
      const w = jogo(); if (w) await lerMochila(w);
      vigiarLucky();
 atualizarMenuLucky();
    });
    const resultado = document.createElement('pre'); resultado.dataset.luckyResultado = '1';
    Object.assign(resultado.style, { whiteSpace: 'pre-wrap', font: '12px/1.5 system-ui,sans-serif' });
    const fechar = document.createElement('button'); fechar.textContent = 'Fechar'; fechar.addEventListener('click', abrirMenuLucky);
    p.append(titulo, dica, campo, salvar, conferir, resultado, fechar);
    document.body.appendChild(p);
    atualizarMenuLucky();
  };
  let menuMapaFarm=null;
  let menuCovil = null;
  const abrirMenuCovil = () => {
    if (menuCovil) { menuCovil.remove(); menuCovil = null; return; }
    const p = document.createElement('div'); menuCovil = p; p.dataset.fznAutoVoltar = '1';
    abrirSubjanela(p, 380);
    const desenhar = () => {
      p.textContent = '';
      const c = covilAlvo();
      const titulo = document.createElement('b'); titulo.textContent = 'Covil do MVP (ranking: 100 pontos x tier)'; p.append(titulo);
      const label = document.createElement('label'); label.textContent = 'MVP: ';
      const sel = document.createElement('select'); sel.setAttribute('aria-label', 'MVP do covil');
      for (const tier of [5, 4, 3, 2, 1]) {
        const g = document.createElement('optgroup');
        const pedras = quantosNaMochila(pedraDoCovil({ tier }));
        g.label = 'Tier ' + tier + ' — ' + tier * 100 + ' pontos — Grau ' + GRAU[tier] + ': ' + pedras + ' pedras';
        for (const m of COVIS.filter((x) => x.tier === tier)) { const o = document.createElement('option'); o.value = m.mobId; o.textContent = m.nome; o.selected = m.mobId === c.mobId; g.append(o); }
        sel.append(g);
      }
      sel.onchange = () => { cfg.covil.mobId = Number(sel.value); salvarCfg(); log('Covil: alvo ' + covilAlvo().nome); desenhar(); };
      label.append(sel); p.append(label);
      const info = document.createElement('p');
      info.textContent = c.nome + ' · Tier ' + c.tier + ' · ' + pedraDoCovil(c) + ' na mochila: ' + quantosNaMochila(pedraDoCovil(c)) + ' · Hoje: ' + cfg.covil.hoje + ' MVPs (' + cfg.covil.hoje * c.tier * 100 + ' pts deste tier), ' + cfg.covil.mortesHoje + ' mortes · Total: ' + cfg.covil.total;
      p.append(info);
      const dica = document.createElement('p'); dica.style.color = '#8fa3b3';
      dica.textContent = 'Invoca e só sai após confirmar o abate. Com peso/mochila no limite, vende entre os encontros e retoma o Covil automaticamente. Sem pedras ou 3 falhas de entrada, encerra o Covil. Morte no Covil: renasce com Folha no mesmo mapa.';
      p.append(dica);
      const liga = document.createElement('button');
      liga.textContent = 'Covil: ' + (cfg.covil.ligado ? 'ON' : 'OFF'); liga.className = cfg.covil.ligado ? 'fzn-av--on' : 'fzn-av--off';
      liga.onclick = () => {
        cfg.covil.ligado = !cfg.covil.ligado;
        if (cfg.covil.ligado) { cfg.ligado = true; recuperacao = null; vigia = null; chegadaAtrasada = null; covil.falhas = 0; }
        salvarCfg(); log('Covil ' + (cfg.covil.ligado ? 'ligado: ' + covilAlvo().nome : 'desligado'));
        if (!cfg.covil.ligado && emInstancia(posicao(jogo()))) log('Covil: continuo na instancia ate o MVP morrer; saia quando quiser');
        desenhar(); atualizarPainel();
      };
      const fechar = document.createElement('button'); fechar.textContent = 'Fechar'; fechar.onclick = abrirMenuCovil;
      p.append(liga, fechar);
    };
    const w = jogo(); if (w) lerMochila(w).then(() => { if (menuCovil === p) desenhar(); }).catch(() => {});
    desenhar();
    document.body.append(p);
  };
  const abrirMapaFarm = () => {
    if(ocupado){log('Mapa de farm: aguarde o processo atual terminar');return;}
    if(menuMapaFarm){menuMapaFarm.remove();menuMapaFarm=null;return;}
    const p=document.createElement('div');menuMapaFarm=p;p.dataset.fznAutoVoltar='1';
    abrirSubjanela(p, 350);
    const label=document.createElement('label');label.textContent='Mapa de farm desta conta (codigo): ';
    const input=document.createElement('input');input.type='text';input.placeholder='mag_dun02';input.setAttribute('aria-label','Codigo do mapa de farm');input.value=cfg.mapaFarmManual || cfg.destinoFarm?.mapa || '';label.append(input);p.append(label);
    const dica=document.createElement('p');dica.textContent='Exemplo: mag_dun02. O script pesquisa este codigo e confirma a chegada. Vazio: acompanha o mapa atual automaticamente.';p.append(dica);
    const salvar=document.createElement('button');salvar.textContent='Salvar mapa';salvar.onclick=()=>{
      if(ocupado)return;const codigo=input.value.trim().toLowerCase();
      if(codigo && !/^[a-z0-9_]+$/.test(codigo)){dica.textContent='Use somente letras, numeros e sublinhado no codigo do mapa.';return;}
       cfg.mapaFarmManual=codigo;
       if (codigo && posicao(jogo())?.mapa !== codigo) cfg.destinoPendente = codigo;
       else delete cfg.destinoPendente;
      if(codigo)cfg.destinoFarm={mapa:codigo,nome:codigo};else{const w=jogo();if(w)registrarDestinoFarm(w);}
      salvarCfg();log('Mapa de farm desta conta: '+(codigo||'acompanhar mapa atual'));abrirMapaFarm();atualizarPainel();
    };p.append(salvar);const usarAtual=document.createElement('button');usarAtual.textContent='Usar mapa atual';usarAtual.title='Limpa o bloqueio antigo e retoma a automacao neste mapa';usarAtual.onclick=async()=>{if(ocupado)return;const pos=posicao(jogo());if(pos?.mapa && pos.mapa!=='prontera'){cfg.mapaFarmManual=pos.mapa;salvarCfg();}abrirMapaFarm();await retomarNoMapaAtual();};p.append(usarAtual);const fechar=document.createElement('button');fechar.textContent='Fechar mapa de farm';fechar.onclick=abrirMapaFarm;p.append(fechar);document.body.append(p);
  };
  let editor = null;

  const ABAS = ['Consumíveis', 'Buffs', 'Munições', 'Forja', 'Alquimia', 'Utilitários'];
  const abrirEditor = () => {
    if (editor) { editor.remove(); editor = null; return; }
    if (calib) abrirCalibracao();
    if (menuVenda) abrirMenuVenda(menuVendaProtegidos);
    editor = document.createElement('div');
    abrirSubjanela(editor, 540);
    const campo = '';
    const desenhar = () => {
      const linhas = (cfg.compras || []).map((c, i) => `
        <div data-i="${i}" style="display:flex;gap:4px;margin:4px 0;align-items:center">
          <input data-k="nome" value="${String(c.nome).replace(/"/g, '&quot;')}" placeholder="Nome na loja" style="${campo};flex:1;min-width:0">
          <select data-k="aba" style="${campo}">${ABAS.map((a) => `<option${a === c.aba ? ' selected' : ''}>${a}</option>`).join('')}</select>
          <input data-k="minimo" type="number" min="0" value="${Number(c.minimo) || 0}" title="Minimo: so compra abaixo disto (0 = sempre que faltar)" style="${campo};width:52px">
          <input data-k="alvo" type="number" min="0" value="${Number(c.alvo) || 0}" title="Alvo: completa ate esta quantidade" style="${campo};width:52px">
          <input data-k="estoque" type="number" min="0" max="9999" value="${Number(c.estoque) || 0}" title="Estoque na Bolsa ALT+B (0 = desligado). Ex.: 999. Nao pesa." style="${campo};width:52px">
          <input data-k="lote" type="number" min="1" max="9999" value="${Number(c.lote) || 100}" title="Lote: quanto compra por vez para a Bolsa ate chegar ao estoque" style="${campo};width:46px">
          <button data-rm="${i}" title="Remover" style="${campo};cursor:pointer">✕</button>
        </div>`).join('');
      editor.innerHTML = `
        <div style="font-weight:bold;margin-bottom:4px">Comprar ao voltar</div>
        <div style="opacity:.75;margin-bottom:6px">Nome igual ao da loja, aba, minimo e alvo. Abaixo do minimo, completa ate o alvo (minimo 0 = sempre que faltar). Bolsa: estoque na ALT+B (nao pesa), enchido de Lote em Lote a cada compra.</div>
        <div style="display:flex;gap:4px;opacity:.6;font-size:11px"><span style="flex:1">Item</span><span>Aba</span><span style="width:52px;text-align:center">Min.</span><span style="width:52px;text-align:center">Alvo</span><span style="width:52px;text-align:center" title="Estoque na Bolsa ALT+B">Bolsa</span><span style="width:46px;text-align:center">Lote</span><span style="width:24px"></span></div>
        ${linhas || '<div style="opacity:.6">Nenhum item.</div>'}
        <label style="display:flex;gap:4px;align-items:center;margin-top:6px" title="Depois de comprar, guarda os itens da lista na Bolsa de consumiveis (ALT+B): nao pesa e o Autopilot usa dela primeiro. Antes de viajar por suprimento, usa o Completar do jogo.">
          <input data-usar-bolsa type="checkbox"${cfg.usarBolsa ? ' checked' : ''}> guardar na Bolsa ALT+B (nao pesa)</label>
        <label style="display:flex;gap:4px;align-items:center" title="Volta a cidade so quando o item cair a 20% do alvo (ou ao minimo, o que for menor). Na viagem, completa TODOS os itens ate o alvo.">
          <input data-gatilho type="checkbox"${cfg.gatilhoBaixo ? ' checked' : ''}> voltar so com 20% do alvo</label>
        <div style="opacity:.6;font-size:11px">Sem voltar a cidade: ligue a Loja de Bolso (precisa do item na mochila).</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button data-add style="${campo};cursor:pointer">+ Item</button>
          <label style="display:flex;gap:4px;align-items:center;margin-left:auto">
            <input data-ativo type="checkbox"${cfg.comprar ? ' checked' : ''}> comprar ligado</label>
          <button data-fechar style="${campo};cursor:pointer">Fechar</button>
        </div>`;
    };
    editor.addEventListener('input', (ev) => {
      const linha = ev.target.closest('[data-i]');
      if (linha) {
        const c = cfg.compras[Number(linha.dataset.i)];
        const k = ev.target.dataset.k;
        c[k] = (k === 'alvo' || k === 'minimo' || k === 'estoque') ? Math.max(0, Number(ev.target.value) || 0) : k === 'lote' ? Math.max(1, Number(ev.target.value) || 100) : ev.target.value;
      }
      if (ev.target.matches('[data-ativo]')) cfg.comprar = ev.target.checked;
      if (ev.target.matches('[data-usar-bolsa]')) cfg.usarBolsa = ev.target.checked;
      if (ev.target.matches('[data-gatilho]')) cfg.gatilhoBaixo = ev.target.checked;
      salvarCfg();
    });
    editor.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.matches('[data-add]')) { cfg.compras.push({ nome: '', aba: 'Consumíveis', minimo: 0, alvo: 0 }); salvarCfg(); desenhar(); }
      else if (t.matches('[data-rm]')) { cfg.compras.splice(Number(t.dataset.rm), 1); salvarCfg(); desenhar(); }
      else if (t.matches('[data-fechar]')) abrirEditor();
    });
    desenhar();
    document.body.appendChild(editor);
  };

  let capturando = null;
  let calib = null;
  let marcas = [];
  let marcasTimer = 0;

  const limparMarcas = () => { for (const m of marcas) m.remove(); marcas = []; };
  const desenharMarcas = () => {
    limparMarcas();
    const w = jogo();
    const iframe = [...document.querySelectorAll('iframe')].find((f) => { try { return f.contentWindow === w; } catch { return false; } });
    const p = w && posicao(w);
    const canvas = w && canvasDoJogo(w);
    if (!iframe || !p || !canvas) return;
    const fr = iframe.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const chave = chaveCelula(p);
    for (const [tipo, cor, rotulo] of [['kafra', '#3fa9f5', 'Kafra'], ['vendedor', '#f5a623', 'Mercador']]) {
      const ponto = cfg[tipo][chave] || (tipo === 'kafra' ? KAFRA_PADRAO : VENDEDOR_PADRAO)[chave];
      if (!ponto) continue;
      const m = document.createElement('div');
      Object.assign(m.style, {
        position: 'fixed', zIndex: 2147483646, pointerEvents: 'none',
        left: `${fr.left + cr.left + cr.width / 2 + ponto.dx - 8}px`,
        top: `${fr.top + cr.top + cr.height / 2 + ponto.dy - 8}px`,
        width: '16px', height: '16px', border: `2px solid ${cor}`, borderRadius: '50%', boxShadow: '0 0 0 1px #000'
      });
      const t = document.createElement('div');
      Object.assign(t.style, { position: 'absolute', left: '18px', top: '-2px', font: 'bold 11px sans-serif', color: cor, textShadow: '0 0 2px #000', whiteSpace: 'nowrap' });
      t.textContent = rotulo;
      m.appendChild(t);
      document.body.appendChild(m);
      marcas.push(m);
    }
  };

  const testarNpc = async (tipo) => {
    const w = jogo();
    if (!w || ocupado) { log('Teste: jogo ocupado ou nao encontrado'); return; }
    ocupado = true;
    try {
      const ok = tipo === 'kafra'
        ? await falarComNpc(w, 'kafra', () => dialogoKafraAberto(w.document))
        : await falarComNpc(w, 'vendedor', () => dialogoMercadorAberto(w));
      log(`Teste ${tipo === 'kafra' ? 'Kafra' : 'Mercador'}: ${ok ? 'conversa abriu' : 'FALHOU'}`);
      if (ok) {
        await esperar(250);
        if (tipo === 'vendedor') await fecharLoja(w);
        try { w.__elragEngine.cancelNpcDialog?.(); } catch {}
      }
    } finally {
      ocupado = false;
      desenharCalibracao();
    }
  };

  function desenharCalibracao() {
    if (!calib) return;
    const w = jogo();
    const p = w && posicao(w);
    const chave = p ? chaveCelula(p) : null;
    const fmt = (tipo) => {
      const salvo = chave && cfg[tipo][chave];
      const padrao = chave && (tipo === 'kafra' ? KAFRA_PADRAO : VENDEDOR_PADRAO)[chave];
      return salvo ? `${salvo.dx}, ${salvo.dy}` : (padrao ? `${padrao.dx}, ${padrao.dy} (padrao)` : '<span style="color:#f88">sem ponto</span>');
    };
    const celulas = (tipo) => Object.keys(cfg[tipo]).join(' · ') || 'nenhuma';
    const bt = '';
    const aviso = capturando
      ? `<div style="background:rgba(255,179,138,.15);border:1px solid rgba(255,179,138,.4);padding:6px;border-radius:6px;margin-bottom:6px">${capturando === 'caminhoBio4' ? 'Clique agora no <b>chao em 169,184</b> (perto do Porteiro do Biolaboratorio) dentro do jogo.' : 'Clique agora no(a) <b>' + (capturando === 'kafra' ? 'Kafra' : 'Mercador') + '</b> dentro do jogo.'} <button data-c="cancelar" style="${bt}">Cancelar</button></div>`
      : '';
    calib.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px">Calibrar Kafra e Mercador</div>
      <div>Celula atual: <b>${chave || '? (jogo nao encontrado)'}</b></div>
      <div style="margin:6px 0">
        <div><span style="color:#3fa9f5">&#9679;</span> Kafra: ${fmt('kafra')}</div>
        <div><span style="color:#f5a623">&#9679;</span> Mercador: ${fmt('vendedor')}</div>
        <div><span style="color:#6fe38a">&#9679;</span> Caminho Bio4: ${chave && cfg.caminhoBio4[chave] ? cfg.caminhoBio4[chave].dx + ', ' + cfg.caminhoBio4[chave].dy : '<span style="color:#f88">sem ponto nesta celula</span>'}</div>
      </div>
      ${aviso}
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        <button data-c="cap-kafra" style="${bt}">Calibrar Kafra</button>
        <button data-c="cap-vendedor" style="${bt}">Calibrar Mercador</button>
        <button data-c="cap-bio4" style="${bt}" title="Fique em Prontera no ponto de nascimento (ex. 155,183) e clique no chao em 169,184">Calibrar caminho Bio4</button>
        <button data-c="teste-kafra" style="${bt}">Testar Kafra</button>
        <button data-c="teste-vendedor" style="${bt}">Testar Mercador</button>
        <button data-c="marcas" style="${bt}">${marcasTimer ? 'Esconder' : 'Mostrar'} pontos na tela</button>
        <button data-c="apagar" style="${bt}">Apagar desta celula</button>
        <button data-c="fechar" style="${bt};margin-left:auto">Fechar</button>
      </div>
      <div style="opacity:.7;margin-top:8px;font-size:11px">
        A Kafra e o vendedor de Prontera agora sao encontrados pelas entidades do mapa. Zoom e rotacao nao exigem recalibracao. Os pontos antigos ficam apenas como registro.
        <br>Celulas com Kafra: ${celulas('kafra')}<br>Celulas com Mercador: ${celulas('vendedor')}
      </div>`;
  }

  const abrirCalibracao = () => {
    if (calib) {
      calib.remove(); calib = null; capturando = null;
      clearInterval(marcasTimer); marcasTimer = 0; limparMarcas();
      return;
    }
    if (editor) abrirEditor();
    if (menuVenda) abrirMenuVenda(menuVendaProtegidos);
    calib = document.createElement('div');
    abrirSubjanela(calib, 440);
    calib.addEventListener('click', (ev) => {
      const c = ev.target?.dataset?.c;
      if (!c) return;
      if (c === 'cap-kafra') capturando = 'kafra';
      else if (c === 'cap-vendedor') capturando = 'vendedor';
      else if (c === 'cap-bio4') capturando = 'caminhoBio4';
      else if (c === 'cancelar') capturando = null;
      else if (c === 'teste-kafra') testarNpc('kafra');
      else if (c === 'teste-vendedor') testarNpc('vendedor');
      else if (c === 'marcas') {
        if (marcasTimer) { clearInterval(marcasTimer); marcasTimer = 0; limparMarcas(); }
        else { desenharMarcas(); marcasTimer = setInterval(desenharMarcas, 700); }
      } else if (c === 'apagar') {
        const w = jogo(); const p = w && posicao(w);
        if (p) { delete cfg.kafra[chaveCelula(p)]; delete cfg.vendedor[chaveCelula(p)]; salvarCfg(); log(`Pontos apagados em ${chaveCelula(p)}`); }
      } else if (c === 'fechar') { abrirCalibracao(); return; }
      desenharCalibracao();
    });
    document.body.appendChild(calib);
    desenharCalibracao();
  };

  let menuVenda = null;
  let menuVendaProtegidos = false;
  const fecharOutros = (manter) => {
    if (manter !== 'editor' && editor) abrirEditor();
    if (manter !== 'calib' && calib) abrirCalibracao();
    if (manter !== 'venda' && menuVenda) abrirMenuVenda(menuVendaProtegidos);
  };

  const testarVenda = async () => {
    const w = jogo();
    if (!w || ocupado) { log('Teste venda: jogo ocupado ou nao encontrado'); return; }
    ocupado = true;
    try { await venderItens(w, true); } finally { ocupado = false; }
  };

  function abrirMenuVenda(focoProtegidos = false) {
    // Eventos de clique passam um objeto; apenas true abre diretamente a lista.
    focoProtegidos = focoProtegidos === true;
    if (menuVenda) {
      const mesmoMenu = menuVendaProtegidos === focoProtegidos;
      menuVenda.remove(); menuVenda = null;
      if (mesmoMenu) return;
    }
    fecharOutros('venda');
    menuVendaProtegidos = focoProtegidos;
    menuVenda = document.createElement('div');
    abrirSubjanela(menuVenda, 440);
    const campo = '';
    const v = cfg.venda;
    const w = jogo();
    const p = w && lerPeso(w);
    menuVenda.innerHTML = `
      ${!focoProtegidos ? `
      <div style="font-weight:bold;margin-bottom:4px">Vender no Mercador</div>
      <div style="margin-bottom:8px;color:#ffb38a">Retorno permitido somente abaixo de ${limiteSeguro()}% de peso (teto de 70%). Se o peso continuar alto ou nao puder ser lido, Auto-voltar e autopilot ficam pausados. Cartao Kafra nunca e vendido.</div>
      <div style="opacity:.75;margin-bottom:8px">Ao chegar no limite de peso, volta ao ponto de salvamento, usa "Vender tudo" e tira os itens protegidos antes de confirmar. Itens com cadeado o jogo ja nao vende.</div>
      <label style="display:flex;gap:6px;align-items:center"><input data-v="ligado" type="checkbox"${v.ligado ? ' checked' : ''}> venda ligada</label>
      <label style="display:flex;gap:6px;align-items:center;margin:6px 0">Vender ao chegar em
        <input data-v="limite" type="number" min="10" max="100" value="${Number(v.limite) || 70}" style="${campo};width:52px">% do peso
        <span style="opacity:.7">(agora: ${p ? `${p.atual}/${p.max} = ${Math.round(p.pct)}%` : '?'})</span></label>
      <label style="display:flex;gap:6px;align-items:center;margin:6px 0">Capacidade da mochila
        <select data-capacidade style="${campo}">
          <option value="100"${capacidadeMochila === 100 ? ' selected' : ''}>100 slots</option>
          <option value="200"${capacidadeMochila === 200 ? ' selected' : ''}>200 slots</option>
        </select></label>
      <div style="opacity:.75;margin-bottom:6px">O script aprende a capacidade pelo jogo e continua conferindo os slots com a mochila fechada. Ajuste aqui se a conta tiver 200 slots e o limite ainda nao tiver sido reconhecido.</div>
      <div style="margin:8px 0">
        <label style="display:flex;gap:6px;align-items:center"><input data-ar="ligado" type="checkbox"${cfg.armazem.ligado ? ' checked' : ''}> Guardar no armazem os itens de Nunca vender</label>
        <label style="display:flex;gap:6px;align-items:center"><input data-ar="usarCartao" type="checkbox"${cfg.armazem.usarCartao ? ' checked' : ''}> Usar Cartao Kafra no mapa quando disponivel</label>
        <div style="opacity:.75;margin-top:4px">Sem cartao, guarda pela Kafra de Prontera. Itens equipados, travados, favoritos e o Cartao Kafra nunca vao para o armazem. Configure os itens protegidos em Nunca vender.</div>
      </div>
      ` : `
      <div data-nunca-vender>
      <div style="font-weight:bold;margin-bottom:4px">Nunca vender — itens protegidos</div>
      <p>Estes nomes bloqueiam venda e desmantelamento. A lista pessoal é salva automaticamente só nesta conta.</p>
      <details style="margin:6px 0"><summary style="cursor:pointer">Itens de mapa e raros (${NUNCA_VENDER_FIXO.length}) — proteção fixa</summary>
        <ul>${NUNCA_VENDER_FIXO.map(nome => `<li>${nome}</li>`).join('')}</ul></details>
      <details style="margin:6px 0"><summary style="cursor:pointer">Prêmios da rifa (${PREMIOS_RIFA.length}) — proteção fixa</summary>
        <ul>${PREMIOS_RIFA.map(nome => `<li>${nome}</li>`).join('')}</ul></details>
      <details style="margin:6px 0"><summary style="cursor:pointer">Consolação da rifa (${CONSOLACAO_RIFA.length}) — proteção fixa</summary>
        <ul>${CONSOLACAO_RIFA.map(nome => `<li>${nome.replace(/&/g, '&amp;')}</li>`).join('')}</ul></details>
      <label for="fzn-nunca-vender-nomes" style="display:block;margin-top:8px;font-weight:bold">Minha lista desta conta</label>
      <div>Um nome por linha. Aceita parte do nome; nomes de até 3 letras precisam ser palavras inteiras. Acrescente aqui outros itens de mapa que quiser preservar.</div>
      <textarea id="fzn-nunca-vender-nomes" aria-label="Itens que nunca serão vendidos nesta conta" data-v="nomes" rows="6" style="${campo};width:100%;box-sizing:border-box">${(v.nomes || []).join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <div style="opacity:.75">As listas fixas continuam protegidas ao limpar sua lista. Também são preservados lendários/míticos, lucky drops procurados, favoritos, cadeados e suprimentos de farm conforme as regras existentes. O nome indica a proteção; a origem de cada exemplar não é identificada.</div>
      </div>
      <div style="font-weight:bold;margin:8px 0 4px">Proteção por tipo e raridade</div>
      ${TIPOS_VENDA.map(([k, r]) => `<label style="display:flex;gap:6px;align-items:center"><input data-p="${k}" type="checkbox"${v.proteger[k] ? ' checked' : ''}> ${r}</label>`).join('')}
      <label style="display:flex;gap:6px;align-items:center"><input data-v="comCarta" type="checkbox"${v.comCarta ? ' checked' : ''}> Equipamentos com carta encaixada</label>
      <label style="display:flex;gap:6px;align-items:center;margin-top:4px">Raridade a partir de
        <select data-v="raridadeMin" style="${campo}">
          <option value="0"${!(Number(v.raridadeMin) > 0) ? ' selected' : ''}>(nao proteger por raridade)</option>
          ${RARIDADES.map((r, i) => `<option value="${i + 1}"${Number(v.raridadeMin) === i + 1 ? ' selected' : ''}>${r}</option>`).join('')}
        </select></label>
      `}
      <div style="display:flex;gap:6px;margin-top:8px">
        ${!focoProtegidos ? `<button data-a="testar" title="Parado na chegada, ao lado do Mercador: monta a venda e mostra no log o que sairia, sem confirmar" style="${campo};cursor:pointer">Testar (sem vender)</button>` : ''}
        <button data-a="fechar" style="${campo};cursor:pointer;margin-left:auto">Fechar</button>
      </div>`;
    menuVenda.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.ar) cfg.armazem[t.dataset.ar] = t.checked;
      if (t.dataset.capacidade !== undefined) definirCapacidadeMochila(t.value, 'ajuste da conta');
      if (t.dataset.p) v.proteger[t.dataset.p] = t.checked;
      const k = t.dataset.v;
      if (k === 'ligado' || k === 'comCarta') v[k] = t.checked;
      else if (k === 'limite') v.limite = Math.min(100, Math.max(10, Number(t.value) || 70));
      else if (k === 'raridadeMin') v.raridadeMin = Number(t.value) || 0;
      else if (k === 'nomes') v.nomes = t.value.split('\n').map((s) => s.trim()).filter(Boolean);
      salvarCfg();
    });
    menuVenda.addEventListener('click', (ev) => {
      const a = ev.target?.dataset?.a;
      if (a === 'testar') testarVenda();
      else if (a === 'fechar') abrirMenuVenda(focoProtegidos);
    });
    document.body.appendChild(menuVenda);
  }

  function atualizarPainel() {
    if (!document.body) return;
    if (!painel) {
      for (const antigo of document.querySelectorAll('[data-fzn-auto-voltar] [data-abrir]')) antigo.parentElement.style.display = 'none';
      for (const sonda of document.querySelectorAll('textarea[aria-label="Leitura camera NPC"], textarea[aria-label="Leitura retorno"]')) sonda.parentElement.style.display = 'none';
      if (!document.getElementById('fzn-autovoltar-contraste')) {
        const css = document.createElement('style');
        css.id = 'fzn-autovoltar-contraste';
        css.textContent = `
          [data-fzn-auto-voltar] {
            font:12px/1.35 system-ui,"Segoe UI",sans-serif; color:#f2eedc;
            background:rgba(18,22,30,.94); border:1px solid rgba(120,200,255,.4);
            border-radius:10px; box-shadow:0 6px 22px rgba(0,0,0,.5); box-sizing:border-box;
          }
          [data-fzn-auto-voltar] .fzn-av__topo {
            width:100%; display:flex; align-items:center; gap:6px; cursor:grab;
            touch-action:none; user-select:none; padding:0 2px 4px;
            border-bottom:1px solid rgba(120,200,255,.2); margin-bottom:2px;
          }
          [data-fzn-auto-voltar] .fzn-av__topo b { flex:1; font-weight:600; }
          [data-fzn-auto-voltar] .fzn-av__topo small { color:#8fa3b3; }
          [data-fzn-auto-voltar] button {
            font:inherit; font-size:11px; font-weight:700; color:#cfe3f0; background:#2c3544;
            border:1px solid rgba(120,200,255,.35); border-radius:999px; padding:4px 10px;
            opacity:1; cursor:pointer;
          }
          [data-fzn-auto-voltar] button:hover:not(:disabled) { background:#36435a; }
          [data-fzn-auto-voltar] button.fzn-av--on { background:#6fe38a; color:#05170a; border-color:#6fe38a; }
          [data-fzn-auto-voltar] button.fzn-av--off { background:#5b5470; color:#d8d4e8; border-color:#5b5470; }
          [data-fzn-auto-voltar] button:disabled {
            background:#232a36!important; color:#8fa3b3!important; opacity:1!important; cursor:wait;
          }
          [data-fzn-auto-voltar] input, [data-fzn-auto-voltar] select, [data-fzn-auto-voltar] textarea {
            font:inherit; color:#f2eedc; background:#2c3544;
            border:1px solid rgba(120,200,255,.35); border-radius:6px; padding:2px 5px;
          }
          [data-fzn-auto-voltar] pre { color:#8fa3b3; }
          [data-fzn-auto-voltar] button:focus-visible,
          [data-fzn-auto-voltar] input:focus-visible {
            outline:2px solid #facc15; outline-offset:2px;
          }
          [data-fzn-auto-voltar] input[type="text"] { padding:4px 6px; max-width:100%; box-sizing:border-box; }
          [data-fzn-auto-voltar] input::placeholder {color:#8fa3b3; opacity:1;}
          [data-fzn-auto-voltar] .fzn-av__barra { display:flex; gap:4px; align-items:center; width:100%; }
          [data-fzn-auto-voltar] .fzn-av__barra [data-liga] { min-width:64px; }
          [data-fzn-auto-voltar] .fzn-av__barra [data-ajustes] { margin-left:auto; padding:4px 8px; }
          [data-fzn-auto-voltar] .fzn-av__gaveta { width:100%; display:flex; flex-direction:column; gap:5px; padding:6px 0 2px; border-top:1px solid rgba(120,200,255,.15); }
          [data-fzn-auto-voltar] .fzn-av__grupo { display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
          [data-fzn-auto-voltar] .fzn-av__grupo > span { width:100%; font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#8fa3b3; }
          [data-fzn-auto-voltar] .fzn-av__gaveta button { font-weight:600; background:transparent; color:#aab8c4; border-color:rgba(143,163,179,.35); }
          [data-fzn-auto-voltar] .fzn-av__gaveta button.fzn-av--on { background:rgba(111,227,138,.14); color:#6fe38a; border-color:rgba(111,227,138,.55); }
          [data-fzn-auto-voltar] .fzn-av__gaveta button.fzn-av--off { background:transparent; color:#8f8aa3; border-color:rgba(143,138,163,.35); }
          [data-fzn-auto-voltar] [data-status] { cursor:pointer; font-size:11px; }
        `;
        document.head.appendChild(css);
      }
      painel = document.createElement('div');
      painel.dataset.fznAutoVoltar = '1';
      Object.assign(painel.style, { position: 'fixed', left: '12px', bottom: '12px', zIndex: 2147483647, pointerEvents: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', maxWidth: 'min(540px, 95vw)', gap: '4px', padding: '6px 8px' });
      const estilo = () => {};
      const liga = document.createElement('button');
      liga.dataset.liga = '1';
      estilo(liga);
      liga.addEventListener('click', async () => {
        if (ocupado) { interromperTudo(); return; }
        canceladoAte = 0;
        relerCalibracao();
        cfg.ligado = !cfg.ligado;
        const atual = jogo();
        if (cfg.ligado && atual && posicao(atual)?.mapa && normalizar(posicao(atual).mapa) !== 'prontera') {
          await retomarNoMapaAtual(); log('ligado'); return;
        }
        if (cfg.ligado && cfg.retornoPendente) {
          const w = jogo();
          const mapa = w && posicao(w)?.mapa;
          if (cfg.retornoPendente.retomarAutopilot && botaoHunt(w, false)) huntsPausados.add(w);
          if (normalizar(mapa) === 'prontera') {
            vigia = { cidade: mapa, ultimaEm: 0, refazerCidade: true, retomarAutopilot: cfg.retornoPendente.retomarAutopilot };
          } else {
            sincronizarMapaAtual(w);
          }
        }
        if (cfg.ligado) { const w = jogo(); if (w) sincronizarMapaAtual(w); }
        salvarCfg();
        log(cfg.ligado ? 'ligado' : 'desligado');
      });
      const compras = document.createElement('button');
      estilo(compras);
      compras.textContent = 'Compras';
      compras.addEventListener('click', abrirEditor);
      const bolso = document.createElement('button');
      bolso.title = 'Loja de Bolso: quando a lista de Compras pedir reposicao (minimo), pausa a cacada, compra pelo item Loja de Bolso e continua no mesmo mapa. Confere a cada 1 min.';
      const pintarBolso = () => { bolso.textContent = 'Loja de Bolso'; bolso.className = cfg.lojaBolso ? 'fzn-av--on' : 'fzn-av--off'; };
      bolso.addEventListener('click', () => { if (ocupado) return; cfg.lojaBolso = !cfg.lojaBolso; compraBolsoEm = 0; salvarCfg(); log('Loja de Bolso ' + (cfg.lojaBolso ? 'ligada' : 'desligada')); pintarBolso(); });
      pintarBolso();
      const ferreiro = document.createElement('button');
      ferreiro.title = 'Ferreiro (158,191): ao chegar em 95% dos espacos da mochila, vai a Prontera e desmonta os equipamentos elegiveis antes de guardar e vender. Nunca destrava itens.';
      const pintarFerreiro = () => { ferreiro.textContent = 'Ferreiro'; ferreiro.className = cfg.ferreiro ? 'fzn-av--on' : 'fzn-av--off'; };
      ferreiro.addEventListener('click', () => { if (ocupado) return; cfg.ferreiro = !cfg.ferreiro; salvarCfg(); log('Ferreiro ' + (cfg.ferreiro ? 'ligado' : 'desligado')); pintarFerreiro(); });
      pintarFerreiro();
      const calibrar = document.createElement('button');
      estilo(calibrar);
      calibrar.textContent = 'Calibrar';
      calibrar.addEventListener('click', abrirCalibracao);
      const venda = document.createElement('button');
      estilo(venda);
      venda.textContent = 'Venda';
      venda.addEventListener('click', abrirMenuVenda);
      const nuncaVenderBtn = document.createElement('button'); estilo(nuncaVenderBtn);
      nuncaVenderBtn.textContent = 'Nunca vender';
      nuncaVenderBtn.title = 'Consultar proteções fixas e editar os itens protegidos desta conta';
      nuncaVenderBtn.addEventListener('click', () => abrirMenuVenda(true));
      const executar = document.createElement('button'); estilo(executar);
      executar.dataset.executar = '1'; executar.addEventListener('click', executarAgora);
      const usarMapa = document.createElement('button'); estilo(usarMapa); usarMapa.textContent = 'Usar mapa atual'; usarMapa.title = 'Limpa o bloqueio antigo e retoma a automacao neste mapa'; usarMapa.addEventListener('click', async()=>{if(ocupado)return;const p=posicao(jogo());if(p?.mapa && p.mapa!=='prontera'){cfg.mapaFarmManual=p.mapa;salvarCfg();}await retomarNoMapaAtual();});
      const detalhes = document.createElement('button'); estilo(detalhes); detalhes.textContent = 'Histórico';
      detalhes.addEventListener('click', () => { detalhesProcesso = !detalhesProcesso; atualizarStatus(); });
      const aplicarBackup = (dados) => {
        if (dados?.formato !== 'fzn-autovoltar-backup' || !dados.cfg ||
            typeof dados.cfg !== 'object' || Array.isArray(dados.cfg)) throw new Error('formato invalido');
        const idDestaConta = cfg.backupId || novoIdBackup();
        for (const [chave, valor] of Object.entries(dados.cfg)) {
          if (!['__proto__', 'constructor', 'prototype', 'backupId'].includes(chave)) cfg[chave] = valor;
        }
        cfg.backupId = idDestaConta;
        salvarCfg();
        if (Array.isArray(dados.historico)) { historicoMem = dados.historico.slice(-100); gravarJson(CHAVE_LOG, historicoMem); }
        log('Configuracoes restauradas; mapa, listas e opcoes desta conta recuperados');
        painel?.remove(); painel = null; atualizarPainel();
      };
      const seletorArquivoBackup = () => {
        const entrada = document.createElement('input'); entrada.type = 'file'; entrada.accept = '.json,application/json';
        entrada.addEventListener('change', async () => {
          const arquivo = entrada.files?.[0];
          if (!arquivo || arquivo.size > 500000) return log('Backup nao selecionado ou grande demais');
          try { aplicarBackup(JSON.parse(await arquivo.text())); }
          catch (e) { log('Backup nao restaurado: ' + String(e?.message || e).slice(0, 80)); }
        }, { once: true });
        entrada.click();
      };
      const painelBackups = () => {
        const lista = backupsDoHub();
        const caixa = document.createElement('div');
        Object.assign(caixa.style, {
          position: 'fixed', zIndex: '2147483647', left: 'max(12px, calc(50% - 225px))',
          top: 'max(12px, calc(50% - 180px))', width: 'min(450px, calc(100vw - 24px))',
          maxHeight: 'min(70vh, 500px)', overflow: 'auto', boxSizing: 'border-box',
          padding: '12px', background: '#172433', color: '#f3f5f7', border: '1px solid #8095a8',
          borderRadius: '10px', boxShadow: '0 12px 35px #000b', font: '13px/1.4 system-ui,sans-serif'
        });
        const cab = document.createElement('div');
        Object.assign(cab.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' });
        const titulo = document.createElement('strong'); titulo.textContent = 'Backup dos ajustes'; cab.appendChild(titulo);
        const fechar = document.createElement('button'); estilo(fechar); fechar.textContent = 'Fechar';
        fechar.addEventListener('click', () => caixa.remove()); cab.appendChild(fechar); caixa.appendChild(cab);
        const salvarAgora = document.createElement('button'); salvarAgora.textContent = 'Salvar ajustes agora';
        salvarAgora.addEventListener('click', () => { exportar.click(); caixa.remove(); });
        Object.assign(salvarAgora.style, { marginTop: '8px' }); caixa.appendChild(salvarAgora);
        const aviso = document.createElement('p');
        aviso.textContent = lista.length ? 'Escolha o backup desta conta pelo mapa e data. Os ajustes do jogo permanecem salvos no Hub mesmo apos limpar o cache do jogo.' : 'Nenhum backup do Hub encontrado. Voce ainda pode escolher um arquivo JSON externo.';
        Object.assign(aviso.style, { margin: '9px 0', color: '#dbe7ef' }); caixa.appendChild(aviso);
        for (const dados of lista) {
          const item = document.createElement('button'); estilo(item);
          Object.assign(item.style, { display: 'block', width: '100%', textAlign: 'left', margin: '5px 0', padding: '8px' });
          const mapa = dados.cfg.mapaFarmManual || dados.cfg.destinoFarm?.mapa || 'mapa nao definido';
          const data = dados.salvoEm ? new Date(dados.salvoEm).toLocaleString('pt-BR') : 'data desconhecida';
          const atual = dados.cfg.backupId === cfg.backupId ? ' (esta conta)' : '';
          item.textContent = `${mapa}${atual} — ${data} — ${dados.cfg.venda?.nomes?.length || 0} protegidos`;
          item.addEventListener('click', () => { try { aplicarBackup(dados); caixa.remove(); } catch (e) { log('Backup nao restaurado: ' + String(e?.message || e)); } });
          caixa.appendChild(item);
        }
        const arquivo = document.createElement('button'); estilo(arquivo); arquivo.textContent = 'Escolher arquivo JSON';
        arquivo.addEventListener('click', () => { caixa.remove(); seletorArquivoBackup(); });
        caixa.appendChild(arquivo);
        document.body.appendChild(caixa);
      };
      const exportar = document.createElement('button'); estilo(exportar); exportar.textContent = 'Salvar ajustes';
      exportar.title = 'Guarda as configuracoes desta conta no armazenamento do Hub, separado do cache do jogo. Recupere-as em Restaurar ajustes.';
      exportar.addEventListener('click', () => {
        salvarCfg();
        const conferido = backupsDoHub().some((x) => x.cfg.backupId === cfg.backupId &&
          JSON.stringify(x.cfg) === JSON.stringify(cfg));
        log(conferido ? 'Backup salvo no Hub. Use Restaurar ajustes para recupera-lo apos limpar o cache.' :
          'Backup no Hub nao confirmado; mantenha os ajustes atuais ate conferir o armazenamento.');
      });
      const importar = document.createElement('button'); estilo(importar); importar.textContent = 'Backup';
      importar.title = 'Salvar os ajustes desta conta no Hub, ou restaurar um backup (do Hub ou arquivo JSON).';
      importar.addEventListener('click', () => {
        if (ocupado) return;
        painelBackups();
      });
      const status = document.createElement('div'); status.dataset.status = '1';
      Object.assign(status.style, { width: '100%', color: '#cfe3f0', fontWeight: '600', fontVariantNumeric: 'tabular-nums' });
      const detalhe = document.createElement('div'); detalhe.dataset.detalhe = '1';
      Object.assign(detalhe.style, { flex: '1', minWidth: '0', color: '#f2eedc' });
      const alternarHistorico = document.createElement('button'); estilo(alternarHistorico);
      alternarHistorico.dataset.historicoToggle = '1';
      alternarHistorico.addEventListener('click', () => { detalhesProcesso = !detalhesProcesso; atualizarStatus(); });
      const linhaHistorico = document.createElement('div');
      Object.assign(linhaHistorico.style, { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' });
      linhaHistorico.append(detalhe, alternarHistorico);
      const abasHist = document.createElement('div'); abasHist.dataset.abasHist = '1';
      Object.assign(abasHist.style, { display: 'none', gap: '4px', width: '100%', marginTop: '3px' });
      for (const [id, nome] of [['problemas', '⚠ Problemas'], ['tudo', 'Tudo']]) {
        const b = document.createElement('button'); estilo(b); b.dataset.abaHist = id; b.textContent = nome;
        b.addEventListener('click', () => { abaHistorico = id; atualizarStatus(); });
        abasHist.appendChild(b);
      }
      const limparProb = document.createElement('button'); estilo(limparProb); limparProb.textContent = 'Limpar problemas';
      limparProb.style.marginLeft = 'auto';
      limparProb.addEventListener('click', () => { problemasMem = []; gravarJson(CHAVE_PROBLEMAS, []); atualizarStatus(); });
      abasHist.appendChild(limparProb);
      const historico = document.createElement('pre'); historico.dataset.historico = '1';
      Object.assign(historico.style, { whiteSpace: 'pre-wrap', width: '100%', maxHeight: '28vh', overflow: 'auto', margin: '3px 0', font: '11px/1.35 system-ui,sans-serif' });
      const abrir = document.createElement('button'); estilo(abrir); abrir.dataset.abrir = '1';
      const conteudo = document.createElement('div'); conteudo.dataset.controles = '1';
      Object.assign(conteudo.style, { display: 'flex', flexWrap: 'wrap', gap: '4px', width: '100%', alignItems: 'center' });
      const ajuda = document.createElement('div'); ajuda.textContent = 'Rotina por limite ON: peso em 70% OU mochila com 95% dos espacos confirmados iniciam o processo; Cartao Kafra e Loja de Bolso podem concluir no mapa. OFF: ignora esses limites e continua a cacada mesmo com mochila cheia; Executar agora ainda funciona. Evento ON retorna pelo Gerente de Premios. Ferreiro ON desmantela antes da venda. Ovos de pet, Cartao, flechas, equipados, travados e favoritos ficam na mochila. Historico mostra as etapas. Funciona em segundo plano.';
      Object.assign(ajuda.style, { color: '#8fa3b3', fontSize: '11px', width: '100%', padding: '4px 0' });
      const cartaoFarm=document.createElement('button');estilo(cartaoFarm);cartaoFarm.dataset.cartaoFarm='1';
      cartaoFarm.title='ON: usar Cartao Kafra no mapa. No modo Vender permitidos, ative tambem Loja de Bolso para guardar e vender sem ir a Prontera. OFF: usar a Kafra na cidade.';
      cartaoFarm.addEventListener('click',()=>{if(ocupado)return;cfg.armazem.tudoNoMapa=!cfg.armazem.tudoNoMapa;salvarCfg();log('Cartao Kafra: '+(cfg.armazem.tudoNoMapa?'ON':'OFF')+'; modo '+cfg.armazem.modoInventario);atualizarStatus();});
      const modoInventario = document.createElement('button'); estilo(modoInventario); modoInventario.dataset.modoInventario='1';
      modoInventario.title='Guardar tudo: armazena os itens elegiveis no maximo. Vender permitidos: guarda os protegidos pela lista de nao vender e vende o restante. Preserva flechas, Asa de Mosca, cartao, equipados, travados e favoritos.';
      modoInventario.addEventListener('click',()=>{if(ocupado)return;cfg.armazem.modoInventario=guardarTudo()?'vender':'guardar';salvarCfg();log('Modo: '+(guardarTudo()?'Guardar tudo':'Vender permitidos'));atualizarStatus();});
      const evento = document.createElement('button'); estilo(evento); evento.dataset.evento = '1';
      evento.title = 'ON: apos curar, guardar e vender em Prontera, fala com o Gerente de Premios e escolhe Ir para o evento. OFF: retorna pelo mapa de farm configurado. Salvo por conta.';
      evento.addEventListener('click', () => { if (ocupado) return; cfg.retornoEvento = !cfg.retornoEvento; salvarCfg(); log('Retorno pelo Gerente de Eventos ' + (cfg.retornoEvento ? 'ligado' : 'desligado')); atualizarStatus(); });
      const alternarConteudo = (modo) => {
        if (ocupado) return;
        if (cfg.conteudo.modo === modo) {
          const anterior = cfg.conteudo.anterior;
          cfg.conteudo = { modo: 'normal', expiraEm: 0 };
          if (anterior) {
            cfg.mapaFarmManual = anterior.mapaFarmManual || '';
            cfg.destinoFarm = anterior.destinoFarm || null;
            cfg.retornoEvento = Boolean(anterior.retornoEvento);
          } else { cfg.mapaFarmManual = ''; cfg.destinoFarm = null; }
          if (['lhz_dun04', 'moro_vol', 'expedicao'].includes(cfg.mapaFarmManual) && !cfg.retornoEvento) {
            cfg.mapaFarmManual = ''; cfg.destinoFarm = null;
          }
          log('Modo especial desligado; destino anterior restaurado');
        } else {
          const anterior = cfg.conteudo.anterior || {
            mapaFarmManual: cfg.mapaFarmManual, destinoFarm: cfg.destinoFarm,
            retornoEvento: cfg.retornoEvento
          };
          const p = posicao(jogo());
          const mapaExpedicao = modo === 'expedicao' && p?.mapa !== 'prontera' &&
            faseExpedicaoNoTexto(p?.nome || '', cfg.expedicaoFase) ? p.mapa : '';
          cfg.conteudo = { modo, expiraEm: 0, anterior, ...(modo === 'expedicao' ? { mapa: mapaExpedicao } : {}) };
          cfg.mapaFarmManual = modo === 'bio4' ? 'lhz_dun04' : modo === 'lhz' ? 'invasao_lhz' : modo === 'cheffenia' ? 'moro_vol' : (mapaExpedicao || 'expedicao');
          cfg.destinoFarm = { mapa: cfg.mapaFarmManual, nome: modo === 'bio4' ? 'Bio 4' : modo === 'lhz' ? 'Invasão LHZ' : modo === 'cheffenia' ? 'Cheffenia' : cfg.expedicaoFase };
          const tempoLhz = modo === 'lhz' && jogo()?.__elragEngine?.getTempoEvento?.();
          if (modo === 'lhz' && p?.mapa && p.mapa !== 'prontera' && tempoLhz?.fonte === 2 && tempoLhz.secondsLeft > 0) {
            cfg.conteudo.mapa = p.mapa; cfg.mapaFarmManual = p.mapa;
            cfg.destinoFarm = { mapa: p.mapa, nome: 'Invasão de LHZ' };
          }
          cfg.retornoEvento = false;
          cfg.ligado = true;
          recuperacao = null; vigia = null; chegadaAtrasada = null;
          log('Modo ' + (modo === 'bio4' ? 'Bio 4' : modo === 'lhz' ? 'Invasão LHZ' : modo === 'cheffenia' ? 'Cheffenia' : 'Expedição · ' + cfg.expedicaoFase) + ' ligado: retorno pelo NPC de Prontera');
        }
        salvarCfg(); atualizarPainel();
      };
      const bio4 = document.createElement('button'); estilo(bio4); bio4.dataset.conteudo = 'bio4';
      bio4.title = 'Retorna pelo Porteiro do Biolaboratorio enquanto o tempo da Bio 4 estiver ativo. Caminho pode ser calibrado em Calibrar.';
      bio4.addEventListener('click', () => alternarConteudo('bio4'));
      const lhz = document.createElement('button'); estilo(lhz); lhz.dataset.conteudo = 'lhz';
      lhz.title = 'Retorna pelo NPC Invasão de LHZ à esquerda, somente com tempo diário; revalida Prontera antes de entrar.';
      lhz.addEventListener('click', () => alternarConteudo('lhz'));
      const cheffenia = document.createElement('button'); estilo(cheffenia); cheffenia.dataset.conteudo = 'cheffenia';
      cheffenia.title = 'Retorna pelo Arauto da Cheffenia enquanto o tempo estiver ativo.';
      cheffenia.addEventListener('click', () => alternarConteudo('cheffenia'));
      const expedicao = document.createElement('button'); estilo(expedicao); expedicao.dataset.conteudo = 'expedicao';
      expedicao.title = 'Retorna pelo NPC Expedições de Yggdrasil em Prontera, nunca pelo mapa comum.';
      expedicao.addEventListener('click', () => alternarConteudo('expedicao'));
      const faseExpedicao = document.createElement('select'); faseExpedicao.dataset.expedicaoFase = '1';
      faseExpedicao.title = 'Mapa da Expedição para voltar pelo NPC';
      Object.assign(faseExpedicao.style, { background: '#172a3b', color: '#f2eedc', border: '1px solid #66829a', borderRadius: '8px', padding: '5px' });
      for (const nome of ['Calabouço I', 'Calabouço II', 'Portal do Abismo']) {
        const option = document.createElement('option'); option.value = nome; option.textContent = nome; faseExpedicao.appendChild(option);
      }
      faseExpedicao.value = cfg.expedicaoFase;
      faseExpedicao.addEventListener('change', () => {
        if (ocupado) { faseExpedicao.value = cfg.expedicaoFase; return; }
        cfg.expedicaoFase = faseExpedicao.value;
        if (cfg.conteudo.modo === 'expedicao') {
          const p = posicao(jogo());
          cfg.conteudo.mapa = p?.mapa !== 'prontera' && faseExpedicaoNoTexto(p?.nome || '', cfg.expedicaoFase) ? p.mapa : '';
          cfg.mapaFarmManual = cfg.conteudo.mapa || 'expedicao';
          cfg.destinoFarm = { mapa: cfg.mapaFarmManual, nome: cfg.expedicaoFase };
        }
        salvarCfg(); atualizarPainel();
      });
      const limites = document.createElement('button'); estilo(limites); limites.dataset.rotinaLimites = '1';
      limites.title = 'ON: aos 70% de peso ou 95% dos espacos, processa no mapa se Cartao Kafra e Loja de Bolso estiverem ativos, ou faz a rotina da cidade. OFF: continua a cacada mesmo acima desses limites; Executar agora ainda funciona. Salvo por conta.';
      limites.addEventListener('click', () => { if (ocupado) return; cfg.rotinaLimites = cfg.rotinaLimites === false; salvarCfg(); log('Rotina automatica por peso e espacos ' + (cfg.rotinaLimites ? 'ligada' : 'desligada') + ' nesta conta'); atualizarStatus(); });
      const mapaFarm=document.createElement('button');estilo(mapaFarm);mapaFarm.textContent='Mapa de farm';mapaFarm.addEventListener('click',abrirMapaFarm);
      const lucky = document.createElement('button'); estilo(lucky); lucky.dataset.lucky = '1'; lucky.addEventListener('click', abrirMenuLucky);
      const rifaBtn = document.createElement('button'); estilo(rifaBtn); rifaBtn.dataset.rifa = '1'; rifaBtn.title = 'Escolher premios, quanto gastar por rifa e executar agora'; rifaBtn.addEventListener('click', abrirMenuRifa);
      const rifaLiga = document.createElement('button'); estilo(rifaLiga); rifaLiga.dataset.rifaLiga = '1'; rifaLiga.addEventListener('click', () => { cfg.rifa.ligado = !cfg.rifa.ligado; salvarCfg(); log('Rifa '+(cfg.rifa.ligado?'ligada; Auto-voltar será ligado ao iniciar a edição':'desligada')); atualizarPainel(); });
      const covilBtn = document.createElement('button'); covilBtn.dataset.covil = '1'; covilBtn.addEventListener('click', abrirMenuCovil);
      const ajustesBtn = document.createElement('button'); ajustesBtn.dataset.ajustes = '1'; ajustesBtn.textContent = '⚙'; ajustesBtn.title = 'Ajustes';
      ajustesBtn.addEventListener('click', () => { ajustesAbertos = !ajustesAbertos; atualizarStatus(); });
      status.title = 'Clique para ver o historico';
      status.addEventListener('click', () => detalhes.click());
      rifaBtn.title = 'Premios, quanto gastar por rifa e executar agora';
      const barra = document.createElement('div'); barra.className = 'fzn-av__barra'; barra.append(liga, executar, ajustesBtn);
      const grupo = (titulo, ...itens) => { const g = document.createElement('div'); g.className = 'fzn-av__grupo'; const t = document.createElement('span'); t.textContent = titulo; g.append(t, ...itens); return g; };
      const gaveta = document.createElement('div'); gaveta.className = 'fzn-av__gaveta'; gaveta.dataset.gaveta = '1';
      gaveta.append(
        grupo('Rotina', limites, modoInventario, cartaoFarm, bolso, ferreiro, evento),
        grupo('Extras', bio4, lhz, cheffenia, expedicao, faseExpedicao, covilBtn, rifaLiga, lucky),
        grupo('Configurar', mapaFarm, compras, venda, nuncaVenderBtn, rifaBtn, calibrar, importar));
      conteudo.append(barra, status, gaveta, linhaHistorico, abasHist, historico);
      abrir.addEventListener('click', () => { controlesAbertos = !controlesAbertos; atualizarStatus(); });
      const topo = document.createElement('div'); topo.className = 'fzn-av__topo';
      // v3.06: versao tirada do cabecalho @version (antes fixa em v2.94).
      topo.innerHTML = '<b>fzN · Auto-voltar</b><small>v' + VERSAO_SCRIPT + '</small>';
      topo.title = ajuda.textContent;
      painel.append(topo, conteudo);
      document.body.appendChild(painel);
      fznArrastavel(painel, topo, 'fzn-autovoltar-ygg-posicao-v8');
      fznEncolhivel(painel, 'fzn-autovoltar-ygg-encolher-v8');
    }
    const liga = painel.querySelector('[data-liga]');
    liga.textContent = rifaRodando ? '⏸ Rifa' : (cfg.ligado ? '● ON' : '○ OFF');
    liga.disabled = rifaRodando;
    liga.className = cfg.ligado ? 'fzn-av--on' : 'fzn-av--off';
    liga.title = historicoLog().slice(-12).map(linhaHist).join('\n') || 'sem eventos ainda';
    const rifaBtn = painel.querySelector('[data-rifa]');
    if (rifaBtn) rifaBtn.textContent = 'Prêmios da rifa ('+(cfg.rifa.premios||[]).length+')';
    const rifaLiga = painel.querySelector('[data-rifa-liga], [data-rifaLiga]');
    if (rifaLiga) { rifaLiga.textContent = 'Rifa'; rifaLiga.className=cfg.rifa.ligado?'fzn-av--on':'fzn-av--off'; }
    const covilBtn = painel.querySelector('[data-covil]');
    covilBtn.textContent = 'Covil' + (cfg.covil?.ligado ? ' · ' + cfg.covil.hoje : '');
    covilBtn.className = cfg.covil?.ligado ? 'fzn-av--on' : 'fzn-av--off';
    atualizarStatus();
  }

  // O Auto Hunt consulta o dono do renascimento para não clicar em paralelo.
  instanciaAutoVoltar.controlaCovil = mapa => Boolean(cfg.ligado && (cfg.covil?.ligado || mapaCovil({ mapa })));
  instanciaAutoVoltar.rifaAtiva = () => rifaRodando;
  let ultimoErroVerificarEm = 0;
  const verificarSeguro = () => {
    try { verificar(); }
    catch (e) {
      if (Date.now() - ultimoErroVerificarEm > 30000) {
        ultimoErroVerificarEm = Date.now();
        console.error('[autovoltar-ygg] Rotina automatica falhou:', e);
        log('Rotina automatica falhou: ' + String(e?.message || e).slice(0, 120));
      }
    }
  };
  const iniciarRotina = () => { atualizarPainel(); setInterval(verificarSeguro, 500); };
  const iniciar = async () => {
    const backup = await lerBackupDisco();
    if (backup && typeof backup === 'object' && !Array.isArray(backup)) {
      const vendaPadrao = cfg.venda, armazemPadrao = cfg.armazem, covilPadrao = cfg.covil;
      for (const [chave, valor] of Object.entries(backup)) {
        if (!['__proto__', 'constructor', 'prototype'].includes(chave)) cfg[chave] = valor;
      }
      cfg.venda = { ...vendaPadrao, ...cfg.venda, proteger: { ...vendaPadrao.proteger, ...cfg.venda?.proteger } };
      cfg.armazem = { ...armazemPadrao, ...cfg.armazem };
      cfg.covil = { ...covilPadrao, ...cfg.covil };
      salvarCfg();
      log('Configuracoes recuperadas do backup local apos limpar o cache');
    }
    iniciarRotina();
  };
  if (!cfgLocal && !cfgSessao && typeof indexedDB !== 'undefined') void iniciar();
  else {
  if (cfgLocal || cfgSessao) salvarCfg();
  atualizarPainel();
  setInterval(verificarSeguro, 500);
  }
})();




