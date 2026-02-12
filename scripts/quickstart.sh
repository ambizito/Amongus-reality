#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
json_get() {
  local json="$1"
  local key="$2"
  node -e "const o=JSON.parse(process.argv[1]); const v=o[process.argv[2]]; if(v===undefined){process.exit(2)}; console.log(v)" "$json" "$key"
}

echo "[1/8] Criando partida em ${BASE_URL}..."
CREATE_RESP=$(curl -sS -X POST "${BASE_URL}/matches")
MATCH_ID=$(json_get "$CREATE_RESP" "matchId")

echo "Partida criada: ${MATCH_ID}"

echo "[2/8] Registrando jogadores..."
P1_RESP=$(curl -sS -X POST "${BASE_URL}/matches/${MATCH_ID}/players" -H 'Content-Type: application/json' -d '{"nickname":"Ana"}')
P2_RESP=$(curl -sS -X POST "${BASE_URL}/matches/${MATCH_ID}/players" -H 'Content-Type: application/json' -d '{"nickname":"Bruno"}')
P3_RESP=$(curl -sS -X POST "${BASE_URL}/matches/${MATCH_ID}/players" -H 'Content-Type: application/json' -d '{"nickname":"Carla"}')

P1=$(json_get "$P1_RESP" "playerId")
P2=$(json_get "$P2_RESP" "playerId")
P3=$(json_get "$P3_RESP" "playerId")

echo "Jogadores: $P1 | $P2 | $P3"

echo "[3/8] Iniciando partida..."
curl -sS -X POST "${BASE_URL}/matches/${MATCH_ID}/start" >/dev/null

echo "[4/8] Buscando estado inicial (papéis atribuídos)..."
STATE=$(curl -sS "${BASE_URL}/matches/${MATCH_ID}/state")
echo "$STATE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const s=JSON.parse(d);console.log('Estado:',s.state);for(const p of s.players){console.log('-',p.nickname,'=>',p.role)}})"

echo "[5/8] Enviando evento de task concluída (Ana)..."
TASK_EVENT=$(node -e "console.log(JSON.stringify({eventId:require('node:crypto').randomUUID(),playerId:'${P1}',type:'TASK_COMPLETED',payload:{taskId:'LIXO'},timestampLocal:Date.now()}))" )
curl -sS -X POST "${BASE_URL}/matches/${MATCH_ID}/events" -H 'Content-Type: application/json' -d "$TASK_EVENT" >/dev/null

echo "[6/8] Host chama emergência..."
curl -sS -X POST "${BASE_URL}/matches/${MATCH_ID}/emergency" -H 'Content-Type: application/json' -d "$(node -e "console.log(JSON.stringify({eventId:require('node:crypto').randomUUID()}))")" >/dev/null

echo "[7/8] Host encerra emergência..."
curl -sS -X POST "${BASE_URL}/matches/${MATCH_ID}/emergency/clear" >/dev/null

echo "[8/8] Estado final:"
curl -sS "${BASE_URL}/matches/${MATCH_ID}/state" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const s=JSON.parse(d);console.log(JSON.stringify({matchId:s.matchId,state:s.state,activeSabotage:s.activeSabotage,players:s.players.map(p=>({nickname:p.nickname,status:p.status,role:p.role,tasks:p.completedTasks}))},null,2))})"

echo
echo "Quickstart concluído."
