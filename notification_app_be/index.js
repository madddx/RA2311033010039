const express = require("express");
const cors = require("cors");
const { Log } = require("../logging_middleware/index");
const notificationRoute = require("./route/notificationRoute");
const { PORT } = require("./config/config");

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", async (req, res) => {
  await Log("backend", "info", "route", "Health check endpoint called");
  res.status(200).json({
    success: true,
    status: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// Notification routes
app.use("/api/notifications", notificationRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Global error handler
app.use(async (err, req, res, next) => {
  await Log("backend", "fatal", "middleware", `Unhandled server error: ${err.message}`);
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.listen(PORT, async () => {
  await Log("backend", "info", "config", `Server started on port ${PORT}`);
  console.log(`\n Server running at http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET http://localhost:${PORT}/health`);
  console.log(`  GET http://localhost:${PORT}/api/notifications`);
  console.log(`  GET http://localhost:${PORT}/api/notifications/priority?n=10`);
  console.log(`  GET http://localhost:${PORT}/api/notifications/stats`);
  console.log(`  GET http://localhost:${PORT}/api/notifications/type/Placement`);
  console.log(`  GET http://localhost:${PORT}/api/notifications/type/Result`);
  console.log(`  GET http://localhost:${PORT}/api/notifications/type/Event\n`);
});