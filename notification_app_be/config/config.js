require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || "http://20.207.122.201/evaluation-service",
  TOP_N: parseInt(process.env.TOP_N) || 10
};