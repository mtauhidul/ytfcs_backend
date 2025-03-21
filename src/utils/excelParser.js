const readXlsxFile = require("read-excel-file/node");
const { v4: uuidv4 } = require("uuid");
const logger = require("../config/logger");
const moment = require("moment");

/**
 * Parse Excel file and convert to appointment objects
 * @param {string} filePath - Path to the uploaded Excel file
 * @returns {Object} - Contains fileId, fileName and parsed appointments array
 */
const parseExcelFile = async (filePath, fileName) => {
  try {
    // Read the Excel file
    const rows = await readXlsxFile(filePath);

    // Extract headers (first row)
    const headers = rows[0];

    // Generate a unique fileId for this batch
    const fileId = uuidv4();

    // Map Excel rows to appointment objects (skip the header row)
    const appointments = rows.slice(1).map((row) => {
      const appointment = {};

      // Map each cell to its corresponding header
      headers.forEach((header, index) => {
        // Skip empty cells or headers
        if (!header || row[index] === undefined || row[index] === null) {
          return;
        }

        // Convert header to camelCase for schema compatibility
        const key = toCamelCase(header.trim());

        // Special handling for dates
        if (
          key.toLowerCase().includes("date") ||
          key.toLowerCase().includes("dob")
        ) {
          // Check if it's already a Date object from Excel
          if (row[index] instanceof Date) {
            appointment[key] = row[index];
          } else {
            // Try to parse the date string
            const parsedDate = parseDate(row[index]);
            if (parsedDate) {
              appointment[key] = parsedDate;
            } else {
              appointment[key] = row[index]; // Keep as string if parsing fails
            }
          }
          return;
        }

        // Special handling for boolean fields
        if (
          key.toLowerCase().includes("is") ||
          key.toLowerCase().includes("dont") ||
          key.toLowerCase().includes("deceased")
        ) {
          // Convert various boolean representations
          if (typeof row[index] === "string") {
            appointment[key] = ["yes", "true", "y", "1"].includes(
              row[index].toLowerCase()
            );
          } else {
            appointment[key] = Boolean(row[index]);
          }
          return;
        }

        // Default: assign the value as is
        appointment[key] = row[index];
      });

      // Add metadata
      appointment.source = "excel";
      appointment.fileName = fileName;
      appointment.fileId = fileId;
      appointment.uploadDate = new Date();

      return appointment;
    });

    logger.info(
      `Successfully parsed Excel file: ${fileName}, rows: ${appointments.length}`
    );

    return {
      fileId,
      fileName,
      appointments,
    };
  } catch (error) {
    logger.error(`Error parsing Excel file: ${error.message}`);
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
};

/**
 * Convert header string to camelCase
 * @param {string} str - Header string from Excel
 * @returns {string} - camelCase version for schema
 */
const toCamelCase = (str) => {
  // Handle special cases for compatibility with the schema
  const specialCases = {
    "appointment date": "appointmentDate",
    "admission date": "admissionDate",
    "discharge date": "dischargeDate",
    "appointment start time": "appointmentStartTime",
    "is sunoh.ai": "isSunohAi",
    "is televisit": "isTelevisit",
    "call start time": "callStartTime",
    "call end time": "callEndTime",
    "call duration": "callDuration",
    "encounter id": "encounterId",
    "visit type": "visitType",
    "visit sub-type": "visitSubType",
    "visit status": "visitStatus",
    "case label": "caseLabel",
    "appointment created by user": "appointmentCreatedByUser",
    "visit count": "visitCount",
    "patient count": "patientCount",
    "patient name": "patientName",
    "patient first name": "patientFirstName",
    "patient last name": "patientLastName",
    "patient middle initial": "patientMiddleInitial",
    "patient acct no": "patientAcctNo",
    "patient dob": "patientDOB",
    "patient gender": "patientGender",
    "patient address line 1": "patientAddressLine1",
    "patient address line 2": "patientAddressLine2",
    "patient city": "patientCity",
    "patient state": "patientState",
    "patient zip code": "patientZIPCode",
    "patient full address": "patientFullAddress",
    "patient race": "patientRace",
    "patient ethnicity": "patientEthnicity",
    "patient language": "patientLanguage",
    "patient home phone": "patientHomePhone",
    "patient cell phone": "patientCellPhone",
    "patient work phone": "patientWorkPhone",
    "patient e-mail": "patientEmail",
    "patient status": "patientStatus",
    "don't send statements": "dontSendStatements",
    "patient deceased": "patientDeceased",
    "patient age group": "patientAgeGroup",
    "birth sex": "birthSex",
    "gender identity name": "genderIdentityName",
    "gender identity snomed code": "genderIdentitySNOMEDCode",
    "sexual orientation name": "sexualOrientationName",
    "sexual orientation snomed code": "sexualOrientationSNOMEDCode",
  };

  // Check if it's a special case
  const lowerStr = str.toLowerCase();
  if (specialCases[lowerStr]) {
    return specialCases[lowerStr];
  }

  // Otherwise, transform to standard camelCase
  return lowerStr
    .replace(/[^a-zA-Z0-9 ]/g, "") // Remove special characters
    .split(" ")
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
};

/**
 * Parse various date formats
 * @param {string|Date} dateStr - Date string from Excel
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;

  // Handle common date formats
  const formats = [
    "YYYY-MM-DD",
    "MM/DD/YYYY",
    "M/D/YYYY",
    "DD-MMM-YYYY",
    "MMM DD YYYY",
    "YYYY/MM/DD",
    "MM-DD-YYYY",
  ];

  const momentDate = moment(dateStr, formats);

  if (momentDate.isValid()) {
    return momentDate.toDate();
  }

  // Try JavaScript's native Date parsing as a fallback
  const jsDate = new Date(dateStr);
  return isNaN(jsDate.getTime()) ? null : jsDate;
};

module.exports = {
  parseExcelFile,
};
