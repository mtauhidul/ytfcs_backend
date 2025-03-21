const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel");
const Appointment = require("../models/appointmentModel");
const {
  successResponse,
  errorResponse,
  getPaginationInfo,
} = require("../utils/apiResponse");
const { ApiError } = require("../middlewares/errorHandler");
const logger = require("../config/logger");

/**
 * @desc    Get patient profile
 * @route   GET /api/patients/:acctNo
 * @access  Private (requires JWT auth)
 */
const getPatient = asyncHandler(async (req, res) => {
  const { acctNo } = req.params;

  // Make sure the patient can only access their own profile
  // unless they're an admin (to be implemented later)
  if (req.patient && req.patient.acctNo !== acctNo) {
    throw new ApiError("Not authorized to access this patient profile", 403);
  }

  const patient = await Patient.findOne({ acctNo });

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  return successResponse(res, 200, "Patient retrieved successfully", patient);
});

/**
 * @desc    Get patient appointments
 * @route   GET /api/patients/:acctNo/appointments
 * @access  Private (requires JWT auth)
 */
const getPatientAppointments = asyncHandler(async (req, res) => {
  const { acctNo } = req.params;
  const {
    page = 1,
    limit = 20,
    past = false,
    upcoming = false,
    startDate,
    endDate,
  } = req.query;

  // Make sure the patient can only access their own appointments
  if (req.patient && req.patient.acctNo !== acctNo) {
    throw new ApiError("Not authorized to access these appointments", 403);
  }

  // Build filter
  const filter = { patientAcctNo: acctNo };

  // Filter by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (past === "true") {
    // Get past appointments
    filter.appointmentDate = { $lt: today };
  } else if (upcoming === "true") {
    // Get upcoming appointments
    filter.appointmentDate = { $gte: today };
  } else if (startDate && endDate) {
    // Get appointments in date range
    filter.appointmentDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Count total matching appointments
  const total = await Appointment.countDocuments(filter);

  // Get appointments
  const appointments = await Appointment.find(filter)
    .sort({ appointmentDate: -1 })
    .skip(skip)
    .limit(limitNum);

  // Pagination metadata
  const paginationInfo = getPaginationInfo(
    pageNum,
    limitNum,
    total,
    `${req.protocol}://${req.get("host")}/api/patients/${acctNo}/appointments`
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
 * @desc    Update patient profile
 * @route   PUT /api/patients/:acctNo
 * @access  Private (requires JWT auth)
 */
const updatePatient = asyncHandler(async (req, res) => {
  const { acctNo } = req.params;

  // Make sure the patient can only update their own profile
  if (req.patient && req.patient.acctNo !== acctNo) {
    throw new ApiError("Not authorized to update this patient profile", 403);
  }

  const patient = await Patient.findOne({ acctNo });

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  // Get allowed fields to update
  const { email, phone, cellPhone, homePhone, workPhone, address } = req.body;

  // Update only provided fields
  if (email !== undefined) patient.email = email;
  if (phone !== undefined) patient.phone = phone;
  if (cellPhone !== undefined) patient.cellPhone = cellPhone;
  if (homePhone !== undefined) patient.homePhone = homePhone;
  if (workPhone !== undefined) patient.workPhone = workPhone;

  // Update address if provided
  if (address) {
    patient.address = {
      ...patient.address,
      ...address,
    };
  }

  // Save updates
  await patient.save();

  return successResponse(
    res,
    200,
    "Patient profile updated successfully",
    patient
  );
});

/**
 * @desc    Get upcoming appointments for patient portal dashboard
 * @route   GET /api/patients/:acctNo/dashboard
 * @access  Private (requires JWT auth)
 */
const getPatientDashboard = asyncHandler(async (req, res) => {
  const { acctNo } = req.params;

  // Make sure the patient can only access their own dashboard
  if (req.patient && req.patient.acctNo !== acctNo) {
    throw new ApiError("Not authorized to access this dashboard", 403);
  }

  const patient = await Patient.findOne({ acctNo });

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get upcoming appointments (next 30 days)
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcomingAppointments = await Appointment.find({
    patientAcctNo: acctNo,
    appointmentDate: {
      $gte: today,
      $lte: thirtyDaysFromNow,
    },
  })
    .sort({ appointmentDate: 1 })
    .limit(5);

  // Get most recent past appointment
  const recentAppointment = await Appointment.findOne({
    patientAcctNo: acctNo,
    appointmentDate: { $lt: today },
  }).sort({ appointmentDate: -1 });

  // Build dashboard data
  const dashboardData = {
    patient: {
      acctNo: patient.acctNo,
      name: patient.name || patient.fullName,
      email: patient.email,
      phone: patient.cellPhone || patient.phone,
      dob: patient.dob,
    },
    upcomingAppointments,
    recentAppointment,
    appointmentCounts: {
      upcoming: upcomingAppointments.length,
      total: await Appointment.countDocuments({ patientAcctNo: acctNo }),
    },
  };

  return successResponse(
    res,
    200,
    "Dashboard data retrieved successfully",
    dashboardData
  );
});

module.exports = {
  getPatient,
  getPatientAppointments,
  updatePatient,
  getPatientDashboard,
};
