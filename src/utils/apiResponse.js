/**
 * Standardized API Response Utility
 * Provides consistent response format across the API
 */

/**
 * Success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {Object|Array} data - Data to return
 * @param {Object} meta - Additional metadata
 * @returns {Object} - Formatted response
 */
const successResponse = (res, statusCode = 200, message = 'Success', data = null, meta = {}) => {
  const response = {
    success: true,
    message
  };

  // Add data if provided
  if (data !== null) {
    response.data = data;
  }

  // Add metadata if not empty
  if (Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Array|null} errors - Detailed error information
 * @returns {Object} - Formatted error response
 */
const errorResponse = (res, statusCode = 500, message = 'Server Error', errors = null) => {
  const response = {
    success: false,
    message
  };

  // Add detailed errors if provided
  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Pagination helper for paginated responses
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {string} baseUrl - Base URL for pagination links
 * @returns {Object} - Pagination metadata
 */
const getPaginationInfo = (page, limit, total, baseUrl) => {
  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);
  
  return {
    totalItems: total,
    itemsPerPage: limit,
    totalPages,
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
    links: {
      first: `${baseUrl}?page=1&limit=${limit}`,
      last: `${baseUrl}?page=${totalPages}&limit=${limit}`,
      next: currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}&limit=${limit}` : null,
      prev: currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}&limit=${limit}` : null
    }
  };
};

module.exports = {
  successResponse,
  errorResponse,
  getPaginationInfo
};