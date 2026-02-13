# Visao geral do projeto

App mobile para Android/iPhone e um dashboard web para um jogo presencial estilo Among Us. O foco e um MVP funcional, offline-first, usado em um local fisico especifico, sem requisitos de seguranca.

## Objetivo do jogo

- Jogadores usam o celular para ver papel (Tripulante ou Impostor), mapa e tasks.
- Tasks sao abertas via QR Code no local fisico e executadas localmente.
- Impostor pode acionar sabotagens.
- Host (PC) monitora a partida e dispara Emergencia.
  - O acesso do jogador e via QR da sala ou codigo de 4 digitos.

## Premissas

- Sem escalabilidade, sem autenticacao/criptografia.
- Precisa funcionar bem com dados moveis e quedas de sinal.
- Deve operar offline e sincronizar depois (offline-first).

## Atores

- Jogador (Tripulante): faz tasks e resolve sabotagens.
- Jogador (Impostor/Assassino): aciona sabotagens e elimina verbalmente.
- Host/Administrador (PC): cria, inicia e encerra partida; monitora eventos.

## Arquitetura (Opcao A)

- App Mobile (Android/iOS)
  - Lobby, papel, mapa, QR scanner, minigames, estado do jogador.
  - Camada offline-first com outbox persistente.
- Servidor Online (HTTP simples)
  - Registro de jogadores, eventos e consulta de estado.
  - Canal de alertas (WebSocket ou push) para emergencia/sabotagem.
- Dashboard Web (PC do Host)
  - Painel de controle e monitoramento em tempo real.

## Conceito offline-first

- Cada acao relevante gera um evento com `eventId` unico (UUID).
- Evento entra na outbox local (persistente).
- App tenta enviar; se offline, reenvia depois com retry/backoff.
- Servidor processa eventos idempotentes (nao duplica).
- App sincroniza o estado atual ao reconectar.

## Modelo de dados (minimo)

- Partida
  - `idPartida`, `estado` (LOBBY, EM_JOGO, EMERGENCIA, FINALIZADA)
  - `entryCode`, `impostorCount`, `tasksPerPlayer`
  - `inicioEm`, `fimEm`, `regraVitoria`
- Jogador
  - `idJogador`, `apelido`, `papel`, `status`, `color`
  - `tasksConcluidas`, `assignedTasks`
- Task
  - `idTask`, `tipo`, `qrLocationId`
  - `concluidaPorJogador` (mapa jogador -> bool)
- Sabotagem
  - `idSabotagem`, `tipo`, `ativa`, `qrFixLocationId`

### Eventos (exemplos)

- PLAYER_JOINED
- GAME_STARTED
- QR_SCANNED
- TASK_STARTED
- TASK_COMPLETED
- PLAYER_REPORTED_DEAD
- SABOTAGE_TRIGGERED
- SABOTAGE_RESOLVED
- EMERGENCY_CALLED
- EMERGENCY_CLEARED
- GAME_ENDED

Payload padrao:

```
eventId
idPartida
idJogador
tipo
payload
timestampLocal
```

## Fluxos principais

- Entrar na partida: host cria e gera QR; jogador escaneia e entra.
- Alternativa: jogador digita codigo numerico de 4 digitos.
- Iniciar jogo: host inicia; servidor atribui papeis e apps sincronizam.
- Fazer tasks: escaneia QR, executa minigame local, envia TASK_COMPLETED.
- Morte: vitima reporta no app; servidor marca como MORTO e abre emergencia.
- Sabotagem: impostor aciona; servidor notifica; jogador resolve via QR.
- Emergencia: host aciona e encerra; apps exibem estado atual ao reconectar.
- Fim de jogo: servidor encerra ao atingir regra de vitoria e retorna ao lobby.

## Requisitos funcionais (RF)

- Partida/Lobby: criar partida, entrar via QR, listar jogadores, iniciar jogo.
- Partida/Lobby: host define numero de impostores e tasks por player.
- Mapa/QR: exibir mapa, ler QR, abrir task correta, registrar conclusao.
- Lobby: mostrar jogadores e cor de cada um.
- Offline-first: outbox persistente, sincronizacao, status online/offline.
- Progresso: servidor calcula progresso e encerra automaticamente.
- Morte: jogador reporta morte; servidor bloqueia pontuacao de morto.
- Sabotagem: acionar, alertar, resolver em ponto QR.
- Emergencia: host aciona, app exibe alerta e sincroniza estado.

## Requisitos nao-funcionais (RNF)

- Um codigo-base (React Native/Flutter).
- Minigames locais (sem dependencia de rede).
- Retry/backoff automatico (2s, 5s, 10s, 30s).
- Tolerancia a eventos atrasados e repetidos.
- Latencia pratica < 2s para alertas online.
- UI simples e botao grande com feedback.
- Sem requisitos de seguranca (escopo).

## Tasks (minigames)

- Lixo: arrastar itens para fora.
- Download: barra + botoes aleatorios.
- Armas: tocar meteoros ate 20 pontos.
- O2: arrastar folhas para fora.
- Navegacao: levar nave A->B e manter 1s.
- Escudo: clicar em secoes ate branco.
- Combustivel: segurar botao em A e B.
- Fios: conectar cores iguais.
- Eletrica com ritmo: acertar N vezes.

### Pasta de tasks

- Definicoes de tasks ficam em `src/tasks`.
- Cada minigame tem um arquivo proprio.
- QRs sao fixos e nao mudam.
- UI dos minigames vive em `public/tasks`.

## Dashboard (Host PC)

- Criar partida e gerar QR/codigo.
- Listar jogadores e status.
- Mostrar progresso global.
- Mostrar sabotagem ativa.
- Log de eventos em tempo real.
- Acoes: iniciar, emergencia, encerrar emergencia, finalizar partida.

## Regras simples para reduzir bugs

- EventId unico (idempotencia no servidor).
- Outbox persistente no app.
- Servidor valida status (morto nao pontua task).
- App puxa estado atual ao reconectar.
- Sabotagem/emergencia so aparecem ao reconectar se offline.
- Ao recarregar a pagina, o app valida se a partida terminou e volta ao login se preciso.
