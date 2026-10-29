# Auto-voltar Yggidle

Script de automação do Yggidle usado no FZN Idle Hub. Esta pasta contém a versão de desenvolvimento para controle de alterações. A configuração de cada conta continua salva localmente no Hub/jogo e não faz parte deste repositório.

## Arquivos

- `AUTOVOLTAR-YGGIDLE.user.js`: script principal, versão 2.57.
- `AUTOLOGIN-YGGIDLE.user.js`: login automático e recuperação de conexão, versão 1.25.
- `ABATES-YGGIDLE.user.js`: contador independente de abates por dia, monstro e hora.
- `AUTOHUNT-YGGIDLE.user.js`: complemento do Autopilot, versão 1.64; asa da Cheffenia opcional, proteção contra teleporte durante combate com MVP, retorno pelo Arauto após morte com Poder Infernal e retomada da caça no Covil.
- `tests/`: verificações locais dos fluxos de aviso diário, Loja de Cash, evento, mochila e limites.

## Comportamento principal

O Auto-voltar acompanha peso, espaços da mochila, morte e mapa de farm. Conforme as opções de cada conta, usa Cartão Kafra/Loja de Bolso no mapa ou volta à cidade para guardar, desmantelar, vender e retornar. Itens travados não são destravados pelo script. A opção **Rotina por limite** permite continuar farmando mesmo acima dos limites quando desligada.

A conferência periódica mostra o mapa atual quando ele difere do destino de farm. Se o personagem permanecer fora do destino por 15 segundos sem outra rotina de retorno, o Auto-voltar inicia a recuperação. Um mapa digitado manualmente fica pendente até a chegada; mapas intermediários não substituem esse destino. Durante a rifa e nas instâncias com rotina própria, a conferência não inicia outra viagem.

Se o jogo deixar o personagem morto sem abrir a tela de retorno, o Auto-voltar tenta abrir o Menu e voltar ao ponto de salvamento. No Covil, tanto o Auto-voltar quanto o Auto Hunt conferem se o Autopilot está realmente ligado após a entrada.

Na versão 2.21, a Loja de Cash é fechada automaticamente **somente** quando o Auto-voltar está ligado. O aviso diário continua sendo dispensado ao marcar “Não mostrar novamente hoje” e fechar.

Na versão 2.22, ovos de pet, inclusive o Ovo de Esqueleto, ficam na mochila nos modos de depósito e são protegidos da venda e do Ferreiro.

Na versão 2.23, o botão **Lucky drops** aceita um nome exato por linha (por padrão, `Ovo da La Voisin`). Quando um item procurado aparece ou aumenta na mochila, o painel mantém um aviso até ser fechado e envia uma notificação do sistema caso o Hub já tenha essa permissão. A lista protege os itens da venda e do Ferreiro. O painel mostra a quantidade atual na mochila e a última leitura da Kafra, com horário; abra o armazém para atualizar essa leitura. Ovos de pet continuam fora do depósito.

## Contador de abates

O script separado **Contador de abates** registra monstros que morreram até 15 segundos após receberem um golpe do próprio personagem. Seu botão compacto abre os totais por espécie, por hora e por espécie em cada hora. O campo de monstro de interesse começa com `Stefan J. E. Wolf`; pontuação e espaços diferentes no nome não afetam essa comparação. **Pausar**, **Nova sessão** e **CSV** controlam a análise. A sessão fica salva localmente na conta e continua após recarregar o jogo.

A contagem é uma **estimativa baseada nos eventos visíveis ao cliente**: outro jogador pode dar o golpe final, e mortes ocorridas enquanto a captura não estiver ativa não entram. O script não ataca nem altera o Auto-voltar.

## Verificação local

Com Node.js instalado:

```powershell
node --check .\AUTOVOLTAR-YGGIDLE.user.js
node --check .\AUTOHUNT-YGGIDLE.user.js
node --check .\AUTOLOGIN-YGGIDLE.user.js
node --check .\ABATES-YGGIDLE.user.js
node .\tests\test-farm-watchdog.cjs
node .\tests\test-autopilot-death.cjs
node .\tests\test-mvp-combat.cjs
```

## Aplicação no Hub

No FZN Idle Hub, em **Scripts**, selecione **GitHub** e use o arquivo [AUTOVOLTAR-YGGIDLE.user.js](https://github.com/MarcusHenriq99/auto-voltar-hub/blob/main/AUTOVOLTAR-YGGIDLE.user.js) da branch `main`. O cartão **Auto voltar GitHub** está ligado para todas as contas; a antiga cópia colada no Hub deve permanecer desligada para evitar duas execuções.

Depois de publicar uma mudança na `main`, clique **Verificar agora** no cartão do script. O Hub consulta o GitHub nesse momento; confirme a nova versão no cartão e no painel do Auto-voltar. Mantenha **Manter jogo em segundo plano** ligado caso queira que o Hub continue rodando ao trocar de janela.
