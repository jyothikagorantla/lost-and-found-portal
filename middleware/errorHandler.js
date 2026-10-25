/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).render('404', {
    title: '404 - Page Not Found',
    path: req.originalUrl,
  });
};

/**
 * Global 500 / Error handler
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    req.flash('error', 'Uploaded image exceeds the 5MB size limit. Please upload a smaller image.');
    return res.redirect(req.get('Referrer') || '/');
  }

  // Handle Mongoose cast errors
  if (err.name === 'CastError') {
    req.flash('error', 'Requested resource was not found.');
    return res.status(404).redirect('/');
  }

  const statusCode = err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(statusCode).render('500', {
    title: `${statusCode} - Something Went Wrong`,
    statusCode,
    message: isDev ? err.message : 'An unexpected error occurred. Our team has been notified.',
    stack: isDev ? err.stack : null,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
