const ui = {
  baseUrl: document.getElementById('baseUrl'),
  entryCode: document.getElementById('entryCode'),
  nickname: document.getElementById('nickname'),
  joinMatch: document.getElementById('joinMatch'),
  openJoinScanner: document.getElementById('openJoinScanner'),
  joinStatus: document.getElementById('joinStatus'),
  screenLogin: document.getElementById('screen-login'),
  screenLobby: document.getElementById('screen-lobby'),
  screenReveal: document.getElementById('screen-reveal'),
  screenGame: document.getElementById('screen-game'),
  lobbyCode: document.getElementById('lobbyCode'),
  lobbyPlayers: document.getElementById('lobbyPlayers'),
  lobbyStatus: document.getElementById('lobbyStatus'),
  roleName: document.getElementById('roleName'),
  roleAvatar: document.getElementById('roleAvatar'),
  roleHint: document.getElementById('roleHint'),
  roleTimer: document.getElementById('roleTimer'),
  playerAvatar: document.getElementById('playerAvatar'),
  playerName: document.getElementById('playerName'),
  playerRole: document.getElementById('playerRole'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  emergencyBanner: document.getElementById('emergencyBanner'),
  mapTasks: document.getElementById('mapTasks'),
  mapHint: document.getElementById('mapHint'),
  reportDead: document.getElementById('reportDead'),
  openTaskScanner: document.getElementById('openTaskScanner'),
  sabotageButton: document.getElementById('sabotageButton'),
  sabotagePanel: document.getElementById('sabotagePanel'),
  sabotageSelect: document.getElementById('sabotageSelect'),
  triggerSabotage: document.getElementById('triggerSabotage'),
  sabotageHint: document.getElementById('sabotageHint'),
  overlayScanner: document.getElementById('overlay-scanner'),
  scannerTitle: document.getElementById('scannerTitle'),
  scannerMessage: document.getElementById('scannerMessage'),
  scannerVideo: document.getElementById('scannerVideo'),
  scannerInput: document.getElementById('scannerInput'),
  scannerSubmit: document.getElementById('scannerSubmit'),
  closeScanner: document.getElementById('closeScanner'),
  overlayTask: document.getElementById('overlay-task'),
  taskTitle: document.getElementById('taskTitle'),
  taskSubtitle: document.getElementById('taskSubtitle'),
  taskFrame: document.getElementById('taskFrame'),
  completeTask: document.getElementById('completeTask'),
  closeTask: document.getElementById('closeTask'),
  overlayEmergency: document.getElementById('overlay-emergency'),
};

const storageKeys = {
  matchId: 'amongus.mobile.matchId',
  entryCode: 'amongus.mobile.entryCode',
  playerId: 'amongus.mobile.playerId',
  nickname: 'amongus.mobile.nickname',
  fakeTasks: 'amongus.mobile.fakeTasks',
  outbox: 'amongus.mobile.outbox',
};

const pollIntervalMs = 1000;
let pollTimer = null;
let viewTimer = null;
let holdTimer = null;
let scanTimer = null;

const TASK_POSITIONS = {
  LIXO: { x: 78, y: 22, label: 'Cafeteria' },
  O2: { x: 30, y: 18, label: 'O2' },
  FIOS: { x: 18, y: 70, label: 'Eletrica' },
  DOWNLOAD: { x: 65, y: 38, label: 'Comms' },
  ARMAS: { x: 82, y: 48, label: 'Armas' },
  NAVEGACAO: { x: 56, y: 72, label: 'Nav' },
  ESCUDO: { x: 70, y: 80, label: 'Escudo' },
  COMBUSTIVEL_A: { x: 25, y: 45, label: 'Comb A' },
  COMBUSTIVEL_B: { x: 75, y: 60, label: 'Comb B' },
  ELETRICA_RITMO: { x: 12, y: 55, label: 'Eletrica' },
};

const FALLBACK_POSITIONS = [
  { x: 22, y: 22 },
  { x: 78, y: 20 },
  { x: 50, y: 45 },
  { x: 24, y: 78 },
  { x: 80, y: 74 },
];

const appState = {
  matchId: '',
  entryCode: '',
  playerId: '',
  nickname: '',
  player: null,
  match: null,
  outbox: [],
  offline: false,
  sabotageUnlocked: false,
  sabotagePanelOpen: false,
  fakeCompletedTasks: new Set(),
  activeTask: null,
  scannerMode: 'join',
  scannerStream: null,
  barcodeDetector: null,
  emergencyActive: false,
  bootedFromStorage: false,
};

function setJoinStatus(message, type = 'info') {
  ui.joinStatus.textContent = message;
  if (type === 'error') {
    ui.joinStatus.style.color = '#f87171';
  } else if (type === 'ok') {
    ui.joinStatus.style.color = '#38bdf8';
  } else {
    ui.joinStatus.style.color = '#9aa4b2';
  }
}

function setScreen(name) {
  const map = {
    login: ui.screenLogin,
    lobby: ui.screenLobby,
    reveal: ui.screenReveal,
    game: ui.screenGame,
  };
  Object.entries(map).forEach(([key, element]) => {
    const isActive = key === name;
    element.classList.toggle('active', isActive);
    element.hidden = !isActive;
  });
}

function setOverlay(open, element) {
  element.classList.toggle('hidden', !open);
  element.hidden = !open;
}

function getBaseUrl() {
  const raw = ui.baseUrl.value.trim();
  const base = raw || window.location.origin;
  return base.replace(/\/$/, '');
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
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function updateNetworkStatus() {
  appState.offline = !navigator.onLine;
}

function loadOutbox() {
  const saved = localStorage.getItem(storageKeys.outbox);
  appState.outbox = saved ? JSON.parse(saved) : [];
}

function saveOutbox() {
  localStorage.setItem(storageKeys.outbox, JSON.stringify(appState.outbox));
}

function loadFakeTasks() {
  const saved = localStorage.getItem(storageKeys.fakeTasks);
  const list = saved ? JSON.parse(saved) : [];
  appState.fakeCompletedTasks = new Set(list);
}

function saveFakeTasks() {
  localStorage.setItem(storageKeys.fakeTasks, JSON.stringify(Array.from(appState.fakeCompletedTasks)));
}

function clearSession(message) {
  appState.matchId = '';
  appState.entryCode = '';
  appState.match = null;
  appState.player = null;
  appState.outbox = [];
  appState.fakeCompletedTasks = new Set();
  appState.activeTask = null;
  appState.sabotageUnlocked = false;
  appState.sabotagePanelOpen = false;
  appState.emergencyActive = false;
  appState.bootedFromStorage = false;
  ui.entryCode.value = '';
  saveOutbox();
  saveFakeTasks();
  localStorage.removeItem(storageKeys.matchId);
  localStorage.removeItem(storageKeys.entryCode);
  if (pollTimer) clearInterval(pollTimer);
  if (viewTimer) clearInterval(viewTimer);
  stopScanner();
  setOverlay(false, ui.overlayScanner);
  setOverlay(false, ui.overlayTask);
  setOverlay(false, ui.overlayEmergency);
  ui.taskFrame.src = 'about:blank';
  setScreen('login');
  if (message) setJoinStatus(message, 'error');
}

function getLastEventTime(match, type) {
  return (match.events || []).reduce((latest, event) => {
    if (event.type !== type) return latest;
    const ts = event.serverReceivedAt || event.timestampLocal || 0;
    return ts > latest ? ts : latest;
  }, 0);
}

function shouldClearStaleSession(match) {
  if (!appState.bootedFromStorage || !match) return false;
  if (match.state === 'FINALIZADA') return true;
  const lastEnd = match.lastEndedAt || getLastEventTime(match, 'GAME_ENDED');
  if (!lastEnd) return false;
  if (match.state === 'EM_JOGO' || match.state === 'EMERGENCIA') return false;
  const lastStart = match.startedAt || getLastEventTime(match, 'GAME_STARTED');
  if (!lastStart) return true;
  return lastEnd >= lastStart;
}

function queueEvent(event) {
  appState.outbox.push({ ...event, retries: 0 });
  saveOutbox();
}

async function sendEvent(event) {
  return api(`/matches/${appState.matchId}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

async function flushOutbox() {
  if (appState.offline) return;
  if (!appState.matchId) return;
  const remaining = [];
  for (const event of appState.outbox) {
    try {
      await sendEvent(event);
    } catch (_error) {
      remaining.push({ ...event, retries: (event.retries || 0) + 1 });
    }
  }
  appState.outbox = remaining;
  saveOutbox();
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

function getPlayerTasks() {
  if (appState.player?.assignedTasks && appState.player.assignedTasks.length > 0) {
    return appState.player.assignedTasks;
  }
  return appState.match?.tasks || [];
}

function getCompletedTaskSet() {
  const isImpostor = appState.player?.role === 'IMPOSTOR';
  const serverCompleted = new Set(appState.player?.completedTasks || []);
  const pendingCompleted = new Set(
    appState.outbox
      .filter((event) => event.type === 'TASK_COMPLETED' && event.playerId === appState.player?.playerId)
      .map((event) => event.payload?.taskId)
      .filter(Boolean)
  );

  if (isImpostor) {
    return new Set([...appState.fakeCompletedTasks]);
  }
  return new Set([...serverCompleted, ...pendingCompleted]);
}

function renderLobbyPlayers(players) {
  if (!players || players.length === 0) {
    ui.lobbyPlayers.textContent = 'No players yet.';
    return;
  }
  ui.lobbyPlayers.innerHTML = players
    .map((player) => {
      const color = player.color || '#22d3ee';
      return `<div class="player-row">
        <span class="player-color" style="background:${color}"></span>
        <span>${player.nickname}</span>
      </div>`;
    })
    .join('');
}

function renderRoleScreen(elapsedMs) {
  const role = appState.player?.role || '-';
  const isImpostor = role === 'IMPOSTOR';
  const remaining = Math.max(0, Math.ceil((10000 - elapsedMs) / 1000));

  ui.roleName.textContent = role;
  ui.roleName.style.color = isImpostor ? '#ef4444' : '#22d3ee';
  ui.roleHint.textContent = isImpostor ? 'Eliminate the crew.' : 'Complete the tasks.';
  ui.roleAvatar.style.background = isImpostor ? '#ef4444' : '#22d3ee';
  ui.roleTimer.textContent = remaining > 0 ? `Tasks unlock in ${remaining}s.` : 'Tasks unlocked.';
}

function getTaskPosition(task, index) {
  if (task.map && Number.isFinite(task.map.x) && Number.isFinite(task.map.y)) {
    return task.map;
  }
  if (TASK_POSITIONS[task.taskId]) {
    return TASK_POSITIONS[task.taskId];
  }
  return FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length];
}

function getTaskFile(task) {
  if (task.file) return task.file;
  const id = String(task.taskId || 'task').toLowerCase();
  return `${id}.html`;
}

function renderMap() {
  const tasks = getPlayerTasks();
  const completed = getCompletedTaskSet();

  ui.mapTasks.innerHTML = tasks
    .map((task, index) => {
      const pos = getTaskPosition(task, index);
      const isDone = completed.has(task.taskId);
      const label = (task.map && task.map.label) || task.label || pos.label || task.taskId;
      return `<div class="task-marker ${isDone ? 'done' : ''}" style="left:${pos.x}%; top:${pos.y}%">
        <div class="dot">!</div>
        <span>${label}</span>
      </div>`;
    })
    .join('');
}

function renderGame() {
  if (!appState.player || !appState.match) return;

  ui.playerAvatar.style.background = appState.player.color || '#22d3ee';
  ui.playerName.textContent = appState.player.nickname || 'You';
  ui.playerRole.textContent = appState.player.role || '-';
  ui.playerRole.style.background =
    appState.player.role === 'IMPOSTOR' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)';
  ui.playerRole.style.color = appState.player.role === 'IMPOSTOR' ? '#fca5a5' : '#93c5fd';

  const isImpostor = appState.player.role === 'IMPOSTOR';
  ui.sabotageButton.hidden = !(isImpostor && appState.sabotageUnlocked);
  if (!isImpostor) {
    appState.sabotagePanelOpen = false;
  }

  const progress = computeProgress(appState.match);
  const pct = progress.required === 0 ? 0 : Math.min(100, (progress.done / progress.required) * 100);
  ui.progressFill.style.width = `${pct}%`;
  ui.progressText.textContent = `${progress.done} / ${progress.required}`;

  ui.mapHint.textContent =
    appState.match.state === 'FINALIZADA'
      ? 'Match ended.'
      : isImpostor
        ? 'Hold your avatar to unlock sabotage. Fake tasks do not count.'
        : 'Go to a marker and scan the QR.';

  renderMap();
  renderSabotage();
}

function renderSabotage() {
  const catalog = appState.match?.sabotageCatalog || [];
  const active = appState.match?.activeSabotage;
  const isImpostor = appState.player?.role === 'IMPOSTOR';

  ui.sabotageSelect.innerHTML = catalog
    .map((item) => `<option value="${item.sabotageId}">${item.type}</option>`)
    .join('');

  const showPanel = isImpostor && appState.sabotageUnlocked && appState.sabotagePanelOpen;
  ui.sabotagePanel.classList.toggle('hidden', !showPanel);
  ui.sabotagePanel.hidden = !showPanel;
  ui.triggerSabotage.disabled = !isImpostor || catalog.length === 0;

  if (active && active.active) {
    ui.sabotageHint.textContent = `Active: ${active.type} (${active.qrFixLocationId})`;
  } else if (isImpostor && appState.sabotageUnlocked) {
    ui.sabotageHint.textContent = 'Select a sabotage to trigger.';
  } else if (isImpostor) {
    ui.sabotageHint.textContent = 'Hold your avatar for 3s to unlock sabotage.';
  } else {
    ui.sabotageHint.textContent = 'Only impostors can sabotage.';
  }
}

function playEmergencyAlert() {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(440, context.currentTime);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.05);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.6);
    oscillator.onended = () => context.close();
  } catch (_error) {
    // Ignore audio errors.
  }

  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

function updateEmergencyUI() {
  const isEmergency = appState.match?.state === 'EMERGENCIA';
  ui.emergencyBanner.classList.toggle('hidden', !isEmergency);
  ui.emergencyBanner.hidden = !isEmergency;
  setOverlay(isEmergency, ui.overlayEmergency);

  if (isEmergency && !appState.emergencyActive) {
    playEmergencyAlert();
  }
  appState.emergencyActive = isEmergency;
}

function updateViewByMatch() {
  if (!appState.match || !appState.player) {
    setScreen('login');
    return;
  }

  updateEmergencyUI();

  if (appState.match.state === 'LOBBY') {
    setScreen('lobby');
    ui.lobbyCode.textContent = appState.match.entryCode || appState.entryCode || '----';
    ui.lobbyStatus.textContent = appState.offline ? 'OFFLINE' : 'ONLINE';
    renderLobbyPlayers(appState.match.players || []);
    return;
  }

  if (appState.match.state === 'EM_JOGO' || appState.match.state === 'EMERGENCIA') {
    if (!appState.match.startedAt || !appState.player.role) {
      setScreen('lobby');
      return;
    }
    const startedAt = appState.match.startedAt;
    const elapsed = Date.now() - startedAt;
    if (elapsed < 10000) {
      setScreen('reveal');
      renderRoleScreen(elapsed);
    } else {
      setScreen('game');
      renderGame();
    }
    return;
  }

  if (appState.match.state === 'FINALIZADA') {
    setScreen('lobby');
    renderLobbyPlayers(appState.match.players || []);
  }
}

async function fetchState() {
  if (appState.offline || !appState.matchId) return;
  try {
    const match = await api(`/matches/${appState.matchId}/state`);
    const player = match.players.find((p) => p.playerId === appState.playerId) || null;
    if (!player) {
      clearSession('Player not found. Join again.');
      return;
    }
    if (shouldClearStaleSession(match)) {
      clearSession('Match ended. Join again.');
      return;
    }
    appState.match = match;
    appState.player = player;
    appState.bootedFromStorage = false;
    updateViewByMatch();
  } catch (error) {
    if (error.status === 404) {
      clearSession('Match not found. Join again.');
      return;
    }
    setJoinStatus(`State error: ${error.message}`, 'error');
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchState, pollIntervalMs);
}

function startViewTimer() {
  if (viewTimer) clearInterval(viewTimer);
  viewTimer = setInterval(() => {
    if (appState.match && appState.player) {
      updateViewByMatch();
    }
  }, 1000);
}

async function joinMatch() {
  const entryCode = ui.entryCode.value.trim();
  const nickname = ui.nickname.value.trim();
  if (!/^\d{4}$/.test(entryCode) || !nickname) {
    return setJoinStatus('Enter a 4 digit code and nickname.', 'error');
  }
  if (appState.offline) {
    return setJoinStatus('Cannot join while offline.', 'error');
  }

  if (!appState.playerId) {
    appState.playerId = uuid();
    localStorage.setItem(storageKeys.playerId, appState.playerId);
  }

  try {
    const payload = { nickname, playerId: appState.playerId };
    const data = await api(`/matches/entry/${entryCode}/players`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    appState.matchId = data.matchId;
    appState.entryCode = data.entryCode;
    appState.player = data.player;
    appState.sabotageUnlocked = false;
    appState.sabotagePanelOpen = false;
    appState.fakeCompletedTasks = new Set();
    appState.bootedFromStorage = false;
    saveFakeTasks();
    localStorage.setItem(storageKeys.matchId, appState.matchId);
    localStorage.setItem(storageKeys.entryCode, appState.entryCode);
    localStorage.setItem(storageKeys.nickname, nickname);
    setJoinStatus(`Joined ${entryCode} as ${data.player.nickname}.`, 'ok');
    await fetchState();
    startPolling();
    startViewTimer();
  } catch (error) {
    setJoinStatus(`Join failed: ${error.message}`, 'error');
  }
}

function completeTaskForPlayer(taskId) {
  if (!appState.matchId || !appState.playerId) {
    return setJoinStatus('Join a match first.', 'error');
  }
  if (appState.player?.status !== 'VIVO') {
    return setJoinStatus('You are not alive to complete tasks.', 'error');
  }

  if (appState.player?.role === 'IMPOSTOR') {
    appState.fakeCompletedTasks.add(taskId);
    saveFakeTasks();
    renderGame();
    return;
  }

  queueEvent({
    eventId: uuid(),
    matchId: appState.matchId,
    playerId: appState.playerId,
    type: 'TASK_COMPLETED',
    payload: { taskId },
    timestampLocal: Date.now(),
  });

  flushOutbox().then(fetchState);
}

function reportDead() {
  if (!appState.matchId || !appState.playerId) {
    return setJoinStatus('Join a match first.', 'error');
  }
  queueEvent({
    eventId: uuid(),
    matchId: appState.matchId,
    playerId: appState.playerId,
    type: 'PLAYER_REPORTED_DEAD',
    payload: {},
    timestampLocal: Date.now(),
  });
  flushOutbox().then(fetchState);
}

function triggerSabotage() {
  const catalog = appState.match?.sabotageCatalog || [];
  const sabotageId = ui.sabotageSelect.value;
  const entry = catalog.find((item) => item.sabotageId === sabotageId);
  if (!entry) return;

  queueEvent({
    eventId: uuid(),
    matchId: appState.matchId,
    playerId: appState.playerId,
    type: 'SABOTAGE_TRIGGERED',
    payload: {
      sabotageId: entry.sabotageId,
      type: entry.type,
      qrFixLocationId: entry.qrFixLocationId,
    },
    timestampLocal: Date.now(),
  });
  flushOutbox().then(fetchState);
}

function setScannerMessage(message) {
  ui.scannerMessage.textContent = message;
}

function parseEntryCode(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const code = url.searchParams.get('code');
    if (code && /^\d{4}$/.test(code)) return code;
  } catch (_e) {
    // Not a URL.
  }
  const match = raw.match(/\b\d{4}\b/);
  return match ? match[0] : null;
}

async function startScanner() {
  if (!('mediaDevices' in navigator)) {
    setScannerMessage('Camera not supported. Use manual input.');
    return;
  }

  try {
    appState.scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    ui.scannerVideo.srcObject = appState.scannerStream;
    await ui.scannerVideo.play();
    if ('BarcodeDetector' in window) {
      appState.barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      startScanLoop();
    } else {
      setScannerMessage('QR detection not supported. Use manual input.');
    }
  } catch (error) {
    setScannerMessage(`Camera error: ${error.message}`);
  }
}

function stopScanner() {
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = null;
  if (appState.scannerStream) {
    appState.scannerStream.getTracks().forEach((track) => track.stop());
    appState.scannerStream = null;
  }
  ui.scannerVideo.srcObject = null;
}

function startScanLoop() {
  if (!appState.barcodeDetector) return;
  scanTimer = setInterval(async () => {
    if (!appState.barcodeDetector || !ui.scannerVideo) return;
    try {
      const codes = await appState.barcodeDetector.detect(ui.scannerVideo);
      if (codes.length > 0) {
        handleScanResult(codes[0].rawValue || '');
      }
    } catch (_error) {
      // Ignore scan errors.
    }
  }, 300);
}

function openScanner(mode) {
  if (mode === 'task' && !appState.match) {
    setJoinStatus('Join a match first.', 'error');
    return;
  }
  appState.scannerMode = mode;
  ui.scannerInput.value = '';
  setScannerMessage('Point the camera at the QR.');
  ui.scannerTitle.textContent = mode === 'join' ? 'Join scanner' : 'Task scanner';
  setOverlay(true, ui.overlayScanner);
  startScanner();
}

function closeScanner() {
  stopScanner();
  setOverlay(false, ui.overlayScanner);
}

function handleScanResult(rawValue) {
  if (!rawValue) return;
  if (appState.scannerMode === 'join') {
    const code = parseEntryCode(rawValue);
    if (!code) {
      return setScannerMessage('Invalid code. Try again.');
    }
    ui.entryCode.value = code;
    closeScanner();
    joinMatch();
    return;
  }

  const activeSabotage = appState.match?.activeSabotage;
  if (activeSabotage && activeSabotage.active && activeSabotage.qrFixLocationId === rawValue) {
    closeScanner();
    queueEvent({
      eventId: uuid(),
      matchId: appState.matchId,
      playerId: appState.playerId,
      type: 'SABOTAGE_RESOLVED',
      payload: { sabotageId: activeSabotage.sabotageId },
      timestampLocal: Date.now(),
    });
    flushOutbox().then(fetchState);
    return;
  }

  const tasks = getPlayerTasks();
  const task = tasks.find((item) => item.qrLocationId === rawValue || item.taskId === rawValue);
  if (!task) {
    return setScannerMessage('No task found for this QR.');
  }
  closeScanner();
  openTask(task);
}

function openTask(task) {
  appState.activeTask = task;
  const label = task.label || task.taskId;
  ui.taskTitle.textContent = `Task: ${label}`;
  ui.taskSubtitle.textContent = `QR: ${task.qrLocationId}`;
  ui.taskFrame.src = `/tasks/${getTaskFile(task)}`;
  setOverlay(true, ui.overlayTask);
}

function closeTask() {
  appState.activeTask = null;
  ui.taskFrame.src = 'about:blank';
  setOverlay(false, ui.overlayTask);
}

function initAvatarHold() {
  ui.playerAvatar.addEventListener('pointerdown', () => {
    if (appState.player?.role !== 'IMPOSTOR' || appState.sabotageUnlocked) return;
    holdTimer = setTimeout(() => {
      appState.sabotageUnlocked = true;
      renderGame();
    }, 3000);
  });
  const clearHold = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };
  ui.playerAvatar.addEventListener('pointerup', clearHold);
  ui.playerAvatar.addEventListener('pointerleave', clearHold);
  ui.playerAvatar.addEventListener('pointercancel', clearHold);
}

function init() {
  ui.baseUrl.value = window.location.origin;
  ui.entryCode.value = localStorage.getItem(storageKeys.entryCode) || '';
  ui.nickname.value = localStorage.getItem(storageKeys.nickname) || '';
  appState.matchId = localStorage.getItem(storageKeys.matchId) || '';
  appState.entryCode = ui.entryCode.value.trim();
  appState.playerId = localStorage.getItem(storageKeys.playerId) || '';
  appState.bootedFromStorage = Boolean(appState.matchId && appState.playerId);
  loadOutbox();
  loadFakeTasks();
  saveOutbox();
  updateNetworkStatus();

  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get('code');
  if (codeParam && /^\d{4}$/.test(codeParam)) {
    ui.entryCode.value = codeParam;
    appState.entryCode = codeParam;
  }

  if (appState.matchId && appState.playerId) {
    fetchState();
    startPolling();
    startViewTimer();
  } else {
    setScreen('login');
  }

  ui.joinMatch.addEventListener('click', joinMatch);
  ui.entryCode.addEventListener('input', () => {
    ui.entryCode.value = ui.entryCode.value.replace(/\D/g, '').slice(0, 4);
  });
  ui.openJoinScanner.addEventListener('click', () => openScanner('join'));
  ui.openTaskScanner.addEventListener('click', () => openScanner('task'));
  ui.scannerSubmit.addEventListener('click', () => {
    const raw = ui.scannerInput.value.trim();
    if (raw) handleScanResult(raw);
  });
  ui.closeScanner.addEventListener('click', closeScanner);
  ui.completeTask.addEventListener('click', () => {
    if (appState.activeTask) {
      completeTaskForPlayer(appState.activeTask.taskId);
    }
    closeTask();
  });
  ui.closeTask.addEventListener('click', closeTask);
  ui.reportDead.addEventListener('click', reportDead);
  ui.triggerSabotage.addEventListener('click', triggerSabotage);
  ui.sabotageButton.addEventListener('click', () => {
    if (appState.player?.role === 'IMPOSTOR' && appState.sabotageUnlocked) {
      appState.sabotagePanelOpen = !appState.sabotagePanelOpen;
      renderSabotage();
    }
  });

  window.addEventListener('online', () => {
    updateNetworkStatus();
    flushOutbox().then(fetchState);
  });
  window.addEventListener('offline', () => {
    updateNetworkStatus();
    updateViewByMatch();
  });

  initAvatarHold();

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== 'TASK_COMPLETE') return;
    if (!appState.activeTask) return;
    if (event.data.taskId && event.data.taskId !== appState.activeTask.taskId) return;
    completeTaskForPlayer(appState.activeTask.taskId);
    closeTask();
  });
}

init();
