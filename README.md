# Amongus Reality - MVP Offline-First

MVP técnico para jogo presencial estilo Among Us com foco em funcionamento em rede móvel instável.

## O que está implementado neste repositório

- **Engine de partida** com regras de estado, sabotagem, emergência, morte e finalização.
- **Servidor HTTP Node (sem dependências externas)** para:
  - criar partida;
  - registrar jogador;
  - iniciar jogo;
  - enviar eventos idempotentes (`eventId`);
  - consultar estado atual.
- **Camada mobile offline-first (simulada)** com outbox persistente em arquivo.
- **Módulo de dashboard (simulado)** com comandos do host.
- **Testes automatizados** cobrindo idempotência, outbox e regras centrais.

## Como executar

```bash
node src/server/httpServer.js
```

Servidor sobe em `http://localhost:8080`.

## Rodar testes

```bash
node --test
```

## Endpoints principais

- `POST /matches`
- `POST /matches/:matchId/players`
- `POST /matches/:matchId/start`
- `POST /matches/:matchId/events`
- `POST /matches/:matchId/emergency`
- `POST /matches/:matchId/emergency/clear`
- `GET /matches/:matchId/state`

## Observações

- Projeto propositalmente sem autenticação/criptografia (escopo solicitado).
- Persistência em JSON local (`./data/state.json`).
- Código pensado para ser base de evolução para app React Native/Flutter e dashboard web real.
