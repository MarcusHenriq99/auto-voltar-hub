const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i);return source.slice(i,j);}
const ctx={Date:{now:()=>100000},botaoPorTexto:()=>({click:()=>{throw Error('Não gastar Folha nem usar salvamento estando vivo');}})};
vm.createContext(ctx);
vm.runInContext(section('  let ponteMorteJanela =','  const recuperarMorteSemDialogo =')+'\nglobalThis.dead=morteConfirmada;',ctx);
const w={document:{body:{innerText:'HP\n35.804 / 35.804\n100,0%\nMenu\nVoltar ao ponto de salvamento\nRenascer agora (gasta 1 Folha de Yggdrasil)'},head:{appendChild:()=>{}},createElement:()=>({})}};
assert.equal(ctx.dead(w),false,'Reprodução da conta 1: vivo em Prontera com menu aberto');
w.document.body.innerText='HP\n1 / 100\n1,0%\nRenascer agora\nVoltar ao ponto de salvamento';
assert.equal(ctx.dead(w),false,'Um HP vivo não é morte');
w.document.body.innerText='HP\n1 / 35.804\n0,0%\nMenu';
assert.equal(ctx.dead(w),true,'HP mortal funciona mesmo sem os botões');
w.document.body.innerText='Renascer agora\nVoltar ao ponto de salvamento';
assert.equal(ctx.dead(w),false,'Menu sozinho, sem evidência de HP ou entidade, não confirma morte');
w.__fznEu=()=>({ACTION:{DIE:5},action:5});
assert.equal(ctx.dead(w),true,'Morte real da entidade continua detectada');
vm.runInContext(section('  const aoMorrer =','  let ponteMorteJanela =')+
  section('  const mapaCovil =','  const gidDoMvp =')+
  '\nglobalThis.die=aoMorrer;globalThis.revive=renascerNoCovil;',ctx);
w.__fznEu=()=>({ACTION:{DIE:5},action:0});
(async()=>{
  await ctx.die(w,{click:()=>{throw Error('Não voltar ao salvamento vivo');}});
  await ctx.revive(w);
  console.log('OK: menu comum não prende personagem vivo nem autoriza Folha ou salvamento.');
})().catch(e=>{console.error(e);process.exitCode=1;});
