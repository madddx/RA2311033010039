const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
};

function calculateScore(notification) {
  const typeWeight = TYPE_WEIGHT[notification.Type] || 0;
  const createdAt = new Date(notification.Timestamp).getTime();
  const now = Date.now();
  const minutesAgo = (now - createdAt) / (1000 * 60);
  const recencyScore = Math.max(0, 1000 - minutesAgo);
  return parseFloat(((typeWeight * 1000) + recencyScore).toFixed(2));
}

function getTopN(notifications, n) {
  return notifications
    .map(notification => ({
      ...notification,
      priorityScore: calculateScore(notification)
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, n);
}

module.exports = { calculateScore, getTopN };