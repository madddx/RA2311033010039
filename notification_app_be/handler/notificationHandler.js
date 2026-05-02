const {
  getAllNotifications,
  getPriorityInbox,
  getNotificationsByType,
  getNotificationStats
} = require("../service/notificationService");
const { Log } = require("../../logging_middleware/index");

// GET /api/notifications
async function handleGetAll(req, res) {
  await Log("backend", "info", "handler", "handleGetAll called");
  try {
    const notifications = await getAllNotifications(req.authToken);
    res.status(200).json({ success: true, count: notifications.length, notifications });
  } catch (err) {
    await Log("backend", "error", "handler", `handleGetAll failed: ${err.message}`);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
}

// GET /api/notifications/priority?n=10
async function handleGetPriority(req, res) {
  const n = parseInt(req.query.n) || 10;
  await Log("backend", "info", "handler", `handleGetPriority called with n=${n}`);
  try {
    const result = await getPriorityInbox(req.authToken, n);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    await Log("backend", "error", "handler", `handleGetPriority failed: ${err.message}`);
    res.status(500).json({ success: false, error: "Failed to compute priority inbox" });
  }
}

// GET /api/notifications/type/:type
async function handleGetByType(req, res) {
  const { type } = req.params;
  await Log("backend", "info", "handler", `handleGetByType called with type=${type}`);
  const validTypes = ["placement", "result", "event"];
  if (!validTypes.includes(type.toLowerCase())) {
    await Log("backend", "warn", "handler", `Invalid notification type: ${type}`);
    return res.status(400).json({ success: false, error: "Invalid type. Must be: Placement, Result, Event" });
  }
  try {
    const notifications = await getNotificationsByType(req.authToken, type);
    res.status(200).json({ success: true, type, count: notifications.length, notifications });
  } catch (err) {
    await Log("backend", "error", "handler", `handleGetByType failed: ${err.message}`);
    res.status(500).json({ success: false, error: "Failed to fetch notifications by type" });
  }
}

// GET /api/notifications/stats
async function handleGetStats(req, res) {
  await Log("backend", "info", "handler", "handleGetStats called");
  try {
    const stats = await getNotificationStats(req.authToken);
    res.status(200).json({ success: true, stats });
  } catch (err) {
    await Log("backend", "error", "handler", `handleGetStats failed: ${err.message}`);
    res.status(500).json({ success: false, error: "Failed to compute stats" });
  }
}

module.exports = {
  handleGetAll,
  handleGetPriority,
  handleGetByType,
  handleGetStats
};