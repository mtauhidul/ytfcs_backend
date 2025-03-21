const asyncHandler = require("express-async-handler");
const Appointment = require("../models/appointmentModel");
const Patient = require("../models/patientModel");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { ApiError } = require("../middlewares/errorHandler");
const logger = require("../config/logger");

/**
 * @desc    Check if patient has a current-day appointment
 * @route   POST /api/kiosk/check-in
 * @access  Public
 */
const checkAppointment = asyncHandler(async (req, res) => {
  const { encounterId } = req.body;

  if (!encounterId) {
    throw new ApiError("Encounter ID is required", 400);
  }

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find appointment for today with matching encounterId
  const appointment = await Appointment.findOne({
    encounterId,
    appointmentDate: {
      $gte: today,
      $lt: tomorrow,
    },
  });

  if (!appointment) {
    return errorResponse(
      res,
      404,
      "No appointment found for today with this Encounter ID"
    );
  }

  // Return basic appointment info for KIOSK
  return successResponse(res, 200, "Appointment found", {
    encounterId: appointment.encounterId,
    patientName: appointment.patientName || appointment.fullName,
    appointmentTime: appointment.appointmentStartTime,
    provider: appointment.appointmentProviderName,
    facility: appointment.appointmentFacilityName,
    visitType: appointment.visitType,
    hasCheckedIn: !!appointment.kioskCheckIn?.checkedInAt,
  });
});

/**
 * @desc    Submit KIOSK check-in data
 * @route   PATCH /api/kiosk/submit/:encounterId
 * @access  Public
 */
const submitKioskData = asyncHandler(async (req, res) => {
  const { encounterId } = req.params;
  const kioskData = req.body;

  // Find appointment
  const appointment = await Appointment.findOne({ encounterId });

  if (!appointment) {
    throw new ApiError("Appointment not found", 404);
  }

  // Check if appointment is for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const appointmentDate = new Date(appointment.appointmentDate);
  appointmentDate.setHours(0, 0, 0, 0);

  const isToday = appointmentDate.getTime() === today.getTime();

  // Only allow check-ins for current-day appointments or in development
  if (!isToday && process.env.NODE_ENV === "production") {
    throw new ApiError("Can only check in for current day appointments", 400);
  }

  // Prepare KIOSK data
  const updates = {
    kioskCheckIn: {
      checkedInAt: new Date(),
      location: kioskData.location || appointment.appointmentFacilityName,
      hasHIPAASignature: kioskData.hasHIPAASignature || false,
      hasPracticePoliciesSignature:
        kioskData.hasPracticePoliciesSignature || false,
      hasUploadedPictures: kioskData.hasUploadedPictures || false,
      uploadedPictureURLs: kioskData.uploadedPictureURLs || [],
    },
  };

  // Add personal information if provided
  if (kioskData.personalInfo) {
    if (kioskData.personalInfo.fullName)
      updates.patientName = kioskData.personalInfo.fullName;
    if (kioskData.personalInfo.email)
      updates.patientEmail = kioskData.personalInfo.email;
    if (kioskData.personalInfo.phone)
      updates.patientCellPhone = kioskData.personalInfo.phone;

    // Address updates
    if (kioskData.personalInfo.address)
      updates.patientAddressLine1 = kioskData.personalInfo.address;
    if (kioskData.personalInfo.city)
      updates.patientCity = kioskData.personalInfo.city;
    if (kioskData.personalInfo.state)
      updates.patientState = kioskData.personalInfo.state;
    if (kioskData.personalInfo.zipcode)
      updates.patientZIPCode = kioskData.personalInfo.zipcode;
  }

  // Add insurance information if provided
  if (kioskData.primaryInsurance) {
    updates.primaryInsurance = kioskData.primaryInsurance;

    // Also update the basic insurance fields for compatibility
    if (kioskData.primaryInsurance.name) {
      updates.primaryInsuranceName = kioskData.primaryInsurance.name;
    }
    if (kioskData.primaryInsurance.memberId) {
      updates.primaryInsuranceSubscriberNo =
        kioskData.primaryInsurance.memberId;
    }
  }

  if (kioskData.secondaryInsurance) {
    updates.secondaryInsurance = kioskData.secondaryInsurance;

    // Also update the basic insurance fields for compatibility
    if (kioskData.secondaryInsurance.name) {
      updates.secondaryInsuranceName = kioskData.secondaryInsurance.name;
    }
    if (kioskData.secondaryInsurance.memberId) {
      updates.secondaryInsuranceSubscriberNo =
        kioskData.secondaryInsurance.memberId;
    }
  }

  // Add medical information if provided
  if (kioskData.medicalInfo) {
    updates.medicalInfo = kioskData.medicalInfo;
  }

  // Update appointment
  const updatedAppointment = await Appointment.findOneAndUpdate(
    { encounterId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  // Also update patient record
  try {
    await Patient.createOrUpdateFromAppointment(updatedAppointment);
  } catch (error) {
    logger.warn(`Error updating patient record: ${error.message}`);
  }

  return successResponse(res, 200, "Check-in completed successfully", {
    encounterId,
    checkedIn: true,
    checkedInAt: updatedAppointment.kioskCheckIn.checkedInAt,
  });
});

/**
 * @desc    Upload patient images (ID, insurance card, etc.)
 * @route   POST /api/kiosk/upload-images/:encounterId
 * @access  Public
 */
const uploadPatientImages = asyncHandler(async (req, res) => {
  const { encounterId } = req.params;

  // Check if files were uploaded
  if (!req.files || Object.keys(req.files).length === 0) {
    throw new ApiError("No files uploaded", 400);
  }

  // Find appointment
  const appointment = await Appointment.findOne({ encounterId });

  if (!appointment) {
    throw new ApiError("Appointment not found", 404);
  }

  // Get file paths
  const imageURLs = Object.keys(req.files).map((key) => {
    const file = req.files[key];

    return {
      type: key,
      url: `/uploads/patients/${appointment.patientAcctNo}/${file.filename}`,
    };
  });

  // Update appointment
  if (!appointment.kioskCheckIn) {
    appointment.kioskCheckIn = {};
  }

  appointment.kioskCheckIn.hasUploadedPictures = true;
  appointment.kioskCheckIn.uploadedPictureURLs = [
    ...(appointment.kioskCheckIn.uploadedPictureURLs || []),
    ...imageURLs,
  ];

  await appointment.save();

  return successResponse(res, 200, "Images uploaded successfully", {
    encounterId,
    uploadedImages: imageURLs,
  });
});

module.exports = {
  checkAppointment,
  submitKioskData,
  uploadPatientImages,
};
