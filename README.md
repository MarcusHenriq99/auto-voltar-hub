# Auto-voltar Yggidle

Script de automação do Yggidle usado no FZN Idle Hub. Esta pasta contém a versão de desenvolvimento para controle de alterações. A configuração de cada conta continua salva localmente no Hub/jogo e não faz parte deste repositório.

## Arquivos

- `AUTOVOLTAR-YGGIDLE.user.js`: script principal, versão 2.21.
- `tests/`: verificações locais dos fluxos de aviso diário, Loja de Cash, evento, mochila e limites.

## Comportamento principal

O Auto-voltar acompanha peso, espaços da mochila, morte e mapa de farm. Conforme as opções de cada conta, usa Cartão Kafra/Loja de Bolso no mapa ou volta à cidade para guardar, desmantelar, vender e retornar. Itens travados não são destravados pelo script. A opção **Rotina por limite** permite continuar farmando mesmo acima dos limites quando desligada.

Na versão 2.21, a Loja de Cash é fechada automaticamente **somente** quando o Auto-voltar está ligado. O aviso diário continua sendo dispensado ao marcar “Não mostrar novamente hoje” e fechar.

## Verificação local

Com Node.js instalado:

```powershell
node --check .\AUTOVOLTAR-YGGIDLE.user.js
Get-ChildItem .\tests\*.cjs | ForEach-Object { node $_.FullName }
```

## Aplicação no Hub

Substitua o conteúdo do Auto-voltar no editor de scripts do FZN Idle Hub pelo arquivo principal e recarregue cada conta. Confirme a versão no painel do Auto-voltar. Publicar uma versão aqui não altera automaticamente o script ativo no Hub.
