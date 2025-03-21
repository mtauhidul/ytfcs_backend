/**
 * Wrapper for async route handlers to catch errors
 * @param {Function} fn - Async function to be wrapped
 * @returns {Function} Express middlewares function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
