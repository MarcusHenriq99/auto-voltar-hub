// ==UserScript==
// @name         Yggidle - contador de abates por sessao
// @namespace    https://jogo.yggidle.com.br/
// @version      1.6
// @description  Conta monstros derrotados apos um golpe proprio, por especie e hora.
// @match        https://jogo.yggidle.com.br/*
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';
  if (window.__fznAbatesPainel) return;
  window.__fznAbatesPainel = true;

  const STORE = 'fzn-abates-ygg-v1';
  const VIEW = 'fzn-abates-ygg-janela-v1';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } })();
  const data = saved && Array.isArray(saved.events) ? saved : { startedAt: Date.now(), paused: false, events: [], target: 'Stefan J. E. Wolf' };
  data.target ||= 'Stefan J. E. Wolf';
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch {} };
  const view = (() => { try { return JSON.parse(localStorage.getItem(VIEW) || '{}'); } catch { return {}; } })();
  const saveView = () => { try { localStorage.setItem(VIEW, JSON.stringify(view)); } catch {} };
  let game = null, injected = false, panel = null, bubble = null, expanded = false, hidden = view.hidden === true, statusLine = null, debugLine = null;
  let dragging = null;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fmt = (ms) => new Date(ms).toLocaleString('pt-BR');
  const hour = (ms) => {
    const d = new Date(ms), two = (n) => String(n).padStart(2, '0');
    return two(d.getDate()) + '/' + two(d.getMonth() + 1) + ' ' + two(d.getHours()) + ':00';
  };
  const findGame = () => {
    for (const f of document.querySelectorAll('iframe')) {
      try { if (f.contentWindow?.document && f.contentWindow.ELRAG_CLIENT_BUILD) return f.contentWindow; } catch {}
    }
    return window.ELRAG_CLIENT_BUILD ? window : null;
  };

  // Este modulo executa no mesmo frame e no mesmo registro de modulos do jogo.
  // Os pacotes continuam com seus callbacks originais; apenas observamos os dados.
  const installSource = `
    (async () => {
      if (window.__fznAbatesInstalando) return;
      window.__fznAbatesInstalando = true;
      window.__fznAbatesQueue = window.__fznAbatesQueue || [];
      const debug = window.__fznAbatesDebug = { hooks: 0, ataques: 0, golpesProprios: 0, mortes: 0, mobs: 0, relacionados: 0, ultimoGid: 0, ultimaOrigem: 0 };
      const status = (s) => { window.__fznAbatesStatus = s; };
      try {
        const build = String(window.ELRAG_CLIENT_BUILD || '').trim();
        if (!/^[0-9a-f]{6,64}$/.test(build)) throw new Error('build do cliente indisponivel');
        const base = '/v/' + build + '/src/';
        // O registro dos handlers ocorre cedo: nao espere carregar renderer e banco.
        const [netMod, packetMod, sessionMod] = await Promise.all([
          import(base + 'Network/NetworkManager.js'), import(base + 'Network/PacketStructure.js'),
          import(base + 'Engine/SessionStorage.js')
        ]);
        const Network = netMod.default, PACKET = packetMod.default, Session = sessionMod.default;
        const recent = new Map(), owners = new Map();
        const own = () => Number(Session.Entity?.GID || 0);
        const note = (gid, source, damage, action) => {
          gid = Number(gid); source = Number(source);
          debug.ataques++; debug.ultimoGid = own(); debug.ultimaOrigem = source;
          if (!gid || !(Number(damage) > 0) || [1, 2, 3, 11].includes(Number(action))) return;
          if (source !== own() && owners.get(source) !== own()) return;
          debug.golpesProprios++;
          recent.set(gid, Date.now());
          if (recent.size > 500) for (const [k, t] of recent) if (Date.now() - t > 30000) recent.delete(k);
        };
        const watched = new Map([
          [PACKET.ZC.NOTIFY_ACT, (p) => note(p.targetGID, p.GID, (Number(p.damage) || 0) + (Number(p.leftDamage) || 0), p.action)],
          [PACKET.ZC.NOTIFY_ACT2, (p) => note(p.targetGID, p.GID, (Number(p.damage) || 0) + (Number(p.leftDamage) || 0), p.action)],
          [PACKET.ZC.NOTIFY_ACT3, (p) => note(p.targetGID, p.GID, (Number(p.damage) || 0) + (Number(p.leftDamage) || 0), p.action)],
          [PACKET.ZC.NOTIFY_SKILL, (p) => note(p.targetID, p.AID, p.damage, p.action)],
          [PACKET.ZC.NOTIFY_SKILL2, (p) => note(p.targetID, p.AID, p.damage, p.action)],
          [PACKET.ZC.NOTIFY_SKILL_POSITION, (p) => note(p.targetID, p.AID, p.damage, p.action)],
          [PACKET.ZC.SKILL_ENTRY, (p) => owners.set(Number(p.AID), Number(p.creatorAID))],
          [PACKET.ZC.SKILL_ENTRY2, (p) => owners.set(Number(p.AID), Number(p.creatorAID))],
          [PACKET.ZC.SKILL_ENTRY3, (p) => owners.set(Number(p.AID), Number(p.creatorAID))],
          [PACKET.ZC.SKILL_ENTRY4, (p) => owners.set(Number(p.AID), Number(p.creatorAID))],
          [PACKET.ZC.SKILL_ENTRY5, (p) => owners.set(Number(p.AID), Number(p.creatorAID))],
          [PACKET.ZC.SKILL_DISAPPEAR, (p) => owners.delete(Number(p.AID))]
        ]);
        const attackPackets = new Set([PACKET.ZC.NOTIFY_ACT, PACKET.ZC.NOTIFY_ACT2, PACKET.ZC.NOTIFY_ACT3, PACKET.ZC.NOTIFY_SKILL, PACKET.ZC.NOTIFY_SKILL2, PACKET.ZC.NOTIFY_SKILL_POSITION]);
        let hooked = 0;
        const origHook = Network.hookPacket;
        Network.hookPacket = function(packet, callback) {
          const observe = watched.get(packet);
          if (!observe || typeof callback !== 'function') return origHook.call(this, packet, callback);
          if (attackPackets.has(packet)) { hooked++; debug.hooks = hooked; }
          return origHook.call(this, packet, function(pkt) {
            try { observe(pkt); } catch {}
            return callback.apply(this, arguments);
          });
        };
        // O renderer do jogo inicializa Entity e EntityManager em uma ordem propria.
        // Importa-los antes disso pode interromper o jogo com
        // "Cannot access 'Entity' before initialization" na tela LOADING.
        status('Aguardando inicializacao do motor do jogo');
        while (!window.__elragEngine?.renderer) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        const managerMod = await import(base + 'Renderer/EntityManager.js');
        const entityMod = await import(base + 'Renderer/Entity/Entity.js');
        const dbMod = await import(base + 'DB/DBManager.js');
        const Entities = managerMod.default, Entity = entityMod.default, DB = dbMod.default;
        const origDeath = Entities.removeLife;
        Entities.removeLife = function(gid) {
          try {
            debug.mortes++;
            const mob = Entities.get(gid), hitAt = recent.get(Number(gid));
            if (mob?.objecttype === Entity.TYPE_MOB) debug.mobs++;
            if (mob && mob.objecttype === Entity.TYPE_MOB && hitAt && Date.now() - hitAt <= 15000) {
              debug.relacionados++;
              const mobId = Number(mob._job || mob.job || 0);
              if (mobId > 0) {
                window.__fznAbatesQueue.push({ id: mobId, name: mob.display?.name || DB.getMonsterName(mobId) || '#' + mobId, at: Date.now() });
                if (window.__fznAbatesQueue.length > 1000) window.__fznAbatesQueue.shift();
              }
            }
            recent.delete(Number(gid));
          } catch (e) { debug.erro = String(e?.message || e).slice(0, 80); }
          return origDeath.apply(this, arguments);
        };
        window.setInterval(() => status(hooked >= 2 ? 'Capturando golpes e mortes' : 'Pacotes de combate anteriores ao contador; recarregue esta conta'), 1000);
        status('Aguardando pacotes de combate');
      } catch (e) { status('Captura indisponivel: ' + String(e?.message || e).slice(0, 100)); }
    })();
  `;

  const inject = (w) => {
    if (w.__fznAbatesInstalando) { injected = true; return; }
    if (!w.document?.head || !w.ELRAG_CLIENT_BUILD) return;
    const script = w.document.createElement('script');
    script.type = 'module'; script.textContent = installSource;
    w.document.head.append(script); injected = true;
  };

  const render = () => {
    if (!document.body) return;
    if (!bubble) {
      bubble = document.createElement('button'); bubble.type = 'button';
      bubble.title = 'Mostrar contador de abates'; bubble.setAttribute('aria-label', 'Mostrar contador de abates');
      bubble.style.cssText = 'position:fixed;z-index:2147483641;width:16px;height:16px;padding:0;border:1px solid #fff;border-radius:50%;background:#999;opacity:.25;cursor:pointer;transition:opacity .15s;touch-action:none';
      bubble.addEventListener('mouseenter', () => { bubble.style.opacity = '.9'; });
      bubble.addEventListener('mouseleave', () => { bubble.style.opacity = '.25'; });
      let move = null, moved = false;
      bubble.addEventListener('pointerdown', (ev) => { move = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, left: bubble.offsetLeft, top: bubble.offsetTop }; moved = false; bubble.setPointerCapture(ev.pointerId); });
      bubble.addEventListener('pointermove', (ev) => {
        if (!move || ev.pointerId !== move.id) return;
        if (Math.abs(ev.clientX - move.x) + Math.abs(ev.clientY - move.y) > 3) moved = true;
        if (!moved) return;
        view.bx = Math.max(0, Math.min(move.left + ev.clientX - move.x, window.innerWidth - 16));
        view.by = Math.max(0, Math.min(move.top + ev.clientY - move.y, window.innerHeight - 16));
        bubble.style.left = view.bx + 'px'; bubble.style.top = view.by + 'px';
      });
      const stopBubbleDrag = (ev) => { if (move?.id !== ev.pointerId) return; move = null; if (moved) saveView(); try { bubble.releasePointerCapture(ev.pointerId); } catch {} };
      bubble.addEventListener('pointerup', stopBubbleDrag); bubble.addEventListener('pointercancel', stopBubbleDrag);
      bubble.addEventListener('click', () => { if (moved) { moved = false; return; } hidden = false; view.hidden = false; saveView(); render(); });
      document.body.append(bubble);
    }
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'fzn-abates';
      Object.assign(panel.style, { position: 'fixed', right: '10px', bottom: '90px', zIndex: '2147483640', color: '#f4f7ff', background: 'rgba(12,20,32,.96)', border: '1px solid #57718f', borderRadius: '8px', padding: '6px', font: '12px Arial,sans-serif', width: '320px', maxWidth: 'calc(100vw - 20px)', maxHeight: '60vh', overflowY: 'auto', boxShadow: '0 4px 16px #0008' });
      if (Number.isFinite(view.x) && Number.isFinite(view.y)) {
        panel.style.left = Math.max(0, Math.min(view.x, window.innerWidth - 80)) + 'px';
        panel.style.top = Math.max(0, Math.min(view.y, window.innerHeight - 30)) + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
      }
      panel.addEventListener('pointerdown', (ev) => {
        if (!ev.target.closest('[data-abates-arrastar]')) return;
        const box = panel.getBoundingClientRect();
        dragging = { id: ev.pointerId, dx: ev.clientX - box.left, dy: ev.clientY - box.top };
        panel.style.left = box.left + 'px'; panel.style.top = box.top + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
        panel.setPointerCapture(ev.pointerId); ev.preventDefault();
      });
      panel.addEventListener('pointermove', (ev) => {
        if (!dragging || ev.pointerId !== dragging.id) return;
        const x = Math.max(0, Math.min(ev.clientX - dragging.dx, window.innerWidth - panel.offsetWidth));
        const y = Math.max(0, Math.min(ev.clientY - dragging.dy, window.innerHeight - panel.offsetHeight));
        panel.style.left = x + 'px'; panel.style.top = y + 'px';
      });
      const stopDrag = (ev) => {
        if (!dragging || ev.pointerId !== dragging.id) return;
        dragging = null; view.x = parseFloat(panel.style.left); view.y = parseFloat(panel.style.top); saveView();
        try { panel.releasePointerCapture(ev.pointerId); } catch {}
      };
      panel.addEventListener('pointerup', stopDrag);
      panel.addEventListener('pointercancel', stopDrag);
      document.body.append(panel);
    }
    panel.style.display = hidden ? 'none' : 'block';
    bubble.style.display = hidden ? 'block' : 'none';
    if (hidden) {
      bubble.style.left = Math.max(0, Math.min(Number(view.bx) || window.innerWidth - 22, window.innerWidth - 16)) + 'px';
      bubble.style.top = Math.max(0, Math.min(Number(view.by) || window.innerHeight - 22, window.innerHeight - 16)) + 'px';
      return;
    }
    panel.replaceChildren();
    panel.style.width = '320px';
    statusLine = null; debugLine = null;
    const button = (text, click) => { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'cursor:pointer;margin:2px;padding:4px 7px;background:#29465e;color:white;border:1px solid #718da6;border-radius:5px'; b.onclick = click; return b; };
    const totals = new Map();
    for (const ev of data.events) totals.set(ev.id, { name: ev.name, count: (totals.get(ev.id)?.count || 0) + 1 });
    const targetCount = data.events.filter((ev) => norm(ev.name) === norm(data.target)).length;
    const header = document.createElement('div'); header.style.cssText = 'display:flex;align-items:center;gap:3px';
    const grip = document.createElement('span'); grip.dataset.abatesArrastar = '1'; grip.textContent = '⠿'; grip.title = 'Arraste para mover o contador';
    grip.style.cssText = 'cursor:grab;touch-action:none;user-select:none;padding:4px 5px;color:#cfe3f0';
    header.append(grip);
    header.append(button('Abates ' + data.events.length + ' · ' + targetCount + ' alvo' + (data.paused ? ' · pausado' : ''), () => { expanded = !expanded; render(); }));
    const minimize = button('–', () => {
      const r = panel.getBoundingClientRect();
      view.bx = Math.round(Math.max(0, Math.min(r.right - 16, window.innerWidth - 16)));
      view.by = Math.round(Math.max(0, Math.min(r.top, window.innerHeight - 16)));
      hidden = true; view.hidden = true; saveView(); render();
    });
    minimize.title = 'Encolher para uma bolinha'; minimize.setAttribute('aria-label', 'Encolher contador de abates');
    minimize.style.width = '20px'; minimize.style.height = '20px'; minimize.style.padding = '0'; minimize.style.lineHeight = '16px';
    header.append(minimize);
    panel.append(header);
    if (!expanded) return;
    const line = (text) => { const d = document.createElement('div'); d.textContent = text; d.style.margin = '5px 2px'; panel.append(d); };
    line('Sessão iniciada: ' + fmt(data.startedAt));
    statusLine = document.createElement('div'); statusLine.style.margin = '5px 2px';
    statusLine.textContent = game?.__fznAbatesStatus || 'Aguardando o jogo'; panel.append(statusLine);
    debugLine = document.createElement('div'); debugLine.style.margin = '5px 2px'; panel.append(debugLine);
    line('Estimativa: morte observada ate 15 s apos seu golpe. Outro jogador pode ter dado o golpe final.');
    const input = document.createElement('input'); input.value = data.target; input.title = 'Monstro de interesse'; input.style.cssText = 'box-sizing:border-box;width:100%;padding:5px;background:#eff4fa;color:#172332;border:1px solid #718da6;border-radius:4px';
    input.onchange = () => { data.target = input.value.trim(); save(); render(); }; panel.append(input);
    panel.append(button(data.paused ? 'Retomar' : 'Pausar', () => { data.paused = !data.paused; save(); render(); }));
    panel.append(button('Nova sessão', () => { if (!window.confirm('Iniciar nova sessão e zerar os abates registrados nesta conta?')) return; data.events = []; data.startedAt = Date.now(); data.paused = false; save(); render(); }));
    panel.append(button('CSV', () => {
      const csv = ['data_hora;monstro;mob_id', ...data.events.map((e) => [fmt(e.at), e.name, e.id].map((s) => '"' + String(s).replace(/"/g, '""') + '"').join(';'))].join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'abates-yggidle.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }));
    line('Por monstro:');
    for (const row of [...totals.values()].sort((a, b) => b.count - a.count)) line(row.name + ': ' + row.count);
    if (!totals.size) line('Nenhum abate registrado nesta sessão.');
    const hours = new Map();
    for (const ev of data.events) { const k = hour(ev.at); hours.set(k, (hours.get(k) || 0) + 1); }
    line('Por hora:'); for (const [k, n] of [...hours].reverse()) line(k + ' — ' + n);
    line('Por monstro em cada hora:');
    const hourlyMobs = new Map();
    for (const ev of data.events) {
      const key = hour(ev.at) + '\u0000' + ev.id, old = hourlyMobs.get(key);
      hourlyMobs.set(key, { hour: hour(ev.at), name: ev.name, count: (old?.count || 0) + 1 });
    }
    for (const row of [...hourlyMobs.values()].reverse()) line(row.hour + ' · ' + row.name + ': ' + row.count);
  };

  // Captura o registro de callbacks do jogo logo no carregamento do frame.
  // O painel e a persistencia podem seguir numa cadencia bem menor.
  setInterval(() => {
    const w = findGame();
    if (w !== game) { game = w; injected = false; }
    if (w && !injected) inject(w);
  }, 30);

  setInterval(() => {
    const w = game;
    let changed = false;
    if (w?.__fznAbatesQueue?.length) {
      const events = w.__fznAbatesQueue.splice(0);
      if (!data.paused && w.__fznAbatesStatus === 'Capturando golpes e mortes') {
        for (const ev of events) if (Number.isFinite(ev.id) && ev.name && Number.isFinite(ev.at)) { data.events.push(ev); changed = true; }
        if (data.events.length > 50000) data.events.splice(0, data.events.length - 50000);
        if (changed) save();
      }
    }
    if (panel?.isConnected && !expanded && !hidden) {
      const b = panel.querySelector('button');
      if (b) b.textContent = 'Abates ' + data.events.length + ' · ' + data.events.filter((ev) => norm(ev.name) === norm(data.target)).length + ' alvo' + (data.paused ? ' · pausado' : '');
    } else if (!panel?.isConnected || changed) render();
    if (statusLine?.isConnected) statusLine.textContent = game?.__fznAbatesStatus || 'Aguardando o jogo';
    if (debugLine?.isConnected) {
      const d = game?.__fznAbatesDebug;
      debugLine.textContent = d ? 'Sinais: ' + d.golpesProprios + ' golpes próprios, ' + d.mobs + ' mortes de monstro, ' + d.relacionados + ' relacionadas' + (d.erro ? ' · ' + d.erro : '') : 'Sinais: aguardando jogo';
    }
  }, 600);
})();

