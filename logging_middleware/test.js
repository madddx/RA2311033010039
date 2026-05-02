const { Log } = require("./index");

async function test() {
  // Backend tests
  await Log("backend", "info",  "config",     "Application starting up");
  await Log("backend", "debug", "db",          "Database connection established");
  await Log("backend", "warn",  "cache",       "Cache miss rate above threshold");
  await Log("backend", "error", "handler",     "Received string, expected bool");
  await Log("backend", "fatal", "db",          "Critical database connection failure");

  // Validation tests (should print errors, not call API)
  await Log("backend", "info",  "component",  "This should fail - wrong package for backend");
  await Log("mobile",  "info",  "config",     "This should fail - invalid stack");
  await Log("backend", "verbose","config",    "This should fail - invalid level");
}

test();