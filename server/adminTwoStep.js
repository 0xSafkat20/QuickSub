const { createHash, randomBytes, randomInt, timingSafeEqual } = require('node:crypto');
const { fail } = require('./http');

const CHALLENGE_DURATION_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const hash = value => createHash('sha256').update(value).digest('hex');
const codeHash = (id, code) => hash(`${id}:${code}`);

function createAdminTwoStep({ db, now = Date.now, memory = false, sendCode }) {
  const records = new Map();
  const path = id => `quicksub_admin_challenges?id=eq.${hash(id)}`;

  async function remove(id) {
    if (!/^[a-f0-9]{64}$/.test(id || '')) return;
    if (memory) records.delete(id);
    else await db(path(id), { method: 'DELETE' });
  }

  async function create(auth, role) {
    if (!auth?.access_token || !auth?.user?.id || !auth?.user?.email)
      throw fail(401, 'Sign-in failed.');
    const id = randomBytes(32).toString('hex');
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(now() + CHALLENGE_DURATION_MS).toISOString();
    const tokenExpiresAt = new Date(now() + Math.max(1, Number(auth.expires_in) || 3600) * 1000).toISOString();
    const record = {
      user_id: auth.user.id,
      email: auth.user.email,
      role,
      token: auth.access_token,
      refresh_token: auth.refresh_token || null,
      token_expires_at: tokenExpiresAt,
      code_hash: codeHash(id, code),
      attempts: 0,
      expires_at: expiresAt,
    };
    if (memory) {
      for (const [key, value] of records) if (Date.parse(value.expires_at) <= now()) records.delete(key);
      if (records.size >= 1000) throw fail(503, 'Please try signing in later.');
      records.set(id, record);
    } else {
      await db('rpc/quicksub_create_admin_challenge', { method: 'POST', body: {
        p_id: hash(id), p_user: record.user_id, p_email: record.email, p_role: role,
        p_token: record.token, p_refresh: record.refresh_token,
        p_token_expires: record.token_expires_at, p_code_hash: record.code_hash,
        p_expires: record.expires_at,
      } });
    }
    try { await sendCode({ email: record.email, code, expiresAt }); }
    catch {
      await remove(id).catch(() => {});
      throw Object.assign(fail(503, 'Two-step verification email could not be sent. Check the mail configuration and try again.'), { expose: true });
    }
    return { id, email: record.email, expiresAt };
  }

  async function consume(id, code) {
    if (!/^[a-f0-9]{64}$/.test(id || '') || !/^\d{6}$/.test(code || ''))
      throw fail(401, 'The verification code is incorrect or expired.');
    const suppliedHash = codeHash(id, code);
    let result;
    if (memory) {
      const record = records.get(id);
      if (!record || Date.parse(record.expires_at) <= now() || record.attempts >= MAX_ATTEMPTS) {
        records.delete(id);
        throw fail(401, 'The verification code is incorrect or expired.');
      }
      const matches = timingSafeEqual(Buffer.from(record.code_hash), Buffer.from(suppliedHash));
      if (!matches) {
        record.attempts += 1;
        if (record.attempts >= MAX_ATTEMPTS) records.delete(id);
        throw fail(401, 'The verification code is incorrect or expired.');
      }
      records.delete(id);
      result = { ok: true, ...record };
    } else {
      result = await db('rpc/quicksub_consume_admin_challenge', { method: 'POST', body: {
        p_id: hash(id), p_code_hash: suppliedHash, p_now: new Date(now()).toISOString(),
      } });
      if (!result?.ok) throw fail(401, 'The verification code is incorrect or expired.');
    }
    const seconds = Math.max(1, Math.floor((Date.parse(result.token_expires_at) - now()) / 1000));
    return {
      role: result.role,
      auth: {
        user: { id: result.user_id, email: result.email },
        access_token: result.token,
        refresh_token: result.refresh_token,
        expires_in: seconds,
      },
    };
  }

  return { create, consume, remove };
}

module.exports = { CHALLENGE_DURATION_MS, createAdminTwoStep };
