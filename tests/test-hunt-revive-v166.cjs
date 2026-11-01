const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','AUTOHUNT-YGGIDLE.user.js'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i);return source.slice(i,j);};
let now=100000,dead=false,owner=false,map='1@tower',clicks=0,ap=0,cycle;
const timers=[];
const button={disabled:false,textContent:'Renascer agora (gasta 1 Folha de Yggdrasil)',
  click:()=>{throw Error('Não chamar click global');},dispatchEvent:()=>{clicks++;}};
const engine={setAutopilotRunning:()=>{ap++;}};
const w={__elragEngine:engine,__fznEu:()=>({ACTION:{DIE:5},action:dead?5:0}),
  MouseEvent:class{},document:{body:{get innerText(){return 'HP\n'+(dead?'0':'100')+' / 100\n'+(dead?'0,0':'100,0')+'%\nRenascer agora\nVoltar ao ponto de salvamento';}},querySelectorAll:()=>[button]}};
const ctx={window:{top:{__fznAutoVoltarInstancia:{ativa:true,controlaCovil:()=>owner}}},
  jogo:()=>w,posicao:()=>({mapa:map}),cfg:{ligado:true},ocupado:false,Date:{now:()=>now},
  gravarJson:()=>{},CHAVE_CFG:'cfg',log:()=>{},temJanelaAberta:()=>false,
  setInterval:fn=>{cycle=fn;},setTimeout:fn=>{timers.push(fn);}};
vm.createContext(ctx);
vm.runInContext(section('  const personagemMorto =','  const temJanelaAberta =')+
  section('  const RELIGAR_AP_MS =','  const mapaCheffenia ='),ctx);
for(let i=0;i<20;i++){now+=4000;cycle();}
assert.equal(clicks,0,'Vivo no covil com menu aberto nunca clica em renascer');
dead=true;owner=true;
for(let i=0;i<10;i++){now+=4000;cycle();}
assert.equal(clicks,0,'Auto-voltar controla o covil: Auto Hunt não duplica a Folha');
owner=false;now+=4000;cycle();assert.equal(clicks,1,'Sem controlador, Hunt renasce morte real com clique único');
map='prontera';dead=false;timers.shift()();assert.equal(ap,0,'Mudança de mapa não confirma renascimento local');
map='1@tower';dead=true;now+=4000;cycle();assert.equal(clicks,2);
dead=false;timers.shift()();assert.equal(ap,1,'Só religa após confirmar vivo no mesmo mapa');
console.log('OK: Auto Hunt não renasce vivo nem disputa Folha com Auto-voltar no covil.');
