const crypto = require('node:crypto');
const { EventType, MatchState, PlayerStatus, Role } = require('../shared/models');

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function makePlayer({ nickname, playerId }) {
  return {
    playerId: playerId || randomId('player'),
    nickname,
    role: null,
    status: PlayerStatus.VIVO,
    completedTasks: [],
    joinedAt: Date.now(),
  };
}

function createMatch({ taskCatalog = [], sabotageCatalog = [] } = {}) {
  return {
    matchId: randomId('match'),
    state: MatchState.LOBBY,
    players: [],
    tasks: taskCatalog,
    sabotageCatalog,
    activeSabotage: null,
    events: [],
    processedEventIds: new Set(),
    startedAt: null,
    endedAt: null,
    winner: null,
  };
}

function assignRoles(players, impostorCount = 1) {
  const indexes = players.map((_, i) => i).sort(() => Math.random() - 0.5);
  const impostorIndexes = new Set(indexes.slice(0, Math.min(impostorCount, players.length - 1)));

  players.forEach((player, idx) => {
    player.role = impostorIndexes.has(idx) ? Role.IMPOSTOR : Role.TRIPULANTE;
  });
}

function evaluateWinCondition(match) {
  if (![MatchState.EM_JOGO, MatchState.EMERGENCIA].includes(match.state)) {
    return;
  }

  const aliveCrew = match.players.filter((p) => p.role === Role.TRIPULANTE && p.status === PlayerStatus.VIVO);
  if (aliveCrew.length === 0) {
    match.state = MatchState.FINALIZADA;
    match.winner = 'IMPOSTOR_ELIMINOU';
    match.endedAt = Date.now();
    return;
  }

  const requiredTasks = match.tasks.filter((t) => !t.impostorOnly).length;
  const doneByAliveCrew = new Set();
  for (const player of match.players) {
    if (player.role === Role.TRIPULANTE && player.status === PlayerStatus.VIVO) {
      for (const taskId of player.completedTasks) {
        doneByAliveCrew.add(taskId);
      }
    }
  }

  if (requiredTasks > 0 && doneByAliveCrew.size >= requiredTasks) {
    match.state = MatchState.FINALIZADA;
    match.winner = 'TASKS_COMPLETAS';
    match.endedAt = Date.now();
  }
}

function applyEvent(match, event) {
  if (!event.eventId) {
    throw new Error('eventId obrigatório para idempotência');
  }

  if (match.processedEventIds.has(event.eventId)) {
    return { accepted: true, duplicated: true };
  }

  const player = event.playerId ? match.players.find((p) => p.playerId === event.playerId) : null;
  const payload = event.payload || {};

  switch (event.type) {
    case EventType.TASK_COMPLETED: {
      if (!player || player.status !== PlayerStatus.VIVO) break;
      if (player.completedTasks.includes(payload.taskId)) break;
      player.completedTasks.push(payload.taskId);
      break;
    }
    case EventType.PLAYER_REPORTED_DEAD: {
      if (!player) break;
      player.status = PlayerStatus.MORTO;
      break;
    }
    case EventType.SABOTAGE_TRIGGERED: {
      if (!player || player.role !== Role.IMPOSTOR) break;
      match.activeSabotage = {
        sabotageId: payload.sabotageId,
        type: payload.type,
        qrFixLocationId: payload.qrFixLocationId,
        triggeredBy: player.playerId,
        active: true,
      };
      break;
    }
    case EventType.SABOTAGE_RESOLVED: {
      if (!player || player.status !== PlayerStatus.VIVO) break;
      if (match.activeSabotage && match.activeSabotage.active) {
        match.activeSabotage.active = false;
      }
      break;
    }
    case EventType.EMERGENCY_CALLED: {
      match.state = MatchState.EMERGENCIA;
      break;
    }
    case EventType.EMERGENCY_CLEARED: {
      if (match.state !== MatchState.FINALIZADA) {
        match.state = MatchState.EM_JOGO;
      }
      break;
    }
    case EventType.GAME_ENDED: {
      match.state = MatchState.FINALIZADA;
      match.winner = payload.winner || 'OUTRA';
      match.endedAt = Date.now();
      break;
    }
    default:
      break;
  }

  match.processedEventIds.add(event.eventId);
  match.events.push({ ...event, serverReceivedAt: Date.now() });

  if (match.state !== MatchState.FINALIZADA) {
    evaluateWinCondition(match);
  }

  return { accepted: true, duplicated: false };
}

function startMatch(match) {
  if (match.state !== MatchState.LOBBY) {
    throw new Error('Partida não está no lobby');
  }
  assignRoles(match.players);
  match.state = MatchState.EM_JOGO;
  match.startedAt = Date.now();
}

function addPlayer(match, nickname, playerId) {
  if (match.state !== MatchState.LOBBY) {
    throw new Error('Só é possível entrar no lobby');
  }
  const p = makePlayer({ nickname, playerId });
  match.players.push(p);
  return p;
}

module.exports = {
  createMatch,
  addPlayer,
  startMatch,
  applyEvent,
  evaluateWinCondition,
};
