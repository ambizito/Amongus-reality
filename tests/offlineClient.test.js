const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { OfflineClient } = require('../src/mobile/offlineClient');

const tempFile = path.resolve(process.cwd(), 'data', 'outbox.test.json');

test('outbox persiste e remove evento confirmado', async () => {
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

  const client = new OfflineClient({
    storagePath: tempFile,
    sender: async () => ({ ok: true }),
  });

  client.queueEvent({ eventId: 'evt-1', type: 'TASK_COMPLETED' });
  assert.equal(client.outbox.length, 1);

  await client.flush();
  assert.equal(client.outbox.length, 0);

  const persisted = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
  assert.equal(persisted.length, 0);
});

test('falha de envio incrementa retry', async () => {
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

  const client = new OfflineClient({
    storagePath: tempFile,
    sender: async () => {
      throw new Error('offline');
    },
  });

  client.queueEvent({ eventId: 'evt-2', type: 'TASK_COMPLETED' });
  await client.flush({ maxRetries: 2 });

  assert.equal(client.outbox.length, 1);
  assert.equal(client.outbox[0].retries, 1);
});
