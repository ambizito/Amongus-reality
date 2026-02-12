const fs = require('node:fs');
const path = require('node:path');
const { createMatch } = require('../core/gameEngine');

const STORE_PATH = path.resolve(process.cwd(), 'data', 'state.json');

function serializeMatch(match) {
  return {
    ...match,
    processedEventIds: Array.from(match.processedEventIds),
  };
}

function deserializeMatch(match) {
  return {
    ...match,
    processedEventIds: new Set(match.processedEventIds || []),
  };
}

function loadState() {
  if (!fs.existsSync(STORE_PATH)) {
    return { matches: {} };
  }
  const content = fs.readFileSync(STORE_PATH, 'utf8');
  const parsed = JSON.parse(content);
  const matches = {};
  for (const [k, v] of Object.entries(parsed.matches || {})) {
    matches[k] = deserializeMatch(v);
  }
  return { matches };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const serializable = { matches: {} };
  for (const [k, v] of Object.entries(state.matches || {})) {
    serializable.matches[k] = serializeMatch(v);
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(serializable, null, 2));
}

function createDefaultMatch() {
  return createMatch({
    taskCatalog: [
      { taskId: 'LIXO', qrLocationId: 'QR_LIXO' },
      { taskId: 'O2', qrLocationId: 'QR_O2' },
      { taskId: 'FIOS', qrLocationId: 'QR_FIOS' },
    ],
    sabotageCatalog: [{ sabotageId: 'SAB_O2', type: 'O2', qrFixLocationId: 'QR_FIX_O2' }],
  });
}

module.exports = {
  loadState,
  saveState,
  createDefaultMatch,
};
