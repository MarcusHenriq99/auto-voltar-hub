const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','AUTOHUNT-YGGIDLE.user.js'),'utf8').replace(/\r\n/g,'\n');
function part(a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
function setup(options={}){
 let now=100000,radar=options.mobs||[{gid:20,mobId:20,name:'Longe',distance:8},{gid:10,mobId:10,name:'Perto',distance:2}],position={mapa:'dic_dun02',x:100,y:100},windowOpen=false,paused=false;
 const pins=[],walks=[],wings=[];
 const e={getAutopilotRadarSnapshot:()=>({mobs:radar}),setAutopilotPinnedTarget:gid=>{pins.push(gid);return options.reject?0:1;}};
 const w={__fznHuntCaminhada:{andar(x,y){walks.push([x,y]);return true;}},__fznEu:()=>null};
 const ctx={Date:{now:()=>now},Math,Number,Set,Map,Infinity,
  cfg:{ligado:true,bio4:false,soMvp:false,pacote:0,asa:'off'},ocupado:false,
  fixado:null,pinoGid:0,evitar:new Map(),golpesMeus:options.noHits?0:10,meuGolpeEm:0,meuAlvoGid:0,
  movChave:'dic_dun02:100:100',ultimoMovEm:0,inicioFarm:90000,ociosoDesde:0,radarVazioDesde:0,exploraVazioDesde:0,
  ultimoPasso:0,posAntesDoPasso:null,direcao:0,euDesliguei:0,pacoteFracoDesde:0,conjurandoAgora:false,acaoLutaDesde:0,golpesAvisado:false,
  asa:{index:null,count:0,aguardando:false},FIXAR_ESPERA_MS:1500,FIXADO_EVITAR_MS:15000,OCIOSO_FIXAR_MS:300,OCIOSO_ASA_MS:3000,
  FARM_LONGE:10,FARM_LONGE_MS:300,LUTA_MS:1500,ANDANDO_MS:500,PASSO_EXPLORAR_MS:3500,ASA_SEM_MOB_MS:600,ASA_CHEGADA_MAX_MS:1500,PACOTE_RAIO:7,PACOTE_MS:500,
  CIDADES_RE:/^prontera$/,pausadoPelaRifa:()=>paused,emEsperaInstancia:()=>false,ehInstancia:()=>false,temJanelaAberta:()=>windowOpen,posicao:()=>position,
  ignorados:()=>new Set(options.ignored||[]),ehMvp:m=>m.mobId===999,mvpTomado:()=>!!options.taken,sessaoCheffenia:()=>!!options.cheffenia,
  bio4Evitar:new Map(),ehBio4:()=>false,esperar:async()=>{},log(){},retrato:()=>'',ultimaAsaEm:0,
  usarAsa:()=>{wings.push(now);return false;},e,w,
 };
 vm.createContext(ctx);
 vm.runInContext(part('  const modoMvpAtivo =','  const ciclo = async () => {')+
  '\nglobalThis.run=async()=>{const w=globalThis.w,e=globalThis.e,ap={},agora=Date.now();\n'+part('    const posF = posicao(e);','\n  let painel = null, botaoAsa = null;')+'\nglobalThis.walk=explorarNoMotor;globalThis.special=reforcarAlvoParado;',ctx);
 return {ctx,pins,walks,wings,step:async ms=>{now+=ms;await ctx.run();},move:(x,y)=>position={...position,x,y},open:b=>windowOpen=b,pause:b=>paused=b,radar:r=>radar=r};
}
(async()=>{
 let t=setup({noHits:true});await t.step(0);await t.step(350);assert.deepEqual(t.pins,[10],'First fight: nearest eligible target before any recorded hit');assert.equal(t.wings.length,0);
 await t.step(200);assert.deepEqual(t.pins,[10],'No focus-command flood');
 await t.step(1400);assert.deepEqual(t.pins,[10,0,20],'Release failed target before trying next');
 t=setup({ignored:[10],noHits:true});await t.step(0);await t.step(350);assert.deepEqual(t.pins,[20],'Ignore/flee policy preserved');
 t=setup({noHits:true});t.ctx.cfg.soMvp=true;await t.step(0);await t.step(350);assert.deepEqual(t.pins,[10],'Saved Cheffenia checkbox does not ignore normal mobs outside content');
 t=setup({noHits:true,cheffenia:true});t.ctx.cfg.soMvp=true;await t.step(0);await t.step(350);assert.equal(t.pins.length,0,'Cheffenia still restricts to bosses');
 t=setup({mobs:[{gid:99,mobId:999,name:'MVP',distance:1}],taken:true,noHits:true});await t.step(0);await t.step(350);assert.equal(t.pins.length,0,'NOKS avoids claimed MVP');
 t=setup({noHits:true});t.ctx.meuGolpeEm=100000;await t.step(300);assert.equal(t.pins.length,0,'Do not interrupt real combat');
 t=setup({noHits:true});await t.step(0);await t.step(350);t.move(101,100);await t.step(1300);assert.deepEqual(t.pins,[10],'Walking progress does not blacklist chase');await t.step(600);await t.step(400);assert.deepEqual(t.pins,[10],'Allow target to attack after arrival');
 t=setup();t.ctx.cfg.pacote=3;await t.step(0);await t.step(550);assert.equal(t.pins.length,0,'Small pack does not acquire a pin that blocks pack teleport');assert.ok(t.wings.length>0,'Existing pack rule is consulted');
 t=setup();await t.step(0);await t.step(350);await t.step(3000);assert.ok(t.wings.length>0,'Existing idle teleport deadline is consulted');
 t=setup({mobs:[]});await t.step(0);await t.step(2100);assert.equal(t.walks.length,1,'Explore without a wing or canvas');assert.ok(t.walks[0].every(Number.isInteger));await t.step(100);assert.equal(t.walks.length,1,'Walking cadence preserved');
 t=setup({mobs:[]});t.open(true);await t.step(5000);assert.equal(t.walks.length,0,'No walk through modal window');t.open(false);t.pause(true);assert.equal(await t.ctx.walk(t.ctx.w,t.ctx.e,110000),false,'Rifa owns movement');
 t=setup();const boss={gid:999,name:'MVP'};t.ctx.special(t.ctx.w,t.ctx.e,boss,100000);t.ctx.special(t.ctx.w,t.ctx.e,boss,101600);assert.deepEqual(t.pins,[999],'Already selected special target is retried if genuinely idle');
 t.ctx.meuAlvoGid=999;t.ctx.meuGolpeEm=102000;t.ctx.special(t.ctx.w,t.ctx.e,boss,102100);assert.deepEqual(t.pins,[999],'Do not re-pin a boss in active combat');
 let used=0,inCheff=false;const wingCtx={cfg:{asa:'auto',cheffeniaTeleporte:true},Date:{now:()=>100000},asa:{index:2,count:10,lidaEm:100000,pedidaEm:100000,aguardando:false},
  pausadoPelaRifa:()=>false,emEsperaInstancia:()=>false,ehInstancia:()=>false,asaBloqueadaPorMvp:()=>false,sessaoCheffenia:()=>inCheff,modoMvpAtivo:()=>inCheff,mvpEmCombate:()=>true,snapshotAp:()=>({}),ganchoMochila(){},asaLiberada:()=>true,posicao:()=>({x:100,y:100}),
  ultimaAsaEm:0,radarVazioDesde:0,setTimeout(){},log(){}};
 vm.createContext(wingCtx);vm.runInContext(part('  const usarAsa =','  setInterval(() => {\n    try { if (ocupado)')+'\nglobalThis.use=usarAsa;',wingCtx);
 assert.equal(wingCtx.use({}, {useInventoryItem(){used++;}},100000),true,'Saved Cheffenia mode does not suppress normal farm teleport');
 inCheff=true;assert.equal(wingCtx.use({}, {},100000),false,'Actual Cheffenia combat keeps its teleport protection');assert.equal(used,1);
 console.log('OK: first-hit acquisition, nearest/ignore/NOKS, no pin flood, stalled-target rotation, combat/movement protection, unchanged teleport gates and native background exploration.');
})().catch(e=>{console.error(e);process.exitCode=1;});

