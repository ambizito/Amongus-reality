const fs = require('node:fs');
const path = require('node:path');

class OfflineClient {
  constructor({ storagePath, sender }) {
    this.storagePath = storagePath || path.resolve(process.cwd(), 'data', 'outbox.json');
    this.sender = sender;
    this.outbox = this.#readOutbox();
  }

  #readOutbox() {
    if (!fs.existsSync(this.storagePath)) return [];
    return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
  }

  #persist() {
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    fs.writeFileSync(this.storagePath, JSON.stringify(this.outbox, null, 2));
  }

  queueEvent(event) {
    this.outbox.push({ ...event, status: 'PENDING', retries: 0 });
    this.#persist();
  }

  async flush({ maxRetries = 5 } = {}) {
    for (const item of this.outbox) {
      if (item.status === 'CONFIRMED' || item.retries >= maxRetries) continue;
      try {
        await this.sender(item);
        item.status = 'CONFIRMED';
      } catch (_e) {
        item.retries += 1;
      }
    }

    this.outbox = this.outbox.filter((i) => i.status !== 'CONFIRMED');
    this.#persist();
    return this.outbox;
  }
}

module.exports = { OfflineClient };
