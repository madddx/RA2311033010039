const { getToken } = require("../../logging_middleware/index");
const { Log } = require("../../logging_middleware/index");

async function authMiddleware(req, res, next) {
  const token = getToken();
  if (!token) {
    await Log("backend", "error", "middleware", "No auth token available");
    return res.status(401).json({ error: "Unauthorized - no token available" });
  }
  req.authToken = token;
  await Log("backend", "debug", "middleware", `Request received: ${req.method} ${req.path}`);
  next();
}

module.exports = authMiddleware;