const express = require("express");
const router = express.Router();
const {
  getPatient,
  getPatientAppointments,
  updatePatient,
  getPatientDashboard,
} = require("../controllers/patientController");
const { protect } = require("../middlewares/auth");

/**
 * Patient Routes
 * Base URL: /api/patients
 */

// All routes require authentication
router.use(protect);

// Get patient profile
router.get("/:acctNo", getPatient);

// Get patient appointments
router.get("/:acctNo/appointments", getPatientAppointments);

// Update patient profile
router.put("/:acctNo", updatePatient);

// Get patient dashboard data
router.get("/:acctNo/dashboard", getPatientDashboard);

module.exports = router;
