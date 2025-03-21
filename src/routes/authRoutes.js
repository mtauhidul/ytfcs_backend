const express = require("express");
const router = express.Router();
const {
  requestOTP,
  verifyPatientOTP,
  getProfile,
  refreshToken,
  logout,
} = require("../controllers/authController");
const { protect, verifyOTP } = require("../middlewares/auth");

/**
 * Authentication Routes
 * Base URL: /api/auth
 */

// Request OTP for login
router.post("/login", requestOTP);

// Verify OTP and get token
router.post("/verify-otp", verifyPatientOTP);

// Get profile (requires authentication)
router.get("/profile", protect, getProfile);

// Refresh token (requires authentication)
router.post("/refresh-token", protect, refreshToken);

// Logout (requires authentication)
router.post("/logout", protect, logout);

module.exports = router;
