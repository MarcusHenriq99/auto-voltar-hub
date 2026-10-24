// ==UserScript==
// @name         Yggidle - contador de abates por sessao
// @namespace    https://jogo.yggidle.com.br/
// @version      1.0
// @description  Conta monstros derrotados apos um golpe proprio, por especie e hora.
// @match        https://jogo.yggidle.com.br/*
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';
  if (window.__fznAbatesPainel) return;
  window.__fznAbatesPainel = true;

  const STORE = 'fzn-abates-ygg-v1';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } })();
  const data = saved && Array.isArray(saved.events) ? saved : { startedAt: Date.now(), paused: false, events: [], target: 'Stefan J. E. Wolf' };
  data.target ||= 'Stefan J. E. Wolf';
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch {} };
  let game = null, injected = false, panel = null, expanded = false, statusLine = null;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
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
      const status = (s) => { window.__fznAbatesStatus = s; };
      try {
        const build = String(window.ELRAG_CLIENT_BUILD || '').trim();
        if (!/^[0-9a-f]{6,64}$/.test(build)) throw new Error('build do cliente indisponivel');
        const base = '/v/' + build + '/src/';
        const [netMod, packetMod, managerMod, sessionMod, entityMod, dbMod] = await Promise.all([
          import(base + 'Network/NetworkManager.js'), import(base + 'Network/PacketStructure.js'),
          import(base + 'Renderer/EntityManager.js'), import(base + 'Engine/SessionStorage.js'),
          import(base + 'Renderer/Entity/Entity.js'), import(base + 'DB/DBManager.js')
        ]);
        const Network = netMod.default, PACKET = packetMod.default, Entities = managerMod.default;
        const Session = sessionMod.default, Entity = entityMod.default, DB = dbMod.default;
        const recent = new Map(), owners = new Map();
        const own = () => Number(Session.Entity?.GID || 0);
        const note = (gid, source, damage, action) => {
          gid = Number(gid); source = Number(source);
          if (!gid || !(Number(damage) > 0) || [1, 2, 3, 11].includes(Number(action))) return;
          if (source !== own() && owners.get(source) !== own()) return;
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
          if (attackPackets.has(packet)) hooked++;
          return origHook.call(this, packet, function(pkt) {
            try { observe(pkt); } catch {}
            return callback.apply(this, arguments);
          });
        };
        const origDeath = Entities.removeLife;
        Entities.removeLife = function(gid) {
          try {
            const mob = Entities.get(gid), hitAt = recent.get(Number(gid));
            if (mob && mob.objecttype === Entity.TYPE_MOB && hitAt && Date.now() - hitAt <= 15000) {
              const mobId = Number(mob._job || mob.job || 0);
              if (mobId > 0) {
                window.__fznAbatesQueue.push({ id: mobId, name: mob.display?.name || DB.getMonsterName(mobId) || '#' + mobId, at: Date.now() });
                if (window.__fznAbatesQueue.length > 1000) window.__fznAbatesQueue.shift();
              }
            }
            recent.delete(Number(gid));
          } catch {}
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
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'fzn-abates';
      Object.assign(panel.style, { position: 'fixed', right: '10px', bottom: '90px', zIndex: '2147483640', color: '#f4f7ff', background: 'rgba(12,20,32,.96)', border: '1px solid #57718f', borderRadius: '8px', padding: '6px', font: '12px Arial,sans-serif', width: '320px', maxWidth: 'calc(100vw - 20px)', maxHeight: '60vh', overflowY: 'auto', boxShadow: '0 4px 16px #0008' });
      document.body.append(panel);
    }
    panel.replaceChildren();
    statusLine = null;
    const button = (text, click) => { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'cursor:pointer;margin:2px;padding:4px 7px;background:#29465e;color:white;border:1px solid #718da6;border-radius:5px'; b.onclick = click; return b; };
    const totals = new Map();
    for (const ev of data.events) totals.set(ev.id, { name: ev.name, count: (totals.get(ev.id)?.count || 0) + 1 });
    const targetCount = data.events.filter((ev) => norm(ev.name) === norm(data.target)).length;
    panel.append(button('Abates ' + data.events.length + ' · ' + targetCount + ' alvo' + (data.paused ? ' · pausado' : ''), () => { expanded = !expanded; render(); }));
    if (!expanded) return;
    const line = (text) => { const d = document.createElement('div'); d.textContent = text; d.style.margin = '5px 2px'; panel.append(d); };
    line('Sessão iniciada: ' + fmt(data.startedAt));
    statusLine = document.createElement('div'); statusLine.style.margin = '5px 2px';
    statusLine.textContent = game?.__fznAbatesStatus || 'Aguardando o jogo'; panel.append(statusLine);
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

  setInterval(() => {
    const w = findGame();
    if (w !== game) { game = w; injected = false; }
    if (w && !injected) inject(w);
    let changed = false;
    if (w?.__fznAbatesQueue?.length) {
      const events = w.__fznAbatesQueue.splice(0);
      if (!data.paused && w.__fznAbatesStatus === 'Capturando golpes e mortes') {
        for (const ev of events) if (Number.isFinite(ev.id) && ev.name && Number.isFinite(ev.at)) { data.events.push(ev); changed = true; }
        if (data.events.length > 50000) data.events.splice(0, data.events.length - 50000);
        if (changed) save();
      }
    }
    if (panel?.isConnected && !expanded) {
      const b = panel.querySelector('button');
      if (b) b.textContent = 'Abates ' + data.events.length + ' · ' + data.events.filter((ev) => norm(ev.name) === norm(data.target)).length + ' alvo' + (data.paused ? ' · pausado' : '');
    } else if (!panel?.isConnected || changed) render();
    if (statusLine?.isConnected) statusLine.textContent = game?.__fznAbatesStatus || 'Aguardando o jogo';
  }, 600);
})();

