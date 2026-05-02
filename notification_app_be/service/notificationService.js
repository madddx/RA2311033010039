const { fetchNotifications } = require("../api/notificationApi");
const { getTopN, calculateScore } = require("../utils/priorityScore");
const { Log } = require("../../logging_middleware/index");
const { TOP_N } = require("../config/config");

async function getAllNotifications(token) {
  await Log("backend", "info", "service", "Fetching all notifications");
  const notifications = await fetchNotifications(token);
  await Log("backend", "info", "service", `Returning ${notifications.length} notifications`);
  return notifications;
}

async function getPriorityInbox(token, n = TOP_N) {
  await Log("backend", "info", "service", `Computing priority inbox for top ${n} notifications`);
  const notifications = await fetchNotifications(token);
  const topN = getTopN(notifications, n);
  await Log("backend", "info", "service", `Priority inbox computed: ${topN.length} notifications selected from ${notifications.length}`);
  return {
    total: notifications.length,
    showing: topN.length,
    notifications: topN
  };
}

async function getNotificationsByType(token, type) {
  await Log("backend", "info", "service", `Filtering notifications by type: ${type}`);
  const notifications = await fetchNotifications(token);
  const filtered = notifications.filter(n => n.Type.toLowerCase() === type.toLowerCase());
  await Log("backend", "info", "service", `Found ${filtered.length} notifications of type ${type}`);
  return filtered;
}

async function getNotificationStats(token) {
  await Log("backend", "info", "service", "Computing notification statistics");
  const notifications = await fetchNotifications(token);

  const stats = {
    total: notifications.length,
    byType: {
      Placement: 0,
      Result: 0,
      Event: 0
    }
  };

  notifications.forEach(n => {
    if (stats.byType[n.Type] !== undefined) {
      stats.byType[n.Type]++;
    }
  });

  await Log("backend", "info", "service", `Stats computed: ${JSON.stringify(stats.byType)}`);
  return stats;
}

module.exports = {
  getAllNotifications,
  getPriorityInbox,
  getNotificationsByType,
  getNotificationStats
};