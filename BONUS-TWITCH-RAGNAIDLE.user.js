// ==UserScript==
// @name         RagnaIdle — bônus Twitch automático (só chat, sem vídeo)
// @namespace    fzn-idle-hub
// @version      1.0
// @description  Entra no chat das Lives Oficiais que estão dando bônus e sai quando acabam. Sem janela e sem vídeo: consumo quase zero.
// @match        https://www.ragnaidle.com.br/*
// @match        https://ragnaidle.com.br/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// COMO FUNCIONA (03/11/2026) — adaptado do BONUS-TWITCH-POKEIDLE:
//
// As Lives Oficiais do RagnaIdle dao +XP, +drop e +aparicao de MVP enquanto
// voce estiver no CHAT de uma live oficial, logado na Twitch vinculada no jogo.
// Quem te acha e o bot do jogo, que e moderador do canal e le a lista de quem
// esta no chat.
//
// Este script so LE a resposta de `live_estado` que o jogo ja pede ao
// servidor (quais canais estao no ar, quais contam para o bonus e em quais o
// bot ja te achou) e pede ao Hub para entrar no chat dessas lives. O Hub
// conecta pelo protocolo de chat da Twitch: sem janela, sem video. Quando nao
// ha live, a conexao fecha.
//
// Requisitos: Hub com suporte ao RagnaIdle na presenca da Twitch, e a conta do
// Hub logada na Twitch com a mesma conta vinculada no jogo. Se nao estiver, o
// painel mostra o botao "Entrar na Twitch".

(() => {
  'use strict';

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

  // ARRASTAR pelo topo (padrao fzN): posicao salva e presa dentro da janela.
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
    try { const p = JSON.parse(localStorage.getItem(chave) || 'null'); if (p && Number.isFinite(p.x) && (Number.isFinite(p.b) || Number.isFinite(p.y))) aplicar(p); } catch {}
    let apertado = false, dx = 0, dy = 0;
    alca.style.cursor = 'grab';
    alca.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.target.closest?.('button,select,input')) return;
      const r = painel.getBoundingClientRect();
      dx = ev.clientX - r.left; dy = ev.clientY - r.top; apertado = true;
      try { alca.setPointerCapture(ev.pointerId); } catch {}
      ev.preventDefault();
    });
    alca.addEventListener('pointermove', (ev) => { if (apertado) aplicar({ x: ev.clientX - dx, y: ev.clientY - dy }); });
    const soltar = (ev) => {
      if (!apertado) return;
      apertado = false;
      try { alca.releasePointerCapture(ev.pointerId); } catch {}
      const r = painel.getBoundingClientRect();
      const p = aplicar({ x: r.left, y: r.top });
      try { localStorage.setItem(chave, JSON.stringify(p)); } catch {}
    };
    alca.addEventListener('pointerup', soltar);
    alca.addEventListener('pointercancel', soltar);

    // NUNCA FORA DA TELA: maior que a tela ganha rolagem; janela redimensionada
    // ou painel que cresceu alem do topo e trazido de volta.
    painel.style.maxHeight = 'calc(100vh - 16px)';
    painel.style.overflowY = 'auto';
    const manterNaTela = () => {
      const r = painel.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.top < 0 || r.right > window.innerWidth + 1 || r.left < 0 || r.bottom > window.innerHeight + 1) {
        aplicar({ x: r.left, b: window.innerHeight - r.bottom });
      }
    };
    try { new ResizeObserver(() => requestAnimationFrame(manterNaTela)).observe(painel); } catch {}
    window.addEventListener('resize', manterNaTela);
  };

  if (window.__FZN_BONUS_TWITCH_RAGNA__) return;

  const PEDIDO_MS = 2 * 60_000;
  const CHAVE = 'fzn.bonusTwitchRagna';
  const ponte = () => window.__FZN_USER_SCRIPT_BRIDGE__;

  const lerPref = () => {
    try { return { ligado: true, limite: 20, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; } catch { return { ligado: true, limite: 20 }; }
  };
  const gravarPref = (p) => { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch {} };

  const st = { live: undefined, resposta: null, pedidoEm: 0, pref: lerPref() };
  Object.defineProperty(window, '__FZN_BONUS_TWITCH_RAGNA__', { value: st });

  // ---- leitura de `live_estado` (so leitura; o jogo recebe a mesma resposta)
  //
  // O jogo consulta sozinho a RPC `live_estado` do Supabase de tempos em
  // tempos. A resposta traz tudo que o script precisa:
  //   { aberto, bonus_ligado, canais:[{id, login, plataforma, ao_vivo, conta}],
  //     assistindo:[id do canal], vinculos:[{plataforma:'twitch', login}] }
  // `conta` = a live conta para o bonus agora. `assistindo` = em quais o bot
  // do jogo ja te achou no chat.
  const fetchOriginal = window.fetch;
  if (typeof fetchOriginal === 'function') {
    window.fetch = function (entrada, init) {
      const promessa = fetchOriginal.apply(this, arguments);
      try {
        const url = typeof entrada === 'string' ? entrada : entrada?.url || String(entrada);
        if (/\/rest\/v1\/rpc\/live_estado\b/.test(url)) {
          promessa.then((resp) => {
            if (!resp?.ok) return;
            resp.clone().json().then((dados) => {
              if (dados && typeof dados === 'object') { st.live = dados; agendarPedido(3000); }
            }).catch(() => {});
          }).catch(() => {});
        }
      } catch {}
      return promessa;
    };
  }

  // ---- o que pedir
  const min = (x) => String(x ?? '').toLowerCase();
  const loginVinculado = () => min((st.live?.vinculos ?? []).find((v) => v?.plataforma === 'twitch')?.login);
  function canaisDesejados() {
    const lv = st.live;
    if (!lv?.aberto || !lv.bonus_ligado || !loginVinculado()) return [];
    const jaEstou = new Set(lv.assistindo ?? []);
    const noAr = (lv.canais ?? []).filter((c) => c?.plataforma === 'twitch' && c.ao_vivo && c.conta && c.login);
    noAr.sort((a, b) => Number(jaEstou.has(b.id)) - Number(jaEstou.has(a.id)));
    return noAr.map((c) => min(c.login)).slice(0, Math.max(1, Number(st.pref.limite) || 20));
  }

  let timerPedido = null;
  function agendarPedido(ms) {
    if (timerPedido) clearTimeout(timerPedido);
    timerPedido = setTimeout(pedir, ms);
  }
  async function pedir() {
    timerPedido = null;
    const p = ponte();
    if (!p?.twitchSync) { st.resposta = { status: 'sem-hub', canais: [] }; pintar(); return; }
    if (st.live === undefined) { pintar(); agendarPedido(PEDIDO_MS); return; } // jogo ainda nao consultou
    try {
      st.resposta = await p.twitchSync({ ligado: st.pref.ligado, login: loginVinculado(), canais: canaisDesejados() });
    } catch {
      st.resposta = { status: 'erro', canais: [] };
    }
    st.pedidoEm = Date.now();
    pintar();
    agendarPedido(PEDIDO_MS);
  }

  // ---- painel
  const TEXTO = {
    desligado: 'sem live com bônus no ar',
    novo: 'conectando…', conectando: 'conectando…', reconectando: 'reconectando…',
    conectado: 'no chat',
    'sem-login': 'conta do Hub não está logada na Twitch',
    'conta-diferente': 'logada em outra conta da Twitch',
    'login-recusado': 'a Twitch recusou o login — entre de novo',
    'jogo-nao-suportado': 'Hub sem suporte ao RagnaIdle (atualize o Hub)',
    'sem-hub': 'Hub sem suporte (atualize o Hub)',
    erro: 'erro ao falar com o Hub'
  };
  let raiz = null;
  let corpo = null;
  function pintar() {
    if (!document.body) return;
    if (!raiz) {
      raiz = document.createElement('div');
      raiz.id = 'fzn-bonus-twitch-ragna';
      raiz.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483000;font:12px system-ui,sans-serif;color:#eee;background:#18181bee;border:1px solid #9146ff;border-radius:8px;min-width:230px';
      raiz.innerHTML = '<div data-alca style="padding:5px 8px;border-bottom:1px solid #9146ff55;user-select:none"></div><div data-corpo style="padding:8px"></div>';
      corpo = raiz.querySelector('[data-corpo]');
      document.body.appendChild(raiz);
      fznArrastavel(raiz, raiz.querySelector('[data-alca]'), 'fzn.bonusTwitchRagna.posicao');
      fznEncolhivel(raiz, 'fzn.bonusTwitchRagna.encolher');
      raiz.addEventListener('click', aoClicar);
      raiz.addEventListener('change', aoMudar);
    }
    const r = st.resposta;
    const lv = st.live;
    const canais = r?.canais ?? [];
    const idPorLogin = new Map((lv?.canais ?? []).map((c) => [min(c?.login), c?.id]));
    const achou = new Set(lv?.assistindo ?? []);
    const cor = !st.pref.ligado ? '#777' : r?.status === 'conectado' ? '#9146ff' : ['sem-login', 'conta-diferente', 'login-recusado', 'erro', 'sem-hub', 'jogo-nao-suportado'].includes(r?.status) ? '#e5534b' : '#555';
    raiz.querySelector('[data-alca]').innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cor};margin-right:6px"></span><b>Bônus Twitch</b> · ${canais.length} chat(s)`;
    const linhas = canais.map((c) => `<div>• ${c}${achou.has(idPorLogin.get(c)) ? ' <span style="color:#3fb950">✓ bônus valendo</span>' : ' <span style="color:#aaa">aguardando o bot</span>'}</div>`).join('');
    const precisaLogin = ['sem-login', 'login-recusado', 'conta-diferente'].includes(r?.status);
    const aviso = lv === undefined ? 'aguardando o jogo consultar as lives'
      : !lv.aberto ? 'Lives Oficiais fechadas no momento'
      : !lv.bonus_ligado ? 'bônus das lives ainda não está valendo'
      : !loginVinculado() ? 'vincule a Twitch no jogo (Lives Oficiais)'
      : '';
    corpo.innerHTML = `
        <label style="display:block;margin:0 0 6px"><input type="checkbox" data-a="ligado" ${st.pref.ligado ? 'checked' : ''}> ligado</label>
        <label style="display:block;margin-bottom:6px">máximo de lives:
          <select data-a="limite">${[1, 2, 3, 5, 10, 20].map((n) => `<option ${Number(st.pref.limite) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div>Vinculada no jogo: <b>${loginVinculado() || '—'}</b></div>
        <div>Estado: ${TEXTO[r?.status] || r?.status || 'aguardando o jogo'}${r?.logado ? ` (${r.logado})` : ''}</div>
        ${aviso ? `<div style="color:#e3b341">${aviso}</div>` : ''}
        ${linhas || '<div style="color:#aaa">nenhum chat aberto</div>'}
        ${precisaLogin ? '<button data-a="login" style="margin-top:6px">Entrar na Twitch</button>' : ''}
        <button data-a="agora" style="margin-top:6px">Verificar agora</button>`;
  }
  function aoClicar(ev) {
    const a = ev.target?.dataset?.a;
    if (a === 'login') ponte()?.twitchLogin?.();
    else if (a === 'agora') agendarPedido(0);
  }
  function aoMudar(ev) {
    const a = ev.target?.dataset?.a;
    if (a === 'ligado') st.pref.ligado = ev.target.checked;
    else if (a === 'limite') st.pref.limite = Number(ev.target.value) || 20;
    else return;
    gravarPref(st.pref);
    agendarPedido(0);
  }

  // Primeiro pedido depois que o jogo carregar; depois a cada 2 min e a cada
  // nova resposta de `live_estado`.
  const iniciar = () => { pintar(); agendarPedido(5000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
