const test = require('node:test');
const assert = require('node:assert/strict');
const { createMatch, addPlayer, startMatch, applyEvent } = require('../src/core/gameEngine');
const { EventType, MatchState, PlayerStatus, Role } = require('../src/shared/models');

test('idempotency: duplicated event does not double count task', () => {
  const match = createMatch({
    taskCatalog: [
      { taskId: 'O2', qrLocationId: 'Q1' },
      { taskId: 'FIOS', qrLocationId: 'Q2' },
    ],
    tasksPerPlayer: 2,
  });
  const p = addPlayer(match, 'Ana', 'p1');
  const other = addPlayer(match, 'Bob', 'p2');
  startMatch(match);

  p.role = Role.TRIPULANTE;
  other.role = Role.TRIPULANTE;
  p.assignedTasks = match.tasks;
  other.assignedTasks = [];
  p.completedTasks = [];
  other.completedTasks = [];

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

test('dead player cannot complete task', () => {
  const match = createMatch({
    taskCatalog: [{ taskId: 'FIOS', qrLocationId: 'Q2' }],
    tasksPerPlayer: 1,
  });
  const victim = addPlayer(match, 'Victim', 'p_dead');
  const crew = addPlayer(match, 'Crew', 'p2');
  startMatch(match);

  victim.role = Role.TRIPULANTE;
  crew.role = Role.TRIPULANTE;
  victim.assignedTasks = [{ taskId: 'FIOS', qrLocationId: 'Q2' }];
  crew.assignedTasks = [];

  applyEvent(match, {
    eventId: 'evt-kill',
    playerId: victim.playerId,
    type: EventType.PLAYER_REPORTED_DEAD,
    payload: {},
  });

  applyEvent(match, {
    eventId: 'evt-task-after-death',
    playerId: victim.playerId,
    type: EventType.TASK_COMPLETED,
    payload: { taskId: 'FIOS' },
  });

  assert.equal(victim.status, PlayerStatus.MORTO);
  assert.equal(victim.completedTasks.length, 0);
});

test('emergency call toggles state', () => {
  const match = createMatch();
  addPlayer(match, 'A', 'p1');
  addPlayer(match, 'B', 'p2');
  startMatch(match);

  applyEvent(match, { eventId: 'evt-e1', type: EventType.EMERGENCY_CALLED, payload: {} });
  assert.equal(match.state, MatchState.EMERGENCIA);

  applyEvent(match, { eventId: 'evt-e2', type: EventType.EMERGENCY_CLEARED, payload: {} });
  assert.equal(match.state, MatchState.EM_JOGO);
});
