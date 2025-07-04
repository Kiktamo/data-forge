const User = require('../models/user.model');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const { Op } = require('sequelize');
const emailService = require('../services/email.service');

// Register a new user
exports.register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, fullName, bio } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with that email or username'
      });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    // Create new user with email verification fields
    const newUser = await User.create({
      username,
      email,
      password,
      fullName,
      bio,
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    // Send verification email
    try {
      const emailResult = await emailService.sendEmailVerification(newUser, verificationToken);
      console.log('📧 Verification email sent successfully:', emailResult.previewUrl);
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    // Generate tokens
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // Save refresh token to user record
    newUser.refreshToken = refreshToken;
    await newUser.save();

    // Return user info and tokens
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      user: newUser.toSafeObject(),
      accessToken,
      refreshToken,
      emailVerificationRequired: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Validate password
    const isPasswordValid = await user.isValidPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to user record
    user.refreshToken = refreshToken;
    await user.save();

    // Return user info and tokens
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
      emailVerified: user.emailVerified
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Hash the token to match stored format
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with matching verification token that hasn't expired
    const user = await User.findOne({
      where: {
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { [Op.gt]: new Date() }
      }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Email verification token is invalid or has expired'
      });
    }
    
    // Mark email as verified and clear token
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while verifying your email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Resend email verification
exports.resendEmailVerification = async (req, res) => {
  try {
    const { id } = req.user;
    
    // Find user
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    // Update user with new token
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();
    
    // Send verification email
    try {
      const emailResult = await emailService.sendEmailVerification(user, verificationToken);
      console.log('📧 Verification email resent successfully:', emailResult.previewUrl);
    } catch (emailError) {
      console.error('❌ Failed to resend verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resending verification email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Refresh access token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Find user by ID from token
    const user = await User.findByPk(decoded.id);
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    
    // Update refresh token in database
    user.refreshToken = newRefreshToken;
    await user.save();

    // Return new tokens
    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Logout user
exports.logout = async (req, res) => {
  try {
    const { id } = req.user;
    
    // Find user
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Clear refresh token
    user.refreshToken = null;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during logout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.user;
    
    // Find user
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.user;
    const { fullName, bio } = req.body;
    
    // Find user
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update fields
    if (fullName !== undefined) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.user;
    const { currentPassword, newPassword } = req.body;
    
    // Find user
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate current password
    const isPasswordValid = await user.isValidPassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    // Invalidate refresh tokens on password change
    user.refreshToken = null;
    await user.save();
    
    // Generate new tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Save new refresh token
    user.refreshToken = refreshToken;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while changing password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user
    const user = await User.findOne({ where: { email } });
    
    // Always return success even if user not found (security)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link'
      });
    }
    
    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Save token to user
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();
    
    // Send password reset email
    try {
      const emailResult = await emailService.sendPasswordReset(user, resetToken);
      console.log('📧 Password reset email sent successfully:', emailResult.previewUrl);
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError);
      // Still return success to user for security
    }
    
    res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }
    
    // Hash the token to match stored format
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid token
    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: new Date() }
      }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }
    
    // Update password and clear reset token
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.refreshToken = null; // Invalidate all sessions
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting your password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};