const winston = require("winston");
const fs = require("fs");
const path = require("path");
require("winston-daily-rotate-file");
const colors = require("colors/safe");

// Ensure logs directory exists
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log symbols for different levels
const logSymbols = {
  error: "■",
  warn: "▲",
  info: "●",
  http: "○",
  verbose: "◇",
  debug: "◆",
  silly: "□",
};

// Console format with colors and symbols
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Truncate long messages
    const MAX_LENGTH = 150;
    const truncatedMessage =
      message.length > MAX_LENGTH
        ? message.substring(0, MAX_LENGTH) + "..."
        : message;

    // Format meta data if present
    let metaStr = "";
    if (Object.keys(meta).length && meta.stack) {
      // If there's a stack, show only the first line
      metaStr = meta.stack.split("\n")[0];
    } else if (Object.keys(meta).length) {
      // For other meta, show a compact representation
      const metaObj = { ...meta };
      delete metaObj.stack; // Don't show stack in normal output

      // Convert to string and limit length
      metaStr = JSON.stringify(metaObj);
      if (metaStr.length > 50) {
        metaStr = metaStr.substring(0, 50) + "...";
      }
    }

    // Color coding based on level
    let coloredOutput;
    switch (level) {
      case "error":
        coloredOutput = colors.red(
          `${timestamp} ${logSymbols.error} ${truncatedMessage}`
        );
        break;
      case "warn":
        coloredOutput = colors.yellow(
          `${timestamp} ${logSymbols.warn} ${truncatedMessage}`
        );
        break;
      case "info":
        coloredOutput = colors.cyan(
          `${timestamp} ${logSymbols.info} ${truncatedMessage}`
        );
        break;
      case "http":
        coloredOutput = colors.green(
          `${timestamp} ${logSymbols.http} ${truncatedMessage}`
        );
        break;
      case "debug":
        coloredOutput = colors.magenta(
          `${timestamp} ${logSymbols.debug} ${truncatedMessage}`
        );
        break;
      default:
        coloredOutput = `${timestamp} [${level}] ${truncatedMessage}`;
    }

    return metaStr ? `${coloredOutput} ${colors.gray(metaStr)}` : coloredOutput;
  })
);

// File format - more detailed for troubleshooting
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transports: [
    // Write logs to console with brief format
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Daily rotating file transport for error logs
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "10m",
      maxFiles: "7d",
      level: "error",
      format: fileFormat,
    }),

    // Daily rotating file for all logs
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "10m",
      maxFiles: "7d",
      format: fileFormat,
    }),
  ],
  // Handle uncaught exceptions and unhandled promise rejections
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "10m",
      maxFiles: "7d",
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "10m",
      maxFiles: "7d",
      format: fileFormat,
    }),
  ],
});

// HTTP request logger function for Express middleware
logger.httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Colorize status code
    let statusColor;
    if (status >= 500) statusColor = colors.red(status);
    else if (status >= 400) statusColor = colors.yellow(status);
    else if (status >= 300) statusColor = colors.cyan(status);
    else if (status >= 200) statusColor = colors.green(status);
    else statusColor = colors.white(status);

    const message = `${method} ${url} ${statusColor} ${duration}ms`;

    // Log at appropriate level based on status
    if (status >= 500) {
      logger.error(message);
    } else if (status >= 400) {
      logger.warn(message);
    } else {
      logger.http(message);
    }
  });

  next();
};

// Add a stream object that can be used by Morgan
logger.stream = {
  write: (message) => {
    // Remove trailing newline that Morgan adds
    logger.http(message.trim());
  },
};

module.exports = logger;
