// ==UserScript==
// @name         Yggidle — entrar sozinho com o personagem escolhido
// @namespace    https://jogo.yggidle.com.br/
// @version      1.25
// @description  Entra com o personagem escolhido, recupera avisos de conexao e aguarda 10 minutos se o servidor fechar.
// @match        https://jogo.yggidle.com.br/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
  'use strict';

  // v1.16: BYPASS DE isTrusted (guarda o getter original p/ o listener de clique humano).
  const fznBypassIsTrusted = (win) => {
    if (!win || win.__fznIsTrustedHook) return;
    win.__fznIsTrustedHook = true;
    try {
      const desc = Object.getOwnPropertyDescriptor(win.Event.prototype, 'isTrusted');
      if (desc && desc.get) win.__fznIsTrustedGetter = desc.get;
    } catch (e) {}
    try {
      Object.defineProperty(win.Event.prototype, 'isTrusted', {
        get: function() { return true; }, configurable: true
      });
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
        wrapped.__fznNoWrap = true;
        wrapped.__fznOrig = listener;
        cache.set(listener, wrapped);
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

  // v1.16: CLIQUE COMPLETO - dispara eventos de ponteiro e mouse (React precisa disso).
  const clicarBotao = (w, el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const base = { bubbles: true, cancelable: true, composed: true, view: w, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    for (const tipo of ['pointerover', 'pointerenter', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Ev = tipo.startsWith('pointer') && w.PointerEvent ? w.PointerEvent : w.MouseEvent;
      try { el.dispatchEvent(new Ev(tipo, { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(tipo) ? 1 : 0 })); } catch {}
    }
    return true;
  };

  // O clique global também é interceptado (para qualquer elemento fora do nosso painel).
  const fznHackClick = (win) => {
    if (!win || win.__fznClickHacked) return;
    win.__fznClickHacked = true;
    const origClick = win.HTMLElement.prototype.click;
    win.HTMLElement.prototype.click = function() {
      if (!this.isConnected) return origClick.call(this);
      if (this.closest && this.closest('.fzn-ygg,[data-fzn-auto-voltar]')) return origClick.call(this);
      clicarBotao(win, this);
    };
  };

  fznBypassIsTrusted(window);
  fznHackClick(window);
  const fznInjetar = () => {
    for (const f of document.querySelectorAll('iframe')) {
      try { const w = f.contentWindow; if (w) { fznBypassIsTrusted(w); fznHackClick(w); } } catch {}
    }
  };
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
    const aplicar = () => { if (!tam) { Object.assign(painel.style, orig); return; } Object.assign(painel.style, { width: tam.w + 'px', height: 'auto', minHeight: tam.h + 'px', maxWidth: '98vw', maxHeight: '98vh', overflow: 'auto', boxSizing: 'border-box' }); };
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


  const fznTemaYggExtra = () => {
    if (document.getElementById('fzn-ygg-tema-gaveta')) return;
    const css = document.createElement('style');
    css.id = 'fzn-ygg-tema-gaveta';
    css.textContent = `
      .fzn-ygg__barra { display:flex; gap:4px; align-items:center; width:100%; }
      .fzn-ygg__barra .fzn-ygg__liga { min-width:64px; }
      .fzn-ygg__barra [data-ajustes] { margin-left:auto; padding:4px 8px; }
      .fzn-ygg__status { width:100%; font-size:11px; font-weight:600; color:#cfe3f0; font-variant-numeric:tabular-nums; }
      .fzn-ygg__status[data-clica] { cursor:pointer; }
      .fzn-ygg__gaveta { width:100%; display:flex; flex-direction:column; gap:5px; padding:6px 0 2px; border-top:1px solid rgba(120,200,255,.15); }
      .fzn-ygg__grupo { display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
      .fzn-ygg__grupo > span { width:100%; font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#8fa3b3; }
      .fzn-ygg__gaveta button { font-weight:600; background:transparent; color:#aab8c4; border-color:rgba(143,163,179,.35); }
      .fzn-ygg__gaveta button.fzn-ygg--on { background:rgba(111,227,138,.14); color:#6fe38a; border-color:rgba(111,227,138,.55); }
      .fzn-ygg__gaveta button.fzn-ygg--off { background:transparent; color:#8f8aa3; border-color:rgba(143,138,163,.35); }
    `;
    (document.head || document.documentElement).appendChild(css);
  };
  // Barra principal + linha de status + gaveta de ajustes (aberta/fechada por conta).
  const fznGavetaYgg = (corpo, chaveAberta) => {
    fznTemaYggExtra();
    const barra = document.createElement('div'); barra.className = 'fzn-ygg__barra';
    const status = document.createElement('div'); status.className = 'fzn-ygg__status';
    const gaveta = document.createElement('div'); gaveta.className = 'fzn-ygg__gaveta';
    const ajustes = document.createElement('button'); ajustes.dataset.ajustes = '1'; ajustes.textContent = '\u2699'; ajustes.title = 'Ajustes';
    let aberta = false;
    try { aberta = localStorage.getItem(chaveAberta) === '1'; } catch {}
    const pintar = () => { gaveta.style.display = aberta ? 'flex' : 'none'; ajustes.className = aberta ? 'fzn-ygg--on' : ''; };
    ajustes.addEventListener('click', () => { aberta = !aberta; try { localStorage.setItem(chaveAberta, aberta ? '1' : '0'); } catch {} pintar(); });
    pintar();
    const grupo = (titulo, ...itens) => {
      const g = document.createElement('div'); g.className = 'fzn-ygg__grupo';
      const t = document.createElement('span'); t.textContent = titulo;
      g.append(t, ...itens); gaveta.appendChild(g); return g;
    };
    corpo.append(barra, status, gaveta);
    return { barra, status, gaveta, ajustes, grupo };
  };
  const fznTemaYgg = () => {
    fznTemaYggExtra();
    if (document.getElementById('fzn-ygg-tema')) return;
    const css = document.createElement('style'); css.id = 'fzn-ygg-tema';
    css.textContent = `
      .fzn-ygg { position:fixed; z-index:2147483000; font:12px/1.35 system-ui,"Segoe UI",sans-serif; color:#f2eedc;
        background:rgba(18,22,30,.94); border:1px solid rgba(120,200,255,.4); border-radius:10px;
        box-shadow:0 6px 22px rgba(0,0,0,.5); padding:6px 8px; box-sizing:border-box; }
      .fzn-ygg__topo { display:flex; align-items:center; gap:6px; cursor:grab; touch-action:none; user-select:none;
        padding:0 2px 4px; margin-bottom:4px; border-bottom:1px solid rgba(120,200,255,.2); }
      .fzn-ygg__topo b { flex:1; font-weight:600; }
      .fzn-ygg__topo small { color:#8fa3b3; }
      .fzn-ygg button { font:inherit; font-size:11px; font-weight:700; color:#cfe3f0; background:#2c3544;
        border:1px solid rgba(120,200,255,.35); border-radius:999px; padding:4px 10px; cursor:pointer; opacity:1; }
      .fzn-ygg button:hover { filter:brightness(1.15); }
      .fzn-ygg button.fzn-ygg--on { background:#6fe38a; color:#05170a; border-color:#6fe38a; }
      .fzn-ygg button.fzn-ygg--off { background:#5b5470; color:#d8d4e8; border-color:#5b5470; }
      .fzn-ygg button.fzn-ygg--alerta { background:#ffb38a; color:#2a1405; border-color:#ffb38a; }
      .fzn-ygg input, .fzn-ygg select, .fzn-ygg textarea { font:inherit; color:#f2eedc; background:#2c3544;
        border:1px solid rgba(120,200,255,.35); border-radius:6px; padding:2px 5px; }
    `;
    (document.head || document.documentElement).appendChild(css);
  };
  const fznArrastavelYgg = (caixa, alca, chave) => {
    const aplicar = (p) => {
      if (!p) return null;
      const w = caixa.offsetWidth, h = caixa.offsetHeight;
      const x = Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - w));
      const bruto = Number.isFinite(p.b) ? p.b : window.innerHeight - p.y - h;
      const b = Math.min(Math.max(0, bruto), Math.max(0, window.innerHeight - h));
      Object.assign(caixa.style, { left: x + 'px', bottom: b + 'px', top: 'auto', right: 'auto' });
      return { x, b };
    };
    try { const p = JSON.parse(localStorage.getItem(chave) || 'null'); if (p && Number.isFinite(p.x) && (Number.isFinite(p.b) || Number.isFinite(p.y))) requestAnimationFrame(() => aplicar(p)); } catch {}
    let apertado = false, dx = 0, dy = 0;
    alca.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.target.closest?.('button,select,input,textarea')) return;
      const r = caixa.getBoundingClientRect(); dx = ev.clientX - r.left; dy = ev.clientY - r.top; apertado = true;
      alca.style.cursor = 'grabbing'; try { alca.setPointerCapture(ev.pointerId); } catch {} ev.preventDefault();
    });
    alca.addEventListener('pointermove', (ev) => { if (apertado) aplicar({ x: ev.clientX - dx, y: ev.clientY - dy }); });
    const soltar = (ev) => { if (!apertado) return; apertado = false; alca.style.cursor = 'grab'; try { alca.releasePointerCapture(ev.pointerId); } catch {} const r = caixa.getBoundingClientRect(); const p = aplicar({ x: r.left, y: r.top }); try { localStorage.setItem(chave, JSON.stringify(p)); } catch {} };
    alca.addEventListener('pointerup', soltar); alca.addEventListener('pointercancel', soltar);
    caixa.style.maxHeight = 'calc(100vh - 16px)'; caixa.style.overflowY = 'auto';
    const manterNaTela = () => { const r = caixa.getBoundingClientRect(); if (!r.width || !r.height) return; if (r.top < 0 || r.right > window.innerWidth + 1 || r.left < 0 || r.bottom > window.innerHeight + 1) aplicar({ x: r.left, b: window.innerHeight - r.bottom }); };
    try { new ResizeObserver(() => requestAnimationFrame(manterNaTela)).observe(caixa); } catch {}
    window.addEventListener('resize', manterNaTela);
  };
  const fznCartaoYgg = (titulo, versao, chavePos, posPadrao, chaveEncolher) => {
    fznTemaYgg();
    const caixa = document.createElement('div'); caixa.className = 'fzn-ygg'; Object.assign(caixa.style, posPadrao);
    const topo = document.createElement('div'); topo.className = 'fzn-ygg__topo'; topo.innerHTML = '<b></b><small></small>';
    topo.firstChild.textContent = 'fzN · ' + titulo; topo.lastChild.textContent = versao;
    const corpo = document.createElement('div'); corpo.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center';
    caixa.append(topo, corpo); document.body.appendChild(caixa);
    fznArrastavelYgg(caixa, topo, chavePos); fznEncolhivel(caixa, chaveEncolher);
    return { caixa, topo, corpo };
  };
  const fznSubjanelaYgg = (el, cartao, largura) => {
    fznTemaYgg(); el.className = 'fzn-ygg';
    const r = cartao?.getBoundingClientRect();
    const left = r ? Math.min(Math.max(0, r.left), Math.max(0, window.innerWidth - largura - 8)) : 12;
    const bottom = r ? Math.max(8, window.innerHeight - r.top + 6) : 60;
    const maxH = Math.max(120, window.innerHeight - bottom - 8);
    Object.assign(el.style, { left: left + 'px', bottom: bottom + 'px', top: 'auto', right: 'auto', zIndex: 2147483001, width: largura + 'px', maxWidth: '95vw', maxHeight: maxH + 'px', overflow: 'auto', padding: '10px 12px' });
  };

  const CHAVE = 'fzn-autologin-ygg-v3';
  const CHAVE_IDENTIDADE = CHAVE + '-conta-local';
  let identidade = '';
  try { identidade = localStorage.getItem(CHAVE_IDENTIDADE) || ''; } catch {}
  const chavePerfil = (nome) => `${CHAVE}:${String(nome).trim().toLowerCase()}`;
  const ler = (chave) => {
    if (!chave) return {};
    try {
      if (typeof GM_getValue === 'function') {
        const salvo = GM_getValue(chave, null);
        if (salvo) return typeof salvo === 'string' ? JSON.parse(salvo) : salvo;
      }
    } catch {}
    try { return JSON.parse(localStorage.getItem(chave)) || {}; } catch { return {}; }
  };
  const padrao = () => ({ ligado: false, personagem: '', religarAutopilot: true, voltarParaCaca: true, loginSalvo: true, conta: '', conhecidos: [], log: [], assinaturaTela: '', pausaServidorAte: 0 });
  let cfg = Object.assign(padrao(), ler(identidade ? chavePerfil(identidade) : ''));
  const normalizarCfg = () => { if (!Array.isArray(cfg.log)) cfg.log = []; if (!Array.isArray(cfg.conhecidos)) cfg.conhecidos = []; };
  normalizarCfg();
  const salvar = () => {
    if (!identidade) return;
    const dados = JSON.stringify(cfg);
    const chave = chavePerfil(identidade);
    try { if (typeof GM_setValue === 'function') GM_setValue(chave, dados); } catch {}
    try { localStorage.setItem(chave, dados); } catch {}
  };
  const log = (msg) => { cfg.log = (cfg.log || []).concat(`${new Date().toLocaleTimeString()} ${msg}`).slice(-15); salvar(); console.log('[autologin-ygg]', msg); pintar(); };

  const PAUSA_SERVIDOR_MS = 10 * 60_000;
  const pausadoPeloServidor = () => Number(cfg.pausaServidorAte || 0) > Date.now();
  const tempoDePausa = () => {
    const segundos = Math.max(0, Math.ceil((Number(cfg.pausaServidorAte || 0) - Date.now()) / 1000));
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const visivel = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const texto = (el) => ((el && (el.innerText || el.textContent)) || '').trim().replace(/\s+/g, ' ');
  const consultar = (raiz, seletor) => {
    const encontrados = [];
    const visitar = (node) => {
      encontrados.push(...node.querySelectorAll(seletor));
      for (const el of node.querySelectorAll('*')) if (el.shadowRoot) visitar(el.shadowRoot);
    };
    visitar(raiz);
    return encontrados;
  };
  // O motor so aparece depois da escolha do personagem em algumas sessoes.
  // Manter o iframe do jogo acessivel permite reconhecer a selecao e o login.
  const jogo = () => {
    let motor = null, selecao = null, fallback = null;
    const visitar = (doc, nivel) => {
      if (nivel > 3) return;
      for (const f of consultar(doc, 'iframe')) {
        try {
          const w = f.contentWindow;
          if (!w?.document?.body) continue;
          if (w.__elragEngine) motor = w;
          const origem = new URL(f.src || w.location.href, location.href).hostname;
          if (origem === 'jogo.yggidle.com.br') fallback = w;
          if (telaDePersonagens(w.document)) selecao = w;
          visitar(w.document, nivel + 1);
        } catch {}
      }
    };
    visitar(document, 0);
    return selecao || motor || fallback;
  };

  const telaDePersonagens = (doc) => {
    for (const el of consultar(doc, 'h1, h2, h3, h4, div, span, p, strong, b, header')) {
      if (!visivel(el)) continue;
      if (!/^Seus personagens(?:\s*\(|\s*$)/i.test(texto(el))) continue;
      const filhos = [...el.children].map((c) => texto(c)).join('|');
      if (filhos && filhos.replace(/\|/g, '').length >= texto(el).length * 0.9) continue;
      return el;
    }
    if (/Seus personagens/i.test(texto(doc.body))) return doc.body;
    return null;
  };

  const candidatosEntrar = (doc) => {
    const lista = [];
    for (const sel of ['button', '[role="button"]', 'a', '[onclick]']) {
      for (const b of consultar(doc, sel)) {
        if (!visivel(b)) continue;
        if (!/entrar/i.test(texto(b))) continue;
        lista.push(b);
      }
    }
    return lista;
  };

  const cards = (doc) => {
    const saida = [];
    const vistos = new Set();
    for (const b of candidatosEntrar(doc)) {
      if (vistos.has(b)) continue;
      vistos.add(b);
      let card = b.parentElement;
      for (let i = 0; card && i < 8 && !/N[ií]vel\s*\d+/i.test(texto(card)); i++) card = card.parentElement;
      if (!card) continue;
      const linhas = [...card.querySelectorAll('div, span, p, strong, b')]
        .filter((el) => !el.children.length && visivel(el))
        .map(texto).filter(Boolean);
      const iNivel = linhas.findIndex((l) => /^N[ií]vel\s*\d+/i.test(l));
      const nome = iNivel > 0 ? linhas[iNivel - 1] : linhas[0];
      if (nome && !/Tier\s*\d/i.test(nome) && !/^entrar$/i.test(nome)) saida.push({ nome, nivel: (linhas[iNivel] || '').replace(/\s+/g, ' '), botao: b });
    }
    return saida;
  };

  let pedidoManualAte = 0;
  const ouvidos = new WeakSet();
  const ouvirCliques = (w) => {
    if (ouvidos.has(w)) return;
    ouvidos.add(w);
    const origAdd = w.__fznAddEventListenerNativo || w.EventTarget.prototype.addEventListener;
    const onClick = (ev) => {
      let realTrusted = true;
      try { realTrusted = w.__fznIsTrustedGetter ? w.__fznIsTrustedGetter.call(ev) : ev.isTrusted; } catch { realTrusted = false; }
      if (!realTrusted) return;
      const b = ev.target?.closest?.('button, a, [role="button"]');
      if (b && /^Voltar (a|à) sele[cç][aã]o de personagem$/i.test(texto(b))) {
        pedidoManualAte = Date.now() + 30_000;
        log('Voce pediu a selecao manualmente: aguardo 30s');
      }
    };
    try { origAdd.call(w.document, 'click', onClick, true); } catch { w.document.addEventListener('click', onClick, true); }
  };

  const tentarEnterPeloMotor = (w, nome) => {
    try {
      const e = w.__elragEngine;
      if (!e) return false;
      const pregame = e.getPregameSnapshot?.();
      const chars = pregame?.characters || pregame?.chars || [];
      if (!chars.length) return false;
      const norm = (s) => String(s || '').trim().toLowerCase();
      const idx = chars.findIndex((c) => norm(c.name) === norm(nome));
      if (idx < 0) return false;
      e.pregameEnter?.(idx);
      log(`pregameEnter(${idx}) com ${nome} (plano B pelo motor)`);
      return true;
    } catch (e) { log('pregameEnter falhou: ' + String(e).slice(0, 80)); return false; }
  };

  let travaAte = 0, avisouManual = false, avisouOff = false, ocupado = false, ultimoDiag = '';

  const entrar = async (w) => {
    ocupado = true;
    try {
      await esperar(600);
      const lista = cards(w.document);
      if (!lista.length) {
        const titulo = telaDePersonagens(w.document);
        const diag = `selecao visivel=${Boolean(titulo)} cards=${lista.length}`;
        if (diag !== ultimoDiag) { ultimoDiag = diag; log(diag); }
        return;
      }
      const nomes = lista.map((c) => c.nome);
      if (nomes.join('|') !== (cfg.conhecidos || []).join('|')) { cfg.conhecidos = nomes; salvar(); pintar(); log(`Personagens visiveis: ${nomes.join(', ')}`); }
      if (!cfg.ligado || pausadoPeloServidor()) { if (!avisouOff && !cfg.ligado) { avisouOff = true; log('Na selecao de personagem, mas o auto-login esta OFF nesta conta: nao entrei'); } return; }
      avisouOff = false;
      if (Date.now() < pedidoManualAte) { if (!avisouManual) { log('Selecao aberta por voce: espero 30 s antes de entrar sozinho'); avisouManual = true; } return; }
      avisouManual = false;
      if (!cfg.personagem) { if (ultimoDiag !== 'sem-personagem') { ultimoDiag = 'sem-personagem'; log('Nenhum personagem escolhido no menu; nao entrei'); } return; }
      const norm = (t) => String(t || '').trim().toLowerCase();
      const alvo = lista.find((c) => norm(c.nome) === norm(cfg.personagem))
        || lista.find((c) => norm(c.nome).includes(norm(cfg.personagem)))
        || lista.find((c) => norm(texto(c.botao.parentElement?.parentElement || c.botao)).includes(norm(cfg.personagem)));
      if (!alvo) { log(`"${cfg.personagem}" nao esta na lista (${nomes.join(', ')}); nao entrei com outro`); travaAte = Date.now() + 3_000; return; }
      if (Date.now() < travaAte) return;
      travaAte = Date.now() + 8_000;
      log(`Entrando com ${alvo.nome} (${alvo.nivel})...`);
      clicarBotao(w, alvo.botao);
      await esperar(1500);
      if (telaDePersonagens(w.document) && cards(w.document).length) {
        log('A tela nao mudou: tentando plano B (pregameEnter)');
        if (tentarEnterPeloMotor(w, alvo.nome)) await esperar(1500);
        else log('Plano B indisponivel (getPregameSnapshot sem lista de personagens).');
      }
      if (cfg.religarAutopilot || cfg.voltarParaCaca) await religarAutopilot(w);
    } finally { ocupado = false; }
  };

  const CIDADES = /^(prontera|geffen|payon|morocc|alberta|izlude|aldebaran|comodo|yuno|lighthalzen|einbroch|hugel|rachel|veins|juno|umbala|amatsu|gonyrun|louyang|ayothaya|moscovia|brasilis|dewata|malangdo|mid_camp|lasagna)/i;
  const posicao = (w) => { try { return w.__elragEngine.getMinimapInfoSnapshot(); } catch { return null; } };
  const botaoPorTexto = (doc, re) => [...doc.querySelectorAll('button')].find((b) => visivel(b) && !b.disabled && re.test(texto(b)));
  const voltarParaCaca = async (w) => {
    const antes = posicao(w);
    if (!antes?.mapId || !CIDADES.test(String(antes.mapId))) { log(`Entrei em ${antes?.mapId || '?'} (nao e cidade): fico aqui`); return true; }
    // v1.17: o atalho "Voltar para..." do jogo leva ao ULTIMO mapa guardado pelo
    // servidor, nao ao mapa escolhido. Com mapa fixo no AUTOVOLTAR, a volta e dele.
    try {
      const av = JSON.parse(localStorage.getItem('fzn-autovoltar-ygg-v1') || '{}');
      // v1.18: basta o Auto-voltar ligado com mapa de farm; ele mesmo volta ao carregar na cidade.
      const mapaAv = av.mapaFarmManual || (av.destinoFarm && av.destinoFarm.mapa);
      if (av.ligado !== false && mapaAv) { log(`Auto-voltar com mapa ${mapaAv}: ele faz a volta, nao uso o atalho do jogo`); return true; }
      log('Auto-voltar sem mapa de farm: uso o atalho do jogo');
    } catch {}
    for (let i = 1; i <= 3; i++) {
      const mapa = w.document.querySelector('button[aria-label="Mundo de Midgard"]');
      if (!mapa) { await esperar(3000); continue; }
      mapa.click();
      let voltar = null;
      for (let t = 0; t < 16 && !voltar; t++) { await esperar(500); voltar = botaoPorTexto(w.document, /^Voltar para /); }
      if (!voltar) { w.document.querySelector('button[data-hud-action="close-panel"]')?.click(); log('Nao achei "Voltar para..." no Mundo de Midgard; fico na cidade'); return false; }
      const destino = texto(voltar);
      voltar.click();
      for (let t = 0; t < 45; t++) { await esperar(1000); const agora = posicao(w); if (agora?.mapId && agora.mapId !== antes.mapId) { log(`${destino}: ok (${agora.mapName || agora.mapId})`); return true; } }
      log(`${destino}: o mapa nao mudou (tentativa ${i}/3)`);
      w.document.querySelector('button[data-hud-action="close-panel"]')?.click();
      await esperar(5000);
    }
    return false;
  };

  const religarAutopilot = async (w) => {
    const fim = Date.now() + 90_000;
    while (Date.now() < fim) {
      await esperar(2000);
      const pos = posicao(w);
      if (!pos || !pos.mapId) continue;
      await esperar(5000);
      if (cfg.voltarParaCaca) await voltarParaCaca(w);
      await esperar(3000);
      if (!cfg.religarAutopilot) return;
      try {
        const ap = w.__elragEngine.getAutopilotSnapshot();
        if (ap && ap.runtimeState === 1) { w.__elragEngine.setAutopilotRunning(true); log('Autopilot religado'); }
        else log('Autopilot ja estava ligado');
      } catch (e) { log('Nao consegui religar o autopilot: ' + String(e?.message || e).slice(0, 60)); }
      return;
    }
    log('Mapa nao carregou em 90 s depois de entrar; autopilot nao religado');
  };

  // v1.16: busca profunda nos Shadow DOMs para achar a conta salva.
  const linhasDeConta = (doc) => {
    const roots = [doc];
    const collectRoots = (node) => {
      try {
        for (const el of node.querySelectorAll('*')) {
          if (el.shadowRoot) { roots.push(el.shadowRoot); collectRoots(el.shadowRoot); }
        }
      } catch {}
    };
    collectRoots(doc);

    const contas = [];
    for (const root of roots) {
      try {
        for (const el of root.querySelectorAll('*')) {
          if (!visivel(el)) continue;
          const t = texto(el);
          if (!/senha salva/i.test(t)) continue;
          if ([...el.children].some(c => /senha salva/i.test(texto(c)))) continue; // evita pegar o pai e o filho

          let row = el.parentElement;
          for (let i = 0; row && i < 4 && !texto(row).match(/fzinhoo|conta|pick|account/i); i++) row = row.parentElement;
          if (!row) row = el.parentElement;

          const pick = row.querySelector('.account-pick, button, [role="button"], input') || row;
          const nome = texto(row).replace(/senha salva/i, '').replace(/×|x/gi, '').trim();

          contas.push({ nome, salva: true, estado: 'senha salva', pick });
        }
      } catch {}
    }
    return contas;
  };

  const sincronizarPerfil = (w) => {
    const contas = linhasDeConta(w.document);
    const atual = contas.length === 1 ? String(contas[0].nome || '').trim() : '';
    if (!atual || atual.toLowerCase() === identidade.toLowerCase()) return;
    identidade = atual;
    try { localStorage.setItem(CHAVE_IDENTIDADE, atual); } catch {}
    cfg = Object.assign(padrao(), ler(chavePerfil(atual)));
    cfg.conta = atual;
    normalizarCfg();
    salvar();
    log(`Perfil da conta ${atual} carregado separadamente.`);
  };

  let loginTravaAte = 0, avisouSemSenha = false, avisouLoginOff = false;
  const tentarLogin = async (w) => {
    if (!cfg.ligado || pausadoPeloServidor()) return;
    if (servidorFechadoVisivel(w.document)) { pausarServidor(); return; }
    if (!cfg.loginSalvo) { if (!avisouLoginOff && !posicao(w)?.mapId && linhasDeConta(w.document).length) { avisouLoginOff = true; log('Na tela de login, mas "entrar pela conta com senha salva" esta OFF: nao entrei'); } return; }
    avisouLoginOff = false;
    if (Date.now() < loginTravaAte) return;
    if (posicao(w)?.mapId) return;
    const contas = linhasDeConta(w.document);
    if (!contas.length) return;
    const norm = (t) => String(t || '').trim().toLowerCase();
    const alvo = cfg.conta ? contas.find((c) => norm(c.nome) === norm(cfg.conta)) : contas.find((c) => c.salva);
    if (!alvo || !alvo.salva) { if (!avisouSemSenha) { avisouSemSenha = true; log(`Login: ${alvo ? `"${alvo.nome}" esta "${alvo.estado}"` : 'nenhuma conta com "senha salva"'}. Clique em "sem senha" para virar "salva ao entrar" e entre uma vez na mao.`); } loginTravaAte = Date.now() + 10_000; return; }
    avisouSemSenha = false;
    loginTravaAte = Date.now() + 20_000;
    log(`Tentando clicar na conta salva ${alvo.nome}...`);
    clicarBotao(w, alvo.pick);
    await esperar(1000);
    if (!cfg.ligado || pausadoPeloServidor()) return;

    // Se ainda está na tela de login, tenta o "Entrar" ou Enter no campo de senha.
    if (!posicao(w)?.mapId && linhasDeConta(w.document).length) {
      log('A tela de login nao avançou. Tentando "Entrar" ou Enter.');
      const btnEntrar = [...w.document.querySelectorAll('button, input[type="submit"], div[role="button"]')].find(b => visivel(b) && /^Entrar$/i.test(texto(b)));
      if (btnEntrar) {
        clicarBotao(w, btnEntrar);
      } else {
        const senhaInput = w.document.querySelector('input[type="password"]');
        if (senhaInput) {
          senhaInput.focus();
          senhaInput.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          senhaInput.dispatchEvent(new w.KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
      }
    }
  };

  const AVISO_QUEDA = /conex[aã]o caiu|entre novamente para continuar|servidor\s+(?:est[aá]\s+)?fechado|servidor\s+em\s+manuten[cç][aã]o/i;
  const AVISO_MANUTENCAO = /servidor\s+(?:est[aá]\s+)?fechado|servidor\s+em\s+manuten[cç][aã]o/i;
  const AVISO_NOVA_VERSAO = /saiu uma vers[aã]o nova do jogo|recarregue para aplicar/i;
  const AVISO_CONEXAO = /a conex[aã]o caiu e n[aã]o foi poss[ií]vel voltar ao seu personagem a tempo|entre novamente para continuar/i;
  const pausarServidor = () => {
    if (pausadoPeloServidor()) return;
    cfg.pausaServidorAte = Date.now() + PAUSA_SERVIDOR_MS;
    log('Servidor fechado: auto-login pausado por 10 minutos. Use "Tentar agora" para antecipar.');
  };
  const servidorFechadoVisivel = (doc) => consultar(doc, '[role="alert"], [role="dialog"], .modal, .alert, p, span, div')
    .some((el) => visivel(el) && texto(el).length < 200 && AVISO_MANUTENCAO.test(texto(el)));
  const ehBotaoOk = (b) => /^(ok|확인)$/i.test(texto(b) || b.value || '') || /(^|[_\-\s])ok([_.\-\s]|$)/i.test(`${b.className || ''} ${b.getAttribute('data-background') || ''} ${b.id || ''}`);
  let avisoTravaAte = 0;
  const recarregarAposAviso = (motivo) => {
    let anterior = Number(cfg.ultimoAvisoRecarregadoEm || 0);
    try { anterior = Math.max(anterior, Number(sessionStorage.getItem(CHAVE + '-ultimo-aviso-reload') || 0)); } catch {}
    if (Date.now() - anterior < 30_000) return;
    cfg.ultimoAvisoRecarregadoEm = Date.now();
    try { sessionStorage.setItem(CHAVE + '-ultimo-aviso-reload', String(cfg.ultimoAvisoRecarregadoEm)); } catch {}
    log(motivo + ': recarregando a pagina do jogo');
    setTimeout(() => location.reload(), 500);
  };
  const textoDeAvisoVisivel = (doc, re) => consultar(doc, '[role="alert"], [role="alertdialog"], [role="dialog"], .modal, .alert, p, span, div')
    .some((el) => visivel(el) && !(cartaoLogin?.contains(el) || menu?.contains(el)) && texto(el).length < 240 && re.test(texto(el)));
  const tratarAvisos = (w) => {
    if (!cfg.ligado) return false;
    const docs = [document];
    if (w?.document && w.document !== document) docs.push(w.document);
    if (docs.some((doc) => textoDeAvisoVisivel(doc, AVISO_MANUTENCAO))) {
      pausarServidor();
      for (const doc of docs) fecharAvisoDeQueda({document:doc});
      return true;
    }
    if (pausadoPeloServidor()) return true;
    if (docs.some((doc) => textoDeAvisoVisivel(doc, AVISO_CONEXAO))) {
      for (const doc of docs) fecharAvisoDeQueda({document:doc});
      recarregarAposAviso('Conexao perdida');
      return true;
    }
    if (docs.some((doc) => textoDeAvisoVisivel(doc, AVISO_NOVA_VERSAO))) {
      recarregarAposAviso('Nova versao do jogo');
      return true;
    }
    return false;
  };
  const fecharAvisoDeQueda = (w) => {
    if (Date.now() < avisoTravaAte) return false;
    const raizes = [w.document];
    for (const el of w.document.querySelectorAll('*')) if (el.shadowRoot) raizes.push(el.shadowRoot);
    for (const raiz of raizes) {
      for (const b of raiz.querySelectorAll('button, [role="button"], input[type="button"]')) {
        if (!visivel(b) || !ehBotaoOk(b)) continue;
        let caixa = b.parentElement;
        for (let i = 0; caixa && i < 6; i++, caixa = caixa.parentElement) {
          const mensagem = texto(caixa);
          if (AVISO_QUEDA.test(mensagem)) {
            avisoTravaAte = Date.now() + 3_000;
            if (AVISO_MANUTENCAO.test(mensagem)) pausarServidor();
            b.click();
            log(`Aviso fechado (OK): ${mensagem.slice(0, 50)}`);
            return true;
          }
        }
      }
    }
    return false;
  };

  const VIGIA_FORA_MS = 3 * 60_000;
  const VIGIA_ENTRE_MS = 10 * 60_000;
  let noMapaEm = Date.now();
  const textoDaTela = (w) => {
    const partes = [];
    try {
      const raizes = [w.document.body];
      for (const el of w.document.querySelectorAll('*')) if (el.shadowRoot) raizes.push(el.shadowRoot);
      for (const r of raizes) { const t = texto(r).slice(0, 160); if (t) partes.push(t); }
    } catch {}
    return partes.join(' | ').slice(0, 300) || '(tela vazia)';
  };
  const vigiar = (w) => {
    if (w && posicao(w)?.mapId) { noMapaEm = Date.now(); return; }
    if (!cfg.ligado || pausadoPeloServidor() || Date.now() < pedidoManualAte) { noMapaEm = Date.now(); return; }
    if (Date.now() - noMapaEm < VIGIA_FORA_MS) return;
    if (Date.now() - (cfg.vigiaRecarregouEm || 0) < VIGIA_ENTRE_MS) return;
    cfg.vigiaRecarregouEm = Date.now();
    log(`Vigia: 3 min fora do jogo; recarregando. Tela: ${w ? textoDaTela(w) : '(jogo nao carregou)'}`);
    setTimeout(() => location.reload(), 500);
  };

  let ultimoEstadoConhecido = '';
  setInterval(() => {
    if (!painel) pintar();
    if (cfg.ligado && cfg.pausaServidorAte && !pausadoPeloServidor()) {
      cfg.pausaServidorAte = 0;
      loginTravaAte = 0;
      noMapaEm = Date.now();
      log('Pausa de 10 minutos terminou: recarregando para tentar entrar novamente.');
      setTimeout(() => location.reload(), 500);
      return;
    }
    if (pausadoPeloServidor()) pintar();
    if (menu) { const aviso = menu.querySelector('[data-pausa-servidor]'); if (aviso) aviso.textContent = pausadoPeloServidor() ? `Servidor fechado: nova tentativa em ${tempoDePausa()}` : ''; }
    const w = jogo();
    if (w) sincronizarPerfil(w);
    if (tratarAvisos(w)) return;
    if (!w) { ultimoEstadoConhecido = 'sem-jogo'; vigiar(null); return; }
    vigiar(w);
    ouvirCliques(w);
    if (ocupado) return;
    const tela = telaDePersonagens(w.document);
    if (tela) { ultimoEstadoConhecido = 'selecao'; entrar(w); return; }
    if (!posicao(w)?.mapId) { ultimoEstadoConhecido = 'login'; tentarLogin(w); return; }
    ultimoEstadoConhecido = 'jogo';
  }, 1000);

  let painel = null, menu = null, cartaoLogin = null;
  const BT = '';

  function abrirMenu() {
    if (menu) { menu.remove(); menu = null; return; }
    menu = document.createElement('div');
    fznSubjanelaYgg(menu, cartaoLogin, 380);
    const nomes = cfg.conhecidos || [];
    const opcoes = nomes.length
      ? nomes.map((n) => `<label style="display:flex;gap:6px;align-items:center;margin:2px 0"><input type="radio" name="fznp" value="${n.replace(/"/g, '&quot;')}"${n === cfg.personagem ? ' checked' : ''}> ${n.replace(/</g, '&lt;')}</label>`).join('')
      : '<div style="opacity:.7">Ainda nao vi a lista desta conta. Abra a selecao uma vez (Esc → Voltar a selecao de personagem) e entre normalmente; os nomes aparecem aqui.</div>';
    const estadoAtual = ultimoEstadoConhecido === 'selecao' ? 'selecao de personagem'
      : ultimoEstadoConhecido === 'login' ? 'tela de login'
      : ultimoEstadoConhecido === 'jogo' ? 'dentro do jogo'
      : '(sem jogo / carregando)';
    menu.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px">Entrar sozinho com</div>
      <div style="font-size:11px;opacity:.75;margin-bottom:6px">Conta: <b>${identidade || 'aguardando identificacao'}</b> · Estado: <b>${estadoAtual}</b></div>
      ${opcoes}
      <label style="display:flex;gap:6px;align-items:center;margin-top:8px">Personagem: <input data-k="personagem" type="text" value="${String(cfg.personagem || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" placeholder="Nome exato" style="min-width:130px;flex:1"></label>
      <label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input data-k="loginSalvo" type="checkbox"${cfg.loginSalvo ? " checked" : ""}> na tela de login, entrar pela conta com "senha salva"</label>
      <label style="display:flex;gap:6px;align-items:center"><input data-k="ligado" type="checkbox"${cfg.ligado ? ' checked' : ''}> entrar sozinho ligado</label>
      <div data-pausa-servidor style="margin-top:5px;color:#ffcf8d">${pausadoPeloServidor() ? `Servidor fechado: nova tentativa em ${tempoDePausa()}` : ''}</div>
      <button data-a="tentar-agora" style="${BT}">Tentar agora</button>
      <label style="display:flex;gap:6px;align-items:center"><input data-k="religarAutopilot" type="checkbox"${cfg.religarAutopilot ? ' checked' : ''}> religar o autopilot depois de entrar</label>
      <label style="display:flex;gap:6px;align-items:center"><input data-k="voltarParaCaca" type="checkbox"${cfg.voltarParaCaca ? ' checked' : ''}> nascendo na cidade, voltar para a ultima caça</label>
      <div style="opacity:.7;margin-top:6px;font-size:11px">Nao entra quando voce mesmo pede a selecao (30 s). Personagem fora da lista: nao entra com outro.</div>
      <div style="margin-top:6px;font-size:11px;white-space:pre-wrap;opacity:.85">${(cfg.log || []).slice(-8).join('\n').replace(/</g, '&lt;')}</div>
      <div style="text-align:right;margin-top:6px"><button data-a="fechar" style="${BT}">Fechar</button></div>`;
    menu.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.name === 'fznp') { cfg.personagem = t.value; travaAte = 0; ultimoDiag = ''; log(`Personagem escolhido: ${t.value}`); }
      else if (t.dataset.k === 'personagem') { cfg.personagem = t.value.trim(); salvar(); pintar(); }
      else if (t.dataset.k) { cfg[t.dataset.k] = t.checked; salvar(); pintar(); }
    });
    menu.addEventListener('click', (ev) => {
      if (ev.target?.dataset?.a === 'fechar') abrirMenu();
      if (ev.target?.dataset?.a === 'tentar-agora') {
        cfg.ligado = true;
        cfg.loginSalvo = true;
        cfg.pausaServidorAte = 0;
        loginTravaAte = 0;
        avisoTravaAte = 0;
        noMapaEm = Date.now();
        log('Tentativa manual solicitada; auto-login ligado.');
        const jogoAtual = jogo();
        if (!jogoAtual || !posicao(jogoAtual)?.mapId) setTimeout(() => location.reload(), 500);
        const chave = menu.querySelector('[data-k="ligado"]'); if (chave) chave.checked = true;
        const senhaSalva = menu.querySelector('[data-k="loginSalvo"]'); if (senhaSalva) senhaSalva.checked = true;
        const aviso = menu.querySelector('[data-pausa-servidor]'); if (aviso) aviso.textContent = '';
      }
    });
    document.body.appendChild(menu);
  }

  let statusLogin = null;
  function pintar() {
    if (!document.body) return;
    if (!painel) {
      cartaoLogin = fznCartaoYgg('Auto-login', 'v1.25', 'fzn-autologin-ygg-posicao-v4', { right: '12px', bottom: '156px' }, 'fzn-encolhido-autologin-ygg-v4').caixa;
      painel = document.createElement('button');
      painel.className = 'fzn-ygg__liga';
      painel.addEventListener('click', () => { cfg.ligado = !cfg.ligado; salvar(); log('Auto-login ' + (cfg.ligado ? 'ligado' : 'desligado')); pintar(); });
      const gv = fznGavetaYgg(cartaoLogin.lastChild, 'fzn-autologin-ygg-gaveta');
      gv.ajustes.addEventListener('click', abrirMenu);
      gv.gaveta.remove();
      gv.barra.append(painel, gv.ajustes);
      statusLogin = gv.status;
    }
    const estado = ultimoEstadoConhecido === 'selecao' ? ' • selecao'
      : ultimoEstadoConhecido === 'login' ? ' • login'
      : ultimoEstadoConhecido === 'jogo' ? ' • no jogo'
      : '';
    painel.textContent = cfg.ligado ? '\u25CF ON' : '\u25CB OFF';
    painel.className = 'fzn-ygg__liga ' + (!cfg.ligado ? 'fzn-ygg--off' : cfg.personagem && cfg.loginSalvo && !pausadoPeloServidor() ? 'fzn-ygg--on' : 'fzn-ygg--alerta');
    statusLogin.textContent = `${identidade || '(conta?)'} · ${cfg.personagem || '(escolher)'}${cfg.ligado ? (pausadoPeloServidor() ? ` · servidor fechado (${tempoDePausa()})` : cfg.loginSalvo ? '' : ' · login OFF') : ''}${estado}`;
    painel.title = (cfg.log || []).slice(-8).join('\n') || 'sem eventos ainda';
  }

  log('v1.24: recupera avisos de conexao e nova versao; pausa 10 min para servidor fechado');
})();
