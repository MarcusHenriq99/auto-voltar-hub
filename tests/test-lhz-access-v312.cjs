const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','AUTOVOLTAR-YGGIDLE.user.js'),'utf8');
function part(a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i);return source.slice(i,j);}
function setup(minutes=60,options={}){
 let p={mapa:'prontera',x:155,y:183},open=false,t=null,now=100000,reloads=0,enters=0,selected=false,walks=[];
 const cfg={ligado:true,conteudo:{modo:'lhz'},retornoPendente:{}}, logs=[];
 const button={textContent:'Ir para a cidade tomada',click(){enters++;selected=true;if(!options.noArrival&&!options.needsClose){p={mapa:'lhz_inv',x:100,y:100};t={fonte:2,secondsLeft:3600,runningUntil:3700,recebidoEm:100};}}};
 const close={textContent:'Fechar',click(){assert.ok(selected);p={mapa:'lhz_inv',x:100,y:100};t={fonte:2,secondsLeft:3600};}};
 const panel={textContent:`[Invasao de LHZ] Voce ainda tem ${minutes} min la dentro hoje.`,querySelectorAll(){return options.needsClose&&selected?[close]:[button];}};
 const w={document:{querySelectorAll(){return open?[panel]:[];}},location:{reload(){throw Error('Never reload api.html alone');}},top:{location:{reload(){reloads++;}}},__elragEngine:{getTempoEvento(){return t;}}};
 const npc={constructor:{TYPE_NPC:7},objecttype:7,GID:42,name:'Invasao de LHZ',position:[138,189],onMouseDown(){assert.ok(Math.hypot(p.x-138,p.y-189)<=5);open=true;}};
 const ctx={cfg,Date:{now:()=>now},recuperacao:{},vigia:{},chegadaAtrasada:{},salvarCfg(){},etapa(){},log:s=>logs.push(s),
  posicao:()=>p,cancelando:()=>false,normalizar:s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),visivel:()=>true,textoDe:e=>e.textContent,
  carregarEntidadesNpc:async()=>({forEach:f=>f(npc)}),carregarCaminhadaBio4:async()=>({andar(x,y){walks.push([x,y]);if(!options.noWalk)p={mapa:'prontera',x,y};return true;}}),
  esperarAte:async f=>f(),segurarRetorno:(_,s)=>{logs.push(s);return false;},religarEconomia:async()=>{},validarChegadaFarm:()=>p.mapa==='lhz_inv'};
 vm.createContext(ctx);
 vm.runInContext(part('  const mapaCheffenia =','  let ultimoTimerConteudo =')+part('  const tempoConteudoEsgotado =','  const PORTEIRO_BIO4 =')+part('  const dialogoLhz =','  const entrarCheffenia =')+
 '\nglobalThis.api={entrarLhz,tempoConteudoEsgotado,revalidarProntera,encerrarAcessoConteudo,mapaConfereConteudo};',ctx);
 return {ctx,w,logs,get reloads(){return reloads},get enters(){return enters},walks};
}
(async()=>{
 let a=setup();assert.equal(a.ctx.api.revalidarProntera(a.w),false);assert.equal(a.reloads,1);assert.equal(a.ctx.api.revalidarProntera(a.w),true);assert.equal(a.reloads,1,'Only one refresh before entry across persisted config');
 assert.equal(await a.ctx.api.entrarLhz(a.w),true);assert.ok(a.walks.length>0);assert.equal(a.enters,1);assert.equal(a.ctx.cfg.conteudo.mapa,'lhz_inv');assert.equal(a.ctx.api.mapaConfereConteudo('lhz_inv'),true);
 a=setup(60,{needsClose:true});assert.equal(await a.ctx.api.entrarLhz(a.w),true,'Server warp waits for Fechar after selecting entry');assert.equal(a.enters,1);
 a=setup(0);assert.equal(await a.ctx.api.entrarLhz(a.w),false);assert.equal(a.enters,0);assert.equal(a.ctx.api.tempoConteudoEsgotado(),true);assert.equal(a.ctx.recuperacao,null);assert.equal(a.ctx.vigia,null);
 a=setup(60,{noWalk:true});assert.equal(await a.ctx.api.entrarLhz(a.w),false);assert.equal(a.enters,0,'No blind click without walking confirmation');
 a=setup(60,{noArrival:true});assert.equal(await a.ctx.api.entrarLhz(a.w),false);assert.equal(a.enters,1,'Click is not a confirmed entry');
 a=setup();a.ctx.cfg.ligado=false;assert.equal(await a.ctx.api.entrarLhz(a.w),false);assert.equal(a.enters,0);assert.equal(a.walks.length,0);
 console.log('OK: LHZ native walk, exact NPC/option, positive daily balance, confirmed server timer/map, terminal exhaustion, OFF and bounded Prontera reload.');
})().catch(e=>{console.error(e);process.exitCode=1});

