// ==UserScript==
// @name         Yggidle - contador de abates por sessao
// @namespace    https://jogo.yggidle.com.br/
// @version      1.9
// @description  Conta monstros derrotados apos um golpe proprio, separados por dia, especie e hora.
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
  const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dayLabel = (ms) => { const d = new Date(ms); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
  const hourOfDay = (ms) => String(new Date(ms).getHours()).padStart(2, '0') + ':00';
  const openDays = new Set([dayKey(Date.now())]);
  let shownDay = dayKey(Date.now());
  const findGame = () => {
    for (const f of document.querySelectorAll('iframe')) {
      try { if (f.contentWindow?.document && f.contentWindow.ELRAG_CLIENT_BUILD) return f.contentWindow; } catch {}
    }
    return window.ELRAG_CLIENT_BUILD ? window : null;
  };

  // Observa sinais do jogo que continuam disponiveis mesmo se o contador
  // iniciar depois do registro dos pacotes de combate.
  const installSource = `
    (async () => {
      if (window.__fznAbatesInstalando) return;
      window.__fznAbatesInstalando = true;
      window.__fznAbatesQueue = window.__fznAbatesQueue || [];
      const debug = window.__fznAbatesDebug = { golpesProprios: 0, mortes: 0, mobs: 0, relacionados: 0 };
      const status = (s) => { window.__fznAbatesStatus = s; };
      try {
        const build = String(window.ELRAG_CLIENT_BUILD || '').trim();
        if (!/^[0-9a-f]{6,64}$/.test(build)) throw new Error('build do cliente indisponivel');
        const base = '/v/' + build + '/src/';
        status('Aguardando inicializacao do motor do jogo');
        // O MapEngine instala este sinal quando seus modulos e callbacks
        // estao prontos. A propriedade renderer usada antes nao existe.
        while (!window.__elragEngine?.getCharacterCartMountState || !window.__elragUI?.pushDpsSample) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        const [managerMod, entityMod, dbMod, sessionMod] = await Promise.all([
          import(base + 'Renderer/EntityManager.js'), import(base + 'Renderer/Entity/Entity.js'),
          import(base + 'DB/DBManager.js'), import(base + 'Engine/SessionStorage.js')
        ]);
        const Entities = managerMod.default, Entity = entityMod.default;
        const DB = dbMod.default, Session = sessionMod.default;
        const recent = new Map();
        let lastMobLookup = 0, lastMobLookupAt = 0;
        const origGet = Entities.get;
        Entities.get = function(gid) {
          const entity = origGet.apply(this, arguments);
          if (entity?.objecttype === Entity.TYPE_MOB) {
            lastMobLookup = Number(gid) || 0;
            lastMobLookupAt = Date.now();
          }
          return entity;
        };
        const observeOwnDamage = (_at, damage) => {
          if (!(Number(damage) > 0)) return;
          debug.golpesProprios++;
          // Os manipuladores de ataque consultam o alvo antes de emitir
          // a amostra de dano proprio; isso inclui ataques e habilidades.
          const gid = Date.now() - lastMobLookupAt < 100
            ? lastMobLookup : Number(Session.Entity?.targetGID || 0);
          if (gid) recent.set(gid, Date.now());
          if (recent.size > 500) for (const [k, t] of recent) if (Date.now() - t > 30000) recent.delete(k);
        };
        const wrapDps = () => {
          const ui = window.__elragUI;
          const current = ui?.pushDpsSample;
          if (typeof current !== 'function' || current.__fznAbatesWrapped) return;
          const wrapped = function(at, damage) {
            try { observeOwnDamage(at, damage); }
            catch (e) { debug.erro = String(e?.message || e).slice(0, 80); }
            return current.apply(this, arguments);
          };
          wrapped.__fznAbatesWrapped = true;
          ui.pushDpsSample = wrapped;
        };
        wrapDps();
        window.setInterval(wrapDps, 1000);
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
        status('Capturando golpes e mortes');
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
    const today = dayKey(Date.now());
    const days = new Map();
    let todayCount = 0, todayTarget = 0;
    for (const ev of data.events) {
      const key = dayKey(ev.at);
      let row = days.get(key);
      if (!row) {
        row = { key, date: dayLabel(ev.at), count: 0, target: 0,
          monsters: new Map(), hours: new Map(), hourMonsters: new Map() };
        days.set(key, row);
      }
      row.count++;
      const isTarget = norm(ev.name) === norm(data.target);
      if (isTarget) row.target++;
      if (key === today) { todayCount++; if (isTarget) todayTarget++; }
      const monster = row.monsters.get(ev.id);
      row.monsters.set(ev.id, { name: ev.name, count: (monster?.count || 0) + 1 });
      const h = hourOfDay(ev.at);
      row.hours.set(h, (row.hours.get(h) || 0) + 1);
      const hmKey = h + '\u0000' + ev.id, hm = row.hourMonsters.get(hmKey);
      row.hourMonsters.set(hmKey, { hour: h, name: ev.name, count: (hm?.count || 0) + 1 });
    }
    const header = document.createElement('div'); header.style.cssText = 'display:flex;align-items:center;gap:3px';
    const grip = document.createElement('span'); grip.dataset.abatesArrastar = '1'; grip.textContent = '⠿'; grip.title = 'Arraste para mover o contador';
    grip.style.cssText = 'cursor:grab;touch-action:none;user-select:none;padding:4px 5px;color:#cfe3f0';
    header.append(grip);
    header.append(button('Hoje ' + todayCount + ' abates · ' + todayTarget + ' alvo' + (data.paused ? ' · pausado' : ''), () => { expanded = !expanded; render(); }));
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
    const line = (value, parent = panel) => { const d = document.createElement('div'); d.textContent = value; d.style.margin = '5px 2px'; parent.append(d); };
    line('Hoje: ' + dayLabel(Date.now()) + ' · ' + todayCount + ' abates · ' + todayTarget + ' alvo');
    line('Sessão: ' + data.events.length + ' abates desde ' + fmt(data.startedAt));
    statusLine = document.createElement('div'); statusLine.style.margin = '5px 2px';
    statusLine.textContent = game?.__fznAbatesStatus || 'Aguardando o jogo'; panel.append(statusLine);
    debugLine = document.createElement('div'); debugLine.style.margin = '5px 2px'; panel.append(debugLine);
    line('Estimativa: morte observada ate 15 s apos seu golpe. Outro jogador pode ter dado o golpe final.');
    const input = document.createElement('input'); input.value = data.target; input.title = 'Monstro de interesse'; input.style.cssText = 'box-sizing:border-box;width:100%;padding:5px;background:#eff4fa;color:#172332;border:1px solid #718da6;border-radius:4px';
    input.onchange = () => { data.target = input.value.trim(); save(); render(); }; panel.append(input);
    panel.append(button(data.paused ? 'Retomar' : 'Pausar', () => { data.paused = !data.paused; save(); render(); }));
    panel.append(button('Nova sessão', () => { if (!window.confirm('Iniciar nova sessão e zerar os abates registrados nesta conta?')) return; data.events = []; data.startedAt = Date.now(); data.paused = false; save(); render(); }));
    panel.append(button('CSV', () => {
      const csv = ['dia;data_hora;monstro;mob_id', ...data.events.map((e) => [dayLabel(e.at), fmt(e.at), e.name, e.id].map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(';'))].join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'abates-yggidle.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }));
    line('Histórico por dia:');
    for (const row of [...days.values()].sort((x, y) => y.key.localeCompare(x.key))) {
      const details = document.createElement('details');
      details.open = openDays.has(row.key);
      details.style.cssText = 'border:1px solid #607b91;border-radius:5px;margin:4px 0;padding:4px';
      const summary = document.createElement('summary');
      summary.textContent = row.date + (row.key === today ? ' (hoje)' : '') + ': ' + row.count + ' abates · ' + row.target + ' alvo';
      summary.style.cursor = 'pointer';
      details.append(summary);
      details.addEventListener('toggle', () => {
        if (details.open) openDays.add(row.key); else openDays.delete(row.key);
      });
      line('Por monstro:', details);
      for (const mob of [...row.monsters.values()].sort((x, y) => y.count - x.count)) line(mob.name + ': ' + mob.count, details);
      line('Por hora:', details);
      for (const [h, count] of [...row.hours].sort((x, y) => x[0].localeCompare(y[0]))) line(h + ' — ' + count, details);
      line('Por monstro em cada hora:', details);
      for (const hm of [...row.hourMonsters.values()].sort((x, y) => x.hour.localeCompare(y.hour))) line(hm.hour + ' · ' + hm.name + ': ' + hm.count, details);
      panel.append(details);
    }
    if (!days.size) line('Nenhum abate registrado nesta sessão.');
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
      if (!data.paused) {
        for (const ev of events) if (Number.isFinite(ev.id) && ev.name && Number.isFinite(ev.at)) { data.events.push(ev); changed = true; }
        if (data.events.length > 50000) data.events.splice(0, data.events.length - 50000);
        if (changed) save();
      }
    }
    const currentDay = dayKey(Date.now());
    if (currentDay !== shownDay) { shownDay = currentDay; openDays.add(currentDay); render(); }
    if (panel?.isConnected && !expanded && !hidden) {
      const eventsToday = data.events.filter((ev) => dayKey(ev.at) === currentDay);
      const b = panel.querySelector('button');
      if (b) b.textContent = 'Hoje ' + eventsToday.length + ' abates · ' + eventsToday.filter((ev) => norm(ev.name) === norm(data.target)).length + ' alvo' + (data.paused ? ' · pausado' : '');
    } else if (!panel?.isConnected || changed) render();
    if (statusLine?.isConnected) statusLine.textContent = game?.__fznAbatesStatus || 'Aguardando o jogo';
    if (debugLine?.isConnected) {
      const d = game?.__fznAbatesDebug;
      debugLine.textContent = d ? 'Sinais: ' + d.golpesProprios + ' golpes próprios, ' + d.mobs + ' mortes de monstro, ' + d.relacionados + ' relacionadas' + (d.erro ? ' · ' + d.erro : '') : 'Sinais: aguardando jogo';
    }
  }, 600);
})();

