const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel");
const {
  generateNumericOTP,
  sendOTP,
  verifyOTP,
} = require("../utils/otpGenerator");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { generateToken } = require("../middlewares/auth");
const { ApiError } = require("../middlewares/errorHandler");
const logger = require("../config/logger");

/**
 * @desc    Request OTP for patient portal login
 * @route   POST /api/auth/login
 * @access  Public
 */
const requestOTP = asyncHandler(async (req, res) => {
  const { acctNo, phone } = req.body;

  // Validate required fields
  if (!acctNo) {
    throw new ApiError("Patient account number is required", 400);
  }

  // Find patient by account number
  const patient = await Patient.findOne({ acctNo });

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  // Verify phone number if provided
  if (phone) {
    const patientPhone =
      patient.cellPhone || patient.phone || patient.homePhone;

    // Simple phone number matching (consider more sophisticated matching in production)
    const normalizedRequestPhone = phone.replace(/\D/g, "");
    const normalizedPatientPhone = patientPhone
      ? patientPhone.replace(/\D/g, "")
      : "";

    const phoneMatches =
      normalizedPatientPhone.endsWith(normalizedRequestPhone) ||
      normalizedRequestPhone.endsWith(normalizedPatientPhone);

    if (!phoneMatches) {
      throw new ApiError("Phone number does not match our records", 400);
    }
  }

  // Generate OTP
  const otp = generateNumericOTP(6);

  // Save OTP to patient record
  patient.otp = {
    code: otp.code,
    expiresAt: otp.expiresAt,
  };

  await patient.save();

  // Send OTP via preferred method
  try {
    // For now, just log it (implement actual SMS/email sending in production)
    const contactMethod = patient.cellPhone ? "sms" : "email";
    await sendOTP(patient, otp.code, contactMethod);

    // In development, return the OTP for testing
    const otpData =
      process.env.NODE_ENV === "development"
        ? { otp: otp.code, expiresAt: otp.expiresAt }
        : { sent: true, method: contactMethod };

    return successResponse(res, 200, "OTP sent successfully", {
      acctNo: patient.acctNo,
      ...otpData,
    });
  } catch (error) {
    logger.error(`Failed to send OTP: ${error.message}`);
    throw new ApiError(`Failed to send OTP: ${error.message}`, 500);
  }
});

/**
 * @desc    Verify OTP and provide JWT token
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
const verifyPatientOTP = asyncHandler(async (req, res) => {
  const { acctNo, otp } = req.body;

  // Validate required fields
  if (!acctNo || !otp) {
    throw new ApiError("Account number and OTP are required", 400);
  }

  // Find patient by account number
  const patient = await Patient.findOne({ acctNo });

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  // Verify OTP
  if (
    !patient.otp ||
    !patient.otp.code ||
    !patient.otp.expiresAt ||
    patient.otp.code !== otp ||
    new Date() > new Date(patient.otp.expiresAt)
  ) {
    throw new ApiError("Invalid or expired OTP", 400);
  }

  // Clear OTP after successful verification
  patient.otp = undefined;
  await patient.save();

  // Generate JWT token
  const token = generateToken(patient.acctNo);

  return successResponse(res, 200, "OTP verified successfully", {
    acctNo: patient.acctNo,
    name: patient.name || patient.fullName,
    token,
  });
});

/**
 * @desc    Get current patient profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getProfile = asyncHandler(async (req, res) => {
  // Patient is already attached to request by auth middlewares
  const patient = req.patient;

  return successResponse(res, 200, "Profile retrieved successfully", patient);
});

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Private
 */
const refreshToken = asyncHandler(async (req, res) => {
  // Patient is already attached to request by auth middlewares
  const patient = req.patient;

  // Generate new token
  const token = generateToken(patient.acctNo);

  return successResponse(res, 200, "Token refreshed successfully", {
    acctNo: patient.acctNo,
    token,
  });
});

/**
 * @desc    Logout patient
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  // Nothing to do on server side since we're using JWT
  // Client should discard the token

  return successResponse(res, 200, "Logout successful");
});

module.exports = {
  requestOTP,
  verifyPatientOTP,
  getProfile,
  refreshToken,
  logout,
};
