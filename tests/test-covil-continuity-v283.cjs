const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','AUTOVOLTAR-YGGIDLE.user.js'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i);return source.slice(i,j);};
let now=100000,map='1@tower',heavy=true,stones=2,kills=0,exits=0,entries=0,sales=0,ended='';
const cfg={ligado:true,covil:{ligado:true,hoje:0,total:0}};
const ctx={window:{},cfg,Date:{now:()=>now},ocupado:false,
  COVIL_LOOT_MS:1000,COVIL_SEM_MVP_MS:25000,COVIL_TETO_MS:28*60000,
  covilAlvo:()=>({mobId:1734,nome:'Kiel',tier:4}),posicao:()=>({mapa:map}),
  emInstancia:p=>p.mapa.includes('@'),observarMorteCovil:async()=>true,
  autopilotLigado:()=>true,ligarAutopilot:()=>{},recuperarCovilParado:async()=>{},mvpNoRadar:()=>false,
  contarCovil:()=>{kills++;},sairDoCovil:async()=>{exits++;map='prontera';return true;},
  etapa:()=>{},log:()=>{},lerMochila:async()=>true,quantosNaMochila:()=>stones,
  itensMochila:()=>Array(6).fill({}),pedraDoCovil:()=>'',precisaVender:()=>heavy,
  viagemDeVenda:async()=>{assert.equal(ctx.ocupado,false,'Venda assume bloqueio próprio');assert.equal(map,'prontera');sales++;heavy=false;},
  entrarNoCovil:async()=>{entries++;map='1@tower';stones--;return true;},
  voltarAoFarmDoCovil:reason=>{ended=reason;cfg.covil.ligado=false;},};
vm.createContext(ctx);
const load=()=>vm.runInContext('(()=>{'+section('  const covil = window.__fznCovilEstado','  const COVIL_SEM_MVP_MS =')+
  section('  const rodadaCovil =','  let cidadeSemRotinaDesde =')+'\nglobalThis.state=covil;globalThis.round=rodadaCovil;})();',ctx);
(async()=>{
  load();Object.assign(ctx.state,{dentro:true,entrouEm:50000,viu:true,gid:42,morteConfirmadaEm:now-1500});
  const oldState=ctx.state;
  load();assert.equal(ctx.state,oldState,'Atualização reutiliza a tentativa acompanhada');
  assert.equal(ctx.state.gid,42);assert.ok(ctx.state.morteConfirmadaEm,'Abate sobrevive à reaplicação');
  await ctx.round({});assert.equal(kills,1);assert.equal(exits,1,'Conclui abate após atualizar');
  await ctx.round({});now+=1000;await ctx.round({});
  assert.equal(sales,1);assert.equal(cfg.covil.ligado,true,'Peso não desliga Covil');
  await ctx.round({});assert.equal(entries,1,'Retoma próxima convocação depois da venda');
  assert.equal(ctx.state.morteConfirmadaEm,0,'Tentativa nova não herda morte antiga');
  assert.equal(stones,1);
  Object.assign(ctx.state,{viu:true,gid:43,morteConfirmadaEm:now-1500});
  await ctx.round({});assert.equal(kills,2);assert.equal(exits,2);
  stones=0;await ctx.round({});now+=1000;await ctx.round({});
  assert.equal(cfg.covil.ligado,false);assert.match(ended,/sem/);
  assert.equal(entries,1,'Sem pedras não abre outra convocação');
  console.log('OK: mantém abate entre atualizações, vende e retoma Covil, encerra sem pedras.');
})().catch(e=>{console.error(e);process.exitCode=1;});
