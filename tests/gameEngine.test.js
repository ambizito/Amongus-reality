const test = require('node:test');
const assert = require('node:assert/strict');
const { createMatch, addPlayer, startMatch, applyEvent } = require('../src/core/gameEngine');
const { EventType, MatchState, PlayerStatus } = require('../src/shared/models');

test('idempotência: evento duplicado não duplica task', () => {
  const match = createMatch({ taskCatalog: [{ taskId: 'O2', qrLocationId: 'Q1' }] });
  const p = addPlayer(match, 'Ana', 'p1');
  addPlayer(match, 'Bob', 'p2');
  startMatch(match);

  const event = {
    eventId: 'evt-1',
    playerId: p.playerId,
    type: EventType.TASK_COMPLETED,
    payload: { taskId: 'O2' },
  };

  const first = applyEvent(match, event);
  const second = applyEvent(match, event);

  assert.equal(first.duplicated, false);
  assert.equal(second.duplicated, true);
  assert.equal(p.completedTasks.length, 1);
});



test('eventos no lobby não finalizam partida antes do início', () => {
  const match = createMatch({ taskCatalog: [{ taskId: 'O2', qrLocationId: 'Q1' }] });
  const p = addPlayer(match, 'Ana', 'p1');

  applyEvent(match, {
    eventId: 'evt-lobby-join-log',
    playerId: p.playerId,
    type: EventType.PLAYER_JOINED,
    payload: {},
  });

  assert.equal(match.state, MatchState.LOBBY);
});
test('jogador morto não conclui task', () => {
  const match = createMatch({ taskCatalog: [{ taskId: 'FIOS', qrLocationId: 'Q2' }] });
  const p = addPlayer(match, 'Vítima', 'p_dead');
  addPlayer(match, 'Imp', 'p_imp');
  startMatch(match);

  applyEvent(match, {
    eventId: 'evt-kill',
    playerId: p.playerId,
    type: EventType.PLAYER_REPORTED_DEAD,
    payload: {},
  });

  applyEvent(match, {
    eventId: 'evt-task-after-death',
    playerId: p.playerId,
    type: EventType.TASK_COMPLETED,
    payload: { taskId: 'FIOS' },
  });

  assert.equal(p.status, PlayerStatus.MORTO);
  assert.equal(p.completedTasks.length, 0);
});

test('emergência alterna estado', () => {
  const match = createMatch();
  addPlayer(match, 'A', 'p1');
  addPlayer(match, 'B', 'p2');
  startMatch(match);

  applyEvent(match, { eventId: 'evt-e1', type: EventType.EMERGENCY_CALLED, payload: {} });
  assert.equal(match.state, MatchState.EMERGENCIA);

  applyEvent(match, { eventId: 'evt-e2', type: EventType.EMERGENCY_CLEARED, payload: {} });
  assert.equal(match.state, MatchState.EM_JOGO);
});
