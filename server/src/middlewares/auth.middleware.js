const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/user.model');

// Middleware to authenticate users based on JWT
exports.authenticate = async (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
    }
    
    // Verify the token
    const decoded = verifyAccessToken(token);
    
    // Find the user
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account inactive'
      });
    }
    
    // Attach user to request object
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware to check if user has required roles
exports.authorize = (requiredRoles = []) => {
  return (req, res, next) => {
    // If no roles required, proceed
    if (requiredRoles.length === 0) {
      return next();
    }
    
    const { roles } = req.user;
    
    // Check if user has admin role (bypass)
    if (roles && roles.includes('admin')) {
      return next();
    }
    
    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some(role => roles && roles.includes(role));
    
    if (!hasRequiredRole) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource'
      });
    }
    
    next();
  };
};

// Middleware to validate email verification
exports.requireEmailVerification = async (req, res, next) => {
  try {
    const { id } = req.user;
    
    // Find the user
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required',
        emailVerificationRequired: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Email verification check error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while checking email verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};