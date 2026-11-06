const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','AUTOVOLTAR-YGGIDLE.user.js'),'utf8');
const start=src.indexOf('  const encerrarAcessoConteudo ='),end=src.indexOf('  // Uma recarga por passagem',start);
function setup(modo='lhz',mapa='rockrdg2'){
 let textos=[];const venda={ligado:true,nomes:['item permitido']},armazem={ligado:true};
 const cfg={ligado:true,venda,armazem,conteudo:{modo,anterior:{mapaFarmManual:mapa,destinoFarm:{mapa,nome:mapa},retornoEvento:false}},mapaFarmManual:'mid_lhzinv',destinoFarm:{mapa:'mid_lhzinv'}};
 const ctx={cfg,recuperacao:null,vigia:{},chegadaAtrasada:{},Date,WeakMap,Set,salvarCfg(){},etapa(){},log(){},normalizar:s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()};
 vm.createContext(ctx);vm.runInContext(src.slice(start,end)+'\nglobalThis.api={encerrarAcessoConteudo,conferirFimConteudo};',ctx);
 const w={document:{querySelectorAll:()=>textos.map(textContent=>({textContent}))}};
 return {cfg,ctx,w,venda,armazem,set:t=>textos=t};
}
for(const modo of ['lhz','bio4','cheffenia']){
 const t=setup(modo,modo==='bio4'?'dic_dun02':'rockrdg2');t.ctx.api.encerrarAcessoConteudo('Tempo esgotado pelo servidor');
 assert.equal(t.cfg.conteudo.modo,'normal');assert.equal(t.cfg.mapaFarmManual,modo==='bio4'?'dic_dun02':'rockrdg2');
 assert.equal(t.ctx.recuperacao.fimConteudo,true);assert.equal(t.cfg.fimConteudoPendente.modo,modo);
 assert.equal(t.cfg.venda,t.venda);assert.equal(t.cfg.armazem,t.armazem,'Individual sale/storage rules preserved');
 const roundtrip=JSON.parse(JSON.stringify(t.cfg));assert.equal(roundtrip.fimConteudoPendente.modo,modo,'Recovery intent survives restart');
}
let t=setup();t.set(['Sua hora de hoje na Invasao de LHZ acabou. Volte depois das 05:00.']);t.ctx.api.conferirFimConteudo(t.w);assert.equal(t.cfg.conteudo.modo,'lhz','Old chat on login is not a new expiration');
t=setup();t.ctx.api.conferirFimConteudo(t.w);t.set(['Seu tempo na Cheffenia acabou.']);t.ctx.api.conferirFimConteudo(t.w);assert.equal(t.cfg.conteudo.modo,'lhz','Another content announcement does not cancel LHZ');
t.set(['Sua hora de hoje na Invasao de LHZ acabou. Volte depois das 05:00.']);t.ctx.api.conferirFimConteudo(t.w);assert.equal(t.cfg.conteudo.modo,'normal');assert.equal(t.cfg.destinoFarm.mapa,'rockrdg2');
t=setup();t.cfg.conteudo.esgotado='Tempo esgotado confirmado pelo servidor';t.ctx.api.conferirFimConteudo(t.w);assert.equal(t.cfg.conteudo.modo,'normal','Migrate already blocked v3.15 content to normal farm');
console.log('OK: expiry unmarks each timed content, restores per-account normal farm, preserves rules, persists recovery, ignores stale/unrelated announcements and migrates old blocked mode.');

