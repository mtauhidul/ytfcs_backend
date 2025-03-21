const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define the Patient schema with FHIR compatibility in mind
const patientSchema = new mongoose.Schema(
  {
    // Core patient identifiers
    acctNo: {
      type: String,
      required: [true, "Patient account number is required"],
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    middleInitial: {
      type: String,
      trim: true,
    },
    dob: {
      type: Date,
    },

    // Contact information
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    phone: {
      type: String,
      trim: true,
    },
    cellPhone: {
      type: String,
      trim: true,
    },
    homePhone: {
      type: String,
      trim: true,
    },
    workPhone: {
      type: String,
      trim: true,
    },

    // Address information
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zipCode: String,
    },

    // Demographics
    gender: String,
    birthSex: String,
    genderIdentity: {
      name: String,
      snomedCode: String,
    },
    sexualOrientation: {
      name: String,
      snomedCode: String,
    },
    race: String,
    ethnicity: String,
    language: String,

    // Statuses
    status: {
      type: String,
      enum: ["active", "inactive", "deceased"],
      default: "active",
    },
    dontSendStatements: {
      type: Boolean,
      default: false,
    },

    // Relationships to other collections
    appointments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
      },
    ],

    // OTP for patient portal authentication
    otp: {
      code: {
        type: String,
      },
      expiresAt: {
        type: Date,
      },
    },

    // Optional portal access credentials (if implemented later)
    portalAccess: {
      username: String,
      password: {
        type: String,
        select: false, // Don't return password by default
      },
      isActivated: {
        type: Boolean,
        default: false,
      },
      lastLogin: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
patientSchema.virtual("fullName").get(function () {
  return `${this.firstName || ""} ${
    this.middleInitial ? this.middleInitial + "." : ""
  } ${this.lastName || ""}`.trim();
});

// Hash password if it's modified (for portal access if implemented later)
patientSchema.pre("save", async function (next) {
  if (
    this.portalAccess &&
    this.portalAccess.password &&
    this.isModified("portalAccess.password")
  ) {
    const salt = await bcrypt.genSalt(10);
    this.portalAccess.password = await bcrypt.hash(
      this.portalAccess.password,
      salt
    );
  }
  next();
});

// Method to compare password (for portal access if implemented later)
patientSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.portalAccess || !this.portalAccess.password) return false;
  return await bcrypt.compare(enteredPassword, this.portalAccess.password);
};

// Method to verify OTP
patientSchema.methods.verifyOTP = function (enteredOtp) {
  return (
    this.otp && this.otp.code === enteredOtp && this.otp.expiresAt > Date.now()
  );
};

// Static method to update or create a patient from appointment data
patientSchema.statics.createOrUpdateFromAppointment = async function (
  appointmentData
) {
  if (!appointmentData.patientAcctNo) {
    throw new Error("Patient account number is required");
  }

  // Find existing patient or create new one
  const patient = await this.findOne({ acctNo: appointmentData.patientAcctNo });

  if (patient) {
    // Update existing patient with new data if fields are empty
    if (!patient.firstName && appointmentData.patientFirstName) {
      patient.firstName = appointmentData.patientFirstName;
    }
    if (!patient.lastName && appointmentData.patientLastName) {
      patient.lastName = appointmentData.patientLastName;
    }
    if (!patient.middleInitial && appointmentData.patientMiddleInitial) {
      patient.middleInitial = appointmentData.patientMiddleInitial;
    }
    if (!patient.dob && appointmentData.patientDOB) {
      patient.dob = appointmentData.patientDOB;
    }
    if (!patient.email && appointmentData.patientEmail) {
      patient.email = appointmentData.patientEmail;
    }
    if (!patient.cellPhone && appointmentData.patientCellPhone) {
      patient.cellPhone = appointmentData.patientCellPhone;
    }
    if (!patient.homePhone && appointmentData.patientHomePhone) {
      patient.homePhone = appointmentData.patientHomePhone;
    }
    if (!patient.workPhone && appointmentData.patientWorkPhone) {
      patient.workPhone = appointmentData.patientWorkPhone;
    }

    // Add appointment ID if not already in the list
    if (
      appointmentData._id &&
      !patient.appointments.includes(appointmentData._id)
    ) {
      patient.appointments.push(appointmentData._id);
    }

    await patient.save();
    return patient;
  } else {
    // Create new patient
    const newPatient = await this.create({
      acctNo: appointmentData.patientAcctNo,
      firstName: appointmentData.patientFirstName,
      lastName: appointmentData.patientLastName,
      middleInitial: appointmentData.patientMiddleInitial,
      name: appointmentData.patientName,
      dob: appointmentData.patientDOB,
      email: appointmentData.patientEmail,
      phone:
        appointmentData.patientCellPhone || appointmentData.patientHomePhone,
      cellPhone: appointmentData.patientCellPhone,
      homePhone: appointmentData.patientHomePhone,
      workPhone: appointmentData.patientWorkPhone,
      gender: appointmentData.patientGender,
      birthSex: appointmentData.birthSex,
      race: appointmentData.patientRace,
      ethnicity: appointmentData.patientEthnicity,
      language: appointmentData.patientLanguage,
      status: appointmentData.patientDeceased ? "deceased" : "active",
      dontSendStatements: appointmentData.dontSendStatements,
      address: {
        line1: appointmentData.patientAddressLine1,
        line2: appointmentData.patientAddressLine2,
        city: appointmentData.patientCity,
        state: appointmentData.patientState,
        zipCode: appointmentData.patientZIPCode,
      },
      genderIdentity: {
        name: appointmentData.genderIdentityName,
        snomedCode: appointmentData.genderIdentitySNOMEDCode,
      },
      sexualOrientation: {
        name: appointmentData.sexualOrientationName,
        snomedCode: appointmentData.sexualOrientationSNOMEDCode,
      },
      appointments: appointmentData._id ? [appointmentData._id] : [],
    });

    return newPatient;
  }
};

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;
