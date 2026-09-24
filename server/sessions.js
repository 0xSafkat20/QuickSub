const { createHash } = require('node:crypto');
const { fail } = require('./http');
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
const hash = value => createHash('sha256').update(value).digest('hex');
const expired = () => fail(401, 'Your session expired. Please sign in again. Your saved data is safe.');

// The application deadline is absolute. Provider token rotation never changes it.
function createSessionManager({ table, db, remote, now, memory = false }) {
  const records = new Map();
  const refreshing = new Map();
  const path = id => `${table}?id=eq.${hash(id)}`;
  const read = async id => memory ? records.get(id) : (await db(path(id) + '&select=user_id,token,refresh_token,token_expires_at,expires_at'))[0];
  const remove = async id => {
    if (!/^[a-f0-9]{64}$/.test(id || '')) return;
    if (memory) records.delete(id);
    else await db(path(id), { method: 'DELETE' });
  };
  function check(record) {
    if (!record || !Number.isFinite(Date.parse(record.expires_at)) || Date.parse(record.expires_at) <= now()) throw expired();
  }
  function tokenFields(auth) {
    const seconds = Number(auth.expires_in);
    return { token: auth.access_token, refresh_token: auth.refresh_token || null,
      token_expires_at: new Date(now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000).toISOString() };
  }
  async function create(id, auth) {
    if (!auth.access_token || !auth.user?.id) throw expired();
    const record = { user_id: auth.user.id, ...tokenFields(auth), expires_at: new Date(now() + SESSION_DURATION_MS).toISOString() };
    if (memory) {
      for (const [key, value] of records) if (Date.parse(value.expires_at) <= now()) records.delete(key);
      if (records.size >= 1000) throw fail(503, 'Please try signing in later.');
      records.set(id, record);
    } else await db(table, { method: 'POST', body: { id: hash(id), ...record } });
    return record;
  }
  async function refresh(id) {
    const record = await read(id);
    check(record);
    if (!record.token_expires_at || Date.parse(record.token_expires_at) > now() + 30000) return record;
    if (!record.refresh_token) throw expired();
    let auth;
    try {
      auth = await remote('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: record.refresh_token } });
    } catch (err) {
      // Another instance may have already rotated this token. Re-read before failing.
      const latest = await read(id);
      check(latest);
      if (latest.token !== record.token) return latest;
      throw err;
    }
    check(record);
    if (!auth.access_token || !auth.refresh_token || auth.user?.id !== record.user_id) throw expired();
    const fields = tokenFields(auth);
    if (memory) {
      if (records.get(id) !== record) throw expired(); // Never resurrect a logged-out session.
      records.set(id, { ...record, ...fields });
    } else {
      // Compare-and-swap prevents a concurrent refresh from overwriting newer credentials.
      await db(path(id) + '&token=eq.' + encodeURIComponent(record.token), { method: 'PATCH', body: fields });
    }
    const latest = await read(id);
    check(latest);
    return latest;
  }
  async function get(id) {
    if (!/^[a-f0-9]{64}$/.test(id || '')) throw expired();
    let record = await read(id);
    check(record);
    if (record.token_expires_at && Date.parse(record.token_expires_at) <= now() + 30000) {
      if (!refreshing.has(id)) {
        const pending = refresh(id).finally(() => refreshing.delete(id));
        refreshing.set(id, pending);
      }
      record = await refreshing.get(id);
    }
    const user = await remote('/auth/v1/user', { token: record.token });
    check(record);
    if (user.id !== record.user_id) throw expired();
    return { user, expiresAt: record.expires_at };
  }
  return { create, get, remove };
}
function sessionHeader(res, scope, expiresAt) {
  res.set('X-QuickSub-Session-Scope', scope);
  res.set('X-QuickSub-Session-Expires', expiresAt);
}
module.exports = { SESSION_DURATION_MS, createSessionManager, sessionHeader };
