const { randomBytes } = require("node:crypto");
const { fail, run } = require("./http");
const { string, validateBody, authSchemas } = require("./validation");
const { SESSION_DURATION_MS, createSessionManager, sessionHeader } = require("./sessions");

// Install login before the /admin authorization boundary; all other admin routes follow it.
function installAdminAuth({ router, db, remote, rate, now, sharedSessions }) {
  const sessions = createSessionManager({ table: "quicksub_admin_sessions", db, remote, now, memory: !sharedSessions });
  const cookieId = (req) =>
    (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("qs_admin="))
      ?.slice(9);
  const cookieOptions = (req) => ({
    httpOnly: true,
    secure: req.secure || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
  });
  router.post(
    "/admin/login",
    run(async (req, res) => {
      rate(req, "login", 6);
      validateBody(req.body, authSchemas.adminLogin);
      const email = string(req.body?.email, 254),
        password = string(req.body?.password, 256, 1, false);
      const auth = await remote("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email, password },
      });
      const roles = await db(
        `quicksub_admins?user_id=eq.${encodeURIComponent(auth.user.id)}&select=role`,
      );
      if (!["owner", "staff"].includes(roles[0]?.role))
        throw fail(403, "This account does not have admin access.");
      const id = randomBytes(32).toString("hex");
      const record = await sessions.create(id, auth);
      res.cookie("qs_admin", id, { ...cookieOptions(req), maxAge: SESSION_DURATION_MS });
      sessionHeader(res, 'admin', record.expires_at);
      res.json({ email: auth.user.email, role: roles[0].role });
    }),
  );
  router.post("/admin/logout", run(async (req, res) => {
    const id = cookieId(req);
    await sessions.remove(id);
    res.clearCookie("qs_admin", cookieOptions(req));
    res.json({ ok: true });
  }));
  // Authentication is checked against Supabase, and role membership is checked on every request.
  router.use("/admin", (req, res, next) => {
    (async () => {
      const id = cookieId(req);
      let active;
      try { active = await sessions.get(id); }
      catch (err) {
        if (err.status === 401) res.clearCookie("qs_admin", cookieOptions(req));
        throw err;
      }
      const { user, expiresAt } = active;
      sessionHeader(res, 'admin', expiresAt);
      const roles = await db(
        `quicksub_admins?user_id=eq.${encodeURIComponent(user.id)}&select=role`,
      );
      if (!["owner", "staff"].includes(roles[0]?.role))
        throw fail(403, "Admin access has been removed.");
      req.admin = { id: user.id, email: user.email, role: roles[0].role };
      next();
    })().catch(next);
  });
}
module.exports = { installAdminAuth };
