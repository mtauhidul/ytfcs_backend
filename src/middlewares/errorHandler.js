const logger = require("../config/logger");

/**
 * Custom error handler middlewares for Express
 * Provides consistent error responses and logging
 */

// Not Found Error Handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Custom Error class for API errors
class ApiError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global Error Handler
const errorHandler = (err, req, res, next) => {
  // Set default status code and message
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong";
  let errors = err.errors || null;

  // Handle specific error types
  if (err.name === "ValidationError" && err.errors) {
    // Mongoose validation error
    statusCode = 400;
    const validationErrors = Object.values(err.errors).map((error) => {
      return {
        field: error.path,
        message: error.message,
      };
    });
    errors = validationErrors;
    message = "Validation Error";
  } else if (err.name === "MongoServerError" && err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 400;
    message = "Duplicate field value entered";
    errors = Object.keys(err.keyValue).map((key) => {
      return {
        field: key,
        message: `${key} already exists`,
      };
    });
  } else if (err.name === "CastError") {
    // MongoDB invalid ID error
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.name === "JsonWebTokenError") {
    // JWT error
    statusCode = 401;
    message = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    // JWT expired error
    statusCode = 401;
    message = "Token expired";
  }

  // Log the error
  const logLevel = statusCode >= 500 ? "error" : "warn";
  logger[logLevel](`${statusCode} - ${message}`, {
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    errors,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  // Send response
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = {
  notFound,
  errorHandler,
  ApiError,
};
