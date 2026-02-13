const crypto = require('node:crypto');
const { EventType, MatchState, PlayerStatus, Role } = require('../shared/models');

const PLAYER_COLORS = [
  '#e34b4b',
  '#3b7dd8',
  '#f0a534',
  '#2d9d78',
  '#8b61c2',
  '#d87aa6',
  '#4f4f4f',
  '#6bc1d1',
];

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickPlayerColor(players) {
  const used = new Set(players.map((p) => p.color).filter(Boolean));
  const available = PLAYER_COLORS.find((color) => !used.has(color));
  return available || PLAYER_COLORS[players.length % PLAYER_COLORS.length];
}

function makePlayer({ nickname, playerId }) {
  return {
    playerId: playerId || randomId('player'),
    nickname,
    role: null,
    status: PlayerStatus.VIVO,
    completedTasks: [],
    assignedTasks: [],
    color: null,
    joinedAt: Date.now(),
  };
}

function createMatch({ taskCatalog = [], sabotageCatalog = [], impostorCount = 1, tasksPerPlayer = null } = {}) {
  return {
    matchId: randomId('match'),
    entryCode: null,
    impostorCount,
    tasksPerPlayer,
    state: MatchState.LOBBY,
    players: [],
    tasks: taskCatalog,
    sabotageCatalog,
    activeSabotage: null,
    emergencyReason: null,
    events: [],
    processedEventIds: new Set(),
    startedAt: null,
    endedAt: null,
    winner: null,
    lastEndedAt: null,
    lastWinner: null,
  };
}

function assignRoles(players, impostorCount = 1) {
  const indexes = players.map((_, i) => i).sort(() => Math.random() - 0.5);
  const impostorIndexes = new Set(indexes.slice(0, Math.min(impostorCount, players.length - 1)));

  players.forEach((player, idx) => {
    player.role = impostorIndexes.has(idx) ? Role.IMPOSTOR : Role.TRIPULANTE;
  });
}

function normalizeTasksPerPlayer(match) {
  const total = match.tasks.length;
  if (total === 0) return 0;
  const raw = Number.isFinite(match.tasksPerPlayer) ? match.tasksPerPlayer : total;
  return Math.max(0, Math.min(total, Math.floor(raw)));
}

function assignTasksToPlayers(match) {
  const tasksPerPlayer = normalizeTasksPerPlayer(match);
  for (const player of match.players) {
    if (player.role === Role.TRIPULANTE) {
      const shuffled = shuffle(match.tasks);
      player.assignedTasks = shuffled.slice(0, tasksPerPlayer);
    } else {
      player.assignedTasks = [];
    }
    player.completedTasks = [];
  }
}

function evaluateWinCondition(match) {
  const aliveCrew = match.players.filter((p) => p.role === Role.TRIPULANTE && p.status === PlayerStatus.VIVO);
  if (aliveCrew.length === 0) {
    match.state = MatchState.FINALIZADA;
    match.winner = 'IMPOSTOR_ELIMINOU';
    match.endedAt = Date.now();
    match.lastEndedAt = match.endedAt;
    match.lastWinner = match.winner;
    return;
  }

  let requiredTasks = 0;
  let doneTasks = 0;
  for (const player of aliveCrew) {
    const assigned = player.assignedTasks || [];
    requiredTasks += assigned.length;
    const assignedIds = new Set(assigned.map((t) => t.taskId));
    doneTasks += player.completedTasks.filter((taskId) => assignedIds.has(taskId)).length;
  }

  if (requiredTasks > 0 && doneTasks >= requiredTasks) {
    match.state = MatchState.FINALIZADA;
    match.winner = 'TASKS_COMPLETAS';
    match.endedAt = Date.now();
    match.lastEndedAt = match.endedAt;
    match.lastWinner = match.winner;
  }
}

function resetMatchToLobby(match) {
  match.state = MatchState.LOBBY;
  match.activeSabotage = null;
  match.emergencyReason = null;
  match.startedAt = null;
  match.endedAt = null;
  match.winner = null;
  for (const player of match.players) {
    player.role = null;
    player.status = PlayerStatus.VIVO;
    player.completedTasks = [];
    player.assignedTasks = [];
  }
}

function applyEvent(match, event) {
  if (!event.eventId) {
    throw new Error('eventId required for idempotency');
  }

  if (match.processedEventIds.has(event.eventId)) {
    return { accepted: true, duplicated: true };
  }

  const player = event.playerId ? match.players.find((p) => p.playerId === event.playerId) : null;
  const payload = event.payload || {};

  switch (event.type) {
    case EventType.TASK_COMPLETED: {
      if (!player || player.status !== PlayerStatus.VIVO) break;
      if (player.role !== Role.TRIPULANTE) break;
      if (!player.assignedTasks || !player.assignedTasks.some((t) => t.taskId === payload.taskId)) break;
      if (player.completedTasks.includes(payload.taskId)) break;
      player.completedTasks.push(payload.taskId);
      break;
    }
    case EventType.PLAYER_REPORTED_DEAD: {
      if (!player) break;
      player.status = PlayerStatus.MORTO;
      if (match.state !== MatchState.FINALIZADA) {
        match.state = MatchState.EMERGENCIA;
        match.emergencyReason = 'BODY_REPORTED';
      }
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
      match.emergencyReason = 'HOST';
      break;
    }
    case EventType.EMERGENCY_CLEARED: {
      if (match.state !== MatchState.FINALIZADA) {
        match.state = MatchState.EM_JOGO;
        match.emergencyReason = null;
      }
      break;
    }
    case EventType.GAME_ENDED: {
      match.state = MatchState.FINALIZADA;
      match.winner = payload.winner || 'OUTRA';
      match.endedAt = Date.now();
      match.lastEndedAt = match.endedAt;
      match.lastWinner = match.winner;
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

  if (match.state === MatchState.FINALIZADA) {
    resetMatchToLobby(match);
  }

  return { accepted: true, duplicated: false };
}

function startMatch(match) {
  if (match.state !== MatchState.LOBBY) {
    throw new Error('Match is not in lobby');
  }
  const impostorCount = Number.isFinite(match.impostorCount) ? match.impostorCount : 1;
  assignRoles(match.players, impostorCount);
  assignTasksToPlayers(match);
  match.state = MatchState.EM_JOGO;
  match.startedAt = Date.now();
}

function addPlayer(match, nickname, playerId) {
  if (match.state !== MatchState.LOBBY) {
    throw new Error('Match is not in lobby');
  }
  const existing = match.players.find((p) => p.playerId === playerId);
  if (existing) {
    if (nickname) existing.nickname = nickname;
    return existing;
  }
  const p = makePlayer({ nickname, playerId });
  p.color = pickPlayerColor(match.players);
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
