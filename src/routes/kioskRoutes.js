const express = require("express");
const router = express.Router();
const {
  checkAppointment,
  submitKioskData,
  uploadPatientImages,
} = require("../controllers/kioskController");
const { patientImageUpload } = require("../middlewares/upload");

/**
 * KIOSK Routes
 * Base URL: /api/kiosk
 */

// Check if patient has a current-day appointment
router.post("/check-in", checkAppointment);

// Submit KIOSK check-in data
router.patch("/submit/:encounterId", submitKioskData);

// Upload patient images
router.post(
  "/upload-images/:encounterId",
  patientImageUpload.fields([
    { name: "photo", maxCount: 1 },
    { name: "id", maxCount: 1 },
    { name: "insurance", maxCount: 2 },
  ]),
  uploadPatientImages
);

module.exports = router;
