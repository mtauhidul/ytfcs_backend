const { StatusCodes } = require("http-status-codes");
const ApiResponse = require("../utils/apiResponse");

/**
 * middlewares for validating request data using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middlewares
 */
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const errorMessage = error.details
      .map((detail) => detail.message)
      .join(", ");
    return ApiResponse.error(res, errorMessage, StatusCodes.BAD_REQUEST);
  }

  next();
};

module.exports = validate;
