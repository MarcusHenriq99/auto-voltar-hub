// ==UserScript==
// @name         Yggidle — autohunt: nao ficar parado sem alvo
// @namespace    https://jogo.yggidle.com.br/
// @version      1.65
// @description  Complementa o autopilot do jogo: quando ele fica sem alvo, fixa o monstro visivel mais proximo ou anda explorando o mapa ate aparecer um. v1.54: clique completo no canvas e nos paineis.
// @match        https://jogo.yggidle.com.br/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  
  // v1.54: BYPASS DE isTrusted e CLIQUE COMPLETO.
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
      for (const tipo of ['pointerover', 'pointerenter', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        const Ev = tipo.startsWith('pointer') && win.PointerEvent ? win.PointerEvent : win.MouseEvent;
        try { this.dispatchEvent(new Ev(tipo, { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: /down/.test(tipo) ? 1 : 0 })); } catch {}
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

  // v1.10: ERRO VISIVEL.
  const mostrarErro = (onde, err) => {
    try {
      console.error('[fzN autohunt]', onde, err);
      const caixa = document.createElement('div');
      caixa.textContent = 'fzN Auto-hunt — erro em ' + onde + ': ' + String(err && (err.stack || err.message) || err).slice(0, 400);
      Object.assign(caixa.style, { position: 'fixed', right: '12px', bottom: '12px', zIndex: 2147483647, maxWidth: '420px',
        background: '#5a1010', color: '#fff', font: '12px/1.4 sans-serif', padding: '8px 10px', borderRadius: '8px', whiteSpace: 'pre-wrap' });
      (document.body || document.documentElement).appendChild(caixa);
    } catch {}
  };
  try {

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
    alca.title = 'Arraste para redimensionar · dois cliques: tamanho automatico';
    Object.assign(alca.style, {
      position: 'fixed', zIndex: 2147483647, width: '12px', height: '12px', display: 'none', touchAction: 'none',
      background: 'linear-gradient(135deg, transparent 45%, rgba(255,255,255,.55) 45%, rgba(255,255,255,.55) 55%, transparent 55%, transparent 70%, rgba(255,255,255,.55) 70%, rgba(255,255,255,.55) 80%, transparent 80%)',
      opacity: '0.6'
    });
    alca.addEventListener('mouseenter', () => { alca.style.opacity = '1'; });
    alca.addEventListener('mouseleave', () => { alca.style.opacity = '0.6'; });
    const posicionar = () => {
      const r = painel.getBoundingClientRect();
      const visivel = painel.isConnected && painel.dataset.fznEncolhido !== '1' && r.width > 0 && r.height > 0 && win.getComputedStyle(painel).visibility !== 'hidden';
      if (!visivel) { alca.style.display = 'none'; return; }
      alca.style.left = r.left + 'px';
      alca.style.top = (r.bottom - 12) + 'px';
      alca.style.transform = 'scaleX(-1)';
      alca.style.cursor = 'nesw-resize';
      alca.style.display = 'block';
    };
    let arr = null;
    alca.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = painel.getBoundingClientRect();
      arr = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, dir: r.right, topo: r.top };
      alca.setPointerCapture(e.pointerId);
    });
    alca.addEventListener('pointermove', (e) => {
      if (!arr) return;
      const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
      const w = Math.round(Math.min(win.innerWidth - 8, Math.max(140, arr.w - dx)));
      const h = Math.round(Math.min(win.innerHeight - 8, Math.max(60, arr.h + dy)));
      tam = { w, h }; aplicar(); Object.assign(painel.style, { left: Math.max(0, arr.dir - w) + 'px', top: Math.max(0, arr.topo) + 'px', right: 'auto', bottom: 'auto' }); posicionar();
    });
    alca.addEventListener('pointerup', () => {
      if (!arr) return;
      arr = null;
      try { localStorage.setItem(chave, JSON.stringify(tam)); } catch {}
    });
    alca.addEventListener('dblclick', (e) => {
      e.preventDefault(); e.stopPropagation();
      tam = null; aplicar(); posicionar();
      try { localStorage.removeItem(chave); } catch {}
    });
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
      const css = doc.createElement('style');
      css.id = 'fzn-enc-css';
      css.textContent = '[data-fzn-encolhido="1"]{display:none!important}';
      doc.head.appendChild(css);
    }
    let est = { e: false, x: null, y: null };
    try { est = { ...est, ...JSON.parse(localStorage.getItem(chave)) }; } catch {}
    const gravar = () => { try { localStorage.setItem(chave, JSON.stringify(est)); } catch {} };
    const btn = doc.createElement('div');
    btn.textContent = '–';
    btn.title = 'Encolher';
    Object.assign(btn.style, {
      position: 'fixed', zIndex: 2147483647, width: '14px', height: '14px', lineHeight: '12px',
      textAlign: 'center', font: 'bold 12px sans-serif', color: '#fff', background: 'rgba(0,0,0,.55)',
      border: '1px solid rgba(255,255,255,.35)', borderRadius: '4px', cursor: 'pointer', userSelect: 'none', display: 'none'
    });
    const bola = doc.createElement('div');
    bola.title = 'Abrir';
    Object.assign(bola.style, {
      position: 'fixed', zIndex: 2147483647, width: '14px', height: '14px', borderRadius: '50%',
      background: '#999', border: '1px solid #fff', opacity: '0.25', cursor: 'pointer', display: 'none', transition: 'opacity .15s'
    });
    bola.addEventListener('mouseenter', () => { bola.style.opacity = '0.9'; });
    bola.addEventListener('mouseleave', () => { bola.style.opacity = '0.25'; });
    const posicionar = () => {
      const visivel = painel.isConnected && painel.style.display !== 'none' && win.getComputedStyle(painel).visibility !== 'hidden';
      if (est.e) {
        painel.dataset.fznEncolhido = '1';
        btn.style.display = 'none';
        bola.style.left = Math.min(Math.max(0, est.x ?? win.innerWidth - 22), win.innerWidth - 16) + 'px';
        bola.style.top = Math.min(Math.max(0, est.y ?? win.innerHeight - 22), win.innerHeight - 16) + 'px';
        bola.style.display = painel.isConnected && painel.style.display !== 'none' ? 'block' : 'none';
        return;
      }
      delete painel.dataset.fznEncolhido;
      bola.style.display = 'none';
      const r = painel.getBoundingClientRect();
      if (!visivel || !r.width) { btn.style.display = 'none'; return; }
      btn.style.left = Math.min(r.right - 7, win.innerWidth - 16) + 'px';
      btn.style.top = Math.max(0, r.top - 7) + 'px';
      btn.style.display = 'block';
    };
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const r = painel.getBoundingClientRect();
      est = { e: true, x: Math.round(r.right - 14), y: Math.round(r.top) };
      gravar();
      posicionar();
    });
    bola.addEventListener('click', (ev) => {
      ev.stopPropagation();
      est.e = false;
      gravar();
      posicionar();
    });
    doc.body.append(btn, bola);
    posicionar();
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
    const css = document.createElement('style');
    css.id = 'fzn-ygg-tema';
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
      const r = caixa.getBoundingClientRect();
      dx = ev.clientX - r.left; dy = ev.clientY - r.top; apertado = true;
      alca.style.cursor = 'grabbing';
      try { alca.setPointerCapture(ev.pointerId); } catch {}
      ev.preventDefault();
    });
    alca.addEventListener('pointermove', (ev) => { if (apertado) aplicar({ x: ev.clientX - dx, y: ev.clientY - dy }); });
    const soltar = (ev) => {
      if (!apertado) return;
      apertado = false;
      alca.style.cursor = 'grab';
      try { alca.releasePointerCapture(ev.pointerId); } catch {}
      const r = caixa.getBoundingClientRect();
      const p = aplicar({ x: r.left, y: r.top });
      try { localStorage.setItem(chave, JSON.stringify(p)); } catch {}
    };
    alca.addEventListener('pointerup', soltar);
    alca.addEventListener('pointercancel', soltar);
    caixa.style.maxHeight = 'calc(100vh - 16px)';
    caixa.style.overflowY = 'auto';
    const manterNaTela = () => {
      const r = caixa.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.top < 0 || r.right > window.innerWidth + 1 || r.left < 0 || r.bottom > window.innerHeight + 1) {
        aplicar({ x: r.left, b: window.innerHeight - r.bottom });
      }
    };
    try { new ResizeObserver(() => requestAnimationFrame(manterNaTela)).observe(caixa); } catch {}
    window.addEventListener('resize', manterNaTela);
  };
  const fznCartaoYgg = (titulo, versao, chavePos, posPadrao, chaveEncolher) => {
    fznTemaYgg();
    const caixa = document.createElement('div');
    caixa.className = 'fzn-ygg';
    Object.assign(caixa.style, posPadrao);
    const topo = document.createElement('div');
    topo.className = 'fzn-ygg__topo';
    topo.innerHTML = '<b></b><small></small>';
    topo.firstChild.textContent = 'fzN · ' + titulo;
    topo.lastChild.textContent = versao;
    const corpo = document.createElement('div');
    corpo.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center';
    // So clique de mouse de verdade aciona os botoes. Botao clicado ficava com
    // foco e o Enter/Espaco seguinte (chat, atalho) "clicava" de novo: o log
    // de 26/10 mostra Hunt desligado 15-20 s depois de ligado, sem clique.
    // mousedown sem padrao = o botao nem pega foco.
    corpo.addEventListener('mousedown', (ev) => { if (ev.target.closest('button')) ev.preventDefault(); }, true);
    corpo.addEventListener('click', (ev) => {
      if (!ev.target.closest('button') || (ev.isTrusted && ev.detail > 0)) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      try { log(`clique ignorado em "${ev.target.closest('button').textContent}" (${ev.isTrusted ? 'teclado' : 'script'})`); } catch {}
    }, true);
    caixa.append(topo, corpo);
    document.body.appendChild(caixa);
    fznArrastavelYgg(caixa, topo, chavePos);
    fznEncolhivel(caixa, chaveEncolher);
    return { caixa, topo, corpo };
  };
  const fznSubjanelaYgg = (el, cartao, largura) => {
    fznTemaYgg();
    el.className = 'fzn-ygg';
    const r = cartao?.getBoundingClientRect();
    const left = r ? Math.min(Math.max(0, r.left), Math.max(0, window.innerWidth - largura - 8)) : 12;
    const bottom = r ? Math.max(8, window.innerHeight - r.top + 6) : 60;
    const maxH = Math.max(120, window.innerHeight - bottom - 8);
    Object.assign(el.style, { left: left + 'px', bottom: bottom + 'px', top: 'auto', right: 'auto', zIndex: 2147483001, width: largura + 'px', maxWidth: '95vw', maxHeight: maxH + 'px', overflow: 'auto', padding: '10px 12px' });
  };

  const CHAVE_CFG = 'fzn-autohunt-ygg-v1';
  const CHAVE_LOG = 'fzn-autohunt-ygg-log-v1';

  const SEM_ALVO_MS = 150;
  const FIXADO_EVITAR_MS = 15000;
  const TROCA_GANHO = 3;
  const TROCA_INTERVALO_MS = 1000;
  let ultimaTroca = 0;
  let exploraVazioDesde = 0;
  const ASA_SEM_MOB_MS = 600;
  const ASA_TRAVA_MS = 1100;
  let ultimaAsaEm = 0;
  const asaLiberada = () => Date.now() - ultimaAsaEm >= ASA_TRAVA_MS;
  const ASA_CHEGADA_MAX_MS = 1500;
  const ASA_GIGANTE_INFINITA = 1280310;
  const ASA_INFINITA = 1280300;
  const ASA_IDS = [ASA_GIGANTE_INFINITA, ASA_INFINITA, 601];
  const ASAS_INFINITAS = new Set([ASA_GIGANTE_INFINITA, ASA_INFINITA]);
  const MVP_IDS = new Set([1038, 1039, 1046, 1059, 1086, 1087, 1112, 1115, 1147, 1150, 1157, 1159, 1190, 1251, 1252, 1272, 1312, 1373, 1389, 1418, 1492, 1511, 1583, 1623, 1630, 1658, 1685, 1688, 1708, 1719, 1734, 1768, 1779, 1785, 1832, 1871, 1874, 1885, 1917, 2022, 2068, 2087, 2109, 2202, 3810, 20419, 20601]);
  const MVP_NOMES = new Set(["Osiris", "Baphomet", "Doppelganger", "Mistress", "Golden Thief Bug", "Orc Hero", "Drake", "Eddga", "Maya", "Moonlight Flower", "Pharaoh", "Phreeoni", "Orc Lord", "Knight of Windstorm", "Garm", "Dark Lord", "Turtle General", "Lord of Death", "Dracula", "Evil Snake Lord", "Incantation Samurai", "Amon Ra", "Tao Gunka", "RSX 0806", "Bacsojin", "Ygnizem", "Vesper", "Lady Tanee", "Thanatos", "Detale", "Kiel D-01", "Gloom Under Night", "Ktullanux", "Atroce", "Ifrit", "Fallen Bishop", "Beelzebub", "Gopinich", "Wounded Morocc", "Nidhoggr's Shadow", "Boitata", "Queen Scaraba", "Valkyrie Randgris", "Kraken", "King Poring", "Rigid Muspellskoll", "Jewel Ungoliant", "Cabra da Peste", "Cabra Safado", "Cabra Macho"].map((n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')));
  const CHAVE_CATALOGO = 'fzn-autohunt-ygg-chefenia';
  let catalogo = null;
  try { catalogo = JSON.parse(localStorage.getItem(CHAVE_CATALOGO) || 'null'); } catch {}
  const normN = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let catIds = new Set(), catNomes = new Set();
  const aplicarCatalogo = (c) => {
    const bosses = Array.isArray(c?.bosses) ? c.bosses : [];
    if (!bosses.length) return;
    catIds = new Set(bosses.map((b) => Number(b.mobId)).filter(Number.isFinite));
    catNomes = new Set(bosses.map((b) => normN(b.name)).filter(Boolean));
    catalogo = { em: Date.now(), bosses: bosses.map((b) => ({ mobId: b.mobId, name: b.name, tier: b.tier })) };
  };
  aplicarCatalogo(catalogo);
  let catalogoPedidoEm = 0;
  const donoGanchoCat = {};
  const ganchoCatalogo = (w) => {
    const ui = w.__elragUI, e = w.__elragEngine;
    const orig = ui?.updateAutopilotChefeniaCatalog;
    if (typeof orig === 'function' && orig.__fzn !== donoGanchoCat) {
      const g = function (next) {
        try {
          const antes = catIds.size;
          aplicarCatalogo(next);
          if (catIds.size) { gravarJson(CHAVE_CATALOGO, catalogo); if (catIds.size !== antes) log('Chefenia: ' + catIds.size + ' chefes no catalogo do jogo: ' + catalogo.bosses.map((b) => b.name).join(', ')); }
        } catch {}
        return orig.apply(this, arguments);
      };
      g.__fzn = donoGanchoCat;
      ui.updateAutopilotChefeniaCatalog = g;
    }
    if (Date.now() - catalogoPedidoEm > (catIds.size ? 600000 : 15000)) {
      catalogoPedidoEm = Date.now();
      try { e?.requestAutopilotChefeniaCatalog?.(); } catch {}
    }
  };
  // O catalogo pode ficar em cache enquanto a Chefenia recebe MVPs novos.
  // As fontes se complementam; catalogo antigo nao invalida os nomes conhecidos.
  const ehMvp = (m) => catIds.has(Number(m?.mobId)) || catNomes.has(normN(m?.name)) ||
    MVP_IDS.has(Number(m?.mobId)) || MVP_NOMES.has(normN(m?.name));
  let mvpFixado = null, mvpFixadoEm = 0;
  let mvpUltimoGid = 0, mvpVistoEm = 0;
  const EVENTO_NOME = normN('Stefan J.E. Wolf');
  let eventoFixado = null, eventoFixadoEm = 0;
  const SO_MVP_TELEPORTE_MS = 2500;
  let naoMvpDesde = 0;
  const golpesMvp = new Map();
  const MVP_TOMADO_MS = 2000;
  let mvpPularAgora = false;
  let meuGolpeEm = 0, meuAlvoGid = 0, golpesMeus = 0;
  const snapshotAp = (e) => { try { return e?.getAutopilotSnapshot?.() || null; } catch { return null; } };
  const mvpEmCombate = (ap, agora = Date.now()) => cfg.soMvp && (
    (mvpUltimoGid > 0 && ((Number(meuAlvoGid) === mvpUltimoGid && agora - meuGolpeEm < 10000) ||
      (Number(ap?.targetGid) === mvpUltimoGid && agora - mvpVistoEm < 10000))) ||
    (Number(meuAlvoGid) > 0 && Number(ap?.targetGid) === Number(meuAlvoGid) && agora - meuGolpeEm < 10000));
  const golpeiEm = new Map();
  let grupoCache = { em: 0, aids: new Set() };
  const ehDoGrupo = (aid) => {
    const agora = Date.now();
    if (agora - grupoCache.em > 2000) {
      let membros = [];
      try { membros = jogo()?.__elragEngine?.getPartySnapshot?.()?.members || []; } catch {}
      grupoCache = { em: agora, aids: new Set(membros.map((m) => Number(m.aid)).filter(Boolean)) };
    }
    return grupoCache.aids.has(Number(aid));
  };
  const anotarGolpe = (origem, alvo, acao, eu) => {
    if (!alvo || origem === alvo || acao === 1 || acao === 2 || acao === 3) return;
    const agora = Date.now();
    const r = golpesMvp.get(alvo) || {};
    if (eu && origem === eu) { if (!r.meuPrimeiro) r.meuPrimeiro = agora; meuGolpeEm = agora; meuAlvoGid = alvo; golpesMeus++; golpeiEm.set(alvo, agora); if (golpeiEm.size > 300) golpeiEm.delete(golpeiEm.keys().next().value); }
    else if (ehDoGrupo(origem)) { if (!r.grupoPrimeiro) r.grupoPrimeiro = agora; r.grupoUltimo = agora; }
    else { if (!r.outroPrimeiro || agora - r.outroUltimo > MVP_TOMADO_MS) r.outroPrimeiro = agora; r.outroUltimo = agora; r.quem = origem; }
    golpesMvp.set(alvo, r);
    if (golpesMvp.size > 300) golpesMvp.delete(golpesMvp.keys().next().value);
  };
  const mvpTomado = (m) => {
    if (cfg.noks === false) return false;
    const agora = Date.now();
    const r = golpesMvp.get(m.gid);
    if (!r || !r.outroUltimo || agora - r.outroUltimo > MVP_TOMADO_MS) return false;
    if (Number(meuAlvoGid) === Number(m.gid) && agora - meuGolpeEm < 10000) return false;
    if (r.meuPrimeiro && r.meuPrimeiro <= r.outroPrimeiro) return false;
    if (r.grupoPrimeiro && r.grupoPrimeiro <= r.outroPrimeiro) return false;
    if (!mvpPularAgora) log('so MVP: ' + m.name + ' ja esta apanhando de outro (' + r.quem + ') -> asa');
    mvpPularAgora = true;
    if (mvpFixado === m.gid) { mvpFixado = null; try { jogo()?.__elragEngine?.setAutopilotPinnedTarget(0); } catch {} }
    return true;
  };
  const FIXADO_MAX_MS = 800;
  const EVITAR_MS = 60000;
  const PASSO_EXPLORAR_MS = 3500;
  const RAIO_EXPLORAR = 0.38;
  const AUTOPILOT_PARADO = new Set([0, 1]);
  const lerJson = (k, p) => { try { return JSON.parse(localStorage.getItem(k)) ?? p; } catch { return p; } };
  const gravarJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const cfg = Object.assign({ ligado: true, asa: 'auto', cheffeniaTeleporte: false, cheffeniaRecuperar: true }, lerJson(CHAVE_CFG, {}));
  const log = (msg) => {
    const l = lerJson(CHAVE_LOG, []);
    l.push(`${new Date().toLocaleTimeString()} ${msg}`);
    gravarJson(CHAVE_LOG, l.slice(-60));
    console.log('[autohunt-ygg]', msg);
    atualizarPainel();
  };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const jogo = () => {
    for (const f of document.querySelectorAll('iframe')) {
      try { if (f.contentWindow?.__elragEngine) return f.contentWindow; } catch {}
    }
    return null;
  };
  const posicao = (e) => {
    try { const m = e.getMinimapInfoSnapshot(); return m ? { mapa: m.mapId, x: m.x, y: m.y } : null; } catch { return null; }
  };
  const ignorados = (ap) => new Set((ap?.targetPolicy?.species || []).map((s) => s.mobId));
  const fugirDe = (ap) => new Set((ap?.targetPolicy?.species || []).filter((s) => s.disposition === 1).map((s) => s.mobId));
  const quadros = (w, n) => new Promise((r) => {
    const teto = setTimeout(r, 1500);
    const passo = (i) => (i <= 0 ? (clearTimeout(teto), r()) : w.requestAnimationFrame(() => passo(i - 1)));
    passo(n);
  });
  
  // v1.54: Clique no Canvas com sequência COMPLETA de eventos (pointer + mouse).
  const clicarNoCanvas = async (w, canvas, x, y) => {
    const base = { bubbles: true, cancelable: true, composed: true, view: w, clientX: x, clientY: y, screenX: x, screenY: y, button: 0 };
    try { w.__elragEngine.setMouseIntersect(true); } catch {}
    
    // Move
    for (let i = 0; i < 3; i++) { 
      canvas.dispatchEvent(new w.MouseEvent('mousemove', base)); 
      await esperar(120); 
    }
    await quadros(w, 3);
    await esperar(200);
    
    // Down
    const EvDown = w.PointerEvent ? w.PointerEvent : w.MouseEvent;
    canvas.dispatchEvent(new EvDown('pointerdown', { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }));
    canvas.dispatchEvent(new w.MouseEvent('mousedown', { ...base, buttons: 1 }));
    await esperar(60);
    
    // Up
    const EvUp = w.PointerEvent ? w.PointerEvent : w.MouseEvent;
    canvas.dispatchEvent(new EvUp('pointerup', { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }));
    canvas.dispatchEvent(new w.MouseEvent('mouseup', base));
    
    // Click
    canvas.dispatchEvent(new w.MouseEvent('click', base));
  };
  
  const canvasDoJogo = (w) => [...w.document.querySelectorAll('canvas')]
    .sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0] || null;
  const temJanelaAberta = (w) => /Renascer agora|Bem-vindo aos servicos Kafra|Voltar para /
    .test(w.document.body.innerText || '');

  let semAlvoDesde = 0;
  let fixado = null;
  const evitar = new Map();
  let direcao = Math.random() * Math.PI * 2;
  let ultimoPasso = 0;
  let posAntesDoPasso = null;
  let euDesliguei = 0;
  let ocupado = false;

  const asa = { index: null, count: 0, lidaEm: 0, pedidaEm: 0, usadaEm: 0, usos: 0, posAntes: null, aguardando: false };
  let radarVazioDesde = 0;
  const donoGanchoAsa = {};
  const semAc = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tipoAsa = (it) => {
    const id = Number(it.itemId), n = semAc(it.name);
    if (id === ASA_GIGANTE_INFINITA || /asas? de mosca gigante/.test(n)) return 'gigante';
    if (id === ASA_INFINITA || /asas? de mosca infinita/.test(n)) return 'infinita';
    if (id === 601 || /^asas? de mosca$/.test(n.trim()) || /fly wing/.test(n)) return 'comum';
    return null;
  };
  const ORDEM_ASA = { auto: ['gigante', 'infinita', 'comum'], gigante: ['gigante'], infinita: ['infinita'], comum: ['comum'] };
  let asasVistas = '';
  let ultimoSnapMochila = null;
  const lerAsa = (snap) => {
    ultimoSnapMochila = snap;
    const ordem = ORDEM_ASA[cfg.asa] || ORDEM_ASA.auto;
    let achou = null, tipoAchou = null;
    const vistas = [];
    for (const lista of Object.values(snap || {})) {
      if (!Array.isArray(lista)) continue;
      for (const it of lista) {
        if (!it || Number(it.count) <= 0) continue;
        const tipo = tipoAsa(it);
        if (!tipo) continue;
        vistas.push(tipo + ':' + it.itemId);
        const pos = ordem.indexOf(tipo);
        if (pos >= 0 && (!achou || pos < ordem.indexOf(tipoAchou))) { achou = it; tipoAchou = tipo; }
      }
    }
    if (!achou) { asa.lidaEm = Date.now(); return; }
    const v = vistas.join(', ');
    if (v !== asasVistas) { asasVistas = v; log('asas na mochila: ' + v + ' | usando: ' + tipoAchou); }
    asa.index = achou ? achou.index : null;
    asa.count = achou ? Number(achou.count) || 0 : 0;
    asa.infinita = tipoAchou === 'gigante' || tipoAchou === 'infinita';
    asa.gigante = tipoAchou === 'gigante';
    asa.lidaEm = Date.now();
  };
  const ganchoMochila = (w) => {
    const ui = w.__elragUI;
    const original = ui?.updateInventorySnapshot;
    if (typeof original !== 'function' || original.__fznAutohunt === donoGanchoAsa) return;
    const g = function (snap) { try { lerAsa(snap); } catch {} return original.apply(this, arguments); };
    g.__fznAutohunt = donoGanchoAsa;
    for (const k of Object.keys(original)) { try { g[k] = original[k]; } catch {} }
    ui.updateInventorySnapshot = g;
  };
  const FUGA_RE = /sem asa de mosca:?\s*n[aã]o consigo fugir/i;
  let fugaEm = 0;
  const fugirComAsa = (w) => {
    if (cfg.asa === 'off') return;
    const e = w.__elragEngine;
    if (sessaoCheffenia(w, e) && cfg.cheffeniaTeleporte !== true) return;
    if (mvpEmCombate(snapshotAp(e))) return;
    if (Date.now() - fugaEm < 1500) return;
    let melhor = null, tipoMelhor = null;
    for (const lista of Object.values(ultimoSnapMochila || {})) {
      if (!Array.isArray(lista)) continue;
      for (const it of lista) {
        if (!it || Number(it.count) <= 0) continue;
        const t = tipoAsa(it);
        if (t === 'gigante' || (t === 'infinita' && tipoMelhor !== 'gigante')) { melhor = it; tipoMelhor = t; }
      }
    }
    if (!melhor) { log('fuga: sem Asa Gigante/Infinita na mochila'); try { e.requestInventorySnapshot(); } catch {} return; }
    if (!asaLiberada()) return;
    try { e.useInventoryItem(melhor.index); fugaEm = ultimaAsaEm = Date.now(); log('fuga: piloto sem asa comum -> Asa ' + (tipoMelhor === 'gigante' ? 'Gigante' : 'Infinita')); } catch (err) { log('fuga falhou: ' + String(err).slice(0, 60)); }
  };
  const BIO4_IDS = new Set([1638, 1639, 1650, 1651]);
  const BIO4_NOME = /cecil|shecil|kathryn|katrinn/i;
  const BIO4_SLOT_F5 = 4;
  const ehBio4 = (m) => BIO4_IDS.has(Number(m?.mobId)) || BIO4_NOME.test(String(m?.name || ''));
  const bio4Furtivos = new Map();
  const efeitosAtivos = new Map();
  let poderInfernalVistoEm = 0;
  const donoGanchoEf = {};
  const ganchoEfeitos = (w) => {
    const ui = w.__elragUI;
    if (!ui || typeof ui.upsertStatusEffect !== 'function' || ui.upsertStatusEffect.__fznAh === donoGanchoEf) return;
    const up = ui.upsertStatusEffect, rm = ui.removeStatusEffect;
    const nUp = function (ef) { try { if (ef && ef.id != null) { const dados = JSON.stringify(ef, (k, v) => (/img|icon|url/i.test(k) ? undefined : v)); efeitosAtivos.set(ef.id, dados); if (/poder infernal|infernal power|hell power/i.test(dados)) poderInfernalVistoEm = Date.now(); } } catch {} return up.apply(this, arguments); };
    nUp.__fznAh = donoGanchoEf;
    ui.upsertStatusEffect = nUp;
    if (typeof rm === 'function') ui.removeStatusEffect = function (id) { try { efeitosAtivos.delete(id); } catch {} return rm.apply(this, arguments); };
    efeitosAtivos.clear();
    try { w.__elragEngine.resyncStatusEffects?.(); } catch {}
  };
  const poderInfernalAtivo = (w) => {
    for (const dados of efeitosAtivos.values()) if (/poder infernal|infernal power|hell power/i.test(dados)) { poderInfernalVistoEm = Date.now(); return true; }
    for (const el of w.document.querySelectorAll('[title],[aria-label]')) {
      const titulo = (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '');
      if (/poder infernal|infernal power|hell power/i.test(titulo)) { poderInfernalVistoEm = Date.now(); return true; }
    }
    return Date.now() - poderInfernalVistoEm < 20000;
  };
  const furtividadeAtiva = () => { for (const t of efeitosAtivos.values()) if (/furtiv|cloak|camufl/i.test(t)) return true; return false; };
  let bio4Fixado = 0, bio4FixadoEm = 0, bio4UltimaFurt = 0, bio4FocoDesde = 0;
  const bio4Evitar = new Map();
  setInterval(() => {
    try {
      if (!cfg.ligado || !cfg.bio4) return;
      const e = jogo()?.__elragEngine;
      if (!e) return;
      const ap = e.getAutopilotSnapshot();
      if (!ap || AUTOPILOT_PARADO.has(ap.runtimeState)) return;
      const radar = e.getAutopilotRadarSnapshot()?.mobs || [];
      if (true) bio4FocoDesde = 0;
      else if (bio4Fixado && bio4FocoDesde && Date.now() - bio4FocoDesde > 3000) {
        bio4Evitar.set(bio4Fixado, Date.now() + 20000);
        log('bio4: foco nao virou alvo em 3 s; evitando por 20 s');
        try { e.setAutopilotPinnedTarget(0); } catch {}
        bio4Fixado = 0; bio4FocoDesde = 0;
      }
      for (const [g, ate] of bio4Evitar) if (ate < Date.now()) bio4Evitar.delete(g);
      const alvos = radar.filter((m) => ehBio4(m) && !bio4Evitar.has(m.gid)).sort((a, b) => (a.distance || 0) - (b.distance || 0));
      const agora = Date.now();
      for (const [gid, em] of bio4Furtivos) if (agora - em > 120000 && !radar.some((m) => m.gid === gid)) bio4Furtivos.delete(gid);
      if (!alvos.length) return;
      const alvo = alvos[0];
      const usaFurt = cfg.classe === 'algoz' && cfg.furtividade === true;
      if (usaFurt) try { ganchoEfeitos(jogo()); } catch {}
      if (usaFurt && !furtividadeAtiva() && !bio4Furtivos.has(alvo.gid) && agora - bio4UltimaFurt > 3000) {
        try {
          const atalho = (e.getShortcutAssignments?.() || [])[BIO4_SLOT_F5];
          e.useShortcutSlot(BIO4_SLOT_F5);
          bio4Furtivos.set(alvo.gid, agora); bio4UltimaFurt = agora;
          log('bio4: ' + alvo.name + ' a ' + alvo.distance + ' -> Furtividade (F5' + (atalho ? ', skill ' + atalho.id : ', atalho vazio?') + ')');
        } catch (err) { log('bio4: F5 falhou ' + String(err).slice(0, 60)); }
      }
    } catch {}
  }, 100);

  const PRESOS = {
    45: 'Armadilha (Ankle Snare)', 129: 'Prisao de Teia', 735: 'Teia ampla', 95: 'Parado (Stop)', 714: 'Parado (Stop)',
    200: 'Confinamento', 201: 'Confinamento', 353: 'Choque Eletrico', 359: 'Mordida de Lobo', 433: 'Mundo Inferior',
    463: 'Armadilha de Espinhos', 490: 'Vacuo Extremo',
  };
  const presoAtivo = new Map();
  const pontesStatus = new WeakSet();
  const ganchoStatus = (w) => {
    if (pontesStatus.has(w)) return;
    pontesStatus.add(w);
    w.__fznPresoCb = (i, ligado, vida) => {
      if (ligado || vida > 0) diag('efeito', i, 'efeito ' + i + (PRESOS[i] ? ' (' + PRESOS[i] + ')' : '') + ' ligado, ' + Math.round((Number(vida) || 0) / 1000) + ' s');
      if (!(i in PRESOS)) return;
      if (ligado || vida > 0) presoAtivo.set(i, Date.now() + Math.min(Math.max(Number(vida) || 5000, 500), 15000));
      else presoAtivo.delete(i);
    };
    const s = w.document.createElement('script');
    s.type = 'module';
    s.textContent = "import('UI/Components/StatusIcons/StatusIcons.js').then(m=>{const S=m.default;if(!S||S.__fznPreso)return;const o=S.update;S.update=function(i,st,l,v){try{window.__fznPresoCb&&window.__fznPresoCb(i,st,l)}catch(e){}return o.apply(this,arguments)};S.__fznPreso=1;window.__fznPresoOk=1;}).catch(e=>{window.__fznPresoErro=String(e)});";
    w.document.head.appendChild(s);
    setTimeout(() => {
      const st = w.__fznPresoErro ? 'gancho falhou ' + w.__fznPresoErro.slice(0, 80) : w.__fznPresoOk ? 'vigiando Teia/Armadilha/Stop' : 'gancho ainda nao respondeu';
      log('preso: ' + st); diag('gancho', 'preso', 'preso: ' + st);
    }, 4000);
  };
  const diagVisto = new Map();
  const diag = (tipo, n, texto) => {
    const k = tipo + ':' + n, agora = Date.now();
    if (agora - (diagVisto.get(k) || 0) < 600000) return;
    diagVisto.set(k, agora);
    const l = lerJson('fzn-autohunt-ygg-diag', []);
    l.push(new Date().toLocaleTimeString() + ' ' + (posicao(jogo()?.__elragEngine)?.mapa || '?') + ' ' + texto);
    gravarJson('fzn-autohunt-ygg-diag', l.slice(-60));
  };
  const CHAVE_CONTA = 'fzn-autohunt-ygg-contagem';
  const LUGARES = { bio4: 'Bio4', chefSolo: 'Chefenia Solo', chefGuild: 'Chefenia Guild', chefenia: 'Chefenia (antes da separacao)' };
  const emGrupo = () => { ehDoGrupo(0); return grupoCache.aids.size >= 2; };
  const lugarDoMapa = (m) => /^lhz_dun04/.test(m) ? 'bio4' : /^moro_vol/.test(m) ? (emGrupo() ? 'chefGuild' : 'chefSolo') : null;
  const hojeTxt = () => new Date().toLocaleDateString('pt-BR');
  const zeroLugar = () => ({ kills: 0, mortes: 0, mvps: {} });
  const zeroBloco = () => ({ bio4: zeroLugar(), chefSolo: zeroLugar(), chefGuild: zeroLugar() });
  const lerConta = () => {
    const c = lerJson(CHAVE_CONTA, null) || {};
    if (!c.total) c.total = zeroBloco();
    if (!c.hoje || c.dia !== hojeTxt()) { c.hoje = zeroBloco(); c.dia = hojeTxt(); }
    for (const b of [c.total, c.hoje]) for (const k of ['bio4', 'chefSolo', 'chefGuild']) if (!b[k]) b[k] = zeroLugar();
    return c;
  };
  const nomesGid = new Map();
  let mapaAgora = '';
  const somar = (campo, nome) => {
    const lugar = lugarDoMapa(mapaAgora);
    if (!lugar) return;
    const c = lerConta();
    for (const b of [c.hoje, c.total]) {
      b[lugar][campo]++;
      if (nome) b[lugar].mvps[nome] = (b[lugar].mvps[nome] || 0) + 1;
    }
    gravarJson(CHAVE_CONTA, c);
    log((campo === 'kills' ? 'kill: ' + (nome || '?') : 'morte') + ' em ' + LUGARES[lugar] + ' (hoje ' + c.hoje[lugar][campo] + ', total ' + c.total[lugar][campo] + ')');
    pintarContagem();
  };
  const contados = new Set();
  const contarAbate = (gid) => {
    if (!gid || contados.has(gid)) return;
    contados.add(gid); if (contados.size > 300) contados.delete(contados.values().next().value);
    somar('kills', nomesGid.get(gid) || 'desconhecido');
  };
  let mvpContadoEm = 0;
  const contarMvp = () => {
    if (Date.now() - mvpContadoEm < 3000) return;
    mvpContadoEm = Date.now();
    contarAbate(meuAlvoGid);
  };
  let mortoAntes = false, morteContadaEm = 0;
  setInterval(() => {
    try {
      const w = jogo();
      const e = w?.__elragEngine;
      if (!e) return;
      mapaAgora = String(posicao(e)?.mapa || mapaAgora);
      for (const m of e.getAutopilotRadarSnapshot?.()?.mobs || []) if (m?.gid && m.name) nomesGid.set(m.gid, m.name);
      while (nomesGid.size > 400) nomesGid.delete(nomesGid.keys().next().value);
      const eu = w.__fznEu?.();
      const morto = Boolean(eu && eu.ACTION && eu.action === eu.ACTION.DIE) || /Renascer agora|Voltar ao ponto de salvamento/.test(w.document.body?.innerText || '');
      if (morto && !mortoAntes && Date.now() - morteContadaEm > 15000) { morteContadaEm = Date.now(); somar('mortes'); }
      mortoAntes = morto;
    } catch {}
  }, 500);
  let caixaConta = null, botaoConta = null, contaAberta = false, linhaStatus = null;
  function pintarStatus() {
    if (!linhaStatus) return;
    const c = lerConta(), m = String(mapaAgora || '');
    let t = m || 'sem mapa';
    if (/^lhz_dun04/.test(m)) t += ' \u00B7 hoje ' + c.hoje.bio4.kills + ' kills \u00B7 ' + c.hoje.bio4.mortes + ' mortes';
    else if (/^moro_vol/.test(m)) t += ' \u00B7 hoje ' + (c.hoje.chefSolo.kills + c.hoje.chefGuild.kills) + ' kills \u00B7 ' + (c.hoje.chefSolo.mortes + c.hoje.chefGuild.mortes) + ' mortes';
    linhaStatus.textContent = t + (contaAberta ? ' \u25BE' : ' \u25B8');
  }
  function pintarContagem() {
    if (!botaoConta) return;
    const c = lerConta();
    botaoConta.textContent = 'Hoje — Bio4 ' + c.hoje.bio4.kills + ' kills/' + c.hoje.bio4.mortes + ' mortes · Chef Solo ' + c.hoje.chefSolo.kills + '/' + c.hoje.chefSolo.mortes + ' · Chef Guild ' + c.hoje.chefGuild.kills + '/' + c.hoje.chefGuild.mortes;
    caixaConta.style.display = contaAberta ? '' : 'none';
    pintarStatus();
    if (!contaAberta) return;
    const linhas = [];
    for (const [rot, b] of [['HOJE (' + c.dia + ')', c.hoje], ['TOTAL', c.total]]) {
      linhas.push(rot);
      for (const k of Object.keys(LUGARES)) {
        if (!b[k]) continue;
        linhas.push('  ' + LUGARES[k] + ': ' + b[k].kills + ' kills, ' + b[k].mortes + ' mortes');
        for (const [n, q] of Object.entries(b[k].mvps).sort((x, y) => y[1] - x[1])) linhas.push('    ' + n + ': ' + q);
      }
    }
    caixaConta.firstChild.textContent = linhas.join('\n');
  }
  const montarContagem = (corpo, gv) => {
    botaoConta = document.createElement('button');
    botaoConta.title = 'Kills de MVP (premio de MVP meu) e mortes na Bio4 e na Chefenia (Solo = sem grupo, Guild = com grupo). Clique para ver por MVP e o total.';
    botaoConta.addEventListener('click', () => { contaAberta = !contaAberta; pintarContagem(); });
    caixaConta = document.createElement('div');
    Object.assign(caixaConta.style, { flexBasis: '100%', whiteSpace: 'pre', font: '11px/1.35 monospace', maxHeight: '220px', overflow: 'auto', padding: '4px 2px' });
    caixaConta.appendChild(document.createElement('div'));
    const zerar = document.createElement('button');
    zerar.textContent = 'Zerar contagem';
    zerar.addEventListener('click', () => {
      if (!confirm('Zerar a contagem de MVPs e mortes (hoje e total)?')) return;
      gravarJson(CHAVE_CONTA, { total: zeroBloco(), hoje: zeroBloco(), dia: hojeTxt() });
      log('contagem zerada'); pintarContagem();
    });
    caixaConta.appendChild(zerar);
    botaoConta.style.display = 'none';
    gv.status.addEventListener('click', () => { contaAberta = !contaAberta; pintarContagem(); });
    gv.status.after(caixaConta);
    corpo.append(botaoConta);
    pintarContagem();
    setInterval(pintarContagem, 60000);
  };
  const SKILLS_FUGIR_BIO4 = {
    84: 'Trovao de Jupiter', 400: 'Vulcao de Napalm', 13: 'Ataque Espiritual',
    19: 'Lancas de Fogo', 21: 'Tempestade de Raios', 230: 'Terror Acido',
  };
  let skillPerigo = null;
  const UNT_PNEUMA = 133;
  const PNEUMA_VIDA_MS = 12000;
  const pneumas = new Map();
  const pontesSkill = new WeakSet();
  const ganchoSkill = (w) => {
    if (pontesSkill.has(w)) return;
    pontesSkill.add(w);
    w.__fznAtoCb = (origem, alvo, acao, eu) => { try { anotarGolpe(origem, alvo, acao, eu); } catch {} };
    w.__fznSaiuCb = (gid, tipo) => { try { if (tipo === 1 && lugarDoMapa(mapaAgora) === 'bio4' && Date.now() - (golpeiEm.get(gid) || 0) < 10000) contarAbate(gid); } catch {} };
    w.__fznUnidCb = (aid, job, x, y, sumiu) => {
      if (sumiu) { pneumas.delete(aid); return; }
      if (Number(job) === UNT_PNEUMA) pneumas.set(aid, { x: Number(x), y: Number(y), mapa: mapaAgora, em: Date.now() });
    };
    w.__fznMvpCb = (dono, meuAid, meuGid) => { try { if (dono && (dono === meuAid || dono === meuGid)) contarMvp(); } catch {} };
    w.__fznSkillCb = (skid, origem, alvo, eu, fase) => {
      if (eu && origem === eu) meuGolpeEm = Date.now();
      if (eu && alvo === eu && origem !== eu) diag('skill', skid, 'skill ' + skid + ' em mim (' + fase + ') de ' + origem);
      else if (skid === 84) diag('skill84', origem, 'skill 84 (' + fase + ') alvo ' + alvo + ' eu ' + eu);
      if (!(skid in SKILLS_FUGIR_BIO4) || !eu || alvo !== eu) return;
      skillPerigo = { nome: SKILLS_FUGIR_BIO4[skid] + ' (' + fase + ')', em: Date.now() };
    };
    const s = w.document.createElement('script');
    s.type = 'module';
    s.textContent = `Promise.all([import('Network/NetworkManager.js'),import('Network/PacketStructure.js'),import('Engine/SessionStorage.js'),import('Engine/MapEngine/Entity.js')]).then(([n,p,ss,ee])=>{
      const N=n.default,P=p.default,S=ss.default,EE=ee.default; window.__fznEu=()=>S.Entity;
      import('Renderer/EntityManager.js').then((em)=>{ window.__fznPosDe=(gid)=>{try{const x=em.default.get(gid);return x&&x.position&&!(x.isDead&&x.isDead())?[Math.round(x.position[0]),Math.round(x.position[1])]:null}catch(e){return null}}; window.__fznCenso=()=>{const out=[];const eu=S.Entity;const px=eu&&eu.position;try{em.default.forEach((x)=>{if(!x||x.objecttype!==(x.constructor&&x.constructor.TYPE_MOB))return;let an='';if(x.ACTION)for(const k in x.ACTION)if(x.ACTION[k]===x.action){an=k;break;}const d=px&&x.position?Math.ceil(Math.hypot(x.position[0]-px[0],x.position[1]-px[1])):-1;out.push({n:(x.display&&x.display.name)||x._job,d,morto:x.isDead&&x.isDead(),vis:x.isVisible&&x.isVisible(),a:an});});}catch(e){out.push({erro:String(e)})}return out.sort((a,b)=>a.d-b.d);}; window.__fznItens=(raio)=>{let n=0;const px=S.Entity&&S.Entity.position;if(!px)return -1;try{em.default.forEach((x)=>{const C=x&&x.constructor;if(!C||(x.objecttype!==C.TYPE_ITEM&&x.objecttype!==C.TYPE_ITEM2)||!x.position)return;if(Math.hypot(x.position[0]-px[0],x.position[1]-px[1])<=raio)n++;});}catch(e){return -2}return n;}; }).catch((e)=>{ window.__fznCenso=()=>[{erro:'import '+String(e)}]; });
      if(N.__fznSkill) return;
      const fase=new Map([[P.ZC.USESKILL_ACK,'conjurando'],[P.ZC.USESKILL_ACK2,'conjurando'],[P.ZC.USESKILL_ACK3,'conjurando'],[P.ZC.NOTIFY_SKILL,'golpe'],[P.ZC.NOTIFY_SKILL2,'golpe']].filter(([k])=>k));
      const atos=new Set([P.ZC.NOTIFY_ACT,P.ZC.NOTIFY_ACT2,P.ZC.NOTIFY_ACT3].filter(Boolean));
      const unid=new Set([P.ZC.SKILL_ENTRY,P.ZC.SKILL_ENTRY2,P.ZC.SKILL_ENTRY3,P.ZC.SKILL_ENTRY4,P.ZC.SKILL_ENTRY5].filter(Boolean));
      const orig=N.hookPacket;
      N.hookPacket=function(pk,cb){ if(fase.has(pk)&&typeof cb==='function'){const c=cb,f=fase.get(pk); cb=function(pkt){try{window.__fznSkillCb&&window.__fznSkillCb(pkt.SKID,pkt.AID,pkt.targetID,(S.Entity&&S.Entity.GID)||S.AID,f)}catch(e){} return c.apply(this,arguments)}}
        else if(atos.has(pk)&&typeof cb==='function'){const c=cb; cb=function(pkt){try{window.__fznAtoCb&&window.__fznAtoCb(pkt.GID,pkt.targetGID,pkt.action,(S.Entity&&S.Entity.GID)||S.AID)}catch(e){} return c.apply(this,arguments)}}
        else if(P.ZC.NOTIFY_VANISH&&pk===P.ZC.NOTIFY_VANISH&&typeof cb==='function'){const c=cb; cb=function(pkt){try{window.__fznSaiuCb&&window.__fznSaiuCb(pkt.GID,pkt.type)}catch(e){} return c.apply(this,arguments)}}
        else if(unid.has(pk)&&typeof cb==='function'){const c=cb; cb=function(pkt){try{window.__fznUnidCb&&window.__fznUnidCb(pkt.AID,pkt.job,pkt.xPos,pkt.yPos,false)}catch(e){} return c.apply(this,arguments)}}
        else if(P.ZC.SKILL_DISAPPEAR&&pk===P.ZC.SKILL_DISAPPEAR&&typeof cb==='function'){const c=cb; cb=function(pkt){try{window.__fznUnidCb&&window.__fznUnidCb(pkt.AID,0,0,0,true)}catch(e){} return c.apply(this,arguments)}}
        else if(pk===P.ZC.MVP&&typeof cb==='function'){const c=cb; cb=function(pkt){try{window.__fznMvpCb&&window.__fznMvpCb(pkt.AID,S.AID,S.Entity&&S.Entity.GID)}catch(e){} return c.apply(this,arguments)}}
        if(fase.get(pk)==='golpe'&&typeof cb==='function'){const c2=cb; cb=function(pkt){try{window.__fznAtoCb&&window.__fznAtoCb(pkt.AID,pkt.targetID,6,(S.Entity&&S.Entity.GID)||S.AID)}catch(e){} return c2.apply(this,arguments)}}
        try{return orig.call(this,pk,cb)}catch(e){window.__fznSkillAviso=String(e)}};
      try{EE()}catch(e){window.__fznSkillAviso=String(e)}
      N.__fznSkill=1; window.__fznSkillOk=1;
    }).catch(e=>{window.__fznSkillErro=String(e)});`;
    w.document.head.appendChild(s);
    setTimeout(() => {
      const st = w.__fznSkillErro ? 'gancho falhou ' + w.__fznSkillErro.slice(0, 80) : w.__fznSkillOk ? 'vigiando skills multi-hit na Bio4' + (w.__fznSkillAviso ? ' (aviso: ' + w.__fznSkillAviso.slice(0, 60) + ')' : '') : 'gancho ainda nao respondeu';
      log('Jupiter: ' + st); diag('gancho', 'skill', 'Jupiter: ' + st);
    }, 4000);
  };
  setInterval(() => {
    try {
      const w = jogo();
      const e = w?.__elragEngine;
      if (!e) return;
      ganchoSkill(w);
      if (!skillPerigo) return;
      const agora = Date.now();
      if (agora - skillPerigo.em > 3000) { skillPerigo = null; return; }
      if (!cfg.ligado || !/^lhz_dun04/.test(String(posicao(e)?.mapa || ''))) { skillPerigo = null; return; }
      if (!asaLiberada()) return;
      asa.aguardando = false;
      if (usarAsa(w, e, agora)) { log(skillPerigo.nome + ' em mim -> asa'); diag('fuga', Date.now(), skillPerigo.nome + ' em mim -> asa'); skillPerigo = null; }
    } catch {}
  }, 50);
  setInterval(() => {
    try {
      if (!pneumas.size) return;
      const agora = Date.now();
      for (const [id, p] of pneumas) if (agora - p.em > PNEUMA_VIDA_MS || p.mapa !== mapaAgora) pneumas.delete(id);
      if (!cfg.ligado || !cfg.pneuma || !pneumas.size) return;
      const w = jogo();
      const e = w?.__elragEngine;
      if (!e || !meuAlvoGid || agora - meuGolpeEm > 3000) return;
      const pos = w.__fznPosDe?.(meuAlvoGid);
      if (!pos) return;
      const dentro = [...pneumas.values()].some((p) => Math.abs(p.x - pos[0]) <= 1 && Math.abs(p.y - pos[1]) <= 1);
      if (!dentro || pneumaFugindo || temJanelaAberta(w)) return;
      pneumaFuga(w, e, nomesGid.get(meuAlvoGid) || '?', pos);
    } catch {}
  }, 100);
  // v1.57: Tiro Preciso/ataque do autopilot atrapalham a asa -> para o autopilot, espera o cast acabar, asa, religa
  let pneumaFugindo = false;
  const pneumaFuga = async (w, e, nome, pos) => {
    pneumaFugindo = true;
    const t0 = Date.now();
    try {
      try { e.setAutopilotRunning(false); } catch {}
      if (pinoGid) { pinoGid = 0; try { e.setAutopilotPinnedTarget(0); } catch {} }
      fixado = null;
      for (let i = 0; i < 10; i++) {
        const c = w.__fznEu?.()?.cast;
        if (!(c && c.delay > 0 && Date.now() < c.tick + c.delay)) break;
        await esperar(50);
      }
      await esperar(80);
      let foi = false;
      for (let tentativa = 0; tentativa < 3 && !foi; tentativa++) {
        while (!asaLiberada()) await esperar(30);
        asa.aguardando = false;
        const antes = posicao(e);
        if (!usarAsa(w, e, Date.now()) || ultimaAsaEm < Date.now() - 100) { await esperar(150); continue; }
        for (let i = 0; i < 25; i++) {
          await esperar(40);
          const p = posicao(e);
          if (p && antes && (p.x !== antes.x || p.y !== antes.y || p.mapa !== antes.mapa)) { foi = true; break; }
        }
      }
      log('Pneuma em ' + nome + ' (' + pos[0] + ',' + pos[1] + '): autopilot parado -> asa ' + (foi ? 'OK' : 'SEM EFEITO') + ' -> religado (' + (Date.now() - t0) + ' ms)');
    } catch (err) { log('Pneuma: erro ' + String(err).slice(0, 60)); }
    finally {
      try { e.setAutopilotRunning(true); } catch {}
      meuAlvoGid = 0;
      pneumaFugindo = false;
    }
    // v1.58: o 1o "ligar" logo apos a asa as vezes nao pega (chegada no mapa); insiste a cada 250 ms por 4 s
    for (let i = 0; i < 16; i++) {
      await esperar(250);
      let ap = null;
      try { ap = e.getAutopilotSnapshot(); } catch {}
      if (ap && !AUTOPILOT_PARADO.has(ap.runtimeState)) { if (i) log('Pneuma: autopilot religado na tentativa ' + (i + 1) + ' (' + (Date.now() - t0) + ' ms)'); return; }
      try { e.setAutopilotRunning(true); } catch {}
    }
  };
  let presoAvisado = 0;
  setInterval(() => {
    try {
      const w = jogo();
      const e = w?.__elragEngine;
      if (!e) return;
      ganchoStatus(w);
      if (!cfg.ligado) return;
      const agora = Date.now();
      for (const [i, fim] of presoAtivo) if (fim < agora) presoAtivo.delete(i);
      if (!presoAtivo.size || temJanelaAberta(w)) return;
      if (!asaLiberada() || asa.aguardando) return;
      const nomes = [...presoAtivo.keys()].map((i) => PRESOS[i]).join(', ');
      if (usarAsa(w, e, agora)) { if (agora - presoAvisado > 2000) { presoAvisado = agora; log('preso (' + nomes + ') -> asa'); diag('fuga', agora, 'preso (' + nomes + ') -> asa'); } presoAtivo.clear(); }
    } catch {}
  }, 100);

  const FARM_LONGE = 10;
  const FARM_LONGE_MS = 300;
  const FARM_PERTO_MS = 1500;
  const LUTA_MS = 1500;
  const ANDANDO_MS = 500;
  const OCIOSO_FIXAR_MS = 300;
  const FIXAR_ESPERA_MS = 1500;
  const OCIOSO_ASA_MS = 3000;
  let acaoLutaDesde = 0;
  const trilha = [];
  let ultPosTrilha = null;
  let trilhaW = null;
  setInterval(() => {
    try {
      const w = trilhaW || jogo(); if (!w) return; trilhaW = w;
      const e = w.__elragEngine; if (!e) return;
      const eu = w.__fznEu?.();
      let an = '';
      if (eu?.ACTION) for (const k in eu.ACTION) if (eu.ACTION[k] === eu.action) { an = k; break; }
      const c = eu?.cast;
      const agora = Date.now();
      const cast = c && c.delay > 0 && agora < c.tick + c.delay ? Math.round(c.tick + c.delay - agora) : 0;
      const p = posicao(e);
      let rad = 0; try { rad = (e.getAutopilotRadarSnapshot()?.mobs || []).length; } catch {}
      const censo = w.__fznCenso?.() || [];
      const vivos = censo.filter((m) => !m.morto && m.d >= 0 && m.d <= 14).length;
      const mortos = censo.filter((m) => m.morto && m.d >= 0 && m.d <= 14).length;
      const itens = w.__fznItens ? w.__fznItens(8) : '?';
      trilha.push(new Date(agora).toTimeString().slice(0, 8) + '.' + String(agora % 1000).padStart(3, '0').slice(0, 1) + ' ' + an + (cast ? ' cast' + cast : '') + ' ' + (p ? p.x + ',' + p.y : '?') + ' radar' + rad + ' vivos' + vivos + ' mortos' + mortos + ' itens' + itens + ' golpe' + (meuGolpeEm ? Math.min(99999, agora - meuGolpeEm) : '-'));
      if (trilha.length > 50) trilha.shift();
      if (p && ultPosTrilha && p.mapa === ultPosTrilha.mapa && Math.hypot(p.x - ultPosTrilha.x, p.y - ultPosTrilha.y) > 6 && agora - ultimaAsaEm > 2000 && agora - (fugaEm || 0) > 2000) {
        let pol = '';
        try {
          const ap = e.getAutopilotSnapshot() || {};
          const tp = ap.targetPolicy || {};
          pol = 'multidao=' + (tp.crowdEscapeEnabled ? 'LIGADA' : 'off') + ' max=' + tp.maxTargetingMobs + ' miniChefe=' + (tp.fleeFromMiniBoss ? 'foge' : 'off') + ' asaAuto=' + (ap.autoFlyWingEnabled ? 'LIGADA' : 'off') + ' fugaStatus=' + JSON.stringify(ap.threatEscapeStatus ?? null).slice(0, 80);
        } catch {}
        ultimaAsaEm = Math.max(ultimaAsaEm, agora - 200);
        log('TELEPORTE EXTERNO (nao foi o Auto Hunt): ' + ultPosTrilha.x + ',' + ultPosTrilha.y + ' -> ' + p.x + ',' + p.y + ' | ' + pol + ' | antes: ' + (trilha[trilha.length - 2] || ''));
        gravarTrilha('TELEPORTE EXTERNO ' + pol);
      }
      ultPosTrilha = p;
    } catch {}
  }, 200);
  const gravarTrilha = (motivo) => {
    try {
      const l = lerJson('fzn-autohunt-ygg-trilha', []);
      l.push({ em: new Date().toLocaleTimeString(), motivo, linhas: trilha.slice() });
      gravarJson('fzn-autohunt-ygg-trilha', l.slice(-6));
    } catch {}
  };
  const retrato = (w) => {
    try {
      const eu = w.__fznEu?.();
      let an = '';
      if (eu?.ACTION) for (const k in eu.ACTION) if (eu.ACTION[k] === eu.action) { an = k; break; }
      const c = eu?.cast;
      const castRest = c && c.delay > 0 ? Math.round(c.tick + c.delay - Date.now()) : null;
      const mobs = (w.__fznCenso?.() || []).slice(0, 6).map((m) => m.erro ? 'erro ' + m.erro.slice(0, 40) : m.n + ' a ' + m.d + (m.morto ? ' MORTO' : '') + (m.vis === false ? ' INVISIVEL' : '') + ' ' + m.a).join(', ');
      return ' || eu: ' + (eu ? an + (castRest != null ? ' cast ' + castRest + ' ms' : '') : 'sem acesso') + ' | mobs no cliente: ' + (mobs || 'nenhum');
    } catch (err) { return ' || retrato falhou: ' + String(err).slice(0, 40); }
  };
  let pinoGid = 0;
  let movChave = '', ultimoMovEm = 0, ociosoDesde = 0, golpesAvisado = false, inicioFarm = 0;
  const FUGA_DIST = 7;
  const temAsaComum = () => Object.values(ultimoSnapMochila || {}).some((l) => Array.isArray(l) && l.some((it) => it && Number(it.count) > 0 && tipoAsa(it) === 'comum'));
  setInterval(() => {
    try {
      if (!cfg.ligado) return;
      const w = jogo();
      const e = w?.__elragEngine;
      if (!e) return;
      ganchoMochila(w); vigiarFuga(w);
      if (Date.now() - (asa.lidaEm || 0) > 60000 && Date.now() - asa.pedidaEm > 20000) { asa.pedidaEm = Date.now(); try { e.requestInventorySnapshot(); } catch {} }
      const ap = e.getAutopilotSnapshot();
      if (!ap || AUTOPILOT_PARADO.has(ap.runtimeState)) return;
      const fugir = fugirDe(ap);
      if (!fugir.size || !ultimoSnapMochila || temAsaComum()) return;
      const radar = e.getAutopilotRadarSnapshot()?.mobs || [];
      const ameaca = radar.find((m) => fugir.has(m.mobId) && (m.gid === ap.targetGid || Number(m.distance) <= FUGA_DIST));
      if (ameaca) { if (Date.now() - fugaEm >= 1500) log('fuga preventiva: ' + ameaca.name + ' a ' + ameaca.distance); fugirComAsa(w); }
    } catch {}
  }, 100);
  const vigiasFuga = new WeakSet();
  const vigiarFuga = (w) => {
    const doc = w.document;
    if (!doc?.body || vigiasFuga.has(doc)) return;
    vigiasFuga.add(doc);
    new w.MutationObserver((muts) => {
      if (!cfg.ligado) return;
      for (const m of muts) for (const n of m.addedNodes) {
        const t = n.textContent;
        if (t && t.length < 300 && FUGA_RE.test(t)) { fugirComAsa(w); return; }
      }
    }).observe(doc.body, { childList: true, subtree: true });
    try { w.__elragEngine.requestInventorySnapshot(); } catch {}
  };
  const usarAsa = (w, e, agora) => {
    if (cfg.asa === 'off' || (sessaoCheffenia(w, e) && cfg.cheffeniaTeleporte !== true)) return false;
    if (mvpEmCombate(snapshotAp(e), agora)) return false;
    ganchoMochila(w);
    if ((asa.index == null || agora - asa.lidaEm > 120000) && agora - asa.pedidaEm > 20000) {
      asa.pedidaEm = agora;
      try { e.requestInventorySnapshot(); } catch {}
    }
    if (asa.index == null || asa.count <= 0) return false;
    if (asa.aguardando) return true;
    if (!asaLiberada()) return true;
    asa.posAntes = posicao(e);
    try { e.useInventoryItem(asa.index); } catch { return false; }
    ultimaAsaEm = Date.now();
    setTimeout(() => gravarTrilha((lerJson(CHAVE_LOG, []).slice(-1)[0] || '').slice(0, 300)), 50);
    asa.usadaEm = agora; asa.usos++; if (!asa.infinita) asa.count--; asa.aguardando = true;
    radarVazioDesde = 0;
    log(asa.gigante ? `asa: Asa Gigante Infinita (${asa.usos}a)` : asa.infinita ? `asa: Asa Infinita (${asa.usos}a)` : `asa: Asa de Mosca (${asa.usos}a, restam ~${asa.count})`);
    return true;
  };
  setInterval(() => {
    try { if (ocupado) window.top.__FZN_ECONOMIA_YGG__?.acordar('autohunt', 1500); } catch {}
  }, 250);

  const RELIGAR_AP_MS = 3000;
  const RELIGAR_AP_INTERVALO_MS = 5000;
  const CIDADES_RE = /^(prontera|prt_in|geffen|payon|morocc|alberta|izlude|aldebaran|yuno|lighthalzen|einbroch|einbech|hugel|rachel|veins|comodo|umbala|amatsu|gonryun|louyang|ayothaya|niflheim|jawaii|moscovia|brasilis|dewata|malangdo|malaya|mora|manuk|splendide|lasagna|dicastes01|eclage)$/;
  // v1.60: mesma lista do AUTO VOLTAR (Bio4, Chefenia, instancias, Moro vol)
  const mapaDeRenascer = (mapa) => {
    const m = String(mapa || '').toLowerCase();
    return /^lhz_dun04(\.|$)/.test(m) || /chef/.test(m) || /^moro_vol(\.|$)/.test(m) || m.includes('@') || /inv$/.test(m);
  };
  const foraDaCidade = (mapa) => Boolean(mapa) && !CIDADES_RE.test(mapa);
  const janelaBloqueiaReligar = (w, mapa) => {
    if (!mapaDeRenascer(mapa) && !sessaoCheffenia(w, w.__elragEngine)) return temJanelaAberta(w);
    // Em mapas especiais, o convite "Voltar para ..." pode permanecer
    // no HUD depois da entrada e nao deve bloquear o Autopilot.
    return /Renascer agora|Voltar ao ponto de salvamento|Bem-vindo aos servicos Kafra/
      .test(w.document.body?.innerText || '');
  };
  // v1.60: sempre ativo fora da cidade, renascer nos mapas especiais e destravar "ocupado"
  let ocupadoDesde = 0, renascerEm = 0, motivoParado = '';
  const motivo = (txt) => { if (txt !== motivoParado) { motivoParado = txt; if (txt) log('parado: ' + txt); } };
  setInterval(() => {
    try {
      const w = jogo();
      const e = w?.__elragEngine;
      if (!e) return;
      const mapa = String(posicao(e)?.mapa || '');
      const agora = Date.now();
      if (!cfg.ligado && foraDaCidade(mapa)) {
        cfg.ligado = true; gravarJson(CHAVE_CFG, cfg);
        log('Hunt estava OFF em ' + mapa + ' -> ligado de novo (so desliga na cidade)');
      }
      if (ocupado) {
        if (!ocupadoDesde) ocupadoDesde = agora;
        else if (agora - ocupadoDesde > 30000) { ocupado = false; ocupadoDesde = 0; log('ocupado preso ha 30 s -> liberado'); }
      } else ocupadoDesde = 0;
      const texto = w.document.body?.innerText || '';
      if (/Renascer agora/.test(texto) && mapaDeRenascer(mapa) && agora - renascerEm > 3000) {
        const b = [...w.document.querySelectorAll('button')].find((x) => /^Renascer agora/i.test((x.textContent || '').trim()) && !x.disabled);
        if (b) {
          renascerEm = agora;
          log('Morreu em ' + mapa + ': Renascer agora');
          b.click();
          setTimeout(() => { try { if (!/Renascer agora/.test(w.document.body?.innerText || '')) { e.setAutopilotRunning(true); log('Renascer: cacada religada em ' + mapa); } } catch {} }, 1500);
        } else motivo('morto em ' + mapa + ', Renascer agora ainda desabilitado');
      }
    } catch {}
  }, 1000);
  const mapaCheffenia = (mapa) => /^moro_vol|cheffenia|chefenia/i.test(String(mapa || ''));
  let hudCheffeniaEm = 0, hudCheffeniaAtivo = false;
  const sessaoCheffenia = (w, e) => {
    const mapa = String(posicao(e)?.mapa || '');
    if (mapaCheffenia(mapa)) return true;
    if (!mapa || CIDADES_RE.test(mapa)) return false;
    if (Date.now() - hudCheffeniaEm > 750) {
      hudCheffeniaEm = Date.now();
      // Exemplo do visor do jogo: "Chefenia Solo: 53min".
      hudCheffeniaAtivo = /cheff?enia\s+(?:solo|guild|grupo)\s*:\s*\d+\s*(?:h|min)/i.test(w.document.body?.innerText || '');
    }
    return hudCheffeniaAtivo;
  };
  const visivelCheff = (el) => { const r = el?.getBoundingClientRect?.(); return !!r && r.width > 0 && r.height > 0 && el.ownerDocument.defaultView.getComputedStyle(el).visibility !== 'hidden'; };
  const botaoCheff = (w, re) => [...w.document.querySelectorAll('button,[role="button"]')].find((b) => visivelCheff(b) && !b.disabled && re.test((b.innerText || b.textContent || '').trim().replace(/\s+/g, ' ')) && !b.closest('.fzn-ygg,[data-fzn-auto-voltar]'));
  const esperarCheff = async (fn, tempo = 12000) => { const fim = Date.now() + tempo; do { const v = fn(); if (v) return v; await esperar(250); } while (Date.now() < fim); return null; };
  let recuperacaoCheffPendente = false, recuperacaoCheffOcupada = false, ultimaTentativaCheff = 0, npcCheffPonte = null;
  const ponteNpcCheff = async (w) => {
    if (!npcCheffPonte || npcCheffPonte.w !== w) {
      const script = w.document.createElement('script'); script.type = 'module';
      script.textContent = "import('Renderer/EntityManager.js').then(m=>{window.__fznAutoHuntNpc={manager:m.default};}).catch(e=>{window.__fznAutoHuntNpc={erro:String(e)};});";
      w.document.head.appendChild(script); npcCheffPonte = { w };
    }
    return (await esperarCheff(() => w.__fznAutoHuntNpc?.manager, 4000)) || null;
  };
  const dialogoArauto = (w) => /Arauto da Cheffenia/i.test(w.document.body?.innerText || '') && !!botaoCheff(w, /^Entrar$/i);
  const falarArauto = async (w) => {
    if (dialogoArauto(w)) return true;
    const manager = await ponteNpcCheff(w); if (!manager || typeof manager.forEach !== 'function') { log('Cheffenia: lista de NPCs indisponivel'); return false; }
    let npc = null; const p = posicao(w.__elragEngine);
    manager.forEach((e) => { const c = e?.constructor; const tipoNpc = c && ((Number.isFinite(c.TYPE_NPC) && e.objecttype === c.TYPE_NPC) || (Number.isFinite(c.TYPE_NPC2) && e.objecttype === c.TYPE_NPC2));
      if (!tipoNpc || !(e.GID > 0) || e.remove_tick || !e.position) return;
      if (![e.display?.name,e.name,e._name,e.entityName,e._job].some((v) => /arauto da cheffenia/i.test(String(v || '')))) return;
      const d = p ? Math.hypot(e.position[0] - p.x, e.position[1] - p.y) : 0;
      if (!npc || d < npc.distancia) npc = { entidade:e, distancia:d };
    });
    if (!npc) { log('Cheffenia: Arauto nao encontrado em Prontera'); return false; }
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const canvas = canvasDoJogo(w);
      try { const camera = w.__elragEngine.renderer?.camera || w.__elragEngine.camera; const xy = camera?.worldToScreen?.(npc.entidade.position[0], npc.entidade.position[1], 0);
        if (canvas && xy?.length >= 2) { const r = canvas.getBoundingClientRect(); await clicarNoCanvas(w, canvas, r.left + xy[0], r.top + xy[1]); }
      } catch {}
      if (await esperarCheff(() => dialogoArauto(w), 1500)) return true;
      try { npc.entidade.onMouseDown?.(); } catch {}
      if (await esperarCheff(() => dialogoArauto(w), 2000)) return true;
    }
    log('Cheffenia: conversa do Arauto nao abriu'); return false;
  };
  const recuperarCheffenia = async (w) => {
    if (recuperacaoCheffOcupada || Date.now() - ultimaTentativaCheff < 8000) return;
    recuperacaoCheffOcupada = true; ultimaTentativaCheff = Date.now();
    window.top.__FZN_CHEFF_RECOVERY__ = { active: true, desde: Date.now() };
    try {
      const e = w.__elragEngine;
      if (botaoCheff(w, /^Voltar ao ponto de salvamento$/i)) {
        log('Poder Infernal: voltando ao ponto de salvamento');
        botaoCheff(w, /^Voltar ao ponto de salvamento$/i).click();
        const saiu = await esperarCheff(() => posicao(e)?.mapa === 'prontera', 30000);
        if (!saiu) { log('Poder Infernal: nao chegou a Prontera; aguardando'); return; }
      }
      if (mapaCheffenia(posicao(e)?.mapa)) {
        try { e.setAutopilotRunning(true); } catch {}
        const ligado = await esperarCheff(() => { try { return !AUTOPILOT_PARADO.has(e.getAutopilotSnapshot()?.runtimeState); } catch { return false; } }, 4000);
        if (ligado) { recuperacaoCheffPendente = false; poderInfernalVistoEm = 0; log('Cheffenia: Autopilot religado'); }
        return;
      }
      if (posicao(e)?.mapa !== 'prontera') { log('Poder Infernal: ponto de salvamento nao e Prontera; retorno automatico interrompido'); recuperacaoCheffPendente = false; return; }
      if (!await falarArauto(w)) return;
      const entrar = botaoCheff(w, /^Entrar$/i);
      if (!entrar) { log('Cheffenia: botao Entrar nao apareceu'); return; }
      log('Cheffenia: entrando novamente pelo Arauto'); entrar.click();
      const chegou = await esperarCheff(() => mapaCheffenia(posicao(e)?.mapa) ? posicao(e) : null, 20000);
      if (!chegou) { log('Cheffenia: entrada nao confirmada; verificarei novamente'); return; }
      try { e.setAutopilotRunning(true); } catch {}
      const ligado = await esperarCheff(() => { try { return !AUTOPILOT_PARADO.has(e.getAutopilotSnapshot()?.runtimeState); } catch { return false; } }, 4000);
      log(ligado ? 'Cheffenia: retorno confirmado; Autopilot ligado' : 'Cheffenia: retorno confirmado; Autopilot nao confirmou, repetirei');
      if (ligado) { recuperacaoCheffPendente = false; poderInfernalVistoEm = 0; }
    } catch (err) { log('Cheffenia: recuperacao falhou: ' + String(err).slice(0, 100)); }
    finally { recuperacaoCheffOcupada = false; window.top.__FZN_CHEFF_RECOVERY__ = { active: recuperacaoCheffPendente, desde: Date.now() }; }
  };
  let apParadoDesde = 0, apReligadoEm = 0, entradaCheffeniaVista = false;
  const ligarAutopilotAoEntrarCheffenia = (w, e, ap, agora, mapa) => {
    if (!sessaoCheffenia(w, e)) { entradaCheffeniaVista = false; return false; }
    if (!AUTOPILOT_PARADO.has(Number(ap.runtimeState))) { entradaCheffeniaVista = true; return false; }
    if (entradaCheffeniaVista || janelaBloqueiaReligar(w, mapa)) return false;
    entradaCheffeniaVista = true; apParadoDesde = agora; apReligadoEm = agora;
    try { e.setAutopilotRunning(true); log('Cheffenia: entrada detectada; ligando Autopilot imediatamente'); }
    catch (err) { log('Cheffenia: nao consegui ligar Autopilot: ' + String(err).slice(0, 80)); }
    return true;
  };
  const ciclo = async () => {
    if (!cfg.ligado || (ocupado && !cfg.soMvp)) return;
    const w = jogo();
    if (!w) return;
    const e = w.__elragEngine;
    try { ganchoMochila(w); vigiarFuga(w); } catch {}
    if (cfg.cheffeniaRecuperar !== false) {
      const mapaAtual = posicao(e)?.mapa;
      if (mapaCheffenia(mapaAtual)) {
        try { ganchoEfeitos(w); } catch {}
        if (botaoCheff(w, /^Voltar ao ponto de salvamento$/i) && poderInfernalAtivo(w)) {
          recuperacaoCheffPendente = true;
          window.top.__FZN_CHEFF_RECOVERY__ = { active: true, desde: Date.now() };
        }
      }
      if (recuperacaoCheffPendente) { await recuperarCheffenia(w); return; }
    }
    let ap;
    try { ap = e.getAutopilotSnapshot(); } catch { return; }
    if (!ap) return;
    const agora = Date.now();
    const mapaAgora = String(posicao(e)?.mapa || '');
    if (ligarAutopilotAoEntrarCheffenia(w, e, ap, agora, mapaAgora)) return;
    if (AUTOPILOT_PARADO.has(Number(ap.runtimeState))) {
      if (euDesliguei && agora - euDesliguei < 8000) {
        euDesliguei = 0;
        try { e.setAutopilotRunning(true); log('autopilot parou apos o passo; religado'); } catch {}
      }
      if (!apParadoDesde) {
        apParadoDesde = agora;
        log('autopilot do jogo PAROU (estado ' + ap.runtimeState + ', mapa ' + (posicao(e)?.mapa || '?') + ')' + retrato(w));
      }
      const mapaP = String(posicao(e)?.mapa || '');
      if (agora - apParadoDesde >= RELIGAR_AP_MS && agora - apReligadoEm >= RELIGAR_AP_INTERVALO_MS && mapaP && !CIDADES_RE.test(mapaP) && !janelaBloqueiaReligar(w, mapaP)) {
        apReligadoEm = agora;
        try { e.setAutopilotRunning(true); log('autopilot parado ha ' + Math.round((agora - apParadoDesde) / 1000) + ' s em ' + mapaP + ' -> religado'); } catch (err) { log('religar autopilot falhou: ' + String(err).slice(0, 60)); }
      } else if (agora - apParadoDesde >= RELIGAR_AP_MS) {
        motivo(!mapaP ? 'mapa desconhecido' : CIDADES_RE.test(mapaP) ? 'na cidade (' + mapaP + ')' : janelaBloqueiaReligar(w, mapaP) ? 'janela aberta (morte/Kafra/teleporte) em ' + mapaP : '');
      }
      semAlvoDesde = 0; radarVazioDesde = 0;
      return;
    }
    if (apParadoDesde) { log('autopilot voltou (parado ' + Math.round((agora - apParadoDesde) / 1000) + ' s)'); apParadoDesde = 0; motivoParado = ''; }
    // evento: Stefan J.E. Wolf no radar e sempre o alvo
    {
      let radarEv = [];
      try { radarEv = e.getAutopilotRadarSnapshot()?.mobs || []; } catch {}
      const ev = radarEv.filter((m) => normN(m?.name) === EVENTO_NOME).sort((a, b) => (a.distance || 0) - (b.distance || 0))[0];
      if (ev) {
        semAlvoDesde = 0; radarVazioDesde = 0; naoMvpDesde = 0;
        if (ap.targetGid === ev.gid) return;
        if (eventoFixado !== ev.gid || agora - eventoFixadoEm > 500) {
          try { e.setAutopilotPinnedTarget(ev.gid); } catch {}
          if (eventoFixado !== ev.gid) log('evento: alvo ' + ev.name + ' a ' + ev.distance);
          eventoFixado = ev.gid; eventoFixadoEm = agora;
        }
        return;
      }
      if (eventoFixado) { eventoFixado = null; try { e.setAutopilotPinnedTarget(0); } catch {} log('evento: Stefan saiu do radar'); }
    }
    if (cfg.soMvp) {
      try { ganchoCatalogo(w); } catch {}
      let radarMvp = [];
      try { radarMvp = e.getAutopilotRadarSnapshot()?.mobs || []; } catch {}
      const candidatos = radarMvp.filter((m) => ehMvp(m) && !mvpTomado(m));
      const mvp = candidatos.find((m) => Number(m.gid) === Number(ap.targetGid)) ||
        candidatos.find((m) => Number(m.gid) === Number(meuAlvoGid) && agora - meuGolpeEm < 10000) ||
        candidatos.sort((a, b) => (a.distance || 0) - (b.distance || 0))[0];
      if (mvp) {
        mvpUltimoGid = Number(mvp.gid) || 0; mvpVistoEm = agora;
        semAlvoDesde = 0; radarVazioDesde = 0; naoMvpDesde = 0;
        if (ap.targetGid === mvp.gid) return;
        if (mvpFixado !== mvp.gid || agora - mvpFixadoEm > 500) {
          try { e.setAutopilotPinnedTarget(mvp.gid); } catch {}
          if (mvpFixado !== mvp.gid) log('so MVP: alvo ' + mvp.name + ' a ' + mvp.distance);
          mvpFixado = mvp.gid; mvpFixadoEm = agora;
        }
        return;
      }
      if (mvpEmCombate(ap, agora) || (mvpUltimoGid && agora - mvpVistoEm < 1500)) {
        naoMvpDesde = 0;
        return;
      }
      if (mvpFixado) { mvpFixado = null; try { e.setAutopilotPinnedTarget(0); } catch {} log('so MVP: MVP saiu do radar'); }
      if (asa.aguardando) {
        const pos = posicao(e);
        const mudou = pos && asa.posAntes && (pos.x !== asa.posAntes.x || pos.y !== asa.posAntes.y || pos.mapa !== asa.posAntes.mapa);
        if (mudou || agora - asa.usadaEm > ASA_CHEGADA_MAX_MS) { asa.aguardando = false; naoMvpDesde = 0; }
        else return;
      }
      if ((!sessaoCheffenia(w, e) || cfg.cheffeniaTeleporte) && mvpPularAgora && !temJanelaAberta(w)) {
        mvpPularAgora = false;
        if (usarAsa(w, e, agora)) { naoMvpDesde = 0; return; }
      }
      mvpPularAgora = false;
      if (!naoMvpDesde) naoMvpDesde = agora;
      if ((!sessaoCheffenia(w, e) || cfg.cheffeniaTeleporte) && agora - naoMvpDesde >= SO_MVP_TELEPORTE_MS && !temJanelaAberta(w)) {
        if (usarAsa(w, e, agora)) { log('so MVP: nenhum chefe da ' + (catIds.size ? 'Chefenia' : 'lista fixa') + ' no radar em 0,3 s (' + radarMvp.length + ' mobs) -> asa'); naoMvpDesde = 0; }
      }
      if (!sessaoCheffenia(w, e) || cfg.cheffeniaTeleporte) return;
    } else naoMvpDesde = 0;

    const posF = posicao(e);
    const chaveF = posF ? posF.mapa + ':' + posF.x + ':' + posF.y : '';
    if (chaveF !== movChave) { movChave = chaveF; ultimoMovEm = agora; }
    if (!inicioFarm) inicioFarm = agora;
    if (asa.aguardando) {
      const mudou = posF && asa.posAntes && (posF.x !== asa.posAntes.x || posF.y !== asa.posAntes.y || posF.mapa !== asa.posAntes.mapa);
      if (mudou) { asa.aguardando = false; radarVazioDesde = 0; ociosoDesde = 0; ultimoMovEm = 0; }
      else if (agora - asa.usadaEm > ASA_CHEGADA_MAX_MS) { asa.aguardando = false; asa.pedidaEm = 0; log('asa sem efeito; relendo a mochila'); asa.lidaEm = 0; }
      else return;
    }
    if (temJanelaAberta(w)) { radarVazioDesde = 0; ociosoDesde = 0; return; }
    for (const [gid, ate] of evitar) if (ate < agora) evitar.delete(gid);
    const ign = ignorados(ap);
    let radar = [];
    try { radar = e.getAutopilotRadarSnapshot()?.mobs || []; } catch {}
    const vivos = radar.filter((m) => !ign.has(m.mobId));
    if (cfg.bio4 && radar.some((m) => ehBio4(m) && !bio4Evitar.has(m.gid))) { ociosoDesde = 0; radarVazioDesde = 0; return; }
    try {
      const eu = w.__fznEu?.();
      if (eu) {
        const c = eu.cast;
        const conjurando = c && c.delay > 0 && agora < c.tick + c.delay + 300;
        let nomeAcao = '';
        if (eu.ACTION) for (const k in eu.ACTION) if (eu.ACTION[k] === eu.action) { nomeAcao = k; break; }
        const emAcao = /^(ATTACK[0-9]?|SKILL)$/.test(nomeAcao);
        if (emAcao) { if (!acaoLutaDesde) acaoLutaDesde = agora; } else acaoLutaDesde = 0;
        if (conjurando || (emAcao && agora - acaoLutaDesde < 8000)) meuGolpeEm = agora;
      }
    } catch {}
    const lutando = agora - meuGolpeEm < LUTA_MS;
    const andando = agora - ultimoMovEm < ANDANDO_MS;
    if (pinoGid && !radar.some((m) => m.gid === pinoGid)) { pinoGid = 0; try { e.setAutopilotPinnedTarget(0); } catch {} }
    if (fixado && fixado.gid !== pinoGid) fixado = null;
    if (fixado && meuAlvoGid === fixado.gid && lutando) fixado = null;
    if (!vivos.length) {
      ociosoDesde = 0;
      if (andando) { radarVazioDesde = 0; return; }
      if (!radarVazioDesde) radarVazioDesde = agora;
      const vazioMs = agora - radarVazioDesde;
      if (lutando) return;
      if (vazioMs >= ASA_SEM_MOB_MS && usarAsa(w, e, agora)) {
        if (ultimaAsaEm >= agora) {
          const ignorRadar = radar.filter((m) => ign.has(m.mobId)).slice(0, 4).map((m) => m.name + ' a ' + m.distance).join(', ');
          const regras = (ap?.targetPolicy?.species || []).map((r) => r.mobId + '@' + r.sourceMapIndex + (r.disposition === 1 ? 'F' : 'I')).join(' ');
          log('motivo: radar vazio e parado por ' + vazioMs + ' ms' + retrato(w) + ' | radar ' + radar.length + (ignorRadar ? ' (ignorados: ' + ignorRadar + ')' : '') + ' | golpe ha ' + (meuGolpeEm ? agora - meuGolpeEm : '-') + ' ms' + (regras ? ' | regras ' + regras.slice(0, 120) : ''));
          radarVazioDesde = 0;
        }
        return;
      }
      if (cfg.asa !== 'off' && asa.index != null && asa.count > 0) return;
    } else {
      radarVazioDesde = 0;
      exploraVazioDesde = 0;
      if (lutando || andando) { ociosoDesde = 0; return; }
      if (!ociosoDesde) { ociosoDesde = agora; return; }
      const ocioso = agora - ociosoDesde;
      const perto = Number(vivos[0].distance) || 0;
      if (!golpesMeus) {
        if (!golpesAvisado && agora - inicioFarm > 60000) { golpesAvisado = true; log('aviso: nenhum golpe meu visto em 60 s; gancho de golpes mudo -- so asa de radar vazio'); }
        return;
      }
      if (perto > FARM_LONGE) {
        if (ocioso >= FARM_LONGE_MS && usarAsa(w, e, agora) && ultimaAsaEm >= agora) { log('parado sem bater ' + ocioso + ' ms; mob mais perto a ' + perto + ' (> ' + FARM_LONGE + ') -> asa' + retrato(w)); ociosoDesde = 0; }
        return;
      }
      if (ocioso >= OCIOSO_ASA_MS) {
        if (usarAsa(w, e, agora) && ultimaAsaEm >= agora) { log('parado ' + ocioso + ' ms sem bater com ' + vivos[0].name + ' a ' + perto + ' -> asa' + retrato(w)); ociosoDesde = 0; fixado = null; if (pinoGid) { pinoGid = 0; try { e.setAutopilotPinnedTarget(0); } catch {} } }
        return;
      }
      if (fixado && agora - fixado.em >= FIXAR_ESPERA_MS) {
        evitar.set(fixado.gid, agora + FIXADO_EVITAR_MS);
        log('fixado ' + fixado.nome + ' sem golpe em 1,5 s; evitando por 15 s');
        fixado = null;
      }
      if (!fixado && ocioso >= OCIOSO_FIXAR_MS) {
        const mob = vivos.find((m) => !evitar.has(m.gid) && Number(m.distance) <= FARM_LONGE);
        if (mob) {
          try { e.setAutopilotPinnedTarget(mob.gid); pinoGid = mob.gid; fixado = { gid: mob.gid, nome: mob.name, em: agora }; log('parado ' + ocioso + ' ms sem bater: fixando o mais perto, ' + mob.name + ' a ' + mob.distance); } catch (err) { log('erro ao fixar: ' + String(err).slice(0, 80)); }
        }
      }
      return;
    }
    if (!exploraVazioDesde) exploraVazioDesde = agora;
    if (agora - exploraVazioDesde < 2000) return;
    if (agora - ultimoPasso < PASSO_EXPLORAR_MS) return;
    const pos = posicao(e);
    if (posAntesDoPasso && pos && pos.x === posAntesDoPasso.x && pos.y === posAntesDoPasso.y) {
      direcao += Math.PI / 2 + Math.random() * Math.PI / 2;
      log('nao andou; mudando de direcao');
    } else {
      direcao += (Math.random() - 0.5) * 0.6;
    }
    const canvas = canvasDoJogo(w);
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const raio = Math.min(r.width, r.height) * RAIO_EXPLORAR;
    const x = Math.round(r.left + r.width / 2 + Math.cos(direcao) * raio);
    const y = Math.round(r.top + r.height / 2 + Math.sin(direcao) * raio);
    ocupado = true;
    try {
      posAntesDoPasso = pos;
      ultimoPasso = agora;
      euDesliguei = Date.now();
      await clicarNoCanvas(w, canvas, x, y);
      log(`radar vazio: explorando (${pos ? `${pos.x},${pos.y}` : '?'})`);
    } finally {
      ocupado = false;
    }
  };

  let painel = null, botaoAsa = null;
  function atualizarPainel() {
    if (!document.body) return;
    if (!painel) {
      const cartao = fznCartaoYgg('Auto-hunt', 'v1.65', 'fzn-autohunt-ygg-posicao-v3', { right: '12px', bottom: '12px' }, 'fzn-encolhido-autohunt-ygg-v3');
      painel = document.createElement('button');
      painel.addEventListener('click', () => {
        cfg.ligado = !cfg.ligado;
        gravarJson(CHAVE_CFG, cfg);
        log(cfg.ligado ? 'ligado' : 'desligado');
      });
      const gv = fznGavetaYgg(cartao.corpo, 'fzn-autohunt-ygg-gaveta');
      painel.classList.add('fzn-ygg__liga');
      gv.barra.append(painel, gv.ajustes);
      const botaoNoks = document.createElement("button");
      botaoNoks.title = "NOKS: nao ataca MVP que outro jogador ja esta atacando (sem voce ou seu grupo ter batido primeiro); usa a asa e procura outro.";
      const pintarNoks = () => { botaoNoks.textContent = "NOKS"; botaoNoks.className = cfg.noks !== false ? "fzn-ygg--on" : "fzn-ygg--off"; };
      botaoNoks.addEventListener("click", () => { cfg.noks = cfg.noks === false; gravarJson(CHAVE_CFG, cfg); log("NOKS " + (cfg.noks ? "ligado" : "desligado")); pintarNoks(); });
      pintarNoks();
      const NOMES_ASA = { auto: 'Asa: Auto', gigante: 'Asa: Gigante', infinita: 'Asa: Infinita', comum: 'Asa: Comum', off: 'Asa: OFF' };
      const SEGUINTE = { auto: 'gigante', gigante: 'infinita', infinita: 'comum', comum: 'off', off: 'auto' };
      botaoAsa = document.createElement('button');
      botaoAsa.title = 'Qual Asa de Mosca usar com o radar vazio. Auto: Gigante > Infinita > Comum. As outras usam SO aquela (sem ela na mochila, explora clicando no chao). OFF: nunca usa asa, nem para fugir.';
      botaoAsa.addEventListener('click', () => {
        cfg.asa = SEGUINTE[cfg.asa] || 'gigante';
        gravarJson(CHAVE_CFG, cfg);
        asa.index = null; asa.lidaEm = 0; asa.pedidaEm = 0; asasVistas = '';
        log('asa escolhida: ' + cfg.asa);
        botaoAsa.textContent = NOMES_ASA[cfg.asa]; botaoAsa.className = cfg.asa === 'off' ? 'fzn-ygg--off' : '';
      });
      botaoAsa.textContent = NOMES_ASA[cfg.asa] || NOMES_ASA.auto;
      if (cfg.asa === 'off') botaoAsa.className = 'fzn-ygg--off';
      const botaoMvp = document.createElement('button');
      botaoMvp.title = 'Chefenia: prioriza o chefe em combate e nao usa asa enquanto o ataca. O teleporte sem chefe e configurado separadamente.';
      const pintarMvp = () => { botaoMvp.textContent = 'Chefenia'; botaoMvp.className = cfg.soMvp ? 'fzn-ygg--on' : 'fzn-ygg--off'; };
      botaoMvp.addEventListener('click', () => { cfg.soMvp = !cfg.soMvp; gravarJson(CHAVE_CFG, cfg); log('so MVP ' + (cfg.soMvp ? 'ligado' : 'desligado')); pintarMvp(); });
      pintarMvp();
      const botaoTeleporte = document.createElement('button');
      botaoTeleporte.title = 'Asa no modo Cheffenia: ON procura outro chefe com teleporte; OFF continua no mapa sem usar asa pelo Auto-hunt.';
      const pintarTeleporte = () => { botaoTeleporte.textContent = 'Asa Cheffenia'; botaoTeleporte.className = cfg.cheffeniaTeleporte ? 'fzn-ygg--on' : 'fzn-ygg--off'; };
      botaoTeleporte.addEventListener('click', () => { cfg.cheffeniaTeleporte = !cfg.cheffeniaTeleporte; gravarJson(CHAVE_CFG, cfg); log('asa Cheffenia ' + (cfg.cheffeniaTeleporte ? 'ligada' : 'desligada')); pintarTeleporte(); });
      pintarTeleporte();
      const botaoRecuperar = document.createElement('button');
      botaoRecuperar.title = 'Quando morrer com Poder Infernal na Cheffenia, volta ao ponto de salvamento, entra pelo Arauto em Prontera e religa o Autopilot.';
      const pintarRecuperar = () => { botaoRecuperar.textContent = 'Poder Infernal'; botaoRecuperar.className = cfg.cheffeniaRecuperar !== false ? 'fzn-ygg--on' : 'fzn-ygg--off'; };
      botaoRecuperar.addEventListener('click', () => { cfg.cheffeniaRecuperar = cfg.cheffeniaRecuperar === false; if (!cfg.cheffeniaRecuperar) { recuperacaoCheffPendente = false; window.top.__FZN_CHEFF_RECOVERY__ = { active: false }; } gravarJson(CHAVE_CFG, cfg); log('recuperacao Poder Infernal ' + (cfg.cheffeniaRecuperar ? 'ligada' : 'desligada')); pintarRecuperar(); });
      pintarRecuperar();
      const botaoBio4 = document.createElement('button');
      botaoBio4.title = 'Bio4: ao ver Cecil Damon ou Kathryne Keyron, Algoz com Furtividade F5 ligada usa a Furtividade (se nao estiver ligada). O alvo e escolhido pelo radar do autopilot: marque os outros mobs como Ignorar.';
      const pintarBio4 = () => { botaoBio4.textContent = 'Bio4'; botaoBio4.className = cfg.bio4 ? 'fzn-ygg--on' : 'fzn-ygg--off'; };
      botaoBio4.addEventListener('click', () => { cfg.bio4 = !cfg.bio4; gravarJson(CHAVE_CFG, cfg); log('bio4 ' + (cfg.bio4 ? 'ligado' : 'desligado')); pintarBio4(); });
      pintarBio4();
      const botaoPneuma = document.createElement('button');
      botaoPneuma.title = 'Pneuma: se o mob que estou atacando estiver dentro de uma Pneuma (imune a ataque a distancia), usa a Asa de Mosca na hora. Para Atirador de Elite e outras classes de longe.';
      const pintarPneuma = () => { botaoPneuma.textContent = 'Pneuma'; botaoPneuma.className = cfg.pneuma ? 'fzn-ygg--on' : 'fzn-ygg--off'; };
      botaoPneuma.addEventListener('click', () => { cfg.pneuma = !cfg.pneuma; gravarJson(CHAVE_CFG, cfg); log('pneuma ' + (cfg.pneuma ? 'ligado' : 'desligado')); pintarPneuma(); });
      pintarPneuma();
      const CLASSES = [['', 'Classe: ?'], ['algoz', 'Algoz'], ['mercenario', 'Mercenario'], ['desordeiro', 'Desordeiro'], ['cavaleiro', 'Cavaleiro'], ['templario', 'Templario'], ['bruxo', 'Bruxo'], ['sabio', 'Sabio'], ['sacerdote', 'Sacerdote'], ['monge', 'Monge'], ['cacador', 'Cacador'], ['bardo', 'Bardo/Odalisca'], ['ferreiro', 'Ferreiro'], ['alquimista', 'Alquimista'], ['taekwon', 'Taekwon/Mestre'], ['justiceiro', 'Justiceiro'], ['ninja', 'Ninja'], ['outra', 'Outra']];
      const selClasse = document.createElement('select');
      selClasse.title = 'Classe que esta jogando nesta conta';
      for (const [v, t] of CLASSES) { const o = document.createElement('option'); o.value = v; o.textContent = t; selClasse.appendChild(o); }
      selClasse.value = cfg.classe || '';
      const botaoFurt = document.createElement('button');
      botaoFurt.title = 'Tenho a Furtividade no atalho F5 (so vale para Algoz): no Bio4 ela sai ao ver Cecil/Kathryne.';
      const pintarFurt = () => {
        const valeAqui = cfg.classe === 'algoz';
        botaoFurt.style.display = valeAqui ? '' : 'none';
        botaoFurt.textContent = 'Furtividade F5';
        botaoFurt.className = cfg.furtividade ? 'fzn-ygg--on' : 'fzn-ygg--off';
      };
      selClasse.addEventListener('change', () => { cfg.classe = selClasse.value; gravarJson(CHAVE_CFG, cfg); log('classe: ' + (cfg.classe || '?')); pintarFurt(); });
      botaoFurt.addEventListener('click', () => { cfg.furtividade = !cfg.furtividade; gravarJson(CHAVE_CFG, cfg); log('furtividade F5 ' + (cfg.furtividade ? 'ligada' : 'desligada')); pintarFurt(); });
      pintarFurt();
      gv.grupo('Opcoes', botaoNoks, botaoMvp, botaoTeleporte, botaoRecuperar, botaoBio4, botaoPneuma, botaoAsa);
      gv.grupo('Classe', selClasse, botaoFurt);
      cartao.caixa.style.maxWidth = 'min(420px, 95vw)';
      linhaStatus = gv.status;
      linhaStatus.dataset.clica = '1';
      linhaStatus.title = 'Clique para ver a contagem de MVPs e mortes';
      montarContagem(cartao.corpo, gv);
      setInterval(pintarStatus, 2000);
    }
    painel.textContent = cfg.ligado ? '\u25CF ON' : '\u25CB OFF';
    pintarStatus();
    painel.className = cfg.ligado ? 'fzn-ygg--on' : 'fzn-ygg--off';
    painel.title = lerJson(CHAVE_LOG, []).slice(-12).join('\n') || 'sem eventos ainda';
  }

  try { atualizarPainel(); } catch (err) { mostrarErro('painel', err); }
  setInterval(() => { ciclo().catch((err) => log(`erro: ${String(err).slice(0, 100)}`)); }, 100);
  } catch (err) { mostrarErro('inicio', err); }
})();
