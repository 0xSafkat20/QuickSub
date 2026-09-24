const fail = (status, message) => Object.assign(new Error(message), { status });

// Express 4 needs both synchronous throws and rejected promises forwarded.
const run = handler => (req, res, next) =>
  Promise.resolve().then(() => handler(req, res, next)).catch(next);

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.type === 'entity.too.large' ? 413
    : err.type === 'entity.parse.failed' ? 400
    : Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  if (status === 429) res.set('Retry-After', '60');
  const message = err.type === 'entity.too.large' ? 'Request body is too large.'
    : err.type === 'entity.parse.failed' ? 'Invalid request body.'
    : status >= 500 ? 'Unable to complete the request. Please try again.'
    : err.message;
  res.status(status).json({ error: message, ...(err.fields ? { fields: err.fields } : {}) });
}

module.exports = { fail, run, errorHandler };
