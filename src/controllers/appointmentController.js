const asyncHandler = require("express-async-handler");
const fs = require("fs").promises;
const path = require("path");
const Appointment = require("../models/appointmentModel");
const Patient = require("../models/patientModel");
const { parseExcelFile } = require("../utils/excelParser");
const {
  calculateDurations,
  validateTimeEvents,
} = require("../utils/timeCalculator");
const {
  successResponse,
  errorResponse,
  getPaginationInfo,
} = require("../utils/apiResponse");
const { ApiError } = require("../middlewares/errorHandler");
const logger = require("../config/logger");

/**
 * @desc    Upload Excel file with appointments
 * @route   POST /api/appointments/upload
 * @access  Private
 */
const uploadAppointments = asyncHandler(async (req, res) => {
  // Check if file exists in the request
  if (!req.file || !req.fileInfo) {
    throw new ApiError("No file uploaded", 400);
  }

  try {
    // Parse Excel file
    const { fileId, fileName, appointments } = await parseExcelFile(
      req.fileInfo.path,
      req.fileInfo.originalName
    );

    // Insert appointments into database
    const insertedAppointments = [];
    const errors = [];

    for (const appointmentData of appointments) {
      try {
        // Check for required fields
        if (!appointmentData.encounterId || !appointmentData.patientAcctNo) {
          errors.push({
            message: "Missing required fields",
            data: appointmentData,
          });
          continue;
        }

        // Check if appointment already exists
        const existingAppointment = await Appointment.findOne({
          encounterId: appointmentData.encounterId,
        });

        if (existingAppointment) {
          errors.push({
            message: "Appointment with this Encounter ID already exists",
            encounterId: appointmentData.encounterId,
          });
          continue;
        }

        // Insert appointment
        const appointment = await Appointment.create(appointmentData);
        insertedAppointments.push(appointment);

        // Update or create patient record
        await Patient.createOrUpdateFromAppointment(appointment);
      } catch (error) {
        errors.push({
          message: `Error inserting appointment: ${error.message}`,
          data: appointmentData,
        });
      }
    }

    return successResponse(res, 201, "Appointments uploaded successfully", {
      fileId,
      fileName,
      total: appointments.length,
      inserted: insertedAppointments.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error(`Error in uploadAppointments: ${error.message}`);

    // Clean up uploaded file on error
    try {
      await fs.unlink(req.fileInfo.path);
    } catch (unlinkError) {
      logger.warn(`Failed to delete file: ${unlinkError.message}`);
    }

    throw new ApiError(`Failed to process Excel file: ${error.message}`, 500);
  }
});

/**
 * @desc    Get all appointments by date
 * @route   GET /api/appointments
 * @access  Private
 */
const getAppointments = asyncHandler(async (req, res) => {
  const {
    date,
    page = 1,
    limit = 50,
    provider,
    facility,
    status,
    search,
  } = req.query;

  // Build filter
  const filter = {};

  // Filter by date if provided
  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    filter.appointmentDate = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  // Filter by provider if provided
  if (provider) {
    filter.appointmentProviderName = { $regex: provider, $options: "i" };
  }

  // Filter by facility if provided
  if (facility) {
    filter.appointmentFacilityName = { $regex: facility, $options: "i" };
  }

  // Filter by status if provided
  if (status) {
    filter.visitStatus = { $regex: status, $options: "i" };
  }

  // Search by patient name or account number
  if (search) {
    filter.$or = [
      { patientName: { $regex: search, $options: "i" } },
      { patientFirstName: { $regex: search, $options: "i" } },
      { patientLastName: { $regex: search, $options: "i" } },
      { patientAcctNo: { $regex: search, $options: "i" } },
      { encounterId: { $regex: search, $options: "i" } },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Count total matching appointments
  const total = await Appointment.countDocuments(filter);

  // Get appointments
  const appointments = await Appointment.find(filter)
    .sort({ appointmentDate: 1, appointmentStartTime: 1 })
    .skip(skip)
    .limit(limitNum);

  // Pagination metadata
  const paginationInfo = getPaginationInfo(
    pageNum,
    limitNum,
    total,
    `${req.protocol}://${req.get("host")}/api/appointments`
  );

  return successResponse(
    res,
    200,
    "Appointments retrieved successfully",
    appointments,
    {
      pagination: paginationInfo,
    }
  );
});

/**
 * @desc    Get one appointment by Encounter ID
 * @route   GET /api/appointments/:encounterId
 * @access  Private
 */
const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({
    encounterId: req.params.encounterId,
  });

  if (!appointment) {
    throw new ApiError("Appointment not found", 404);
  }

  return successResponse(
    res,
    200,
    "Appointment retrieved successfully",
    appointment
  );
});

/**
 * @desc    Update appointment with KIOSK data
 * @route   PATCH /api/appointments/:encounterId
 * @access  Private
 */
const updateAppointment = asyncHandler(async (req, res) => {
  // Find appointment
  const appointment = await Appointment.findOne({
    encounterId: req.params.encounterId,
  });

  if (!appointment) {
    throw new ApiError("Appointment not found", 404);
  }

  // Check if appointment is for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const appointmentDate = new Date(appointment.appointmentDate);
  appointmentDate.setHours(0, 0, 0, 0);

  const isToday = appointmentDate.getTime() === today.getTime();

  // Only allow updates for current-day appointments or in development
  if (!isToday && process.env.NODE_ENV === "production") {
    throw new ApiError("Can only update appointments for current day", 400);
  }

  // Update only empty fields (don't overwrite existing data)
  const updates = {};
  const kioskData = req.body;

  // Flatten kioskData for easier field checking
  const flattenObject = (obj, prefix = "") => {
    return Object.keys(obj).reduce((acc, key) => {
      const pre = prefix.length ? `${prefix}.` : "";
      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        Object.assign(acc, flattenObject(obj[key], `${pre}${key}`));
      } else {
        acc[`${pre}${key}`] = obj[key];
      }
      return acc;
    }, {});
  };

  const flatKioskData = flattenObject(kioskData);

  // Convert appointment to plain object
  const appointmentObj = appointment.toObject();

  // Update empty fields only
  Object.keys(flatKioskData).forEach((key) => {
    const value = flatKioskData[key];

    // Skip if value is undefined or null
    if (value === undefined || value === null) return;

    // Get the value at the nested path in the appointment
    const parts = key.split(".");
    let currentObj = appointmentObj;
    let currentUpdates = updates;
    let exists = true;

    // Navigate to the nested property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!currentObj[part]) {
        currentObj[part] = {};
        exists = false;
      }

      if (!currentUpdates[part]) {
        currentUpdates[part] = {};
      }

      currentObj = currentObj[part];
      currentUpdates = currentUpdates[part];
    }

    const finalKey = parts[parts.length - 1];
    const currentValue = currentObj[finalKey];

    // Update if field is empty or doesn't exist
    if (
      currentValue === undefined ||
      currentValue === null ||
      currentValue === "" ||
      !exists
    ) {
      currentUpdates[finalKey] = value;
    }
  });

  // Set check-in timestamp if this is a KIOSK update
  if (kioskData.kioskCheckIn) {
    if (!updates.kioskCheckIn) {
      updates.kioskCheckIn = {};
    }
    updates.kioskCheckIn.checkedInAt = new Date();
  }

  // Apply updates
  const updatedAppointment = await Appointment.findOneAndUpdate(
    { encounterId: req.params.encounterId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  return successResponse(
    res,
    200,
    "Appointment updated successfully",
    updatedAppointment
  );
});

/**
 * @desc    Delete appointments by file ID
 * @route   DELETE /api/appointments/file/:fileId
 * @access  Private
 */
const deleteAppointmentsByFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  // Find all appointments with this fileId
  const appointments = await Appointment.find({ fileId });

  if (appointments.length === 0) {
    throw new ApiError("No appointments found for this file ID", 404);
  }

  // Get the encounter IDs to update patient references later
  const encounterIds = appointments.map((a) => a.encounterId);

  // Delete the appointments
  const deleteResult = await Appointment.deleteMany({ fileId });

  // Clean up patient references (optional but recommended)
  for (const appointment of appointments) {
    try {
      const patient = await Patient.findOne({
        acctNo: appointment.patientAcctNo,
      });
      if (patient) {
        // Remove this appointment from patient's list
        patient.appointments = patient.appointments.filter(
          (id) => !encounterIds.includes(id.toString())
        );
        await patient.save();
      }
    } catch (error) {
      logger.warn(`Error updating patient references: ${error.message}`);
    }
  }

  return successResponse(res, 200, "Appointments deleted successfully", {
    fileId,
    deleted: deleteResult.deletedCount,
  });
});

/**
 * @desc    Record time tracking events
 * @route   POST /api/appointments/:encounterId/times
 * @access  Private
 */
const recordTimeEvents = asyncHandler(async (req, res) => {
  const { encounterId } = req.params;
  const { events } = req.body;

  // Check if events array is provided
  if (!events || !Array.isArray(events)) {
    throw new ApiError("Events array is required", 400);
  }

  // Validate events
  const validation = validateTimeEvents(events);
  if (!validation.isValid) {
    throw new ApiError("Invalid time events", 400, validation.errors);
  }

  // Find appointment
  const appointment = await Appointment.findOne({ encounterId });

  if (!appointment) {
    throw new ApiError("Appointment not found", 404);
  }

  // Add events to appointment
  if (!appointment.visitTimes) {
    appointment.visitTimes = { rawEvents: [] };
  }

  // Append new events
  appointment.visitTimes.rawEvents = [
    ...(appointment.visitTimes.rawEvents || []),
    ...events,
  ];

  // Calculate durations
  const durations = calculateDurations(appointment.visitTimes.rawEvents);

  appointment.visitTimes.patientDuration = durations.patientDuration;
  appointment.visitTimes.doctorDuration = durations.doctorDuration;
  appointment.visitTimes.staffDuration = durations.staffDuration;

  // Save appointment
  await appointment.save();

  return successResponse(res, 200, "Time events recorded successfully", {
    encounterId,
    visitTimes: appointment.visitTimes,
  });
});

module.exports = {
  uploadAppointments,
  getAppointments,
  getAppointment,
  updateAppointment,
  deleteAppointmentsByFile,
  recordTimeEvents,
};
