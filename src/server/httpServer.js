const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { addPlayer, applyEvent, startMatch } = require('../core/gameEngine');
const { loadState, saveState, createDefaultMatch } = require('./stateStore');
const { EventType } = require('../shared/models');

const state = loadState();

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    req.on('data', (chunk) => (buffer += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(buffer ? JSON.parse(buffer) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function routeMatch(pathname) {
  const patterns = [
    { key: 'createMatch', re: /^\/matches$/ },
    { key: 'join', re: /^\/matches\/([^/]+)\/players$/ },
    { key: 'start', re: /^\/matches\/([^/]+)\/start$/ },
    { key: 'event', re: /^\/matches\/([^/]+)\/events$/ },
    { key: 'state', re: /^\/matches\/([^/]+)\/state$/ },
    { key: 'emergency', re: /^\/matches\/([^/]+)\/emergency$/ },
    { key: 'clearEmergency', re: /^\/matches\/([^/]+)\/emergency\/clear$/ },
  ];

  for (const p of patterns) {
    const m = pathname.match(p.re);
    if (m) {
      return { key: p.key, params: m.slice(1) };
    }
  }

  return null;
}

function getMatchOr404(matchId, res) {
  const match = state.matches[matchId];
  if (!match) {
    json(res, 404, { error: 'Partida não encontrada' });
    return null;
  }
  return match;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = routeMatch(url.pathname);

  if (!route) {
    return json(res, 404, { error: 'Rota não encontrada' });
  }

  try {
    if (route.key === 'createMatch' && req.method === 'POST') {
      const match = createDefaultMatch();
      state.matches[match.matchId] = match;
      saveState(state);
      return json(res, 201, { matchId: match.matchId, entryCode: match.matchId });
    }

    const [matchId] = route.params;

    if (route.key === 'join' && req.method === 'POST') {
      const body = await getBody(req);
      const match = getMatchOr404(matchId, res);
      if (!match) return;
      const player = addPlayer(match, body.nickname || 'SemNome', body.playerId || randomUUID());
      applyEvent(match, {
        eventId: randomUUID(),
        matchId,
        playerId: player.playerId,
        type: EventType.PLAYER_JOINED,
        payload: {},
        timestampLocal: Date.now(),
      });
      saveState(state);
      return json(res, 201, player);
    }

    if (route.key === 'start' && req.method === 'POST') {
      const match = getMatchOr404(matchId, res);
      if (!match) return;
      startMatch(match);
      applyEvent(match, {
        eventId: randomUUID(),
        matchId,
        type: EventType.GAME_STARTED,
        payload: {},
        timestampLocal: Date.now(),
      });
      saveState(state);
      return json(res, 200, { ok: true, state: match.state });
    }

    if (route.key === 'event' && req.method === 'POST') {
      const match = getMatchOr404(matchId, res);
      if (!match) return;
      const body = await getBody(req);
      const result = applyEvent(match, { ...body, matchId });
      saveState(state);
      return json(res, 202, result);
    }

    if (route.key === 'emergency' && req.method === 'POST') {
      const match = getMatchOr404(matchId, res);
      if (!match) return;
      const body = await getBody(req);
      const result = applyEvent(match, {
        eventId: body.eventId || randomUUID(),
        matchId,
        playerId: body.playerId || null,
        type: EventType.EMERGENCY_CALLED,
        payload: body.payload || {},
        timestampLocal: Date.now(),
      });
      saveState(state);
      return json(res, 200, result);
    }

    if (route.key === 'clearEmergency' && req.method === 'POST') {
      const match = getMatchOr404(matchId, res);
      if (!match) return;
      const result = applyEvent(match, {
        eventId: randomUUID(),
        matchId,
        type: EventType.EMERGENCY_CLEARED,
        payload: {},
        timestampLocal: Date.now(),
      });
      saveState(state);
      return json(res, 200, result);
    }

    if (route.key === 'state' && req.method === 'GET') {
      const match = getMatchOr404(matchId, res);
      if (!match) return;
      return json(res, 200, {
        ...match,
        processedEventIds: Array.from(match.processedEventIds),
      });
    }

    return json(res, 405, { error: 'Método não permitido' });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

if (require.main === module) {
  const port = process.env.PORT || 8080;
  server.listen(port, () => {
    console.log(`Amongus Reality server em http://localhost:${port}`);
  });
}

module.exports = { server };
