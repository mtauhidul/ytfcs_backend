# YTFCS Backend System

Backend system for Your Total Foot Care Specialist (YTFCS) that integrates hospital workflow (CareSync), patient check-in (KIOSK), and a patient portal.

## System Overview

This backend system consists of three integrated modules:

1. **CareSync** – Hospital workflow & time tracking
2. **KIOSK** – Patient check-in
3. **Patient Portal** – For profile & appointment viewing

## Tech Stack

- **Node.js** + **Express.js** - Backend framework
- **MongoDB** with **Mongoose** - Database
- **MVC architecture** - Project structure
- **PNPM** - Package manager
- **JWT** - Authentication
- **OTP** - Patient portal access
- **Multer** - File uploads
- **Winston & Morgan** - Logging

## Features

- Upload Excel files with appointment data
- Patient check-in via KIOSK
- Time tracking for patient, doctor, and staff
- Patient portal with OTP authentication
- Image uploads (ID, insurance, etc.)
- Comprehensive API for integration with frontend systems

## Getting Started

### Prerequisites

- Node.js 16+
- MongoDB
- PNPM

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd ytfcs-backend
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env` file in the root directory with the following variables:

   ```
   NODE_ENV=development
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/ytfcs
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRE=30d
   OTP_EXPIRE=10m
   ```

4. Start the server:
   ```bash
   pnpm run dev
   ```

## API Documentation

### Appointments

- `POST /api/appointments/upload` – Upload Excel file with appointments
- `GET /api/appointments?date=YYYY-MM-DD` – Fetch appointments by date
- `GET /api/appointments/:encounterId` – Fetch one appointment
- `PATCH /api/appointments/:encounterId` – Update appointment data
- `DELETE /api/appointments/file/:fileId` – Delete file and related appointments
- `POST /api/appointments/:encounterId/times` – Record time tracking events

### KIOSK

- `POST /api/kiosk/check-in` – Check for current-day appointment
- `PATCH /api/kiosk/submit/:encounterId` – Submit check-in data
- `POST /api/kiosk/upload-images/:encounterId` – Upload patient images

### Authentication

- `POST /api/auth/login` – Request OTP for login
- `POST /api/auth/verify-otp` – Verify OTP and get token
- `GET /api/auth/profile` – Get current patient profile
- `POST /api/auth/refresh-token` – Refresh JWT token
- `POST /api/auth/logout` – Logout

### Patient Portal

- `GET /api/patients/:acctNo` – Get patient profile
- `GET /api/patients/:acctNo/appointments` – Get patient appointments
- `PUT /api/patients/:acctNo` – Update patient profile
- `GET /api/patients/:acctNo/dashboard` – Get dashboard data

## FHIR Integration

This backend is designed with future FHIR integration in mind. Key design considerations include:

- Schema design that can easily map to FHIR resources
- Separation of concerns to facilitate future integrations
- Extensible data models
- Consistent API patterns

When migrating to FHIR, adapters can be implemented in the database connection layer to translate between MongoDB models and FHIR resources.

## Error Handling

The system includes comprehensive error handling with:

- Standardized error responses
- Detailed logging
- HTTP status codes
- Input validation

## Future Enhancements

- Implement FHIR integration
- Add comprehensive API documentation with Swagger
- Enhance security features
- Add analytics endpoints

## License

[MIT](LICENSE)
