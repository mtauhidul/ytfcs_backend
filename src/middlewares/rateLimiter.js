const rateLimit = require("express-rate-limit");
const config = require("../config/config");

/**
 * Rate limiting middlewares to prevent abuse
 */
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

module.exports = limiter;
