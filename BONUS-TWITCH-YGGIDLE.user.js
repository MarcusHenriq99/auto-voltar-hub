// ==UserScript==
// @name         Ygg Idle — bônus Twitch automático (só chat, sem vídeo)
// @namespace    fzn-idle-hub
// @version      1.1
// @description  Entra no chat das Lives Parceiras do Ygg que estão no ar e sai quando acabam. Sem janela e sem vídeo: consumo quase zero.
// @match        https://jogo.yggidle.com.br/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// COMO FUNCIONA (04/11/2026) — adaptado do BONUS-TWITCH-RAGNAIDLE:
//
// Lives Parceiras do Ygg: vincule a Twitch no site, escolha em qual conta do
// jogo o bonus cai e assista, LOGADO, a live de um parceiro oficial com
// "YggIdle" no titulo. Em ate 1 minuto o bonus liga e vale enquanto o
// personagem estiver online (nao vale no Farm AFK). Ate 5 lives somam:
// 1 live = +10% XP / +3% drop; 5 lives = +15% XP / +5% drop.
//
// Este script so LE a lista de canais que o servidor do jogo manda (quais
// estao ao vivo e dao bonus, e o login da Twitch vinculado) e pede ao Hub para
// entrar no chat dessas lives. O Hub conecta pelo protocolo de chat da Twitch:
// sem janela, sem video. Quando nao ha live, a conexao fecha.
//
// Requisitos: conta do Hub logada na Twitch com a MESMA conta vinculada no
// Ygg. Se nao estiver, o painel mostra o botao "Entrar na Twitch".

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

  if (window.__FZN_BONUS_TWITCH_YGG__) return;

  const PEDIDO_MS = 2 * 60_000;
  const CHAVE = 'fzn.bonusTwitchYgg';
  const ponte = () => window.__FZN_USER_SCRIPT_BRIDGE__;

  const lerPref = () => {
    // `bloqueadas`: logins em que o bot nunca entra, mesmo no ar e com bonus.
    try {
      const p = { ligado: true, limite: 5, bloqueadas: [], ...JSON.parse(localStorage.getItem(CHAVE) || '{}') };
      if (!Array.isArray(p.bloqueadas)) p.bloqueadas = [];
      return p;
    } catch { return { ligado: true, limite: 5, bloqueadas: [] }; }
  };
  const gravarPref = (p) => { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch {} };

  const st = { lives: undefined, resposta: null, pedidoEm: 0, pref: lerPref() };
  Object.defineProperty(window, '__FZN_BONUS_TWITCH_YGG__', { value: st });

  // ---- leitura das Lives Parceiras (so leitura)
  //
  // O jogo roda num iframe same-origin (applications/api/api.html). Quando o
  // servidor responde ao pedido de lives, o motor chama
  // `__elragUI.openLives(payload)` com:
  //   { estado (0 desligada, 1 ligada, 2 indisponivel), canais:[{ login, name,
  //     live, bonus, viewers }], livesAgora, expBp, dropBp, vinculado,
  //     twitchLogin, escolhida }
  // O script embrulha essa funcao para COPIAR o payload e repassa tudo igual.
  //
  // Para pedir sem abrir a janela: `__elragEngine.requestOpenLives()` com a
  // janela fechada cai no caminho "silencioso" do proprio jogo (livesBridge:
  // `silencioso = !open && pedido !== "janela"`) — e o mesmo pedido que o
  // jogo faz sozinho para saber se as lives estao ligadas.
  function quadroDoJogo() {
    for (const f of document.querySelectorAll('iframe')) {
      try {
        const w = f.contentWindow;
        if (w && w.__elragUI && w.__elragEngine) return w;
      } catch {}
    }
    return null;
  }

  let embrulhado = null;
  function embrulhar() {
    const w = quadroDoJogo();
    if (!w || typeof w.__elragUI.openLives !== 'function') return null;
    if (embrulhado === w && w.__elragUI.openLives.__fzn) return w;
    const original = w.__elragUI.openLives;
    const novo = function (payload) {
      try {
        if (payload && typeof payload === 'object') {
          st.lives = JSON.parse(JSON.stringify(payload));
          agendarPedido(2000);
        }
      } catch {}
      return original.apply(this, arguments);
    };
    novo.__fzn = true;
    w.__elragUI.openLives = novo;
    embrulhado = w;
    return w;
  }

  function pedirLivesAoJogo() {
    const w = embrulhar();
    try { w?.__elragEngine?.requestOpenLives?.(); } catch {}
  }

  // ---- o que pedir
  const min = (x) => String(x ?? '').toLowerCase();
  const ligadas = () => st.lives && Number(st.lives.estado) === 1;
  const loginVinculado = () => (st.lives?.vinculado ? min(st.lives.twitchLogin) : '');
  function canaisDesejados() {
    if (!ligadas() || !loginVinculado()) return [];
    return (st.lives.canais ?? [])
      .filter((c) => c && c.live && c.bonus !== false && /^[a-z0-9_]{1,25}$/i.test(String(c.login || '')))
      .map((c) => min(c.login))
      .filter((login) => !st.pref.bloqueadas.includes(login))
      .slice(0, Math.max(1, Number(st.pref.limite) || 5));
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
    if (st.lives === undefined) { pintar(); agendarPedido(15_000); return; } // jogo ainda nao respondeu
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
    desligado: 'sem live parceira no ar',
    novo: 'conectando…', conectando: 'conectando…', reconectando: 'reconectando…',
    conectado: 'no chat',
    'sem-login': 'conta do Hub não está logada na Twitch',
    'conta-diferente': 'logada em outra conta da Twitch',
    'login-recusado': 'a Twitch recusou o login — entre de novo',
    'jogo-nao-suportado': 'Hub sem suporte (atualize o Hub)',
    'sem-hub': 'Hub sem suporte (atualize o Hub)',
    erro: 'erro ao falar com o Hub'
  };
  let raiz = null;
  let corpo = null;
  function pintar() {
    if (!document.body) return;
    if (!raiz) {
      raiz = document.createElement('div');
      raiz.id = 'fzn-bonus-twitch-ygg';
      raiz.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483000;font:12px system-ui,sans-serif;color:#eee;background:#18181bee;border:1px solid #9146ff;border-radius:8px;min-width:230px';
      raiz.innerHTML = '<div data-alca style="padding:5px 8px;border-bottom:1px solid #9146ff55;user-select:none"></div><div data-corpo style="padding:8px"></div>';
      corpo = raiz.querySelector('[data-corpo]');
      document.body.appendChild(raiz);
      fznArrastavel(raiz, raiz.querySelector('[data-alca]'), 'fzn.bonusTwitchYgg.posicao');
      fznEncolhivel(raiz, 'fzn.bonusTwitchYgg.encolher');
      raiz.addEventListener('click', aoClicar);
      raiz.addEventListener('change', aoMudar);
      // O jogo escuta teclado: o que se mexe no painel nao vira atalho dele.
      for (const tipo of ['keydown', 'keyup', 'keypress']) raiz.addEventListener(tipo, (e) => e.stopPropagation());
    }
    const r = st.resposta;
    const lv = st.lives;
    const canais = r?.canais ?? [];
    const agora = Number(lv?.livesAgora) || 0;
    const cor = !st.pref.ligado ? '#777' : r?.status === 'conectado' ? '#9146ff' : ['sem-login', 'conta-diferente', 'login-recusado', 'erro', 'sem-hub', 'jogo-nao-suportado'].includes(r?.status) ? '#e5534b' : '#555';
    raiz.querySelector('[data-alca]').innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cor};margin-right:6px"></span><b>Bônus Twitch</b> · ${canais.length} chat(s)`;
    const linhas = canais.map((c) => `<div>• ${c}</div>`).join('');
    const precisaLogin = ['sem-login', 'login-recusado', 'conta-diferente'].includes(r?.status);
    const aviso = lv === undefined ? 'aguardando o jogo responder (entre com o personagem)'
      : Number(lv.estado) === 0 ? 'Lives Parceiras desligadas no servidor'
      : Number(lv.estado) !== 1 ? 'Lives Parceiras indisponíveis agora'
      : !lv.vinculado ? 'vincule a Twitch no site do Ygg (Lives Parceiras)'
      : '';
    const bonusTxt = agora > 0
      ? `<div style="color:#3fb950">✓ bônus valendo: ${agora} live(s) · +${(Number(lv.expBp) || 0) / 100}% XP · +${(Number(lv.dropBp) || 0) / 100}% drop</div>`
      : (canais.length ? '<div style="color:#aaa">aguardando o jogo confirmar (até ~1 min)</div>' : '');
    const det = corpo.querySelector('[data-bloqueio]');
    if (det) bloqueioAberto = det.open;
    corpo.innerHTML = `
        <label style="display:block;margin:0 0 6px"><input type="checkbox" data-a="ligado" ${st.pref.ligado ? 'checked' : ''}> ligado</label>
        <label style="display:block;margin-bottom:6px">máximo de lives:
          <select data-a="limite">${[1, 2, 3, 4, 5].map((n) => `<option ${Number(st.pref.limite) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div>Vinculada no jogo: <b>${loginVinculado() || '—'}</b></div>
        <div>Estado: ${TEXTO[r?.status] || r?.status || 'aguardando o jogo'}${r?.logado ? ` (${r.logado})` : ''}</div>
        ${aviso ? `<div style="color:#e3b341">${aviso}</div>` : ''}
        ${bonusTxt}
        ${linhas || '<div style="color:#aaa">nenhum chat aberto</div>'}
        ${painelBloqueio()}
        ${precisaLogin ? '<button data-a="login" style="margin-top:6px">Entrar na Twitch</button>' : ''}
        <button data-a="agora" style="margin-top:6px">Verificar agora</button>`;
  }
  // Menu de bloqueio: todas as lives parceiras que o jogo mandou (no ar
  // primeiro) mais as ja bloqueadas que sumiram da lista. Fica aberto entre
  // repinturas porque o estado do <details> e guardado.
  let bloqueioAberto = false;
  function painelBloqueio() {
    const daLista = (st.lives?.canais ?? [])
      .filter((c) => c && /^[a-z0-9_]{1,25}$/i.test(String(c.login || '')))
      .map((c) => ({ login: min(c.login), nome: String(c.name || c.login), live: !!c.live }));
    const vistos = new Set(daLista.map((c) => c.login));
    for (const login of st.pref.bloqueadas) if (!vistos.has(login)) daLista.push({ login, nome: login, live: false });
    daLista.sort((a, b) => Number(b.live) - Number(a.live) || a.login.localeCompare(b.login));
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const itens = daLista.map((c) => `<label style="display:block"><input type="checkbox" data-bloquear="${c.login}" ${st.pref.bloqueadas.includes(c.login) ? 'checked' : ''}> ${esc(c.nome)}${c.live ? ' <span style="color:#3fb950">● ao vivo</span>' : ''}</label>`).join('');
    return `<details data-bloqueio ${bloqueioAberto ? 'open' : ''} style="margin-top:6px"><summary>🚫 Bloquear lives (${st.pref.bloqueadas.length})</summary><div style="max-height:160px;overflow:auto;margin-top:4px">${itens || '<span style="color:#aaa">a lista aparece quando o jogo responder</span>'}</div></details>`;
  }

  function aoClicar(ev) {
    const a = ev.target?.dataset?.a;
    if (a === 'login') ponte()?.twitchLogin?.();
    else if (a === 'agora') { pedirLivesAoJogo(); agendarPedido(3000); }
  }
  function aoMudar(ev) {
    const a = ev.target?.dataset?.a;
    const bloq = ev.target?.dataset?.bloquear;
    if (bloq) {
      const set = new Set(st.pref.bloqueadas);
      if (ev.target.checked) set.add(bloq); else set.delete(bloq);
      st.pref.bloqueadas = [...set];
      gravarPref(st.pref);
      agendarPedido(0);
      return;
    }
    if (a === 'ligado') st.pref.ligado = ev.target.checked;
    else if (a === 'limite') st.pref.limite = Number(ev.target.value) || 5;
    else return;
    gravarPref(st.pref);
    agendarPedido(0);
  }

  // O jogo so responde com o personagem dentro do mundo. A cada 2 min o
  // script pede de novo (o bonus do jogo se atualiza "em ate 1 minuto").
  const iniciar = () => {
    pintar();
    setInterval(() => { embrulhar(); }, 5000);
    setInterval(pedirLivesAoJogo, PEDIDO_MS);
    setTimeout(pedirLivesAoJogo, 20_000);
    agendarPedido(25_000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
