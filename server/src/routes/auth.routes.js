const express = require('express');
const { body, query } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

// Register validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]*$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain at least one letter'),
  body('fullName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name cannot exceed 100 characters')
    .trim(),
  body('bio')
    .optional()
    .trim()
];

// Login validation rules
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Email verification validation rules
const emailVerificationValidation = [
  query('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid token format')
];

// Profile update validation rules
const profileUpdateValidation = [
  body('fullName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name cannot exceed 100 characters')
    .trim(),
  body('bio')
    .optional()
    .trim()
];

// Password change validation rules
const passwordChangeValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/\d/)
    .withMessage('New password must contain at least one number')
    .matches(/[a-zA-Z]/)
    .withMessage('New password must contain at least one letter')
];

// Password reset request validation rules
const passwordResetRequestValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
];

// Password reset validation rules
const passwordResetValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid token format'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/\d/)
    .withMessage('New password must contain at least one number')
    .matches(/[a-zA-Z]/)
    .withMessage('New password must contain at least one letter')
];

// Public routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/refresh-token', authController.refreshToken);

// Email verification routes
router.get('/verify-email', emailVerificationValidation, authController.verifyEmail);

// Password reset routes
router.post('/request-password-reset', passwordResetRequestValidation, authController.requestPasswordReset);
router.post('/reset-password', passwordResetValidation, authController.resetPassword);

// Protected routes (require authentication)
router.use(authenticate);

// User management routes
router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.put('/profile', profileUpdateValidation, authController.updateProfile);
router.post('/change-password', passwordChangeValidation, authController.changePassword);

// Email verification management for authenticated users
router.post('/resend-verification', authController.resendEmailVerification);

module.exports = router;