# Auto-voltar Yggidle

Script de automação do Yggidle usado no FZN Idle Hub. Esta pasta contém a versão de desenvolvimento para controle de alterações. A configuração de cada conta continua salva localmente no Hub/jogo e não faz parte deste repositório.

## Arquivos

- `AUTOVOLTAR-YGGIDLE.user.js`: script principal, versão 3.17.
- `AUTOLOGIN-YGGIDLE.user.js`: login automático e recuperação de conexão, versão 1.26.
- `ABATES-YGGIDLE.user.js`: contador independente de abates por dia, monstro e hora.
- `AUTOHUNT-YGGIDLE.user.js`: complemento do Autopilot, versão 1.70; asa da Cheffenia opcional, proteção contra teleporte durante combate com MVP, retorno pelo Arauto após mudança real para Prontera e retomada da caça no Covil.
- `tests/`: verificações locais dos fluxos de aviso diário, Loja de Cash, evento, mochila e limites.

## Comportamento principal

A v3.17 também mostra `Mochila usados/capacidade` no status com dados recentes, mesmo com o inventário fechado; `?` indica que falta uma leitura recente.

A v3.16 desmarca LHZ/Bio 4/Cheffenia ao confirmar o fim do tempo por aviso novo do servidor, contador zerado ou bloqueio já salvo. Restaura o destino normal que estava salvo antes de ativar o conteúdo e mantém a intenção de retorno em disco até confirmar chegada. Se o servidor ainda não retirou o personagem do conteúdo, usa a saída antes de retomar a rotina normal. Não usa um relógio antigo de Cheffenia fora do mapa como prova de tempo esgotado, nem reage a avisos históricos já visíveis ao relogar. Sem destino anterior configurado, informa a falta e não inventa outro mapa.

Também corrige a contagem da mochila fechada durante drops contínuos: cada `updateInventorySnapshot` já contém a lista completa, então não exige 700 ms sem atualização para aceitar o número de slots. O limite de 95% continua sendo confirmado antes da rotina; preserva capacidade 100/200, itens protegidos e opções de venda/armazém de cada conta. A v3.16 foi instalada no Hub. A venda observada na conta 2 às 16:21 ocorreu antes da instalação desta revisão às 16:24, portanto não é prova de disparo com a correção. Testes reproduzem 100/100 com atualizações a cada 200 ms, restauração de destino por conteúdo, migração do bloqueio antigo e anúncios antigos/de outro conteúdo.

A v3.15 corrige o retorno após reinício/recarga: o histórico da conta 1 mostrou o modo LHZ preservado, mas a v3.14 recusava prosseguir por não localizar o NPC pelo nome. A nova aproximação usa o ceifador validado em 140,194 e para no chão 142,194 mesmo quando a entidade ainda está fora da área carregada. Aceita a entidade NPC nessa posição sem exigir o nome; continua exigindo diálogo de LHZ, saldo positivo, opção exata, fechamento da fala e confirmação do mapa/contador. Teste local reproduz login sem nome e sem entidade antes da aproximação. A conta já tinha voltado manualmente quando o diagnóstico foi feito; o farm atual foi preservado.

A v3.14 acrescenta o modo **Invasão LHZ**: caminha até a entidade do NPC à esquerda de Prontera, lê os minutos restantes e escolhe somente **Ir para a cidade tomada** e fecha a fala do NPC para concluir o teleporte. Confirma o novo mapa junto ao contador de rede de LHZ antes de retomar a caça. Bio 4 e LHZ fazem uma atualização simples por passagem por Prontera antes de retornar, com marca persistida antes da recarga para impedir loops; isso é prevenção contra o limbo, não uma detecção pela quantidade de jogadores. Os dois modos ignoram serviços de cidade e usam Folha no próprio conteúdo. Sem acesso oferecido no Porteiro de Bio 4, ou sem tempo em LHZ/contador do servidor, o retorno fica suspenso; não compra acesso e não tenta indefinidamente. Após renovar, desligue e ligue o modo para liberar nova tentativa. Configurações individuais são preservadas.

Verificação local: sintaxe e testes de caminhada/NPC/entrada LHZ, saldo zero, recarga única da aplicação completa, fechamento obrigatório da fala, Bio 4 sem passe, retorno sem serviços e renascimento com prazo do servidor.

Validação ao vivo em 06/11/2026, conta 1 (StarManny), Auto-voltar 3.14: caminhada curta de Prontera 146,191 → 142,194 até o ceifador (NPC em 140,194); saldo de 60 minutos informado pelo NPC. Após selecionar a cidade tomada e fechar a fala, chegada confirmada em `mid_lhzinv` às 14:44:59, Autopilot confirmado às 14:45:01, contador de 59 minutos e monstros presentes. Zeny permaneceu em 113.218.248. A revisão foi aplicada no cartão do Hub; somente a conta 1 teve o novo modo ativado para teste. A primeira recarga apenas do api.html foi corrigida para recarregar a aplicação completa (v3.13), que voltou ao jogo preservando a sessão. Não houve reprodução controlada do limbo, expulsão por três mortes ou esgotamento real de tempo; esses limites foram verificados localmente.

O Auto-voltar acompanha peso, espaços da mochila, morte e mapa de farm. Conforme as opções de cada conta, usa Cartão Kafra/Loja de Bolso no mapa ou volta à cidade para guardar, desmantelar, vender e retornar. Itens travados não são destravados pelo script. A opção **Rotina por limite** permite continuar farmando mesmo acima dos limites quando desligada.

Na versão 3.11, morrer em Bio 4/Cheffenia **não autoriza voltar ao salvamento**. O histórico ao vivo da conta 1 confirmou o defeito da v3.10 às 12:16:49: ela desistia após 3 segundos sem botão liberado e clicava em salvamento. Essa alternativa foi removida dos mapas com renascimento próprio. O script abre o menu, captura `updateEscapeSnapshot` e espera o prazo do servidor (`reviveAvailableAt`) e a Folha (`hasLeaf`); usa `reviveNow` ou um único evento no botão habilitado. Só retoma a caça após confirmar vida no mesmo mapa. Sem Folha/botão, espera no conteúdo; não usa salvamento nem recarga. Se o mapa realmente mudar para Prontera por uma expulsão, segue o retorno pelo NPC. O Auto Hunt 1.70 também não usa salvamento por Poder Infernal e deixa o renascimento com o Auto-voltar quando ele está ativo, evitando duas rotinas sobre a mesma Folha. Nenhuma configuração nova de LHZ foi criada nesta alteração.

Validação ao vivo em 06/11/2026 após aplicar Auto-voltar 3.11 e Auto Hunt 1.70 no Hub: morte natural da conta 1 às 12:31:42, espera pelo renascimento às 12:31:43 e vida/caça confirmadas no mesmo `lhz_dun04` às 12:31:48, sem passagem por Prontera. Esse episódio não registrou pedido explícito de Folha pelo macro; portanto não comprova consumo do item pelo script. O pedido nativo com prazo do servidor, o botão habilitado, falta de Folha e expulsão real estão cobertos por testes locais; a Cheffenia ainda não foi validada ao vivo nesta revisão.

Na versão 3.10, **Bio 4 marcado ignora storage, venda e os demais serviços de cidade**, inclusive após morte, expulsão, tentativa de retorno que falhou ou execução manual. Não dispara viagens por peso/slots nesse modo e não consulta peso/inventário antes de voltar pelo Porteiro. As configurações de venda e armazém da conta ficam preservadas para os outros modos. Corrigida a identificação da janela real do Porteiro: `HudPanel` usa `data-hud-presentation`, não publica `windowId` como `data-hud-window`. O histórico da conta 1 confirmou que a v3.09 caía na conversa antiga e aguardava o botão errado. Os testes agora reproduzem o portal real sem aquele atributo inexistente e impedem qualquer chamada de storage/venda durante o retorno de Bio 4.

Teste ao vivo da v3.10 em 06/11/2026, conta 1 (StarManny): após saída controlada do Bio 4, chegada a Prontera às 12:02:29, caminhada automática 155,183 → 167,181 às 12:02:30, entrada em `lhz_dun04` confirmada pelo Porteiro às 12:02:33 e Autopilot confirmado às 12:02:35. Sem storage/venda, sem nova compra de passe e com 113.218.248 zeny preservados. A v3.10 foi confirmada nos painéis das duas contas; apenas a conta 1 foi usada no teste de saída e retorno. Não foram provocadas três mortes para testar a expulsão.

Na versão 3.09, o retorno de Bio 4 caminha por coordenadas de mapa até o lado direito de Prontera, conversa com a entidade do Porteiro (170,184) e aceita a janela nova de entrada ou retorno à dupla. A caminhada não depende de foco, câmera ou resolução. Depois de o servidor mandar o personagem para Prontera (inclusive após três mortes rápidas), a recuperação usa o conteúdo marcado nesta conta e confirma `lhz_dun04` antes de retomar a caça. O saldo do passe é confirmado pelo NPC: o relógio estimado não bloqueia o retorno, pois o passe só corre dentro do andar. Sem acesso disponível, fecha a janela e aguarda; não compra passe nem gasta limite diário automaticamente.

Validação de 06/11/2026: na conta 1, StarManny caminhou de Prontera 155,183 até 168,181, abriu o Porteiro e fechou a janela sem compra (126.996.866 zeny preservados; NPC sem passe). A entrada paga não foi testada, por decisão do usuário. Testes locais verificam a caminhada por coordenadas sem câmera, interação com a entidade, janela nova/dupla, confirmação de chegada, ausência de passe e recuperação após retorno forçado. A versão publicada e a instalada no Hub são etapas separadas.

Na versão 3.07, o monitor captura a consulta dos itens mesmo quando o painel da mochila ainda não registrou seu receptor. A capacidade é consultada no motor do jogo sem abrir a janela. Aos 95/100 ou 190/200 espaços, novos drops não reiniciam a confirmação, e a conferência final aceita o limite de slots mesmo sem leitura de peso. Testes locais cobrem mochila fechada, receptor ausente/substituído, peso baixo/indisponível e liberação dos slots antes da viagem; a atualização ainda requer validação na conta pelo Hub.

O Auto Login 1.26 reconhece a nova seleção de personagens: clica no nome exato salvo para a conta, confirma o cartão selecionado e o nome no painel lateral e só então clica em **Jogar**. Não entra por correspondência parcial de nome nem envia uma entrada paralela pelo motor na HUD nova. Mantém o botão Entrar da tela antiga, as pausas por seleção manual/servidor fechado e a retomada da caça. A publicação não instala a atualização no Hub; confirme a versão 1.26 na conta para validar ao vivo.

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




