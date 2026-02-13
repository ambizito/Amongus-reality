# Arquitetura MVP Offline-First (Android/iPhone + Host PC)

## 1. Stack proposta

- **Mobile**: React Native/Expo (camada apresentada aqui em `src/mobile/offlineClient.js`).
- **Servidor**: Node.js HTTP sem dependências externas (`src/server/httpServer.js`).
- **Dashboard host**: Web app simples consumindo API (`src/dashboard/hostActions.js`).
- **Persistência**: JSON local para MVP (`data/state.json` + outbox por app).

## 2. Conceito offline-first aplicado

1. Toda ação crítica gera evento com `eventId` único.
2. Evento entra em **outbox persistente** no app.
3. App tenta envio imediato; sem rede, mantém pendente.
4. Ao reconectar, envia em lote.
5. Servidor aplica idempotência por `eventId`.

## 3. Fluxos suportados no código

- Entrada no lobby.
- Início da partida e distribuição de papéis.
- Conclusão de tasks por evento.
- Reporte de morte.
- Acionamento e resolução de sabotagem.
- Emergência chamada e encerrada pelo host.
- Encerramento automático por vitória de impostor ou tasks completas.

## 4. Contratos de evento

Formato comum:

```json
{
  "eventId": "uuid",
  "matchId": "match_x",
  "playerId": "player_y",
  "type": "TASK_COMPLETED",
  "payload": {"taskId": "O2"},
  "timestampLocal": 1700000000
}
```

## 5. Evolução sugerida para produção do evento

- Trocar JSON file por Postgres/Supabase.
- Adicionar WebSocket para alertas <2s.
- Implementar app mobile visual (scanner QR + minigames).
- Dashboard React com tabela/linha do tempo em tempo real.

## Atualizacoes recentes

- Entrada por codigo numerico de 4 digitos ou QR.
- Host configura quantidade de impostores e tasks por player.
- Reporte de corpo dispara emergencia para todos.
- Mapa do mobile usa imagem com icones.
- Partida finalizada retorna ao lobby.
- Tasks ficam em `src/tasks` (um arquivo por minigame, QR fixo).
- UI dos minigames em `public/tasks` com um arquivo por task.
- Mobile valida sessao salva no reload e volta ao login se a partida terminou.
