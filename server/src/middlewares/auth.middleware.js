const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { verifyAccessToken } = require('../config/jwt');

// Required authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Use the JWT config's verifyAccessToken function
    const decoded = verifyAccessToken(token);
    
    // Get user from database using the 'id' field from JWT payload
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.message === 'Invalid access token' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Optional authentication middleware - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      // No token provided, continue without user
      return next();
    }

    // Use the JWT config's verifyAccessToken function
    const decoded = verifyAccessToken(token);
    
    // Get user from database using the 'id' field from JWT payload
    const user = await User.findByPk(decoded.id);
    
    if (user && user.isActive) {
      // Attach user to request if valid
      req.user = user;
    }
    
    // Continue regardless of token validity
    next();
  } catch (error) {
    // Log error but don't fail the request
    console.error('Optional authentication error:', error);
    next();
  }
};

// Helper function to extract token from request
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
};

// Role-based authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (roles.length === 0 || !Array.isArray(roles)) {
      return next();
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize
};