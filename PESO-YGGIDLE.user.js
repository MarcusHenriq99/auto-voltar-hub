// ==UserScript==
// @name         Ygg Idle — leitor de peso (o que pesa na mochila)
// @namespace    fzn-idle-hub
// @version      1.2
// @description  Lista os itens da mochila (e equipados) do mais pesado ao mais leve, com o peso de cada um tirado da Wiki do Ygg.
// @match        https://jogo.yggidle.com.br/*
// @noframes
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      yggidle.com.br
// @grant        GM_registerMenuCommand
// ==/UserScript==

// COMO FUNCIONA (05/11/2026):
// O jogo nao manda o peso de cada item, so o total no HUD ("Peso X / Y").
// O script le a mochila pelo proprio jogo (__elragUI.updateInventorySnapshot,
// igual ao Auto-voltar), busca o peso UNITARIO de cada item na Wiki publica
// (yggidle.com.br/wiki/itens/<id>, campo "Peso") e guarda em cache. Peso do
// item = quantidade x peso unitario. A soma deve bater com o HUD; se nao
// bater, a diferenca aparece no painel (item sem ficha na wiki, por exemplo).
// So leitura: nao move, vende nem usa nada.

(() => {
  'use strict';
  if (window.__FZN_PESO_YGG__) return;
  window.__FZN_PESO_YGG__ = true;

  const CACHE = 'pesosWiki';
  const st = { mochila: null, equip: null, seq: 0, lendo: false, erro: '' };

  // ENCOLHER (padrao fzN em todos os scripts): um "–" no canto do painel o
  // transforma numa bolinha de 14px quase transparente; clique na bolinha
  // reabre. O estado e a posicao ficam em localStorage. O "–" e a bolinha
  // sao elementos a parte (o painel pode reescrever o proprio conteudo) e o
  // painel some por atributo, sem brigar com o display que o script controla.
  // fzN REDIMENSIONAVEL (17/10/2026, pedido do usuario): alca no canto inferior
  // esquerdo (v2, usuario: em cima ficava estranho); o canto superior direito
  // fica parado. Arrastar muda largura/altura; o tamanho fica salvo
  // por janela e por conta; dois cliques na alca voltam ao tamanho automatico.
  // Conteudo que nao couber rola dentro da janela.
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
    const ancora = () => {
      const cs = win.getComputedStyle(painel);
      const porBaixo = (painel.style.top === '' || painel.style.top === 'auto') && cs.bottom !== 'auto';
      const pelaDireita = (painel.style.left === '' || painel.style.left === 'auto') && cs.right !== 'auto';
      return { porBaixo, pelaDireita };
    };
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

  // ---- VISUAL fzN (padrao dos scripts do Ygg, igual ao Auto-voltar) ----

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

    // NUNCA FORA DA TELA: maior que a tela ganha rolagem; janela redimensionada
    // ou painel que cresceu alem do topo e trazido de volta.
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
  // Cartao fzN: topo arrastavel com titulo e versao; o conteudo vai em .corpo.
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
    caixa.append(topo, corpo);
    document.body.appendChild(caixa);
    fznArrastavelYgg(caixa, topo, chavePos);
    fznEncolhivel(caixa, chaveEncolher);
    return { caixa, topo, corpo };
  };
  // Sub-janela (menu) com o mesmo tema, aberta logo acima do cartao.
  const fznSubjanelaYgg = (el, cartao, largura) => {
    fznTemaYgg();
    el.className = 'fzn-ygg';
    const r = cartao?.getBoundingClientRect();
    const left = r ? Math.min(Math.max(0, r.left), Math.max(0, window.innerWidth - largura - 8)) : 12;
    const bottom = r ? Math.max(8, window.innerHeight - r.top + 6) : 60;
    // Sempre ACIMA do cartao, e nunca passando do topo da tela.
    const maxH = Math.max(120, window.innerHeight - bottom - 8);
    Object.assign(el.style, { left: left + 'px', bottom: bottom + 'px', top: 'auto', right: 'auto', zIndex: 2147483001, width: largura + 'px', maxWidth: '95vw', maxHeight: maxH + 'px', overflow: 'auto', padding: '10px 12px' });
  };

  const pesos = GM_getValue(CACHE, {}) || {};
  const buscando = new Map();

  const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  function quadro() {
    for (const f of document.querySelectorAll('iframe')) {
      try { const w = f.contentWindow; if (w && w.__elragUI && w.__elragEngine) return w; } catch {}
    }
    return null;
  }

  let ganchoEm = null;
  function enganchar() {
    const w = quadro();
    if (!w) return null;
    const ui = w.__elragUI;
    for (const [metodo, chave] of [['updateInventorySnapshot', 'mochila'], ['updateEquipmentSnapshot', 'equip']]) {
      const original = ui[metodo];
      if (typeof original !== 'function' || original.__fznPeso) continue;
      const g = function (snap) { st[chave] = snap; st.seq++; return original.apply(this, arguments); };
      g.__fznPeso = true;
      ui[metodo] = g;
    }
    ganchoEm = w;
    return w;
  }

  // Junta todos os objetos com itemId (a mochila chega em abas e pedacos).
  function itensDe(raiz, equipado) {
    const out = [], fila = [raiz], vistos = new Set();
    while (fila.length && vistos.size < 5000) {
      const o = fila.shift();
      if (!o || typeof o !== 'object' || vistos.has(o)) continue;
      vistos.add(o);
      const nome = o.name ?? o.itemName ?? o.label;
      const id = o.itemId ?? o.nameid ?? o.itemID;
      if (typeof nome === 'string' && (id !== undefined || equipado === 'bolsa')) {
        const qtd = Number(o.count ?? o.amount ?? o.quantity ?? o.qty ?? 1) || 1;
        out.push({ id: id !== undefined ? Number(id) : null, nome, qtd, index: o.index, equipado });
        continue;
      }
      for (const v of Array.isArray(o) ? o : Object.values(o)) if (v && typeof v === 'object') fila.push(v);
    }
    return out;
  }

  function pesoDoHud(w) {
    const txt = w?.document?.body?.innerText || '';
    let m = /Peso\s*:?\s*([\d.]+)\s*\/\s*([\d.]+)/i.exec(txt);
    if (!m) {
      for (const el of w?.document?.querySelectorAll('[title], [aria-label]') || []) {
        const r = (el.getAttribute('title') || el.getAttribute('aria-label') || '').trim();
        if (!/^peso/i.test(r)) continue;
        m = /([\d.]+)\s*\/\s*([\d.]+)/.exec(el.textContent || r);
        if (m) break;
      }
    }
    return m ? { atual: Number(m[1].replace(/\./g, '')), max: Number(m[2].replace(/\./g, '')) } : null;
  }

  // Peso unitario pela Wiki. Formatos vistos: "Peso: </span><span ...>0.1" e
  // ">Peso</p><p ...>0,1".
  function pesoDaWiki(id) {
    if (pesos[id] !== undefined) return Promise.resolve(pesos[id]);
    if (buscando.has(id)) return buscando.get(id);
    const baixar = (url) => new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 15000,
        onload: (r) => resolve(String(r.responseText || '')),
        onerror: () => resolve(''), ontimeout: () => resolve(''),
      });
    });
    const extrair = (html) => {
      const m = />\s*Peso\s*<\/p>\s*<p[^>]*>\s*([\d.,]+)/i.exec(html) || /Peso:\s*<\/span>\s*<span[^>]*>\s*([\d.,]+)/i.exec(html);
      const v = m ? Number(m[1].replace(',', '.')) : NaN;
      return Number.isFinite(v) ? v : null;
    };
    const p = (async () => {
      let html = await baixar(`https://yggidle.com.br/wiki/itens/${id}`);
      let v = extrair(html);
      // /wiki/itens/<id> redireciona pelo navegador (NEXT_REDIRECT) para /wiki/itens/<id>/<nome>.
      const red = v === null && new RegExp(`NEXT_REDIRECT;replace;(/wiki/itens/${id}/[^;"\\\\]+);`).exec(html);
      if (red) { html = await baixar('https://yggidle.com.br' + red[1]); v = extrair(html); }
      if (v !== null) { pesos[id] = v; GM_setValue(CACHE, pesos); }
      return v;
    })().finally(() => buscando.delete(id));
    buscando.set(id, p);
    return p;
  }

  let linhas = [];
  async function ler() {
    if (st.lendo) return;
    st.lendo = true; st.erro = '';
    pintar();
    try {
      const w = enganchar();
      if (!w) { st.erro = 'jogo ainda não carregou (entre com o personagem)'; return; }
      const antes = st.seq;
      try { w.__elragEngine.requestInventorySnapshot(); } catch {}
      try { w.__elragEngine.requestEquipmentSnapshot(); } catch {}
      // A mochila chega em pedacos: espera ficar 800 ms sem novidade.
      const fim = Date.now() + 5000;
      let visto = st.seq, quieto = Date.now();
      while (Date.now() < fim && (st.seq === antes || Date.now() - quieto < 800)) {
        await esperar(100);
        if (st.seq !== visto) { visto = st.seq; quieto = Date.now(); }
      }
      if (!st.mochila) { st.erro = 'o jogo não respondeu a mochila'; return; }
      const daMochila = itensDe(st.mochila, false);
      const naMochila = new Set(daMochila.map((i) => i.index).filter((x) => x !== undefined));
      const doEquip = itensDe(st.equip, true).filter((i) => i.index === undefined || !naMochila.has(i.index));
      // v1.2: bolsa de consumiveis (ALT+B). Fica fora da mochila e tambem pesa.
      let bolsa = [];
      try { bolsa = itensDe(w.__elragEngine.getConsumablePouchSnapshot?.(), 'bolsa'); } catch {}
      const idPorNome = new Map(daMochila.map((i) => [normalizar(i.nome), i.id]));
      bolsa = bolsa.map((i) => ({ ...i, id: i.id ?? idPorNome.get(normalizar(i.nome)) ?? null })).filter((i) => i.qtd > 0);
      st.bolsaLida = bolsa.length;
      // Agrupa por item (pilhas iguais somam).
      const porId = new Map();
      for (const i of [...daMochila, ...doEquip, ...bolsa]) {
        const k = (i.id ?? normalizar(i.nome)) + (i.equipado === 'bolsa' ? ':b' : i.equipado ? ':e' : '');
        const a = porId.get(k);
        if (a) a.qtd += i.qtd; else porId.set(k, { ...i });
      }
      const lista = [...porId.values()];
      // Busca pesos que faltam, 4 de cada vez.
      const faltam = [...new Set(lista.map((i) => i.id).filter((id) => id != null && pesos[id] === undefined))];
      for (let k = 0; k < faltam.length; k += 4) {
        await Promise.all(faltam.slice(k, k + 4).map(pesoDaWiki));
        pintarProgresso(Math.min(k + 4, faltam.length), faltam.length);
      }
      linhas = lista.map((i) => ({ ...i, unit: pesos[i.id] ?? null, total: pesos[i.id] != null ? pesos[i.id] * i.qtd : null }))
        .sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
    } finally {
      st.lendo = false;
      pintar();
    }
  }

  // ---- painel (cartao padrao fzN dos scripts do Ygg)
  let cartao = null, botaoLer = null, statusEl = null, tabela = null;
  function montar() {
    if (cartao || !document.body) return;
    fznTemaYgg();
    if (!document.getElementById('fzn-peso-ygg-css')) {
      const css = document.createElement('style');
      css.id = 'fzn-peso-ygg-css';
      css.textContent = `
        .fzn-peso__tab { width:100%; max-height:46vh; overflow:auto; margin-top:2px; }
        .fzn-peso__tab table { width:100%; border-collapse:collapse; font-size:11px; font-variant-numeric:tabular-nums; }
        .fzn-peso__tab th { position:sticky; top:0; background:rgba(18,22,30,.98); color:#8fa3b3; font-weight:600; font-size:10px;
          text-transform:uppercase; letter-spacing:.05em; text-align:right; padding:2px 4px; }
        .fzn-peso__tab th:first-child, .fzn-peso__tab td:first-child { text-align:left; }
        .fzn-peso__tab td { text-align:right; padding:2px 4px; border-top:1px solid rgba(120,200,255,.1); }
        .fzn-peso__tab td.un { color:#8fa3b3; }
        .fzn-peso__tab td.alto { color:#ffb38a; font-weight:700; }
        .fzn-peso__nota { width:100%; font-size:10px; color:#8fa3b3; }
        .fzn-peso__aviso { width:100%; font-size:11px; color:#ffb38a; }
      `;
      (document.head || document.documentElement).appendChild(css);
    }
    const c = fznCartaoYgg('Peso da mochila', 'v1.2', 'fzn-peso-ygg-posicao', { right: '12px', bottom: '260px', width: '330px' }, 'fzn-encolhido-peso-ygg');
    cartao = c.caixa;
    const g = fznGavetaYgg(c.corpo, 'fzn-peso-ygg-gaveta');
    botaoLer = document.createElement('button');
    botaoLer.className = 'fzn-ygg__liga fzn-ygg--on';
    botaoLer.textContent = '⚖ Ler peso';
    botaoLer.title = 'Ler a mochila e calcular o peso de cada item';
    botaoLer.addEventListener('click', () => void ler());
    g.barra.appendChild(botaoLer);
    g.ajustes.remove();
    statusEl = g.status;
    tabela = document.createElement('div');
    tabela.style.width = '100%';
    c.corpo.appendChild(tabela);
    for (const t of ['keydown', 'keyup', 'keypress']) cartao.addEventListener(t, (e) => e.stopPropagation());
  }

  function pintarProgresso(feito, total) {
    if (statusEl) statusEl.textContent = `Buscando peso na Wiki: ${feito}/${total}…`;
  }

  function pintar() {
    montar();
    if (!cartao) return;
    botaoLer.disabled = st.lendo;
    botaoLer.textContent = st.lendo ? 'Lendo…' : '⚖ Ler peso';
    if (st.lendo && !linhas.length) { statusEl.textContent = 'Lendo a mochila…'; tabela.innerHTML = ''; return; }
    if (st.erro) { statusEl.textContent = ''; tabela.innerHTML = `<div class="fzn-peso__aviso">${esc(st.erro)}</div>`; return; }
    if (!linhas.length) { statusEl.textContent = 'Clique em Ler peso com o personagem no jogo.'; tabela.innerHTML = ''; return; }
    const soma = linhas.reduce((s, l) => s + (l.total || 0), 0);
    const hud = pesoDoHud(ganchoEm);
    const semPeso = linhas.filter((l) => l.unit == null);
    statusEl.textContent = hud
      ? `Itens: ${fmt(soma)} · HUD: ${fmt(hud.atual)} / ${fmt(hud.max)} (${fmt(hud.atual / hud.max * 100)}%)`
      : `Soma dos itens: ${fmt(soma)}`;
    let aviso = '';
    if (hud && Math.abs(hud.atual - soma) >= 1) {
      aviso = `<div class="fzn-peso__aviso">Diferença de ${fmt(hud.atual - soma)} entre o HUD e a soma${semPeso.length ? ' (itens com "?" não têm peso na Wiki)' : ''}.</div>`;
    }
    const base = hud?.atual || soma || 1;
    const tr = linhas.map((l) => {
      const pct = l.total != null ? l.total / base * 100 : 0;
      return `<tr><td>${esc(l.nome)}${l.equipado === 'bolsa' ? ' <span title="bolsa de consumíveis (ALT+B)" style="color:#78c8ff">B</span>' : l.equipado ? ' <span title="equipado" style="color:#6fe38a">⚔</span>' : ''}</td>
        <td>${l.qtd.toLocaleString('pt-BR')}</td><td class="un">${l.unit == null ? '?' : fmt(l.unit)}</td>
        <td><b>${l.total == null ? '?' : fmt(l.total)}</b></td><td class="${pct >= 10 ? 'alto' : 'un'}">${l.total == null ? '' : fmt(pct) + '%'}</td></tr>`;
    }).join('');
    tabela.innerHTML = aviso + `<div class="fzn-peso__tab"><table><tr><th>Item</th><th>Qtd</th><th>Un.</th><th>Total</th><th>%</th></tr>${tr}</table></div>
      <div class="fzn-peso__nota">Peso unitário da Wiki do Ygg. ⚔ = equipado, B = bolsa ALT+B (também pesam).</div>`;
  }

  try { GM_registerMenuCommand('Ler peso da mochila', () => void ler()); } catch {}
  const iniciar = () => { pintar(); setInterval(enganchar, 5000); };
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar, { once: true });
})();
