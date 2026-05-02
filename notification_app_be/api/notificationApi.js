const axios = require("axios");
const { Log } = require("../../logging_middleware/index");
const { BASE_URL } = require("../config/config");

async function fetchNotifications(token) {
  await Log("backend", "info", "utils", "Calling notifications API");
  try {
    const res = await axios.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const notifications = res.data.notifications;
    await Log("backend", "info", "utils", `Notifications API returned ${notifications.length} records`);
    return notifications;
  } catch (err) {
    await Log("backend", "error", "utils", `Notifications API call failed: ${err.message}`);
    throw err;
  }
}

module.exports = { fetchNotifications };