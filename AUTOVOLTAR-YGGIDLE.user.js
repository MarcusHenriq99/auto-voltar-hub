// ==UserScript==
// @name         Yggidle — voltar ao mapa apos morrer (com cura na Kafra)
// @namespace    https://jogo.yggidle.com.br/
// @version      2.46
// @description  Rotina de peso/espacos por conta; protege e avisa sobre lucky drops.
// @match        https://jogo.yggidle.com.br/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// ==/UserScript==

(() => {
  'use strict';

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
    const orig = { width: painel.style.width, height: painel.style.height, maxWidth: painel.style.maxWidth, maxHeight: painel.style.maxHeight, overflow: painel.style.overflow, boxSizing: painel.style.boxSizing };
    let tam = null;
    try { tam = JSON.parse(localStorage.getItem(chave)); } catch {}
    const aplicar = () => {
      if (!tam) { Object.assign(painel.style, orig); return; }
      Object.assign(painel.style, { width: tam.w + 'px', height: tam.h + 'px', maxWidth: '98vw', maxHeight: '98vh', overflow: 'auto', boxSizing: 'border-box' });
    };
    aplicar();
    const alca = doc.createElement('div');
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
    btn.textContent = '–'; btn.title = 'Encolher';
    Object.assign(btn.style, { position: 'fixed', zIndex: 2147483647, width: '14px', height: '14px', lineHeight: '12px', textAlign: 'center', font: 'bold 12px sans-serif', color: '#fff', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.35)', borderRadius: '4px', cursor: 'pointer', userSelect: 'none', display: 'none' });
    const bola = doc.createElement('div');
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

  const CHAVE_CFG = 'fzn-autovoltar-ygg-v1';
  const CHAVE_LOG = 'fzn-autovoltar-ygg-log-v1';
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
  const etapa = (nome, detalhe = '') => {
    andamento.etapa = nome; andamento.detalhe = detalhe; andamento.desde = Date.now();
    log(nome + (detalhe ? ': ' + detalhe : ''));
  };
  let historicoMem = null;
  const historicoLog = () => (historicoMem ??= lerJson(CHAVE_LOG, []));
  const log = (msg) => {
    const l = historicoLog();
    l.push(`${new Date().toLocaleTimeString()} ${msg}`);
    if (l.length > 40) l.splice(0, l.length - 40);
    gravarJson(CHAVE_LOG, l);
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
    const alvo = w.document.elementFromPoint(base.clientX, base.clientY) || el;
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
    diagTela('dialogo-' + tipo); log(nome + ': o dialogo nao abriu apos 3 tentativas. Verifique a calibracao.');
    return false;
  };

  const curarNaKafra = async (w) => {
    if (!await falarComNpc(w, 'kafra', () => dialogoKafraAberto(w.document))) { log('Kafra: pulando cura'); return false; }
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
    for (const [metodo, chave] of [['updateInventorySnapshot', 'mochila'], ['updateEquipmentSnapshot', 'equipamento'], ['updateStorageSnapshot', 'armazem']]) {
      const original = ui[metodo];
      if (typeof original !== 'function' || original.__fznAutovoltar === donoGancho) continue;
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
        return original.apply(this, arguments);
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

  const calcularFaltas = (w, lista) => lista
    .map((c) => ({ ...c, tem: quantosNaMochila(c.nome) + naBolsa(w, c.nome) }))
    .map((c) => ({ ...c, qtd: Number(c.alvo) - c.tem }))
    .filter((c) => c.qtd > 0 && (!(Number(c.minimo) > 0) || c.tem < Number(c.minimo)));

  const textoTela = (w) => w.document.body.innerText || '';
  const dialogoMercadorAberto = (w) => /\[Mercador\]/.test(textoTela(w)) || Boolean(botaoPorTexto(w.document, (t) => /^Comprar suprimentos/.test(t)));

  const lojaAberta = (w) => {
    if (/Confirmar compra|Buscar item|Loja de Suprimentos/i.test(w.document.body.innerText || '')) return true;
    return [...w.document.querySelectorAll('button')].some((b) => visivel(b) && /^Confirmar compra$/i.test(textoDe(b)));
  };

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
    for (let i = 0; i < 3; i++) {
      if (!lojaAberta(w) && !dialogoMercadorAberto(w)) return;
      const b = botaoPorTexto(w.document, (t) => /^(×|✕|x|Cancelar|Fechar)$/i.test(t))
        || [...w.document.querySelectorAll('button[aria-label]')].find((x) => visivel(x) && /fechar|close/i.test(x.getAttribute('aria-label')));
      if (b) b.click();
      else { try { w.__elragEngine.closeNpcStore(); w.__elragEngine.cancelNpcDialog?.(); } catch {} }
      await esperar(250);
    }
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
  const comprarItens = async (w, bolso = false, { mochilaLida = false, aoEnviar = null, aoRetentar = null } = {}) => {
    const lista = (cfg.compras || []).filter((c) => c && c.nome && Number(c.alvo) > 0);
    if (!lista.length) return false;
    const rapido = bolso && aoEnviar;
    let fresca = mochilaLida || await lerMochila(w);
    let faltas = calcularFaltas(w, lista);
    if (!faltas.length && fresca) { log('Loja: mochila completa, nada a comprar'); return false; }
    if (!fresca) log('Loja: mochila nao atualizou; vou conferir com a loja aberta');
    if (!bolso && Date.now() < compraCidadeBloqueadaAte) { log('Loja: compra na cidade em espera; venda continua independente'); return false; }

    if (bolso) {
      if (!await abrirLojaDeBolso(w)) return false;
    } else {
      if (!await falarComNpc(w, 'vendedor', () => dialogoMercadorAberto(w))) {
          log('Loja: pulando compras');
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
    if (!await esperarAte(() => lojaAberta(w), 6000)) { log('Loja: a janela Suprimentos nao abriu'); await fecharLoja(w); return false; }
    if (!fresca) {
      fresca = await lerMochila(w);
      if (!fresca && !estadoLoja.mochila) { log('Loja: mochila ilegivel mesmo com a loja aberta; pulando'); await fecharLoja(w); return false; }
      faltas = calcularFaltas(w, lista);
      const contas = lista.map((c) => `${c.nome} ${quantosNaMochila(c.nome)}+${naBolsa(w, c.nome)}`).join(', ');
      log(`Loja: conferido com a loja aberta (${fresca ? 'mochila nova' : 'mochila AINDA velha'}): ${contas}`);
      if (!faltas.length) { await fecharLoja(w); return false; }
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
    log(feitos.length ? `Loja: comprei ${feitos.join(', ')}` : 'Loja: nada foi comprado');
    return feitos.length > 0;
  };

  const LOJA_BOLSO_ID = 1280330;
  cfg.lojaBolso = cfg.lojaBolso === true;
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
    if (!lista.length) return;
    await lerMochila(w);
    const faltas = calcularFaltas(w, lista);
    if (!faltas.length) return;
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
    if (!todos && !cfg.armazem.ligado) return { ok: true, depositados: 0 };
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
  let elPeso = null;
  const textoPeso = (w) => {
    if (elPeso && elPeso.ownerDocument === w.document && elPeso.isConnected && RE_PESO.test(elPeso.textContent || '')) return elPeso.textContent;
    elPeso = null;
    for (const el of w.document.querySelectorAll('div, span')) {
      const t = el.textContent || '';
      if (t.length <= 40 && RE_PESO.test(t)) elPeso = el;
    }
    return elPeso ? elPeso.textContent : (w.document.body.innerText || '');
  };
  const lerPeso = (w) => {
    const m = RE_PESO.exec(textoPeso(w));
    if (!m) return null;
    const atual = Number(m[1].replace(/\./g, ''));
    const max = Number(m[2].replace(/\./g, ''));
    return max > 0 ? { atual, max, pct: (atual / max) * 100 } : null;
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

  const motivoProtecao = (item, tipo) => {
    const v = cfg.venda;
    if (alvoLucky(item)) return 'lucky drop procurado';
    const deCaixa = protecaoDeCaixa(item);
    if (deCaixa) return deCaixa;
    if (/cartao (?:de )?kafra/.test(normalizar(item.name))) return 'Cartao Kafra reservado';
    if (ovoDePet(item)) return 'ovo de pet preservado na mochila';
    if (/\basas? de mosca\b|\bfly wings?\b/.test(normalizar(item.name))) return 'Asa de Mosca reservada para farm';
    if (itemTravado(item)) return 'cadeado';
    if (itemDeCompra(item)) return 'item da lista de Compras';
    if (itemFavorito(item)) return 'favorito';
    if (item.isCard && v.proteger.card) return 'carta';
    if (v.proteger[tipo]) return TIPOS_VENDA.find(([k]) => k === tipo)?.[1] || tipo;
    if (v.comCarta && (item.cards || []).some(Boolean)) return 'tem carta encaixada';
    if (Number(v.raridadeMin) > 0 && Number(item.rarity?.tier) >= Number(v.raridadeMin)) return item.rarity.label || 'raridade';
    const n = normalizar(item.name);
    const nome = (v.nomes || []).map(normalizar).find((x) => x && n.includes(x));
    if (nome) return `nome "${nome}"`;
    return null;
  };

  const protecaoDaLinha = (nomeLinha) => {
    if (!nomeLinha) return null;
    const alvo = nomeBase(nomeLinha);
    const mochila = estadoLoja.mochila || {};
    const correspondentes = [];
    for (const tipo of Object.keys(mochila)) {
      for (const item of Array.isArray(mochila[tipo]) ? mochila[tipo] : []) {
        const b = nomeBase(item.name);
        if (b !== alvo && !b.startsWith(`${alvo} `) && !b.includes(alvo)) continue;
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
      log('Venda: nada vendavel na mochila atual; etapa concluida');
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
    if (!vendendo.length) { log('Venda: nada vendavel; etapa concluida'); await fecharVenda(w); return true; }
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
      const b=nomeBase(item.name), alvo=nomeBase(nome);return b===alvo || b.startsWith(alvo+' ') || b.includes(alvo);
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
      if (!cfg.ligado) return false;
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

  const retomadaPlanejada = new WeakMap();
  const PESO_TEIMOSO_MS = 30 * 60 * 1000;
  let pesoTeimosoAte = 0, pesoTeimosoPct = 0;
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
    if (cfg.rotinaLimites === false) return true;
    await lerMochila(w);
    await esperar(500);
    const peso = lerPeso(w);
    if (!peso) return segurarRetorno(w, 'nao consegui conferir o peso');
    if (peso.pct >= limiteSeguro()) {
      if (peso.pct < 90 && !itensVendaveis() && (fezReducao.has(w) || normalizar(posicao(w)?.mapa) === 'prontera')) {
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
  let capacidadeMochila = Number(lerJson(CHAVE_CAPACIDADE, 200)) || 200;
  let snapshotEspacosEm = 0, espacoTeimosoAte = 0;

  const pilhasReais = () => estadoLoja.mochila && Object.values(estadoLoja.mochila).reduce((n, itens) =>
    n + (Array.isArray(itens) ? itens.filter(item => item && Number(item.itemId) > 0).length : 0), 0);

  const lerEspacos = (w) => {
    const atual = Date.now();
    const pilhas = atual - estadoLoja.mochilaEm < 15_000 ? pilhasReais() : null;
    try {
      for (const el of w.document.querySelectorAll('div, span')) {
        if (!visivel(el) || el.closest?.('[data-fzn-auto-voltar]')) continue;
        const t = el.textContent || '';
        if (t.length > 60) continue;
        const m = RE_ESPACOS.exec(t);
        if (m) {
          const usados = Number(m[1]), lida = Number(m[2]), livres = m[3] ? Number(m[3]) : 0;
          if (lida < 50 || lida > 400 || usados > lida || (m[3] && usados + livres !== lida)) continue;
          if (usados >= Math.ceil(lida * OCUPACAO_MAXIMA_MOCHILA) &&
              (pilhas === null || Math.abs(usados - pilhas) > Math.max(20, Math.ceil(lida * 0.1)))) {
            log('Mochila: contador visual ' + usados + '/' + lida + ' sem confirmacao no snapshot (' + (pilhas ?? '?') + ' pilhas); aguardando');
            continue;
          }
          if (lida > 0 && lida !== capacidadeMochila) { capacidadeMochila = lida; gravarJson(CHAVE_CAPACIDADE, lida); log('Mochila: capacidade ' + lida + ' gravada'); }
          return { usados, max: capacidadeMochila, livres, fonte: 'jogo' }; }
      }
    } catch {}
    if (Date.now() - snapshotEspacosEm > 10_000) {
      snapshotEspacosEm = Date.now();
      try { instalarGanchos(w); w.__elragEngine.requestInventorySnapshot(); } catch {}
    }
    if (!estadoLoja.mochila || Date.now() - estadoLoja.mochilaEm > 20_000) return null;
    if (Date.now() - estadoLoja.mochilaEm < 700) return null;
    // O contador de vagas do jogo inclui equipamentos na mochila, mesmo quando equipados.
    const usados = pilhasReais();
    if (usados > capacidadeMochila) {
      capacidadeMochila = Math.max(200, usados + 10);
      gravarJson(CHAVE_CAPACIDADE, capacidadeMochila);
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
    const chave = e.usados + '/' + e.max;
    if (espacoCriticoVisto?.chave !== chave) { espacoCriticoVisto = { chave, desde: Date.now() }; return null; }
    return Date.now() - espacoCriticoVisto.desde >= 1000 ? e : null;
  };
  const irAoFerreiroPorEspaco = (w) => Boolean(cfg.ferreiro && mochilaCheia(w));

  const precisaVender = (w) => {
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
    if (Date.now() < pesoTeimosoAte && p.pct < pesoTeimosoPct + 5 && !itensVendaveis()) return false;
    return true;
  };

  const autopilotLigado = (w) => { try { const ap = w.__elragEngine.getAutopilotSnapshot(); return Boolean(ap && ap.runtimeState !== 1); } catch { return false; } };
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
  const retomarCacada = async (w) => {
    if (!await fecharArmazem(w)) return segurarRetorno(w, 'armazem aberto; cacada bloqueada');
    if (!validarChegadaFarm(w)) return false;
    etapa('Concluido', 'Armazem fechado; retomando a cacada');
    if (huntsPausados.has(w)) {
      botaoHunt(w, false)?.click();
      huntsPausados.delete(w);
    }
    return ligarAutopilot(w, true);
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
    if (!await falarComNpc(w, 'ferreiro', () => dialogoFerreiro(w) || ferreiroAberto(w))) { log('Ferreiro: pulando'); return false; }
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
        log(voltou ? 'Venda na instancia: cacada religada' : 'Venda na instancia: autopilot NAO confirmou religar');
      }
      etapa('Aguardando', 'Monitorando peso e morte');
      ocupado = false;
    }
  };

  let viagemPorSuprimento = '', suprimentoLidoEm = 0, suprimentoBaixoVezes = 0;
  const viagemDeVenda = async (w, manual = false, retomarForcado = false) => {
    if (ocupado) return false;
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
        if (!cfg.ligado) return;
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
    if (!p?.mapa || normalizar(p.mapa) === 'prontera' || ocupado) return false;
    if (String(p.mapa).includes('@')) return false;
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
    if (!destino?.mapa || !atual?.mapa || atual.mapa !== destino.mapa)
      return segurarRetorno(w, 'mapa de chegada ' + (atual?.mapa || '?') + '; esperado ' + (destino?.mapa || '?'));
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

  const PORTEIRO_BIO4 = [170, 184];
  cfg.caminhoBio4 = cfg.caminhoBio4 && typeof cfg.caminhoBio4 === 'object' ? cfg.caminhoBio4 : {};
  if (cfg.caminhoBio4Alvo !== "170,184") {
    cfg.caminhoBio4 = {}; cfg.caminhoBio4Alvo = "170,184";
    // Nao sobrescrever o backup de IndexedDB antes da recuperacao inicial.
    if (cfgLocal || cfgSessao) salvarCfg();
  }
  const porteiroAberto = (w) => /Porteiro do Biolaborat/i.test(w.document.body.innerText || '');

  const falarComPorteiro = async (w) => {
    if (porteiroAberto(w)) return true;
    const canvas = canvasDoJogo(w);
    if (!canvas) return false;
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

    if (alvo) {
      try {
        const camera = w.__elragEngine.renderer?.camera || w.__elragEngine.camera;
        if (camera && camera.worldToScreen) {
          const p = camera.worldToScreen(alvo.position[0], alvo.position[1], 0);
          if (p) { sx = p[0]; sy = p[1]; }
        }
      } catch (e) {}
    }
    if (sx !== null && sy !== null) {
      const r = canvas.getBoundingClientRect();
      await clicarNoCanvas(w, canvas, r.left + sx, r.top + sy);
      return Boolean(await esperarAte(() => porteiroAberto(w), 3500));
    }
    log('Bio4: Porteiro nao tem clique mapeado (worldToScreen falhou)');
    return false;
  };

  const entrarBio4 = async (w) => {
    etapa('8/8 Voltando ao mapa', 'Porteiro do Biolaboratorio (lhz_dun04)');
    let abriu = await falarComPorteiro(w);
    if (!abriu) {
      const partida = posicao(w);
      const ponto = partida && cfg.caminhoBio4[chaveCelula(partida)];
      if (!ponto) return segurarRetorno(w, 'Porteiro fora de alcance: calibre o "Caminho Bio4" (Calibrar) estando em ' + (partida ? chaveCelula(partida) : '?'));
      const canvas = canvasDoJogo(w);
      if (!canvas) return segurarRetorno(w, 'canvas do jogo nao encontrado para andar ate o Porteiro');
      const r = canvas.getBoundingClientRect();
      log('Bio4: andando pelo clique calibrado (' + ponto.dx + ',' + ponto.dy + ') a partir de ' + chaveCelula(partida));
      await clicarNoCanvas(w, canvas, r.left + r.width / 2 + ponto.dx, r.top + r.height / 2 + ponto.dy);
      await esperarAte(() => { const q = posicao(w); return q && chaveCelula(q) !== chaveCelula(partida); }, 4000, 200);
      for (let i = 0; i < 6 && !abriu; i++) { await esperar(1500); abriu = await falarComPorteiro(w); }
    }
    if (!abriu) return segurarRetorno(w, 'conversa com o Porteiro do Biolaboratorio nao abriu');
    const entrar4 = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Entrar no 4.? andar agora/i.test(t)), 3000);
    if (!entrar4) {
      try { w.__elragEngine.cancelNpcDialog?.(); } catch {}
      return segurarRetorno(w, 'Porteiro sem "Entrar no 4o andar agora" (passe vencido?); nao compro passe sozinho');
    }
    entrar4.click();
    const entrar = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Entrar$/i.test(t)), 3000);
    if (!entrar) return segurarRetorno(w, 'botao Entrar do Porteiro nao apareceu');
    entrar.click();
    const chegou = await esperarAte(() => /^lhz_dun04/.test(String(posicao(w)?.mapa || '')), 20000, 250);
    if (!chegou) return segurarRetorno(w, 'entrada na lhz_dun04 sem confirmacao');
    if (!validarChegadaFarm(w)) return false;
    delete cfg.retornoPendente; salvarCfg(); log('Retorno confirmado: lhz_dun04 pelo Porteiro'); await religarEconomia(w); return true;
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

  const voltarAoMapa = async (w) => {
    if (mapaDeRenascer(posicao(w))) { log('Voltar ao mapa: estou em ' + posicao(w).mapa + ' (protegido); nao saio daqui'); return true; }
    if (!cfg.mapaFarmManual && String(cfg.destinoFarm?.mapa || '').includes('@')) {
      const antigo = historicoLog().map((l) => /pesquisa exata ([a-z0-9_]+)/.exec(l)?.[1]).filter(Boolean).pop();
      if (antigo) { cfg.destinoFarm = { mapa: antigo, nome: antigo }; salvarCfg(); log('Mapa de farm recuperado do historico: ' + antigo + ' (o covil tinha gravado ' + '1@tower)'); }
    }
    const codigo=cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
    if((!cfg.retornoEvento || posicao(w)?.mapa !== 'prontera') && (!codigo || !/^[a-z0-9_]+$/.test(codigo))) return segurarRetorno(w,'configure o codigo em Mapa de farm');
    if(codigo && /^[a-z0-9_]+$/.test(codigo)) { cfg.destinoFarm={...cfg.destinoFarm,mapa:codigo};salvarCfg(); }
    etapa('7/8 Conferindo retorno','Peso precisa estar abaixo de '+limiteSeguro()+'%');
    if(!await fecharArmazem(w)) return segurarRetorno(w,'armazem nao fechou antes do retorno');
    if(!cfg.ligado || !await pesoSeguroParaVoltar(w)) return false;
    if(posicao(w)?.mapa===codigo) return true;
    await sairDaEconomia(w);
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
      w.document.querySelectorAll('button').forEach(b => antes.add(b));

      log('Mapa de farm: pesquisa exata ' + codigo + '; clicando Entrar');
      try { clicarBotao(w, entrar); } catch (e) { log('Mapa: erro ao clicar Entrar: ' + String(e).slice(0, 60)); }

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
      const erro = (w.document.body.innerText || '').match(/(zeny insuficiente|peso|bloqueado|indisponivel|nao pode)/i);
      if (erro) log('Mapa: possivel bloqueio: "' + erro[0] + '"');
      diagTela('mapa-sem-teleporte');
      return false;
    };

    for (let i = 1; i <= 2; i++) {
      if (!cfg.ligado || !await pesoSeguroParaVoltar(w)) return false;
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
    return /^lhz_dun04(\.|$)/.test(mapa) || /chef/.test(mapa) || /^moro_vol(\.|$)/.test(mapa) || mapa.includes('@') || /inv$/.test(mapa) || /chefenia|instancia|covil|invas|maldicao/.test(nome);
  };
  const renascerNoLugar = async (w) => {
    ocupado = true;
    try {
      const p = posicao(w);
      const retomar = autopilotLigado(w) || !!botaoHunt(w, true) || huntsPausados.has(w);
      await sairDaEconomia(w);
      const achar = () => botaoPorTexto(w.document, (t) => /^Renascer agora/i.test(t));
      let renascer = await esperarAte(achar, 10000, 250);
      if (!renascer) log('Renascer: nao apareceu em 10 s; retentando a cada 1 s');
      for (let i = 0; !renascer && i < 110; i++) {
        if (!/Renascer agora|Voltar ao ponto de salvamento/.test(w.document.body.innerText || '')) { log('Renascer: a tela de morte fechou sozinha'); return; }
        await esperar(1000);
        renascer = achar();
      }
      if (!renascer) {
        const pista = [...w.document.querySelectorAll('button')].filter((b) => visivel(b) && /renasc|ressusc|reviv|salvamento/i.test(textoDe(b))).map((b) => '"' + textoDe(b).slice(0, 40) + '"' + (b.disabled ? ' (desabilitado)' : '')).join(', ');
        log('Morreu em ' + (p?.mapa || '?') + ': Renascer agora nao liberou em 2 min. Botoes: ' + (pista || 'nenhum'));
        const salvar = botaoPorTexto(w.document, (t) => t === 'Voltar ao ponto de salvamento');
        if (/^lhz_dun04/.test(String(p?.mapa || '')) && salvar) {
          log('Bio4: sem Renascer; volto pelo ponto de salvamento e entro de novo pelo Porteiro');
          await aoMorrer(w, salvar);
        }
        return;
      }
      log('Morreu em ' + (p?.nome || p?.mapa || '?') + ' (' + (p?.mapa || '?') + '): Renascer agora (sem voltar ao salvamento)');
      renascer.click();
      let vivo = await esperarAte(() => !/Renascer agora/.test(w.document.body.innerText || ''), 1000, 200);
      for (let i = 0; !vivo && i < 10; i++) { const b = achar(); if (b) b.click(); vivo = await esperarAte(() => !/Renascer agora/.test(w.document.body.innerText || ''), 1000, 200); }
      if (!vivo) { log('Renascer: a tela de morte continuou; tento de novo no proximo ciclo'); return; }
      if (retomar) {
        if (huntsPausados.has(w)) { botaoHunt(w, false)?.click(); huntsPausados.delete(w); }
        else if (botaoHunt(w, false)) botaoHunt(w, false).click();
        const ok = await esperarAte(() => { if (autopilotLigado(w)) return true; ligarAutopilot(w, true); return false; }, 6000, 300);
        log(ok ? 'Renascer: cacada religada no mesmo mapa' : 'Renascer: autopilot nao confirmou religar');
      }
    } catch (e) {
      log('Renascer: erro ' + String(e?.message || e).slice(0, 100));
    } finally {
      ocupado = false;
    }
  };

  const aoMorrer = async (w, botaoSalvamento) => {
    ocupado = true;
    try {
      const retomar = autopilotLigado(w) || !!botaoHunt(w, true);
      retomadaPlanejada.set(w, retomar);
      if (!await pausarCacada(w)) { segurarRetorno(w, 'nao consegui pausar a cacada antes de renascer'); return; }
      if (await sairDaEconomia(w)) botaoSalvamento = botaoPorTexto(w.document, (t) => t === 'Voltar ao ponto de salvamento') || botaoSalvamento;
      const antes = posicao(w);
      registrarDestinoFarm(w);
      log(`Morreu${antes ? ` em ${antes.nome}` : ''}. Voltando ao ponto de salvamento`);
      botaoSalvamento.click();
      contarQuadros(w, 2000).then((n) => log(`Quadros do jogo: ${n} em 2 s (${espelhados.has(w) ? 'espelhado' : 'NAO espelhado'})`));
      const chegou = await esperarAte(() => {
        const p = posicao(w);
        return p && antes && (p.mapa !== antes.mapa || p.x !== antes.x || p.y !== antes.y);
      }, 90000, 1000);
      if (!chegou) {
        chegadaAtrasada = { mapaMorte: antes?.mapa || '', desde: Date.now(), retomarAutopilot: retomar };
        log('Nao chegou na cidade em 90 s; sigo esperando a chegada');
        return;
      }
      await rotinaDaCidade(w, retomar);
    } catch (e) {
      log(`erro: ${String(e?.message || e).slice(0, 120)}`);
    } finally {
      ocupado = false;
    }
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
    if (!cfg.ligado) return false;
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
    } else if (!cfg.venda.ligado && await pesoAlto()) log('Peso no limite e a venda esta DESLIGADA na configuracao');
    if (!deposito.ok) return segurarRetorno(w, 'nao consegui guardar todos os protegidos: ' + deposito.motivo);
    if (cfg.comprar && !guardarTudo()) {
      try { await retirarDoArmazem(w); } catch (e) { if (cancelando()) throw e; log('Armazem: falha ao retirar — ' + String(e?.message || e).slice(0, 100)); await fecharArmazem(w); }
      etapa('6/8 Comprando', 'Repondo os itens da lista de Compras'); await comprarItens(w);
    }
    const voltou = await voltarComInsistencia(w);
    if (voltou && retomar && cfg.ligado) {
      log(await retomarCacada(w) ? 'Cacada religada no mapa' : 'Nao consegui religar o autopilot');
    } else if (voltou) {
      etapa('Concluido', 'Armazem fechado; retorno ao mapa confirmado');
    } else if (!voltou && cfg.ligado) {
      if (vigia) vigia.retomarAutopilot = retomar;
    }
    return voltou;
  };

  let chegadaAtrasada = null;
  const CHEGADA_MAX_MS = 10 * 60 * 1000;

  const rondaDaRecuperacao = async (w) => {
    const r = recuperacao;
    const espera = r.tentativas < 5 ? 60000 : 600000;
    if (Date.now() - r.ultimaEm < espera) return;
    const p = posicao(w);
    r.ultimaEm = Date.now();
    if (!p?.mapa) { log('Recuperando: personagem fora do mapa; aguardo'); return; }
    ocupado = true;
    try {
      r.tentativas++;
      const destino = cfg.destinoFarm?.mapa;
      if (destino && p.mapa === destino) {
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
      else if (!recuperacao) recuperacao = { ...r, ultimaEm: Date.now() };
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
      log('Chegada atrasada: 10 min sem mudar de mapa; desisto desta volta');
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
  const covil = { dentro: false, entrouEm: 0, viuEm: 0, viu: false, falhas: 0, lutaEm: 0 };
  const COVIL_SEM_MVP_MS = 25000, COVIL_MORTO_MS = 1000, COVIL_LOOT_MS = 0, COVIL_TETO_MS = 28 * 60000;
  const contarCovil = (campo) => {
    const dia = new Date().toLocaleDateString('pt-BR');
    if (cfg.covil.dia !== dia) { cfg.covil.dia = dia; cfg.covil.hoje = 0; cfg.covil.mortesHoje = 0; }
    if (campo === 'kill') { cfg.covil.hoje++; cfg.covil.total++; } else cfg.covil.mortesHoje++;
    salvarCfg();
  };
  const emInstancia = (p) => String(p?.mapa || '').includes('@');
  const gidDoMvp = (w, c) => {
    try { const m = (w.__elragEngine.getAutopilotRadarSnapshot()?.mobs || []).find((x) => x && Number(x.mobId) === c.mobId); return m ? m.gid : null; } catch { return null; }
  };
  const mvpNoRadar = (w, c) => {
    try { return (w.__elragEngine.getAutopilotRadarSnapshot()?.mobs || []).some((m) => m && Number(m.mobId) === c.mobId); } catch { return false; }
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
  const entrarNoCovil = async (w, c, deDentro = false) => {
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
    if (!input) return false;
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
    if (!cfg.covil.ligado || !cfg.ligado) return false;
    invocar.click();
    const convocar = await esperarAte(() => botaoPorTexto(w.document, (t) => /^Convocar$/i.test(t)) || botaoPorTexto(document, (t) => /^Convocar$/i.test(t)), 5000);
    if (!convocar) { log('Covil: confirmacao "Convocar o MVP?" nao apareceu'); return false; }
    log('Covil: convocando ' + c.nome + ' (T' + c.tier + ', ' + pedraDoCovil(c) + ': ' + quantosNaMochila(pedraDoCovil(c)) + ')');
    convocar.click();
    if (deDentro) {
      const pedrasAntes = quantosNaMochila(pedraDoCovil(c));
      const novo = await esperarAte(() => { const g = gidDoMvp(w, c); return (g && g !== covil.gidMorto) || !emInstancia(posicao(w)); }, 8000, 200);
      if (novo && emInstancia(posicao(w)) && gidDoMvp(w, c)) return true;
      await lerMochila(w);
      if (quantosNaMochila(pedraDoCovil(c)) < pedrasAntes && emInstancia(posicao(w))) return true;
      return false;
    }
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
      if (emInstancia(p) && covil.dentro) {
        if (!autopilotLigado(w)) ligarAutopilot(w, true);
        const agora = Date.now();
        if (mvpNoRadar(w, c)) { covil.viu = true; covil.viuEm = agora; covil.gid = gidDoMvp(w, c); etapa('Covil', 'Lutando com ' + c.nome + ' (' + cfg.covil.hoje + ' hoje)'); return; }
        if (covil.viu && agora - covil.viuEm > COVIL_MORTO_MS) {
          if (!covil.morto) {
            covil.morto = true;
            contarCovil('kill');
            log('Covil: ' + c.nome + ' derrotado em ' + Math.round((covil.viuEm - covil.entrouEm) / 1000) + ' s (' + cfg.covil.hoje + ' hoje, ' + cfg.covil.total + ' no total, +' + c.tier * 100 + ' pontos)');
            if (COVIL_LOOT_MS > 0) { etapa('Covil', 'Pegando o drop'); await esperar(COVIL_LOOT_MS); }
          }
          if (covil.reinvocar !== false && !covil.tentouAqui) {
            covil.tentouAqui = true;
            covil.gidMorto = covil.gid;
            const pedras = quantosNaMochila(pedraDoCovil(c));
            if (pedras > 0 && !precisaVender(w)) {
              etapa('Covil', 'Invocando de novo sem sair (' + pedras + ' pedras)');
              if (await entrarNoCovil(w, c, true)) {
                if (!covil.reinvocouLog) { covil.reinvocouLog = true; log('Covil: reinvocacao de dentro funcionou; sigo sem passar por Prontera'); }
                covil.entrouEm = Date.now(); covil.viu = false; covil.morto = false; covil.reinvocarFalhas = 0; covil.tentouAqui = false;
                ligarAutopilot(w, true);
                return;
              }
              covil.reinvocarFalhas = (covil.reinvocarFalhas || 0) + 1;
              log('Covil: reinvocacao de dentro nao confirmou (' + covil.reinvocarFalhas + '/3); saio pelo SAIR');
              if (covil.reinvocarFalhas >= 3) { covil.reinvocar = false; log('Covil: reinvocacao desligada nesta sessao; uso sempre o SAIR'); }
              try { w.document.querySelector('button[aria-label="Mundo de Midgard"]') && botaoPorTexto(w.document, (t) => /^(Cancelar|Fechar)$/i.test(t))?.click(); } catch {}
            }
          }
          if (!await sairDoCovil(w)) { covil.sairFalhas = (covil.sairFalhas || 0) + 1; if (covil.sairFalhas < 10) return; log('Covil: saida falhou 10 vezes; espero a instancia acabar sozinha'); }
          covil.sairFalhas = 0;
          covil.dentro = false;
          return;
        }
        if (!covil.viu && agora - covil.entrouEm > COVIL_SEM_MVP_MS) { log('Covil: ' + c.nome + ' nao apareceu em 25 s; saindo'); covil.dentro = false; await sairDoCovil(w); return; }
        if (agora - covil.entrouEm > COVIL_TETO_MS) { log('Covil: 28 min sem terminar; saindo antes do limite de 30 min'); covil.dentro = false; await sairDoCovil(w); }
        return;
      }
      if (emInstancia(p)) {
        const jaMorto = covil.morto;
        covil.dentro = true; covil.entrouEm = Date.now(); covil.viu = jaMorto; covil.viuEm = Date.now() - COVIL_MORTO_MS - 1; covil.morto = jaMorto;
        log('Covil: ja estou em ' + p.mapa + (jaMorto ? '; MVP ja derrotado, saindo' : '; acompanho a luta'));
        return;
      }
      await lerMochila(w);
      const pedras = quantosNaMochila(pedraDoCovil(c));
      if (pedras <= 0 && itensMochila().length < 5) { diagTela('covil-mochila'); log('Covil: mochila nao foi lida (' + itensMochila().length + ' itens); tento de novo'); return; }
      if (pedras <= 0) { voltarAoFarmDoCovil('sem ' + pedraDoCovil(c) + ' na mochila'); return; }
      if (precisaVender(w)) { voltarAoFarmDoCovil('mochila/peso no limite (a venda roda no farm; religue o Covil depois)'); return; }
      etapa('Covil', 'Entrando: ' + c.nome + ' (' + pedras + ' pedras)');
      if (await entrarNoCovil(w, c)) {
        covil.dentro = true; covil.entrouEm = Date.now(); covil.viu = false; covil.morto = false; covil.tentouAqui = false; covil.falhas = 0;
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
    const p = posicao(w);
    const naCidade = normalizar(p?.mapa || '') === 'prontera';
    const destino = cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
    if (!naCidade || !destino || recuperacao || vigia || chegadaAtrasada || cfg.retornoPendente) {
      cidadeSemRotinaDesde = 0;
      return false;
    }
    if (!cidadeSemRotinaDesde) { cidadeSemRotinaDesde = Date.now(); return false; }
    if (Date.now() - cidadeSemRotinaDesde < 8000) return false;
    cidadeSemRotinaDesde = 0;
    log('Prontera sem rotina ativa por 8 s; retomando o retorno a ' + destino);
    etapa('Recuperando', 'Em Prontera com Auto-voltar ON; retomando Kafra, venda e retorno a ' + destino);
    recuperacao = { motivo: 'parado na cidade', desde: Date.now(), ultimaEm: Date.now() - 60000, tentativas: 0, retomarAutopilot: true };
    return true;
  };

  const dispensarAvisoDiario = (w) => {
    // O aviso diario cobre a cacada. Identificar pelo controle exclusivo evita
    // fechar por engano uma conversa de NPC ou uma janela de venda.
    const caixas = [...w.document.querySelectorAll('input[type="checkbox"]')].filter(caixa => {
      if (!visivel(caixa) || caixa.disabled) return false;
      const nomes = [caixa.getAttribute('aria-label'), ...[...(caixa.labels || [])].map(l => l.innerText || l.textContent),
        caixa.closest('label')?.innerText, caixa.parentElement?.innerText].filter(Boolean);
      return nomes.some(nome => normalizar(nome).includes('nao mostrar novamente hoje'));
    });
    if (caixas.length !== 1) return false;
    const caixa = caixas[0];
    let area = caixa.parentElement;
    let fechar = null;
    for (let i = 0; i < 6 && area && area !== w.document.body; i++, area = area.parentElement) {
      const botoes = [...area.querySelectorAll('button')].filter(b => visivel(b) && /^fechar$/i.test(textoDe(b)));
      if (botoes.length === 1) { fechar = botoes[0]; break; }
    }
    if (!fechar) return false;
    if (!caixa.checked) { caixa.click(); log('Aviso diario: marquei Nao mostrar novamente hoje'); return true; }
    fechar.click();
    log('Aviso diario: fechado; cacada liberada');
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
  const rifaEstado = { etapa: 'Aguardando', premio: '', edicao: '', compras: 0, detalhe: '' };
  let rifaRodando = false, rifaFarmPausado = false, rifaMenu = null;
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
  const textoHistoricoRifa = () => (cfg.rifa.historico.length
    ? cfg.rifa.historico.map(r => {
      const quando = new Date(r.inicio).toLocaleString('pt-BR');
      return quando+' · '+(r.premio||'Prêmio a confirmar')+'\n'+
        'Tentativas: '+r.tentativas+' · Comprados: '+r.confirmados+
        ' · Gasto: '+Number(r.gasto||0).toLocaleString('pt-BR')+'z\n'+
        'Resultado: '+r.resultado+(r.vencedor?' · Vencedor: '+r.vencedor:'');
    }).join('\n\n') : 'Nenhuma participação registrada neste personagem.');
  const conferirResultadoRifa = (w) => {
    const texto = w.document.body.innerText || '';
    const anuncios = [...texto.matchAll(/\[Rifa YggIdle\]\s*([^\n]+?)\s+tirou o n[uú]mero da sorte e levou\s+([^\n]+?)\s+x\d+[!.]?/gi)];
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
    const h = rifaMenu?.querySelector('[data-rifa-historico]');
    if (h) h.textContent = textoHistoricoRifa();
  };
  const rifaStatus = (etapa, detalhe = '') => {
    const mudou = rifaEstado.etapa !== etapa || rifaEstado.detalhe !== detalhe;
    rifaEstado.etapa = etapa; rifaEstado.detalhe = detalhe;
    const linha = rifaMenu?.querySelector('[data-rifa-status]');
    if (linha) linha.textContent = 'Estado: '+etapa+(detalhe?' · '+detalhe:'');
    if (mudou && detalhe) log('Rifa: ' + etapa + ' — ' + detalhe);
    atualizarPainel();
  };
  const premioMarcadoRifa = (texto) => (cfg.rifa.premios || [])
    .some(nome => normalizar(texto).includes(normalizar(nome)));
  const janelaRifa = (w) => {
    const folhas = [...w.document.querySelectorAll('h1,h2,h3,div,span,strong')]
      .filter(el => visivel(el) && normalizar(textoDe(el)) === 'rifa yggidle' &&
        ![...el.children].some(c => normalizar(textoDe(c)) === 'rifa yggidle'));
    for (const folha of folhas) {
      let p = folha;
      for (let i = 0; p && i < 7; i++, p = p.parentElement) {
        if (/seus n[uú]meros nesta edi[cç][aã]o/i.test(p.innerText || '') &&
            /comprar n[uú]mero/i.test(p.innerText || '')) return p;
      }
    }
    return null;
  };
  const zenyRifa = (w) => {
    const m = /Zeny\s+([\d.,]+)/i.exec(w.document.body.innerText || '');
    return m ? Number(m[1].replace(/[^\d]/g, '')) : NaN;
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
  const abrirRifaNoNpc = async (w) => {
    if (janelaRifa(w)) return true;
    if (posicao(w)?.mapa !== 'prontera') return false;
    for (let i = 0; i < 3; i++) {
      const npc = await acharNpcRifa(w);
      if (!npc) { await esperar(700); continue; }
      try { npc.onMouseDown?.(); } catch {}
      const opcao = await esperarAte(() => botaoPorTexto(w.document,t => /^Rifa Yggidle$/i.test(t)),2500);
      if (opcao) opcao.click();
      if (await esperarAte(() => janelaRifa(w),3500)) return true;
    }
    return false;
  };
  const sairParaRifa = async (w) => {
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
    let premio = premioAvisado, semBotaoDesde = 0;
    while (cfg.rifa.ligado && cfg.ligado && posicao(w)?.mapa === 'prontera') {
      const modal = janelaRifa(w);
      if (!modal) {
        if (!await abrirRifaNoNpc(w)) { rifaStatus('Parada','janela da rifa não abriu'); return; }
        continue;
      }
      const texto = modal.innerText || '';
      if (/edi[cç][aã]o encerrada|n[aã]o est[aá] aberta para compras/i.test(texto)) { rifaStatus('Encerrada','edição finalizada'); return; }
      if (/nenhuma edi[cç][aã]o aberta/i.test(texto)) {
        if (Date.now() > edicao.inicio + 120000) { rifaStatus('Encerrada','nenhuma edição aberta'); return; }
        await esperar(500); continue;
      }
      const premiosNoModal = PREMIOS_RIFA.filter(nome => normalizar(texto).includes(normalizar(nome)));
      premio = premiosNoModal.join(' + ');
      if (!premio || !premioMarcadoRifa(premio)) {
        rifaStatus('Ignorada',premio ? 'prêmio não selecionado: '+premio : 'prêmio não confirmado');
        return;
      }
      rifaEstado.premio = premio;
      const limite = Math.max(0, Math.floor(Number(cfg.rifa.limiteGasto) || 0));
      const registro = registroRifa(edicao,premio);
      if ((registro.tentativas + 1)*500000 > limite) {
        rifaStatus('Limite atingido','máximo de '+limite.toLocaleString('pt-BR')+'z nesta edição'); return;
      }
      const saldo = zenyRifa(w);
      if (!Number.isFinite(saldo)) { rifaStatus('Parada','saldo de zeny não identificado'); return; }
      if (saldo < 500000) { rifaStatus('Sem saldo','menos de 500.000z para outro bilhete'); return; }
      const comprar = [...modal.querySelectorAll('button')].find(b => /comprar n[uú]mero/i.test(textoDe(b)));
      if (!comprar || comprar.disabled) {
        if (Date.now() < edicao.inicio) {
          rifaStatus('Aguardando abertura','compra começa no horário anunciado');
          await esperar(650); continue;
        }
        if (!semBotaoDesde) semBotaoDesde = Date.now();
        if (Date.now()-semBotaoDesde > 12000) { rifaStatus('Encerrada','botão indisponível por 12 s'); return; }
        await esperar(650); continue;
      }
      semBotaoDesde = 0;
      registro.tentativas++;
      gravarJson(CHAVE_CFG,cfg);
      comprar.click();
      const confirmar = await esperarAte(() => [...w.document.querySelectorAll('button')]
        .filter(b => visivel(b) && !b.disabled &&
          /^comprar\s*[—-]\s*500[.,]000z?$/i.test(textoDe(b)))
        .find(b => /confirmar compra|voc[eê] vai gastar/i.test(b.parentElement?.parentElement?.innerText || '')),3500,100);
      if (!confirmar) { rifaStatus('Parada','confirmação da compra não apareceu'); return; }
      confirmar.click();
      const debitou = await esperarAte(() => {
        const novo = zenyRifa(w);
        return Number.isFinite(saldo) && Number.isFinite(novo) && novo <= saldo-500000;
      },6000,150);
      if (!debitou) { rifaStatus('Parada','compra não confirmada pelo saldo'); return; }
      registro.confirmados++; registro.gasto += 500000;
      if (registro.confirmados % 5 === 0) salvarCfg();
      else gravarJson(CHAVE_CFG,cfg);
      const h = rifaMenu?.querySelector('[data-rifa-historico]');
      if (h) h.textContent = textoHistoricoRifa();
      rifaEstado.compras++;
      rifaStatus('Comprando',rifaEstado.compras+' número(s); '+premio);
      await esperar(600);
    }
  };
  const executarRifa = async (w,edicao) => {
    if (ocupado || rifaRodando || !cfg.rifa.ligado || !cfg.ligado ||
        !(cfg.rifa.premios||[]).length || !(Number(cfg.rifa.limiteGasto) >= 500000)) return;
    rifaRodando = true; ocupado = true;
    const origem = posicao(w), cacava = autopilotLigado(w) || !!botaoHunt(w,true);
    const premioAvisado = rifaEstado.premio;
    rifaEstado.compras = 0;
    try {
      if (origem?.mapa !== 'prontera') registrarDestinoFarm(w);
      rifaStatus('Saindo do farm',premioAvisado || 'conferindo o prêmio');
      await sairDaEconomia(w);
      if (cacava && !await pausarCacada(w)) throw new Error('não consegui pausar a caça');
      rifaFarmPausado = true;
      rifaStatus('Farm pausado para rifa',premioAvisado || 'aguardando edição');
      if (!await sairParaRifa(w)) throw new Error('não consegui chegar a Prontera');
      rifaStatus('Falando com YggIdle Bet');
      if (!await abrirRifaNoNpc(w)) throw new Error('NPC YggIdle Bet não encontrado');
      await comprarRifa(w,edicao,premioAvisado);
    } catch(e) { rifaStatus('Parada',String(e?.message||e).slice(0,160)); }
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
      rifaFarmPausado = false; rifaRodando = false; ocupado = false; atualizarPainel();
    }
  };
  const vigiarRifa = (w) => {
    const edicao = edicaoRifaAtual();
    if (!edicao || !cfg.rifa.ligado || !cfg.ligado || !(cfg.rifa.premios||[]).length) return;
    if (!(Number(cfg.rifa.limiteGasto) >= 500000)) {
      rifaStatus('Sem limite','defina quanto gastar por rifa; mínimo 500.000z'); return;
    }
    if (rifaEstado.edicao !== edicao.id) { rifaEstado.edicao = edicao.id; rifaEstado.premio = ''; }
    const anunciado = anuncioRifa(w);
    if (anunciado) rifaEstado.premio = anunciado;
    if (ocupado || rifaRodando || cfg.rifa.ultimaEdicao === edicao.id) return;
    if (rifaEstado.premio && !premioMarcadoRifa(rifaEstado.premio)) {
      rifaStatus('Ignorada','prêmio não marcado: '+rifaEstado.premio+'; marque no painel para disputar esta edição'); return;
    }
    if (!edicao.abriu && Date.now() < edicao.inicio - 60000) {
      rifaStatus('Aguardando último minuto',rifaEstado.premio || 'prêmio ainda não identificado');
      return;
    }
    if (!rifaEstado.premio && !edicao.abriu) return;
    cfg.rifa.ultimaEdicao = edicao.id; salvarCfg();
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
      salvarCfg();const h=menu.querySelector('[data-rifa-historico]');if(h)h.textContent=textoHistoricoRifa();};
    personagemLinha.appendChild(personagem);
    const historicoRifa=document.createElement('details');
    Object.assign(historicoRifa.style,{margin:'9px 0',border:'1px solid #445967',padding:'7px',borderRadius:'5px'});
    const tituloHistorico=document.createElement('summary');tituloHistorico.textContent='Histórico de bilhetes e resultados';
    tituloHistorico.style.cursor='pointer';
    const conteudoHistorico=document.createElement('pre');conteudoHistorico.dataset.rifaHistorico='1';
    conteudoHistorico.textContent=textoHistoricoRifa();
    Object.assign(conteudoHistorico.style,{whiteSpace:'pre-wrap',font:'12px/1.4 Arial,sans-serif',maxHeight:'190px',overflowY:'auto'});
    historicoRifa.append(tituloHistorico,conteudoHistorico);
    const acoes=document.createElement('div');
    Object.assign(acoes.style,{display:'flex',gap:'6px',justifyContent:'space-between'});
    const botao=(txt,fn)=>{const b=document.createElement('button');b.textContent=txt;b.onclick=fn;
      Object.assign(b.style,{padding:'7px',background:'#24516c',color:'white',border:'1px solid #9cb9c9',
        borderRadius:'6px',cursor:'pointer'});return b;};
    acoes.append(
      botao('Executar agora',()=>{const w=jogo(),edicao=edicaoRifaAtual();
        if (!w||!edicao) {rifaStatus('Aguardando','não há edição próxima ou aberta');return;}
        if (!cfg.rifa.ligado||!cfg.ligado) {rifaStatus('Desligada','ligue Rifa e Auto-voltar');return;}
        if (!(Number(cfg.rifa.limiteGasto)>=500000)) {rifaStatus('Sem limite','defina quanto gastar por rifa');return;}
        cfg.rifa.ultimaEdicao=edicao.id;salvarCfg();void executarRifa(w,edicao);}),
      botao('Fechar',()=>{menu.remove();rifaMenu=null;})
    );
    menu.append(topo,ajuda,status,lista,limiteLinha,personagemLinha,historicoRifa,acoes);
    document.body.appendChild(menu);rifaMenu=menu;
    fznArrastavel(menu,topo,'fzn-rifa-ygg-pos-v1');
  };
  const verificar = () => {
    atualizarPainel();
    const w = jogo();
    if (!w) return;
    conferirResultadoRifa(w);
    if (rifaRodando) {
      if (rifaFarmPausado) {
        botaoHunt(w, true)?.click();
        if (autopilotLigado(w)) ligarAutopilot(w, false);
      }
      return;
    }
    if (dispensarAvisoDiario(w)) return;
    if (cfg.ligado && fecharLojaCash(w)) return;
    ligarCalibracao(w);
    instalarGanchos(w);
    vigiarLucky();
    vigiarRifa(w);
    if (!cfg.ligado || ocupado) return;
    if (cfg.covil.ligado) {
      const salvarC = botaoPorTexto(w.document, (t) => t === 'Voltar ao ponto de salvamento');
      if (salvarC && /Renascer agora|Voltar ao ponto de salvamento/.test(w.document.body.innerText || '') && (emInstancia(posicao(w)) || covil.dentro)) {
        contarCovil('morte'); covil.dentro = false;
        log('Covil: morri em ' + covilAlvo().nome + ' (' + cfg.covil.mortesHoje + ' hoje); volto pelo salvamento e tento de novo');
        salvarC.click(); return;
      }
      rodadaCovil(w); return;
    }
    sincronizarMapaAtual(w);
    if (!posicaoInicialVista) {
      const p0 = posicao(w);
      if (p0?.mapa) {
        posicaoInicialVista = true;
        const destino = cfg.mapaFarmManual || cfg.destinoFarm?.mapa;
        if (normalizar(p0.mapa) === 'prontera' && (destino || cfg.retornoEvento) && !recuperacao) {
          log('Carreguei em Prontera; retorno ' + (cfg.retornoEvento ? 'pelo Gerente de Eventos' : 'ao mapa de farm ' + destino) + ': iniciando em instantes');
          recuperacao = { motivo: 'carregou na cidade', desde: Date.now(), ultimaEm: Date.now() - 50000, tentativas: 0, retomarAutopilot: true };
        }
      }
    }
    if (!armazemInicialConferido) {
      armazemInicialConferido = true;
      if (armazemAberto(w)) { liberarArmazemInicial(w); return; }
    }
    const salvar = botaoPorTexto(w.document, (t) => t === 'Voltar ao ponto de salvamento');
    if (salvar && /Renascer agora/.test(w.document.body.innerText || '')) {
      if (mapaDeRenascer(posicao(w))) { renascerNoLugar(w); return; }
      aoMorrer(w, salvar); return;
    }
    vigiarCidadeSemRotina(w);
    if ((chegadaAtrasada || vigia) && /Economia de energia/.test(w.document.body.innerText || '')) { sairDaEconomia(w); return; }
    if (chegadaAtrasada) { conferirChegadaAtrasada(w); return; }
    if (recuperacao) { rondaDaRecuperacao(w); return; }
    if (vigia) { rondaDaVigia(w); return; }
    if (cfg.rotinaLimites !== false && (cfg.venda.ligado || guardarTudo() || cfg.ferreiro || cfg.armazem.ligado) && Date.now() - pesoLidoEm > 3000) {
      pesoLidoEm = Date.now();
      const espacoCritico = Date.now() >= espacoTeimosoAte && Boolean(mochilaCheiaConfirmada(w));
      const peso = lerPeso(w);
      const pesoCritico = Boolean(peso && peso.pct >= limiteSeguro());
      const intervalo = espacoCritico || pesoCritico ? 15000 : VENDA_INTERVALO_MS;
      if (Date.now() - ultimaViagemVenda > intervalo && precisaVender(w)) viagemDeVenda(w);
    }
    if ((!cfg.lojaBolso || !lojaDeBolso()) && Date.now() - suprimentoLidoEm > 5000 && Date.now() - ultimaViagemVenda > VENDA_INTERVALO_MS) {
      suprimentoLidoEm = Date.now();
      const pos = posicao(w);
      const listaMin = (cfg.compras || []).filter((c) => c && c.nome && Number(c.alvo) > 0 && Number(c.minimo) > 0);
      if (listaMin.length && pos?.mapa && normalizar(pos.mapa) !== 'prontera' && !mapaDeRenascer(pos) && autopilotLigado(w) && itensMochila().length) {
        const baixo = calcularFaltas(w, listaMin);
        suprimentoBaixoVezes = baixo.length ? suprimentoBaixoVezes + 1 : 0;
        if (suprimentoBaixoVezes >= 2) { suprimentoBaixoVezes = 0; viagemPorSuprimento = baixo.map((c) => c.nome + ' ' + c.tem + '/' + c.minimo).join(', '); viagemDeVenda(w, true); return; }
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
    const w = jogo(), peso = w && lerPeso(w);
    const texto = painel.querySelector('[data-status]');
    if (texto) texto.textContent = andamento.etapa + ' | Peso ' + (peso ? peso.pct.toFixed(1) + '%' : '?') +
      (cfg.destinoFarm?.mapa ? ' | Destino: ' + cfg.destinoFarm.mapa : '') +
      (cfg.rotinaLimites === false ? ' | Limites ignorados' : '') +
      (cfg.retornoEvento ? ' | Retorno: Gerente de Premios' : '') +
      (ocupado ? ' | ' + Math.floor((Date.now() - andamento.desde) / 1000) + 's nesta etapa' : '');
    const detalhe = painel.querySelector('[data-detalhe]');
    if (detalhe) detalhe.textContent = andamento.detalhe;
    const cartao = painel.querySelector('[data-cartao-farm]');
    if (cartao) { cartao.textContent = 'Cartao Kafra: ' + (cfg.armazem.tudoNoMapa ? 'ON' : 'OFF'); cartao.setAttribute('aria-pressed', String(cfg.armazem.tudoNoMapa)); cartao.disabled = ocupado; cartao.className = cfg.armazem.tudoNoMapa ? 'fzn-av--on' : ''; }
    const modo = painel.querySelector('[data-modo-inventario]');
    if (modo) { modo.textContent = 'Modo: ' + (guardarTudo() ? 'Guardar tudo' : 'Vender permitidos'); modo.disabled = ocupado; modo.className = guardarTudo() ? 'fzn-av--on' : ''; }
    const evento = painel.querySelector('[data-evento]');
    if (evento) { evento.textContent = 'Evento: ' + (cfg.retornoEvento ? 'ON' : 'OFF'); evento.disabled = ocupado; evento.className = cfg.retornoEvento ? 'fzn-av--on' : ''; evento.setAttribute('aria-pressed', String(Boolean(cfg.retornoEvento))); }
    const limites = painel.querySelector('[data-rotina-limites]');
    if (limites) { limites.textContent = 'Rotina por limite: ' + (cfg.rotinaLimites === false ? 'OFF' : 'ON'); limites.disabled = ocupado; limites.className = cfg.rotinaLimites === false ? 'fzn-av--off' : 'fzn-av--on'; limites.setAttribute('aria-pressed', String(cfg.rotinaLimites !== false)); }
    const lucky = painel.querySelector('[data-lucky]');
    if (lucky) {
      const encontrados = (cfg.lucky || []).filter((alvo) => estadoLoja.mochila && totalLucky(alvo, itensMochila()) > 0).length;
      lucky.textContent = `Lucky drops: ${encontrados}/${cfg.lucky.length}`;
      lucky.className = encontrados ? 'fzn-av--on' : '';
      lucky.title = 'Configurar nomes procurados e ver mochila/Kafra. Itens da lista nunca sao vendidos nem desmantelados.';
    }
    if (menuLucky?.isConnected) atualizarMenuLucky();
    const executar = painel.querySelector('[data-executar]');
    if (executar) { executar.disabled = ocupado; executar.textContent = ocupado ? 'Processo em andamento' : 'Executar agora'; }
    const historico = painel.querySelector('[data-historico]');
    if (historico) { historico.style.display = detalhesProcesso ? 'block' : 'none'; historico.textContent =
      (cfg.rotinaLimites === false ? 'Rotina por limite OFF: peso e espacos nao iniciam viagens automaticas. Executar agora continua disponivel; morte e falta de suprimentos seguem suas rotinas.\n' : 'Rotina por limite ON: peso inicia em 70%; espacos em 95/100 ou 190/200. Com Ferreiro ON, vai a Prontera para desmantelar antes de guardar e vender.\n') +
      (cfg.retornoEvento ? 'Evento ON: depois da rotina na cidade, fala com o Gerente de Premios e escolhe Ir para o evento. Se falhar, aguarda em Prontera sem usar o mapa-mundi.\n' : '') +
      (guardarNoMapa() ? 'Passos: pausar cacada → cartao → guardar tudo no maximo → fechar armazem → conferir peso → cacar no mesmo mapa.\n\n' : venderNoMapa() ? 'Passos: pausar cacada → cartao/guardar protegidos → fechar armazem → Loja de Bolso/vender permitidos → conferir peso → cacar no mesmo mapa.\n\n' : guardarTudo() ? 'Passos: pausar cacada → Prontera/Kafra → guardar tudo no maximo → conferir peso → voltar e cacar.\n\n' : 'Passos: pausar cacada → guardar protegidos → Prontera/Kafra → vender permitidos → comprar → conferir peso → voltar e cacar.\n\n') + historicoLog().slice(-18).join('\n'); }
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
      dica.textContent = 'Entra pelo Mundo de Midgard, invoca, deixa o autopilot lutar, espera o drop e sai — repete enquanto houver pedra. Sem pedra, mochila cheia ou 3 falhas: desliga o Covil e volta ao mapa de farm. Morte: volta pelo salvamento e tenta de novo.';
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
      if(codigo)cfg.destinoFarm={mapa:codigo,nome:codigo};else{const w=jogo();if(w)registrarDestinoFarm(w);}
      salvarCfg();log('Mapa de farm desta conta: '+(codigo||'acompanhar mapa atual'));abrirMapaFarm();atualizarPainel();
    };p.append(salvar);const fechar=document.createElement('button');fechar.textContent='Fechar mapa de farm';fechar.onclick=abrirMapaFarm;p.append(fechar);document.body.append(p);
  };
  let editor = null;

  const ABAS = ['Consumíveis', 'Buffs', 'Munições', 'Forja', 'Alquimia', 'Utilitários'];
  const abrirEditor = () => {
    if (editor) { editor.remove(); editor = null; return; }
    if (calib) abrirCalibracao();
    if (menuVenda) abrirMenuVenda();
    editor = document.createElement('div');
    abrirSubjanela(editor, 440);
    const campo = '';
    const desenhar = () => {
      const linhas = (cfg.compras || []).map((c, i) => `
        <div data-i="${i}" style="display:flex;gap:4px;margin:4px 0;align-items:center">
          <input data-k="nome" value="${String(c.nome).replace(/"/g, '&quot;')}" placeholder="Nome na loja" style="${campo};flex:1;min-width:0">
          <select data-k="aba" style="${campo}">${ABAS.map((a) => `<option${a === c.aba ? ' selected' : ''}>${a}</option>`).join('')}</select>
          <input data-k="minimo" type="number" min="0" value="${Number(c.minimo) || 0}" title="Minimo: so compra abaixo disto (0 = sempre que faltar)" style="${campo};width:52px">
          <input data-k="alvo" type="number" min="0" value="${Number(c.alvo) || 0}" title="Alvo: completa ate esta quantidade" style="${campo};width:52px">
          <button data-rm="${i}" title="Remover" style="${campo};cursor:pointer">✕</button>
        </div>`).join('');
      editor.innerHTML = `
        <div style="font-weight:bold;margin-bottom:4px">Comprar ao voltar</div>
        <div style="opacity:.75;margin-bottom:6px">Nome igual ao da loja, aba, minimo e alvo. Abaixo do minimo, completa ate o alvo (minimo 0 = sempre que faltar).</div>
        <div style="display:flex;gap:4px;opacity:.6;font-size:11px"><span style="flex:1">Item</span><span>Aba</span><span style="width:52px;text-align:center">Min.</span><span style="width:52px;text-align:center">Alvo</span><span style="width:24px"></span></div>
        ${linhas || '<div style="opacity:.6">Nenhum item.</div>'}
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
        c[k] = (k === 'alvo' || k === 'minimo') ? Math.max(0, Number(ev.target.value) || 0) : ev.target.value;
      }
      if (ev.target.matches('[data-ativo]')) cfg.comprar = ev.target.checked;
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
    if (menuVenda) abrirMenuVenda();
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
  const fecharOutros = (manter) => {
    if (manter !== 'editor' && editor) abrirEditor();
    if (manter !== 'calib' && calib) abrirCalibracao();
    if (manter !== 'venda' && menuVenda) abrirMenuVenda();
  };

  const testarVenda = async () => {
    const w = jogo();
    if (!w || ocupado) { log('Teste venda: jogo ocupado ou nao encontrado'); return; }
    ocupado = true;
    try { await venderItens(w, true); } finally { ocupado = false; }
  };

  function abrirMenuVenda() {
    if (menuVenda) { menuVenda.remove(); menuVenda = null; return; }
    fecharOutros('venda');
    menuVenda = document.createElement('div');
    abrirSubjanela(menuVenda, 440);
    const campo = '';
    const v = cfg.venda;
    const w = jogo();
    const p = w && lerPeso(w);
    menuVenda.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px">Vender no Mercador</div>
      <div style="margin-bottom:8px;color:#ffb38a">Retorno permitido somente abaixo de ${limiteSeguro()}% de peso (teto de 70%). Se o peso continuar alto ou nao puder ser lido, Auto-voltar e autopilot ficam pausados. Cartao Kafra nunca e vendido.</div>
      <div style="opacity:.75;margin-bottom:8px">Ao chegar no limite de peso, volta ao ponto de salvamento, usa "Vender tudo" e tira os itens protegidos antes de confirmar. Itens com cadeado o jogo ja nao vende.</div>
      <label style="display:flex;gap:6px;align-items:center"><input data-v="ligado" type="checkbox"${v.ligado ? ' checked' : ''}> venda ligada</label>
      <label style="display:flex;gap:6px;align-items:center;margin:6px 0">Vender ao chegar em
        <input data-v="limite" type="number" min="10" max="100" value="${Number(v.limite) || 70}" style="${campo};width:52px">% do peso
        <span style="opacity:.7">(agora: ${p ? `${p.atual}/${p.max} = ${Math.round(p.pct)}%` : '?'})</span></label>
      <div style="margin:8px 0">
        <label style="display:flex;gap:6px;align-items:center"><input data-ar="ligado" type="checkbox"${cfg.armazem.ligado ? ' checked' : ''}> Guardar no armazem os itens de Nunca vender</label>
        <label style="display:flex;gap:6px;align-items:center"><input data-ar="usarCartao" type="checkbox"${cfg.armazem.usarCartao ? ' checked' : ''}> Usar Cartao Kafra no mapa quando disponivel</label>
        <div style="opacity:.75;margin-top:4px">Sem cartao, guarda pela Kafra de Prontera. Itens equipados, travados, favoritos e o Cartao Kafra nunca vao para o armazem. A mesma lista abaixo escolhe os itens a guardar.</div>
      </div>
      <div style="font-weight:bold;margin:8px 0 4px">Nunca vender / Guardar</div>
      ${TIPOS_VENDA.map(([k, r]) => `<label style="display:flex;gap:6px;align-items:center"><input data-p="${k}" type="checkbox"${v.proteger[k] ? ' checked' : ''}> ${r}</label>`).join('')}
      <label style="display:flex;gap:6px;align-items:center"><input data-v="comCarta" type="checkbox"${v.comCarta ? ' checked' : ''}> Equipamentos com carta encaixada</label>
      <label style="display:flex;gap:6px;align-items:center;margin-top:4px">Raridade a partir de
        <select data-v="raridadeMin" style="${campo}">
          <option value="0"${!(Number(v.raridadeMin) > 0) ? ' selected' : ''}>(nao proteger por raridade)</option>
          ${RARIDADES.map((r, i) => `<option value="${i + 1}"${Number(v.raridadeMin) === i + 1 ? ' selected' : ''}>${r}</option>`).join('')}
        </select></label>
      <div style="margin-top:6px">Nomes (um por linha; vale parte do nome, ex.: "Elunium"):</div>
      <textarea data-v="nomes" rows="4" style="${campo};width:100%;box-sizing:border-box">${(v.nomes || []).join('\n').replace(/</g, '&lt;')}</textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button data-a="testar" title="Parado na chegada, ao lado do Mercador: monta a venda e mostra no log o que sairia, sem confirmar" style="${campo};cursor:pointer">Testar (sem vender)</button>
        <button data-a="fechar" style="${campo};cursor:pointer;margin-left:auto">Fechar</button>
      </div>`;
    menuVenda.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.ar) cfg.armazem[t.dataset.ar] = t.checked;
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
      else if (a === 'fechar') abrirMenuVenda();
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
      const pintarBolso = () => { bolso.textContent = 'Loja de Bolso: ' + (cfg.lojaBolso ? 'ON' : 'OFF'); bolso.className = cfg.lojaBolso ? 'fzn-av--on' : 'fzn-av--off'; };
      bolso.addEventListener('click', () => { if (ocupado) return; cfg.lojaBolso = !cfg.lojaBolso; compraBolsoEm = 0; salvarCfg(); log('Loja de Bolso ' + (cfg.lojaBolso ? 'ligada' : 'desligada')); pintarBolso(); });
      pintarBolso();
      const ferreiro = document.createElement('button');
      ferreiro.title = 'Ferreiro (158,191): ao chegar em 95% dos espacos da mochila, vai a Prontera e desmonta os equipamentos elegiveis antes de guardar e vender. Nunca destrava itens.';
      const pintarFerreiro = () => { ferreiro.textContent = 'Ferreiro: ' + (cfg.ferreiro ? 'ON' : 'OFF'); ferreiro.className = cfg.ferreiro ? 'fzn-av--on' : 'fzn-av--off'; };
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
        const titulo = document.createElement('strong'); titulo.textContent = 'Restaurar ajustes'; cab.appendChild(titulo);
        const fechar = document.createElement('button'); estilo(fechar); fechar.textContent = 'Fechar';
        fechar.addEventListener('click', () => caixa.remove()); cab.appendChild(fechar); caixa.appendChild(cab);
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
      const importar = document.createElement('button'); estilo(importar); importar.textContent = 'Restaurar ajustes';
      importar.title = 'Recupere um backup do Hub ou escolha um arquivo JSON externo.';
      importar.addEventListener('click', () => {
        if (ocupado) return;
        painelBackups();
      });
      const status = document.createElement('div'); status.dataset.status = '1';
      Object.assign(status.style, { width: '100%', color: '#cfe3f0', fontWeight: '600', fontVariantNumeric: 'tabular-nums' });
      const detalhe = document.createElement('div'); detalhe.dataset.detalhe = '1';
      Object.assign(detalhe.style, { width: '100%', color: '#f2eedc' });
      const historico = document.createElement('pre'); historico.dataset.historico = '1';
      Object.assign(historico.style, { whiteSpace: 'pre-wrap', width: '100%', maxHeight: '28vh', overflow: 'auto', margin: '3px 0', font: '11px/1.35 system-ui,sans-serif' });
      const abrir = document.createElement('button'); estilo(abrir); abrir.dataset.abrir = '1';
      const conteudo = document.createElement('div'); conteudo.dataset.controles = '1';
      Object.assign(conteudo.style, { display: 'flex', flexWrap: 'wrap', gap: '4px', width: '100%', alignItems: 'center' });
      const ajuda = document.createElement('div'); ajuda.textContent = 'Rotina por limite ON: peso em 70% OU mochila com 95% dos espacos confirmados iniciam o processo; Cartao Kafra e Loja de Bolso podem concluir no mapa. OFF: ignora esses limites e continua a cacada mesmo com mochila cheia; Executar agora ainda funciona. Evento ON retorna pelo Gerente de Premios. Ferreiro ON desmantela antes da venda. Ovos de pet, Cartao, Asa de Mosca, flechas, equipados, travados e favoritos ficam na mochila. Historico mostra as etapas. Funciona em segundo plano.';
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
      const limites = document.createElement('button'); estilo(limites); limites.dataset.rotinaLimites = '1';
      limites.title = 'ON: aos 70% de peso ou 95% dos espacos, processa no mapa se Cartao Kafra e Loja de Bolso estiverem ativos, ou faz a rotina da cidade. OFF: continua a cacada mesmo acima desses limites; Executar agora ainda funciona. Salvo por conta.';
      limites.addEventListener('click', () => { if (ocupado) return; cfg.rotinaLimites = cfg.rotinaLimites === false; salvarCfg(); log('Rotina automatica por peso e espacos ' + (cfg.rotinaLimites ? 'ligada' : 'desligada') + ' nesta conta'); atualizarStatus(); });
      const mapaFarm=document.createElement('button');estilo(mapaFarm);mapaFarm.textContent='Mapa de farm';mapaFarm.addEventListener('click',abrirMapaFarm);
      const lucky = document.createElement('button'); estilo(lucky); lucky.dataset.lucky = '1'; lucky.addEventListener('click', abrirMenuLucky);
      const rifaBtn = document.createElement('button'); estilo(rifaBtn); rifaBtn.dataset.rifa = '1'; rifaBtn.title = 'Escolher premios, quanto gastar por rifa e executar agora'; rifaBtn.addEventListener('click', abrirMenuRifa);
      const rifaLiga = document.createElement('button'); estilo(rifaLiga); rifaLiga.dataset.rifaLiga = '1'; rifaLiga.addEventListener('click', () => { cfg.rifa.ligado = !cfg.rifa.ligado; salvarCfg(); log('Rifa '+(cfg.rifa.ligado?'ligada':'desligada')); atualizarPainel(); });
      const covilBtn = document.createElement('button'); covilBtn.dataset.covil = '1'; covilBtn.addEventListener('click', abrirMenuCovil);
      conteudo.append(liga, covilBtn, lucky, rifaLiga, rifaBtn, cartaoFarm, modoInventario, evento, limites, bolso, ferreiro, compras, venda, calibrar, executar, mapaFarm, usarMapa, detalhes, exportar, importar, status, detalhe, historico);
      abrir.addEventListener('click', () => { controlesAbertos = !controlesAbertos; atualizarStatus(); });
      const topo = document.createElement('div'); topo.className = 'fzn-av__topo';
      topo.innerHTML = '<b>fzN · Auto-voltar</b><small>v2.46</small>';
      topo.title = ajuda.textContent;
      painel.append(topo, conteudo);
      document.body.appendChild(painel);
      fznArrastavel(painel, topo, 'fzn-autovoltar-ygg-posicao-v8');
      fznEncolhivel(painel, 'fzn-autovoltar-ygg-encolher-v8');
    }
    const liga = painel.querySelector('[data-liga]');
    liga.textContent = rifaRodando ? 'Auto-voltar: PAUSADO (RIFA)' : `Auto-voltar: ${cfg.ligado ? 'ON' : 'OFF'}`;
    liga.disabled = rifaRodando;
    liga.className = cfg.ligado ? 'fzn-av--on' : 'fzn-av--off';
    liga.title = historicoLog().slice(-12).join('\n') || 'sem eventos ainda';
    const rifaBtn = painel.querySelector('[data-rifa]');
    if (rifaBtn) rifaBtn.textContent = 'Rifa: '+rifaEstado.etapa+' · '+(cfg.rifa.premios||[]).length+' prêmios';
    const rifaLiga = painel.querySelector('[data-rifa-liga], [data-rifaLiga]');
    if (rifaLiga) { rifaLiga.textContent = 'Rifa: '+(cfg.rifa.ligado?'ON':'OFF'); rifaLiga.className=cfg.rifa.ligado?'fzn-av--on':'fzn-av--off'; }
    const covilBtn = painel.querySelector('[data-covil]');
    covilBtn.textContent = 'Covil: ' + (cfg.covil?.ligado ? 'ON · ' + cfg.covil.hoje + ' hoje' : 'OFF');
    covilBtn.className = cfg.covil?.ligado ? 'fzn-av--on' : 'fzn-av--off';
    atualizarStatus();
  }

  const iniciarRotina = () => { atualizarPainel(); setInterval(verificar, 500); };
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
  setInterval(verificar, 500);
  }
})();
