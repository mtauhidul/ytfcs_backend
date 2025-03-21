const express = require("express");
const router = express.Router();
const {
  uploadAppointments,
  getAppointments,
  getAppointment,
  updateAppointment,
  deleteAppointmentsByFile,
  recordTimeEvents,
} = require("../controllers/appointmentController");
const { excelUpload } = require("../middlewares/upload");

/**
 * Appointment Routes
 * Base URL: /api/appointments
 */

// Upload Excel file with appointments
router.post("/upload", excelUpload.single("file"), uploadAppointments);

// Get all appointments (with filters)
router.get("/", getAppointments);

// Get appointment by Encounter ID
router.get("/:encounterId", getAppointment);

// Update appointment with KIOSK data
router.patch("/:encounterId", updateAppointment);

// Delete appointments by file ID
router.delete("/file/:fileId", deleteAppointmentsByFile);

// Record time tracking events
router.post("/:encounterId/times", recordTimeEvents);

module.exports = router;
