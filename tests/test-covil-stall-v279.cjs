const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const section = (a,b) => { const i=source.indexOf(a),j=source.indexOf(b,i); assert.ok(i>=0&&j>i); return source.slice(i,j); };
let now=100000, mode='idle', gid=0, map='1@tower', x=10, calls=[], radar=[], corpse=null, dead=false;
const w={document:{body:{get innerText(){return 'Autopilot: '+(mode==='idle'?'Aguardando':'Atacando');}}},__elragEngine:{
  getAutopilotSnapshot:()=>({runtimeState:2,targetGid:gid}), getAutopilotRadarSnapshot:()=>({mobs:radar}),
  setAutopilotPinnedTarget:v=>calls.push(['target',v]),
}};
const ctx={Date:{now:()=>now},cfg:{ligado:true,covil:{ligado:true}},covil:{viu:true,gid:42},
  mapaCovil:p=>p.mapa==='1@tower',posicao:()=>({mapa:map,x,y:10}),morteConfirmada:()=>dead,
  carregarEntidadesNpc:async()=>({get:()=>corpse}),ligarAutopilot:(_w,v)=>calls.push(['run',v]),
  esperar:async ms=>{now+=ms;},log:()=>{},};
vm.createContext(ctx);vm.runInContext(section('  const recuperarCovilParado =','  const mvpNoRadar =')+'\nglobalThis.recover=recuperarCovilParado;',ctx);
(async()=>{
  const c={mobId:1734,nome:'Kiel'};
  await ctx.recover(w,c);now+=11999;await ctx.recover(w,c);assert.equal(calls.length,0);
  now++;await ctx.recover(w,c);assert.deepEqual(calls,[['target',0],['run',false],['run',true]]);
  assert.equal(ctx.covil.morteConfirmadaEm,undefined,'Radar vazio nunca confirma abate');
  calls=[];now+=1000;await ctx.recover(w,c);assert.equal(calls.length,0,'Não repete a recuperação em rajada');
  now+=16000;mode='attack';gid=42;await ctx.recover(w,c);assert.equal(calls.length,0,'Não interrompe combate');
  mode='idle';gid=0;x++;await ctx.recover(w,c);now+=12000;
  radar=[{mobId:1734,gid:42}];await ctx.recover(w,c);assert.deepEqual(calls,[['target',42],['run',true]]);
  calls=[];radar=[];x++;now+=16000;await ctx.recover(w,c);now+=12000;
  corpse={_job:1734,isDead:()=>true};await ctx.recover(w,c);
  assert.ok(ctx.covil.morteConfirmadaEm,'Cadáver do GID acompanhado confirma abate perdido');
  assert.equal(calls.length,0,'Confirmação não reinicia a caça');
  ctx.covil.morteConfirmadaEm=0;ctx.covil.mortePendente=true;now+=20000;await ctx.recover(w,c);
  assert.equal(calls.length,0,'Morte do personagem tem prioridade');
  let logs=0;const stage={andamento:{etapa:'Covil',detalhe:'esperando',desde:1},Date:{now:()=>now},log:()=>logs++};
  vm.createContext(stage);vm.runInContext(section('  const etapa =','  let historicoMem =')+'\nglobalThis.stage=etapa;',stage);
  for(let i=0;i<100;i++)stage.stage('Covil','esperando');
  assert.equal(logs,0);assert.equal(stage.andamento.desde,1,'Etapa igual preserva o tempo de espera');
  stage.stage('Covil','recuperando');assert.equal(logs,1);
  console.log('OK: recupera covil parado sem alvo, respeita combate/morte e preserva duração sem spam.');
})().catch(e=>{console.error(e);process.exitCode=1;});
