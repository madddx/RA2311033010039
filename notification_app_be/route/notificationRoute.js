const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const {
  handleGetAll,
  handleGetPriority,
  handleGetByType,
  handleGetStats
} = require("../handler/notificationHandler");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Routes
router.get("/",          handleGetAll);
router.get("/priority",  handleGetPriority);
router.get("/stats",     handleGetStats);
router.get("/type/:type", handleGetByType);

module.exports = router;