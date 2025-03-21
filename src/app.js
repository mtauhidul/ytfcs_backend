// Start with core dependencies
const express = require("express");
const path = require("path");
const fs = require("fs");

// Load environment variables
try {
  require("dotenv").config();
  console.log("Environment variables loaded");
} catch (err) {
  console.error("Error loading dotenv:", err.message);
  // Continue without env variables - will use defaults
}

// Ensure required directories exist
const uploadsDir = path.join(__dirname, "../uploads");
const logsDir = path.join(__dirname, "../logs");

[uploadsDir, logsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize Express
const app = express();

// Set port from env or default
const PORT = process.env.PORT || 5001;

try {
  console.log("Loading dependencies...");

  // Load dependencies
  const morgan = require("morgan");
  const helmet = require("helmet");
  const cors = require("cors");

  // Load local modules - using absolute paths to avoid path issues
  console.log("Loading local modules...");
  const logger = require(path.join(__dirname, "./config/logger"));
  const connectDB = require(path.join(__dirname, "./config/db"));
  const { notFound, errorHandler } = require(
    path.join(__dirname, "./middlewares/errorHandler")
  );

  console.log("Connecting to database...");
  // Connect to MongoDB
  connectDB().catch((err) => {
    console.error("Database connection failed:", err.message);
    // Continue even if DB connection fails - app will still start
  });

  console.log("Setting up middlewares...");
  // Security middlewares
  app.use(helmet());

  // Enable CORS
  app.use(cors());

  // Body parser middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Request logging
  app.use(morgan("combined", { stream: logger.stream }));

  // Serve static files from uploads directory
  app.use("/uploads", express.static(uploadsDir));

  console.log("Setting up routes...");
  // API routes
  app.use(
    "/api/appointments",
    require(path.join(__dirname, "./routes/appointmentRoutes"))
  );
  app.use("/api/kiosk", require(path.join(__dirname, "./routes/kioskRoutes")));
  app.use("/api/auth", require(path.join(__dirname, "./routes/authRoutes")));
  app.use(
    "/api/patients",
    require(path.join(__dirname, "./routes/patientRoutes"))
  );

  // API health check
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "success",
      message: "YTFCS API is running",
      timestamp: new Date(),
    });
  });

  // Root route
  app.get("/", (req, res) => {
    res.status(200).json({
      message: "Welcome to YTFCS API",
      documentation: "/api-docs",
      version: "1.0.0",
    });
  });

  // API documentation route placeholder (to be implemented)
  app.get("/api-docs", (req, res) => {
    res.status(200).json({
      message: "API documentation will be available here",
    });
  });

  // Error handling middlewares
  app.use(notFound);
  app.use(errorHandler);

  console.log("Setup complete, starting server...");
} catch (error) {
  console.error("Error during app initialization:", error);

  // Fallback routes for basic functionality
  app.get("/", (req, res) => {
    res.status(200).json({
      message: "YTFCS API - Limited functionality mode",
      error: "Some components failed to load",
    });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "limited",
      message: "API running in limited mode due to initialization errors",
      error: error.message,
    });
  });

  // Simple error handler if the main one fails to load
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      status: "error",
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  });
}

// Start server
const server = app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`
  );
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  // Log but don't exit in development
  if (process.env.NODE_ENV === "production") {
    server.close(() => process.exit(1));
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  // Log but don't exit in development
  if (process.env.NODE_ENV === "production") {
    server.close(() => process.exit(1));
  }
});

module.exports = app;
