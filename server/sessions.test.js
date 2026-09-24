const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionManager } = require('./sessions');
const id = 'a'.repeat(64);

test('concurrent refresh is shared, absolute deadline does not slide, and logout cannot be undone by refresh', async () => {
  let clock = 0, refreshes = 0, release;
  const manager = createSessionManager({ memory: true, now: () => clock, remote: async (path) => {
    if (path.includes('refresh_token')) {
      refreshes++;
      await new Promise(resolve => { release = resolve; });
      return { user: { id: 'user' }, access_token: 'new', refresh_token: 'new-refresh', expires_in: 3600 };
    }
    return { id: 'user' };
  } });
  await manager.create(id, { user: { id: 'user' }, access_token: 'old', refresh_token: 'refresh', expires_in: 3600 });
  clock = 3600000;
  const first = manager.get(id), second = manager.get(id);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(refreshes, 1); release();
  const results = await Promise.all([first, second]);
  assert.equal(Date.parse(results[0].expiresAt), 7200000);
  clock = 7200000;
  await assert.rejects(manager.get(id), { status: 401 });
  assert.equal(refreshes, 1);
  clock = 0;
  await manager.create(id, { user: { id: 'user' }, access_token: 'old', refresh_token: 'refresh', expires_in: 3600 });
  clock = 3600000;
  const pending = manager.get(id);
  const rejection = assert.rejects(pending, { status: 401 });
  await new Promise(resolve => setImmediate(resolve));
  await manager.remove(id); release();
  await rejection;
  await assert.rejects(manager.get(id), { status: 401 });
});

test('a refresh completing after the absolute deadline is rejected', async () => {
  let clock = 0;
  const manager = createSessionManager({ memory: true, now: () => clock, remote: async () => {
    clock = 7200000;
    return { user: { id: 'user' }, access_token: 'new', refresh_token: 'new', expires_in: 3600 };
  } });
  await manager.create(id, { user: { id: 'user' }, access_token: 'old', refresh_token: 'refresh', expires_in: 3600 });
  clock = 7199999;
  await assert.rejects(manager.get(id), { status: 401 });
});
