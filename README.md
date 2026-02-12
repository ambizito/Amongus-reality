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
npm install
npm run start
```

Servidor sobe em `http://localhost:8080`.

---

## “Subi o server, e agora?” (fluxo prático em 5 minutos)

Com o servidor rodando em um terminal, abra outro terminal e rode:

```bash
npm run quickstart
```

Esse script automaticamente:
1. cria uma partida;
2. registra 3 jogadores;
3. inicia o jogo;
4. mostra os papéis sorteados;
5. envia uma task concluída;
6. chama e encerra emergência;
7. imprime o estado final.

> Se seu servidor estiver em outra URL (ex: VPS), rode:
>
> ```bash
> ./scripts/quickstart.sh http://SEU_HOST:8080
> ```

---

## Rodar testes

```bash
npm test
```

## Endpoints principais

- `POST /matches`
- `POST /matches/:matchId/players`
- `POST /matches/:matchId/start`
- `POST /matches/:matchId/events`
- `POST /matches/:matchId/emergency`
- `POST /matches/:matchId/emergency/clear`
- `GET /matches/:matchId/state`

## Teste manual rápido via curl

### 1) Criar partida
```bash
curl -X POST http://localhost:8080/matches
```

### 2) Entrar jogador
```bash
curl -X POST http://localhost:8080/matches/<MATCH_ID>/players \
  -H 'Content-Type: application/json' \
  -d '{"nickname":"Ana"}'
```

### 3) Iniciar partida
```bash
curl -X POST http://localhost:8080/matches/<MATCH_ID>/start
```

### 4) Ver estado completo
```bash
curl http://localhost:8080/matches/<MATCH_ID>/state
```

## Observações

- Projeto propositalmente sem autenticação/criptografia (escopo solicitado).
- Persistência em JSON local (`./data/state.json`).
- Código pensado para ser base de evolução para app React Native/Flutter e dashboard web real.
