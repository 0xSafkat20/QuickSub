const { fail } = require('./http');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function string(value, max, min = 1, trim = true) {
  if (typeof value !== 'string' || (trim ? value.trim() : value).length < min || value.length > max)
    throw fail(400, 'Please check the required fields.');
  return trim ? value.trim() : value;
}

function contact(value) {
  const result = string(value, 160, 5);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) &&
      (!/^\+?[\d ()-]{8,24}$/.test(result) || result.replace(/\D/g, '').length < 8))
    throw fail(400, 'Enter a valid email or phone number.');
  return result;
}

const text = (max, min = 1, trim = true) => value => string(value, max, min, trim);
const optional = parse => value => value === undefined ? undefined : parse(value);
const email = value => {
  const result = string(value, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw fail(400, 'Enter a valid email address.');
  return result;
};
const authSchemas = {
  adminLogin: { email, password: text(256, 1, false) },
  login: { email, password: text(128, 1, false) },
  signup: { email, password: text(128, 10, false), name: text(120) },
  forgotPassword: { email },
  resetPassword: {
    password: text(128, 10, false),
    confirmPassword: text(128, 10, false),
    tokenHash: optional(text(512, 20)),
    accessToken: optional(text(4096, 20, false)),
  },
};

// Reject unexpected keys instead of silently accepting privilege-related input.
function validateBody(body, schema) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Expected a JSON object.');
  const fields = Object.create(null);
  for (const key of Object.keys(body)) if (!Object.hasOwn(schema, key)) fields[key] = 'Unexpected field.';
  for (const [key, parse] of Object.entries(schema)) {
    try { parse(body[key]); } catch (err) { fields[key] = err.message; }
  }
  if (Object.keys(fields).length) throw Object.assign(fail(400, 'Please check the required fields.'), { fields });
}

module.exports = { string, contact, uuid, validateBody, authSchemas };
