const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { ApiError } = require("./errorHandler");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const newFilename = `${uniqueId}${fileExtension}`;

    // Save original filename in the request for later use
    if (!req.fileInfo) req.fileInfo = {};
    req.fileInfo.originalName = file.originalname;
    req.fileInfo.savedName = newFilename;
    req.fileInfo.path = path.join(uploadDir, newFilename);

    cb(null, newFilename);
  },
});

// File filter function
// File filter function
const fileFilter = (req, file, cb) => {
  console.log("File upload attempt:");
  console.log("Original filename:", file.originalname);
  console.log("Mimetype:", file.mimetype);

  // List of allowed Excel and CSV MIME types
  const allowedMimeTypes = [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msexcel",
    "application/x-msexcel",
    "application/x-ms-excel",
    "application/x-excel",
    "application/x-dos_ms_excel",
    "application/xls",
    "application/x-xls",
    "text/csv",
    "application/csv",
    "text/x-csv",
    "application/x-csv",
    "text/comma-separated-values",
    "text/x-comma-separated-values",
  ];

  // Check extension
  const filetypes = /xlsx|xls|csv/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  // Either the MIME type is in our allowed list OR the extension is valid
  if (allowedMimeTypes.includes(file.mimetype) || extname) {
    return cb(null, true);
  } else {
    return cb(
      new ApiError(
        "Invalid file type. Only Excel files (xlsx, xls) and CSV files are allowed.",
        400
      ),
      false
    );
  }
};

// Configure upload for Excel files
const excelUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Configure upload for patient images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const patientDir = path.join(
      uploadDir,
      "patients",
      req.params.patientId || "temp"
    );

    // Create directory if it doesn't exist
    if (!fs.existsSync(patientDir)) {
      fs.mkdirSync(patientDir, { recursive: true });
    }

    cb(null, patientDir);
  },
  filename: (req, file, cb) => {
    // Generate filename based on file type
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    let prefix;

    switch (file.fieldname) {
      case "photo":
        prefix = "photo";
        break;
      case "id":
        prefix = "id";
        break;
      case "insurance":
        prefix = "insurance";
        break;
      default:
        prefix = "document";
    }

    const newFilename = `${prefix}_${uniqueId}${fileExtension}`;

    // Store file info in request
    if (!req.fileInfo) req.fileInfo = {};
    if (!req.fileInfo.files) req.fileInfo.files = [];

    const fileInfo = {
      fieldName: file.fieldname,
      originalName: file.originalname,
      savedName: newFilename,
      path: path.join(
        uploadDir,
        "patients",
        req.params.patientId || "temp",
        newFilename
      ),
    };

    req.fileInfo.files.push(fileInfo);

    cb(null, newFilename);
  },
});

// Image file filter
const imageFileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    return cb(
      new ApiError(
        "Invalid file type. Only images (jpeg, jpg, png, gif) are allowed.",
        400
      ),
      false
    );
  }
};

// Configure upload for patient images
const patientImageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

module.exports = {
  excelUpload,
  patientImageUpload,
};
