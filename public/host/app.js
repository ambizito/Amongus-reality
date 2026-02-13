const ui = {
  screenCreate: document.getElementById('screen-create'),
  screenAdmin: document.getElementById('screen-admin'),
  baseUrl: document.getElementById('baseUrl'),
  impostorCount: document.getElementById('impostorCount'),
  tasksPerPlayer: document.getElementById('tasksPerPlayer'),
  createMatch: document.getElementById('createMatch'),
  entryDetails: document.getElementById('entryDetails'),
  entryCode: document.getElementById('entryCode'),
  joinUrl: document.getElementById('joinUrl'),
  entryQr: document.getElementById('entryQr'),
  goAdmin: document.getElementById('goAdmin'),
  statusMessage: document.getElementById('statusMessage'),
  adminStatus: document.getElementById('adminStatus'),
  matchId: document.getElementById('matchId'),
  startMatch: document.getElementById('startMatch'),
  emergency: document.getElementById('emergency'),
  clearEmergency: document.getElementById('clearEmergency'),
  endMatch: document.getElementById('endMatch'),
  refresh: document.getElementById('refresh'),
  currentMatch: document.getElementById('currentMatch'),
  currentEntryCode: document.getElementById('currentEntryCode'),
  lastUpdate: document.getElementById('lastUpdate'),
  matchState: document.getElementById('matchState'),
  playerCount: document.getElementById('playerCount'),
  progress: document.getElementById('progress'),
  sabotage: document.getElementById('sabotage'),
  playersBody: document.getElementById('playersBody'),
  events: document.getElementById('events'),
};

const storageKeys = {
  matchId: 'amongus.host.matchId',
  entryCode: 'amongus.host.entryCode',
};

const pollIntervalMs = 1000;
let pollTimer = null;

const appState = {
  matchId: '',
  entryCode: '',
};

function setStatus(element, message, type = 'info') {
  element.textContent = message;
  if (type === 'error') {
    element.style.color = '#a64235';
  } else if (type === 'ok') {
    element.style.color = '#1e6f5c';
  } else {
    element.style.color = '#6f6a5b';
  }
}

function setScreen(screen) {
  ui.screenCreate.classList.toggle('active', screen === 'create');
  ui.screenAdmin.classList.toggle('active', screen === 'admin');
}

function getBaseUrl() {
  const raw = ui.baseUrl.value.trim();
  const base = raw || window.location.origin;
  return base.replace(/\/$/, '');
}

function buildJoinUrl(entryCode) {
  return `${getBaseUrl()}/mobile?code=${entryCode}`;
}

function setMatch(matchId, entryCode) {
  appState.matchId = matchId || '';
  appState.entryCode = entryCode || '';
  ui.matchId.value = appState.matchId;
  ui.currentMatch.textContent = appState.matchId || 'None';
  ui.currentEntryCode.textContent = appState.entryCode || '----';
  localStorage.setItem(storageKeys.matchId, appState.matchId);
  localStorage.setItem(storageKeys.entryCode, appState.entryCode);
}

function setEntryDetails(entryCode) {
  if (!entryCode) return;
  const joinUrl = buildJoinUrl(entryCode);
  ui.entryCode.textContent = entryCode;
  ui.joinUrl.value = joinUrl;
  ui.entryQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    joinUrl
  )}`;
  ui.entryDetails.classList.remove('hidden');
}

function formatTime(ts) {
  if (!ts) return '-';
  const date = new Date(ts);
  return date.toLocaleTimeString();
}

function uuid() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `evt_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

async function api(path, options = {}) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function createMatch() {
  try {
    const impostorCount = Number.parseInt(ui.impostorCount.value, 10);
    const tasksPerPlayer = Number.parseInt(ui.tasksPerPlayer.value, 10);
    const payload = {
      impostorCount: Number.isFinite(impostorCount) ? impostorCount : 1,
      tasksPerPlayer: Number.isFinite(tasksPerPlayer) ? tasksPerPlayer : null,
    };
    const data = await api('/matches', { method: 'POST', body: JSON.stringify(payload) });
    setMatch(data.matchId, data.entryCode);
    setEntryDetails(data.entryCode);
    setStatus(ui.statusMessage, `Match created: ${data.entryCode}`, 'ok');
    await fetchState();
    startPolling();
  } catch (error) {
    setStatus(ui.statusMessage, `Failed to create match: ${error.message}`, 'error');
  }
}

async function startMatch() {
  if (!appState.matchId) return setStatus(ui.adminStatus, 'Match ID required.', 'error');
  try {
    await api(`/matches/${appState.matchId}/start`, { method: 'POST' });
    setStatus(ui.adminStatus, 'Match started.', 'ok');
    await fetchState();
  } catch (error) {
    setStatus(ui.adminStatus, `Start failed: ${error.message}`, 'error');
  }
}

async function triggerEmergency() {
  if (!appState.matchId) return setStatus(ui.adminStatus, 'Match ID required.', 'error');
  try {
    await api(`/matches/${appState.matchId}/emergency`, {
      method: 'POST',
      body: JSON.stringify({ eventId: uuid() }),
    });
    setStatus(ui.adminStatus, 'Emergency triggered.', 'ok');
    await fetchState();
  } catch (error) {
    setStatus(ui.adminStatus, `Emergency failed: ${error.message}`, 'error');
  }
}

async function clearEmergency() {
  if (!appState.matchId) return setStatus(ui.adminStatus, 'Match ID required.', 'error');
  try {
    await api(`/matches/${appState.matchId}/emergency/clear`, { method: 'POST' });
    setStatus(ui.adminStatus, 'Emergency cleared.', 'ok');
    await fetchState();
  } catch (error) {
    setStatus(ui.adminStatus, `Clear failed: ${error.message}`, 'error');
  }
}

async function endMatch() {
  if (!appState.matchId) return setStatus(ui.adminStatus, 'Match ID required.', 'error');
  try {
    await api(`/matches/${appState.matchId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        eventId: uuid(),
        matchId: appState.matchId,
        type: 'GAME_ENDED',
        payload: { winner: 'OUTRA' },
        timestampLocal: Date.now(),
      }),
    });
    setStatus(ui.adminStatus, 'Match ended.', 'ok');
    await fetchState();
  } catch (error) {
    setStatus(ui.adminStatus, `End failed: ${error.message}`, 'error');
  }
}

function computeProgress(match) {
  let required = 0;
  let done = 0;
  for (const player of match.players || []) {
    if (player.role === 'TRIPULANTE' && player.status === 'VIVO') {
      const assigned = player.assignedTasks || [];
      required += assigned.length;
      done += (player.completedTasks || []).length;
    }
  }
  return { required, done };
}

function renderPlayers(players) {
  if (!players || players.length === 0) {
    ui.playersBody.innerHTML = '<tr><td colspan="5">No players yet.</td></tr>';
    return;
  }

  ui.playersBody.innerHTML = players
    .map((player) => {
      const role = player.role || '-';
      const status = player.status || '-';
      const tasks = (player.completedTasks || []).length;
      const color = player.color || '#999';
      return `<tr>
        <td><span class="color-dot" style="background:${color}"></span></td>
        <td>${player.nickname}</td>
        <td>${role}</td>
        <td>${status}</td>
        <td>${tasks}</td>
      </tr>`;
    })
    .join('');
}

function renderEvents(events) {
  if (!events || events.length === 0) {
    ui.events.textContent = 'No events yet.';
    return;
  }
  const lines = events
    .slice(-20)
    .reverse()
    .map((event) => {
      const time = formatTime(event.serverReceivedAt || event.timestampLocal);
      const player = event.playerId ? ` ${event.playerId}` : '';
      return `<div class="event-line">[${time}] ${event.type}${player}</div>`;
    })
    .join('');
  ui.events.innerHTML = lines;
}

function renderMatch(match) {
  ui.matchState.textContent = match.state || '-';
  ui.playerCount.textContent = (match.players || []).length;
  const progress = computeProgress(match);
  ui.progress.textContent = `${progress.done} / ${progress.required}`;
  if (match.activeSabotage && match.activeSabotage.active) {
    ui.sabotage.textContent = `${match.activeSabotage.type} @ ${match.activeSabotage.qrFixLocationId}`;
  } else {
    ui.sabotage.textContent = 'None';
  }
  renderPlayers(match.players || []);
  renderEvents(match.events || []);
  ui.lastUpdate.textContent = formatTime(Date.now());
  ui.currentEntryCode.textContent = match.entryCode || appState.entryCode || '----';
}

async function fetchState() {
  if (!appState.matchId) return;
  try {
    const match = await api(`/matches/${appState.matchId}/state`);
    renderMatch(match);
    setStatus(ui.adminStatus, 'State updated.', 'ok');
  } catch (error) {
    setStatus(ui.adminStatus, `Failed to load state: ${error.message}`, 'error');
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchState, pollIntervalMs);
}

function init() {
  ui.baseUrl.value = window.location.origin;
  const savedMatchId = localStorage.getItem(storageKeys.matchId) || '';
  const savedEntryCode = localStorage.getItem(storageKeys.entryCode) || '';
  if (savedMatchId) {
    setMatch(savedMatchId, savedEntryCode);
    setEntryDetails(savedEntryCode);
    setScreen('admin');
    fetchState();
    startPolling();
  } else {
    setScreen('create');
  }

  ui.createMatch.addEventListener('click', createMatch);
  ui.goAdmin.addEventListener('click', () => setScreen('admin'));
  ui.startMatch.addEventListener('click', startMatch);
  ui.emergency.addEventListener('click', triggerEmergency);
  ui.clearEmergency.addEventListener('click', clearEmergency);
  ui.endMatch.addEventListener('click', endMatch);
  ui.refresh.addEventListener('click', fetchState);
  ui.baseUrl.addEventListener('change', () => setEntryDetails(appState.entryCode));
  ui.matchId.addEventListener('change', () => {
    const matchId = ui.matchId.value.trim();
    if (!matchId) return;
    setMatch(matchId, appState.entryCode);
    fetchState();
    startPolling();
  });
}

init();
