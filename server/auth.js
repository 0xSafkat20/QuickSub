const { randomBytes } = require("node:crypto");
const { fail, run } = require("./http");
const { string, validateBody, authSchemas } = require("./validation");
const { SESSION_DURATION_MS, createSessionManager, sessionHeader } = require("./sessions");
const { CHALLENGE_DURATION_MS, createAdminTwoStep } = require("./adminTwoStep");

// Install login and two-step verification before the /admin authorization boundary.
function installAdminAuth({
  router,
  db,
  remote,
  rate,
  now,
  sharedSessions,
  twoStep = { enabled: false, sendCode: async () => {} },
}) {
  const sessions = createSessionManager({
    table: "quicksub_admin_sessions",
    db,
    remote,
    now,
    memory: !sharedSessions,
  });
  const challenges = createAdminTwoStep({
    db,
    now,
    memory: !sharedSessions,
    sendCode: twoStep.sendCode,
  });
  const cookieValue = (req, name) =>
    (req.headers.cookie || "")
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(name + "="))
      ?.slice(name.length + 1);
  const cookieOptions = (req) => ({
    httpOnly: true,
    secure: req.secure || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
  });
  const maskEmail = (email) => {
    const [local, domain] = String(email || "").split("@");
    if (!local || !domain) return "your administrator email";
    return local.slice(0, 1) + "***@" + domain;
  };
  async function completeSession(req, res, auth, role) {
    const id = randomBytes(32).toString("hex");
    const record = await sessions.create(id, auth);
    res.cookie("qs_admin", id, {
      ...cookieOptions(req),
      maxAge: SESSION_DURATION_MS,
    });
    res.clearCookie("qs_admin_challenge", cookieOptions(req));
    sessionHeader(res, "admin", record.expires_at);
    res.json({ email: auth.user.email, role });
  }

  router.post(
    "/admin/login",
    run(async (req, res) => {
      validateBody(req.body, authSchemas.adminLogin);
      const email = string(req.body.email, 254).toLowerCase();
      const password = string(req.body.password, 256, 1, false);
      rate(req, "admin-login", 6, email);
      const auth = await remote("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email, password },
      });
      const roles = await db(
        "quicksub_admins?user_id=eq." +
          encodeURIComponent(auth.user.id) +
          "&select=role",
      );
      const role = roles[0]?.role;
      if (!["owner", "staff"].includes(role))
        throw fail(403, "This account does not have admin access.");
      if (twoStep.enabled) {
        const challenge = await challenges.create(auth, role);
        res.cookie("qs_admin_challenge", challenge.id, {
          ...cookieOptions(req),
          maxAge: CHALLENGE_DURATION_MS,
        });
        return res.status(202).json({
          requiresTwoStep: true,
          email: maskEmail(challenge.email),
        });
      }
      await completeSession(req, res, auth, role);
    }),
  );

  router.post(
    "/admin/verify",
    run(async (req, res) => {
      validateBody(req.body, authSchemas.adminVerify);
      rate(req, "admin-two-step", 10);
      const id = cookieValue(req, "qs_admin_challenge");
      const result = await challenges.consume(id, req.body.code);
      await completeSession(req, res, result.auth, result.role);
    }),
  );

  router.post(
    "/admin/two-step/cancel",
    run(async (req, res) => {
      const id = cookieValue(req, "qs_admin_challenge");
      await challenges.remove(id);
      res.clearCookie("qs_admin_challenge", cookieOptions(req));
      res.json({ ok: true });
    }),
  );

  router.post(
    "/admin/logout",
    run(async (req, res) => {
      await sessions.remove(cookieValue(req, "qs_admin"));
      await challenges.remove(cookieValue(req, "qs_admin_challenge"));
      res.clearCookie("qs_admin", cookieOptions(req));
      res.clearCookie("qs_admin_challenge", cookieOptions(req));
      res.json({ ok: true });
    }),
  );

  // Authentication is checked against Supabase, and role membership is checked on every request.
  router.use("/admin", (req, res, next) => {
    (async () => {
      const id = cookieValue(req, "qs_admin");
      let active;
      try {
        active = await sessions.get(id);
      } catch (err) {
        if (err.status === 401)
          res.clearCookie("qs_admin", cookieOptions(req));
        throw err;
      }
      const { user, expiresAt } = active;
      sessionHeader(res, "admin", expiresAt);
      const roles = await db(
        "quicksub_admins?user_id=eq." +
          encodeURIComponent(user.id) +
          "&select=role",
      );
      if (!["owner", "staff"].includes(roles[0]?.role))
        throw fail(403, "Admin access has been removed.");
      req.admin = { id: user.id, email: user.email, role: roles[0].role };
      next();
    })().catch(next);
  });
}
module.exports = { installAdminAuth };
