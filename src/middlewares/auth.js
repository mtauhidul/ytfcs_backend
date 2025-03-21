const jwt = require("jsonwebtoken");
const { ApiError } = require("./errorHandler");
const Patient = require("../models/patientModel");
const logger = require("../config/logger");

/**
 * Authentication middlewares for patient portal
 * Handles JWT verification and OTP validation
 */

// Protect routes using JWT
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Check if token exists
    if (!token) {
      return next(new ApiError("Not authorized, no token provided", 401));
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get patient from the token
      const patient = await Patient.findOne({ acctNo: decoded.acctNo });

      if (!patient) {
        return next(new ApiError("Not authorized, patient not found", 401));
      }

      // Add patient to request
      req.patient = patient;
      next();
    } catch (error) {
      logger.error(`JWT verification error: ${error.message}`);
      return next(new ApiError("Not authorized, token failed", 401));
    }
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    return next(new ApiError("Authentication failed", 500));
  }
};

// Verify OTP for patient login
const verifyOTP = async (req, res, next) => {
  try {
    const { acctNo, otp } = req.body;

    if (!acctNo || !otp) {
      return next(new ApiError("Account number and OTP are required", 400));
    }

    // Find patient by account number
    const patient = await Patient.findOne({ acctNo });

    if (!patient) {
      return next(new ApiError("Patient not found", 404));
    }

    // Check if OTP exists and is valid
    if (!patient.otp || !patient.otp.code || !patient.otp.expiresAt) {
      return next(new ApiError("No OTP found, please request a new one", 400));
    }

    // Check if OTP has expired
    if (new Date() > new Date(patient.otp.expiresAt)) {
      return next(
        new ApiError("OTP has expired, please request a new one", 400)
      );
    }

    // Check if OTP matches
    if (patient.otp.code !== otp) {
      return next(new ApiError("Invalid OTP", 400));
    }

    // OTP is valid, add patient to request
    req.patient = patient;
    next();
  } catch (error) {
    logger.error(`OTP verification error: ${error.message}`);
    return next(new ApiError("OTP verification failed", 500));
  }
};

// Generate JWT for patient
const generateToken = (acctNo) => {
  return jwt.sign({ acctNo }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

module.exports = {
  protect,
  verifyOTP,
  generateToken,
};
