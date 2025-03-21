const mongoose = require("mongoose");
const logger = require("./logger");

/**
 * Connect to MongoDB
 * This module is designed to be easily extended for FHIR integration in the future
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options may change but are good defaults
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Setup for future FHIR integration
    // When migrating to FHIR, create adapters here that translate between
    // our MongoDB models and FHIR resources

    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
