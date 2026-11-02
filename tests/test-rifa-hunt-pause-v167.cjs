const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','AUTOHUNT-YGGIDLE.user.js'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i);return source.slice(i,j);};
let active=true,tick,writes=0;
const w={__elragEngine:{},document:{body:{innerText:'HP\n100 / 100\n100,0%'}}};
const ctx={window:{top:{__fznAutoVoltarInstancia:{ativa:true,rifaAtiva:()=>active}}},
  cfg:{ligado:false},ocupado:false,jogo:()=>w,posicao:()=>({mapa:'lhz_dun04'}),
  Date:{now:()=>100000},CHAVE_CFG:'cfg',gravarJson:()=>writes++,log:()=>{},
  temJanelaAberta:()=>false,setInterval:fn=>{tick=fn;},reached:0};
vm.createContext(ctx);
vm.runInContext(section('  const pausadoPelaRifa =','  const temJanelaAberta =')+
  section('  const RELIGAR_AP_MS =','  const mapaCheffenia =')+
  section('  const usarAsa =','  setInterval(() => {\n    try { if (ocupado)')+
  section('  const ciclo = async () => {','    const w = jogo();')+
  '\nglobalThis.reached++;}; globalThis.run=ciclo;globalThis.wing=usarAsa;',ctx);
(async()=>{
  for(let i=0;i<100;i++)tick();
  assert.equal(ctx.cfg.ligado,false,'Rifa mantém pausa; vigia do Hunt não religa antes de chegar à cidade');
  assert.equal(writes,0);
  assert.equal(ctx.wing({}, {}, 0),false,'Não teleporta durante rifa');
  ctx.cfg.ligado=true;await ctx.run();assert.equal(ctx.reached,0,'Ciclo de caça não gera cliques paralelos');
  active=false;ctx.cfg.ligado=false;tick();assert.equal(ctx.cfg.ligado,true,'Ao liberar rifa o vigia volta ao comportamento normal');
  await ctx.run();assert.equal(ctx.reached,1);
  console.log('OK: rifa pausa o vigia, ciclo e asas do Auto Hunt até o retorno terminar.');
})().catch(e=>{console.error(e);process.exitCode=1;});
