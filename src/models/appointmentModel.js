const mongoose = require("mongoose");

// Define a schema that will accommodate both Excel and KIOSK data
// Keeping FHIR compatibility in mind for future migration
const appointmentSchema = new mongoose.Schema(
  {
    // Excel file metadata
    source: {
      type: String,
      enum: ["excel", "kiosk", "api"],
      default: "excel",
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    fileName: String,
    fileId: String,

    // Core appointment data (from Excel)
    appointmentDate: {
      type: Date,
      required: true,
      index: true, // Index for faster queries by date
    },
    admissionDate: Date,
    dischargeDate: Date,
    appointmentStartTime: String,
    isSunohAi: Boolean,
    isTelevisit: Boolean,
    callStartTime: String,
    callEndTime: String,
    callDuration: String,
    encounterId: {
      type: String,
      required: true,
      unique: true,
      index: true, // Index for faster lookups by encounterId
    },
    visitType: String,
    visitSubType: String,
    visitStatus: String,
    caseLabel: String,
    appointmentCreatedByUser: String,
    visitCount: Number,
    patientCount: Number,

    // Patient demographics (from Excel)
    patientName: String,
    patientFirstName: String,
    patientLastName: String,
    patientMiddleInitial: String,
    patientAcctNo: {
      type: String,
      required: true,
      index: true, // Index for faster patient lookups
    },
    patientDOB: Date,
    patientGender: String,
    patientAddressLine1: String,
    patientAddressLine2: String,
    patientCity: String,
    patientState: String,
    patientZIPCode: String,
    patientFullAddress: String,
    patientRace: String,
    patientEthnicity: String,
    patientLanguage: String,
    patientHomePhone: String,
    patientCellPhone: String,
    patientWorkPhone: String,
    patientEmail: String,
    patientStatus: String,
    dontSendStatements: Boolean,
    patientDeceased: Boolean,
    patientAgeGroup: String,
    birthSex: String,
    genderIdentityName: String,
    genderIdentitySNOMEDCode: String,
    sexualOrientationName: String,
    sexualOrientationSNOMEDCode: String,

    // Facility and provider information (from Excel)
    appointmentFacilityName: String,
    appointmentFacilityPOS: String,
    appointmentFacilityGroupName: String,
    departmentName: String,
    practiceName: String,
    appointmentProviderName: String,
    appointmentProviderNPI: String,
    appointmentReferringProviderName: String,
    appointmentReferringProviderNPI: String,
    resourceProviderName: String,
    resourceProviderNPI: String,
    demographicsPCPName: String,
    demographicsPCPNPI: String,
    demographicsReferringProviderName: String,
    demographicsReferringProviderNPI: String,
    demographicsRenderingProviderName: String,
    demographicsRenderingProviderNPI: String,

    // Insurance information (from Excel, can be updated by KIOSK)
    primaryInsuranceName: String,
    primaryInsuranceSubscriberNo: String,
    secondaryInsuranceName: String,
    secondaryInsuranceSubscriberNo: String,
    tertiaryInsuranceName: String,
    tertiaryInsuranceSubscriberNo: String,
    slidingFeeSchedule: String,
    appointmentEmployer: String,

    // Additional insurance details (from KIOSK)
    primaryInsurance: {
      name: String,
      memberId: String,
      groupName: String,
      groupNumber: String,
      phoneNumber: String,
      copay: Number,
      specialistCopay: Number,
      activeDate: Date,
    },

    secondaryInsurance: {
      name: String,
      memberId: String,
      groupName: String,
      groupNumber: String,
      phoneNumber: String,
      copay: Number,
      specialistCopay: Number,
      activeDate: Date,
    },

    // Medical information (from KIOSK)
    medicalInfo: {
      allergies: [String],
      medications: [String],
      medicalHistory: [String],
      surgicalHistory: [String],
      familyHistory: {
        diabetes: String,
      },
      socialHistory: {
        smoke: String,
      },
      shoeSize: String,
    },

    // KIOSK check-in information
    kioskCheckIn: {
      checkedInAt: Date,
      location: String,
      hasHIPAASignature: Boolean,
      hasPracticePoliciesSignature: Boolean,
      hasUploadedPictures: Boolean,
      uploadedPictureURLs: [String],
    },

    // Time tracking data (from CareSync)
    visitTimes: {
      rawEvents: [
        {
          label: {
            type: String,
            enum: [
              "patient_start",
              "patient_end",
              "doctor_start",
              "doctor_end",
              "staff_start",
              "staff_end",
            ],
          },
          time: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      patientDuration: Number, // Duration in minutes
      doctorDuration: Number, // Duration in minutes
      staffDuration: Number, // Duration in minutes
    },
  },
  {
    timestamps: true,
    // Add metadata to help with FHIR migration in the future
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
appointmentSchema.virtual("fullName").get(function () {
  return `${this.patientFirstName || ""} ${
    this.patientMiddleInitial ? this.patientMiddleInitial + "." : ""
  } ${this.patientLastName || ""}`.trim();
});

// Removed duplicate index declaration
// The index is already defined in the schema field definition

// Method to calculate durations based on raw events
appointmentSchema.methods.calculateDurations = function () {
  const events = this.visitTimes.rawEvents || [];

  // Calculate patient duration
  const patientEvents = events.filter((e) => e.label.includes("patient_"));
  if (patientEvents.length >= 2) {
    const patientStart = patientEvents.find((e) => e.label === "patient_start");
    const patientEnd = patientEvents.find((e) => e.label === "patient_end");

    if (patientStart && patientEnd) {
      this.visitTimes.patientDuration = Math.round(
        (new Date(patientEnd.time) - new Date(patientStart.time)) / 60000
      ); // Convert ms to minutes
    }
  }

  // Calculate doctor duration (sum of all doctor segments)
  const doctorEvents = events.filter((e) => e.label.includes("doctor_"));
  let doctorDuration = 0;

  // Group doctor events by pairs (start/end)
  for (let i = 0; i < doctorEvents.length; i += 2) {
    const start = doctorEvents[i];
    const end = doctorEvents[i + 1];

    if (
      start &&
      end &&
      start.label === "doctor_start" &&
      end.label === "doctor_end"
    ) {
      doctorDuration += (new Date(end.time) - new Date(start.time)) / 60000;
    }
  }

  this.visitTimes.doctorDuration = Math.round(doctorDuration);

  // Calculate staff duration (sum of all staff segments)
  const staffEvents = events.filter((e) => e.label.includes("staff_"));
  let staffDuration = 0;

  // Group staff events by pairs (start/end)
  for (let i = 0; i < staffEvents.length; i += 2) {
    const start = staffEvents[i];
    const end = staffEvents[i + 1];

    if (
      start &&
      end &&
      start.label === "staff_start" &&
      end.label === "staff_end"
    ) {
      staffDuration += (new Date(end.time) - new Date(start.time)) / 60000;
    }
  }

  this.visitTimes.staffDuration = Math.round(staffDuration);

  return this;
};

// Pre-save middleware to ensure appointmentDate is a Date object
appointmentSchema.pre("save", function (next) {
  // Convert appointmentDate string to Date if it's not already
  if (this.appointmentDate && typeof this.appointmentDate === "string") {
    this.appointmentDate = new Date(this.appointmentDate);
  }

  // Convert patientDOB string to Date if it's not already
  if (this.patientDOB && typeof this.patientDOB === "string") {
    this.patientDOB = new Date(this.patientDOB);
  }

  next();
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
