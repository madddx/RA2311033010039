const axios = require("axios");
const config = require("./config");

let accessToken = config.ACCESS_TOKEN;

const VALID_STACKS = ["backend", "frontend"];
const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const BACKEND_PACKAGES = [
  "cache", "controller", "cron_job", "db", "domain",
  "handler", "repository", "route", "service",
  "auth", "config", "middleware", "utils"
];
const FRONTEND_PACKAGES = [
  "api", "component", "hook", "page", "state", "style",
  "auth", "config", "middleware", "utils"
];

// ─── Refresh Token ────────────────────────────────────────────────────────────
async function refreshToken() {
  try {
    const res = await axios.post(config.AUTH_API_URL, {
      email: config.EMAIL,
      name: config.NAME,
      rollNo: config.ROLL_NO,
      accessCode: config.ACCESS_CODE,
      clientID: config.CLIENT_ID,
      clientSecret: config.CLIENT_SECRET
    });
    accessToken = res.data.access_token;
    console.log("[AUTH] Token refreshed successfully");
  } catch (err) {
    console.error("[AUTH] Token refresh failed:", err.message);
    throw err;
  }
}

// ─── Get Current Token ────────────────────────────────────────────────────────
function getToken() {
  return accessToken;
}

// ─── Log Function ─────────────────────────────────────────────────────────────
async function Log(stack, level, pkg, message) {
  // Validation
  if (!VALID_STACKS.includes(stack)) {
    console.error(`[LOG ERROR] Invalid stack: "${stack}". Must be "backend" or "frontend"`);
    return;
  }
  if (!VALID_LEVELS.includes(level)) {
    console.error(`[LOG ERROR] Invalid level: "${level}". Must be one of: debug, info, warn, error, fatal`);
    return;
  }
  const validPkgs = stack === "backend" ? BACKEND_PACKAGES : FRONTEND_PACKAGES;
  if (!validPkgs.includes(pkg)) {
    console.error(`[LOG ERROR] Invalid package "${pkg}" for stack "${stack}"`);
    return;
  }

  const payload = { stack, level, package: pkg, message };

  try {
    const res = await axios.post(
      config.LOG_API_URL,
      payload,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log(`[LOG SUCCESS] ${stack} | ${pkg} | ${level} | ${message}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) {
      // Token expired — refresh and retry
      console.log("[AUTH] Token expired, refreshing...");
      try {
        await refreshToken();
        const retry = await axios.post(
          config.LOG_API_URL,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        console.log(`[LOG SUCCESS] ${stack} | ${pkg} | ${level} | ${message}`);
        return retry.data;
      } catch (retryErr) {
        console.error(`[LOG FAILED after refresh] ${retryErr.message}`);
      }
    } else {
      console.error(`[LOG FAILED] ${err.response?.status} - ${err.message}`);
    }
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { Log, getToken };