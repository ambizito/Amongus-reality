const { randomUUID } = require('node:crypto');
const { EventType } = require('../shared/models');

async function callApi(baseUrl, path, method = 'GET', payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Falha ${response.status}`);
  }
  return response.json();
}

async function createMatch(baseUrl) {
  return callApi(baseUrl, '/matches', 'POST');
}

async function startMatch(baseUrl, matchId) {
  return callApi(baseUrl, `/matches/${matchId}/start`, 'POST');
}

async function triggerEmergency(baseUrl, matchId) {
  return callApi(baseUrl, `/matches/${matchId}/emergency`, 'POST', {
    eventId: randomUUID(),
    type: EventType.EMERGENCY_CALLED,
  });
}

async function clearEmergency(baseUrl, matchId) {
  return callApi(baseUrl, `/matches/${matchId}/emergency/clear`, 'POST');
}

module.exports = {
  createMatch,
  startMatch,
  triggerEmergency,
  clearEmergency,
};
