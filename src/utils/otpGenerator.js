const { authenticator } = require("otplib");
const crypto = require("crypto");
const logger = require("../config/logger");

/**
 * OTP Generator Utility
 * Handles generation and verification of OTPs for patient portal access
 */

// Configure OTP settings
authenticator.options = {
  digits: 6,
  step: 300, // 5 minutes
};

/**
 * Generate a new OTP for a patient
 * @returns {Object} - Object with OTP code and expiry timestamp
 */
const generateOTP = () => {
  try {
    // Generate a random secret for this OTP
    const secret = authenticator.generateSecret();

    // Generate a token based on this secret
    const token = authenticator.generate(secret);

    // Calculate expiry time (default: 10 minutes from now)
    const expiresAt = new Date(
      Date.now() + parseInt(process.env.OTP_EXPIRE || "10m") * 60000
    );

    return {
      code: token,
      expiresAt,
    };
  } catch (error) {
    logger.error(`Error generating OTP: ${error.message}`);
    throw new Error("Failed to generate OTP");
  }
};

/**
 * Generate a numeric OTP of specified length (simpler alternative)
 * @param {number} length - Length of OTP to generate (default: 6)
 * @returns {Object} - Object with OTP code and expiry timestamp
 */
const generateNumericOTP = (length = 6) => {
  try {
    // Generate a random numeric OTP
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    const otp = Math.floor(min + crypto.randomInt(max - min));

    // Calculate expiry time (default: 10 minutes from now)
    const otpExpireMinutes = process.env.OTP_EXPIRE
      ? parseInt(process.env.OTP_EXPIRE)
      : 10;
    const expiresAt = new Date(Date.now() + otpExpireMinutes * 60000);

    return {
      code: otp.toString(),
      expiresAt,
    };
  } catch (error) {
    logger.error(`Error generating numeric OTP: ${error.message}`);
    throw new Error("Failed to generate OTP");
  }
};

/**
 * Send OTP to patient via SMS or Email
 * @param {Object} patient - Patient document from database
 * @param {string} otpCode - Generated OTP code
 * @param {string} method - 'sms' or 'email'
 * @returns {boolean} - Success status
 */
const sendOTP = async (patient, otpCode, method = "sms") => {
  try {
    // This is a placeholder for actual SMS/Email sending logic
    // In a production environment, implement proper SMS/Email service integration

    if (method === "sms") {
      if (!patient.phone && !patient.cellPhone) {
        throw new Error("Patient has no phone number on file");
      }

      logger.info(
        `[MOCK] Sending OTP ${otpCode} to phone: ${
          patient.cellPhone || patient.phone
        }`
      );

      // Implement SMS sending logic here
      // Example: Use Twilio, AWS SNS, or another SMS provider

      return true;
    } else if (method === "email") {
      if (!patient.email) {
        throw new Error("Patient has no email on file");
      }

      logger.info(`[MOCK] Sending OTP ${otpCode} to email: ${patient.email}`);

      // Implement email sending logic here
      // Example: Use Nodemailer, SendGrid, or another email provider

      return true;
    } else {
      throw new Error(`Invalid OTP delivery method: ${method}`);
    }
  } catch (error) {
    logger.error(`Error sending OTP: ${error.message}`);
    throw error;
  }
};

/**
 * Verify an OTP against the stored value and expiry time
 * @param {string} storedOTP - The OTP stored in the database
 * @param {Date} expiresAt - Expiry timestamp from database
 * @param {string} submittedOTP - OTP submitted by the user
 * @returns {boolean} - Whether the OTP is valid
 */
const verifyOTP = (storedOTP, expiresAt, submittedOTP) => {
  // Check if OTP has expired
  if (new Date() > new Date(expiresAt)) {
    return false;
  }

  // Simple comparison for numeric OTPs
  return storedOTP === submittedOTP;
};

module.exports = {
  generateOTP,
  generateNumericOTP,
  sendOTP,
  verifyOTP,
};
