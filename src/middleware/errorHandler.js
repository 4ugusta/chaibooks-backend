// Format Mongoose errors into readable messages
const formatError = (err) => {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const fields = Object.values(err.errors).map(e => e.path);
    return { message: `Please fill in required fields: ${fields.join(', ')}`, statusCode: 400 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return { message: `A record with this ${field} already exists`, statusCode: 400 };
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return { message: 'Resource not found', statusCode: 404 };
  }

  return null;
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error(err);

  const formatted = formatError(err);
  if (formatted) {
    return res.status(formatted.statusCode).json({ message: formatted.message });
  }

  res.status(500).json({ message: 'Server Error' });
};

// Helper for controllers to format error messages in catch blocks
const getErrorMessage = (err) => {
  const formatted = formatError(err);
  return formatted ? formatted.message : err.message;
};

module.exports = errorHandler;
module.exports.getErrorMessage = getErrorMessage;
