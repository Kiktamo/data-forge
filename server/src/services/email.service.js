const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.testAccount = null;
    this.initialize();
  }

  async initialize() {
    try {
      // Create Ethereal test account
      this.testAccount = await nodemailer.createTestAccount();
      
      console.log('📧 Ethereal Email Account Created:');
      console.log('Username:', this.testAccount.user);
      console.log('Password:', this.testAccount.pass);
      console.log('SMTP Server:', this.testAccount.smtp.host);
      console.log('Preview URL: https://ethereal.email');

      // Create transporter with Ethereal
      this.transporter = nodemailer.createTransport({
        host: this.testAccount.smtp.host,
        port: this.testAccount.smtp.port,
        secure: this.testAccount.smtp.secure,
        auth: {
          user: this.testAccount.user,
          pass: this.testAccount.pass
        }
      });

      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email service ready for testing');
      
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  // Send email verification
  async sendEmailVerification(user, verificationToken) {
    try {
      const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:4200'}/auth/verify-email?token=${verificationToken}`;
      
      const mailOptions = {
        from: '"DataForge" <noreply@dataforge.app>',
        to: user.email,
        subject: 'Verify Your DataForge Account',
        html: this.getEmailVerificationTemplate(user, verificationUrl)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('📧 Email verification sent:', info.messageId);
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
      
      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      throw error;
    }
  }

  // Send password reset email
  async sendPasswordReset(user, resetToken) {
    try {
      const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:4200'}/auth/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: '"DataForge" <noreply@dataforge.app>',
        to: user.email,
        subject: 'Reset Your DataForge Password',
        html: this.getPasswordResetTemplate(user, resetUrl)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('📧 Password reset sent:', info.messageId);
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
      
      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  }

  // Send validation status notification
  async sendValidationNotification(contributor, contribution, validationStatus, validatorNotes = '') {
    try {
      const datasetUrl = `${process.env.CLIENT_URL || 'http://localhost:4200'}/datasets/${contribution.datasetId}`;
      const contributionUrl = `${process.env.CLIENT_URL || 'http://localhost:4200'}/contributions/${contribution.id}`;
      
      const mailOptions = {
        from: '"DataForge" <noreply@dataforge.app>',
        to: contributor.email,
        subject: `Your Contribution Has Been ${validationStatus.charAt(0).toUpperCase() + validationStatus.slice(1)}`,
        html: this.getValidationNotificationTemplate(contributor, contribution, validationStatus, validatorNotes, datasetUrl, contributionUrl)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('📧 Validation notification sent:', info.messageId);
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
      
      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };
    } catch (error) {
      console.error('❌ Failed to send validation notification:', error);
      throw error;
    }
  }

  // Email templates
  getEmailVerificationTemplate(user, verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your DataForge Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; }
          .button { display: inline-block; background: #3f51b5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚀 Welcome to DataForge!</h1>
        </div>
        <div class="content">
          <h2>Hi ${user.fullName || user.username},</h2>
          <p>Thank you for signing up for DataForge! To complete your account setup, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #3f51b5;">${verificationUrl}</p>
          
          <p>This verification link will expire in 24 hours for security reasons.</p>
          
          <p>If you didn't create a DataForge account, you can safely ignore this email.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
          <p><strong>What's next?</strong></p>
          <ul>
            <li>📊 Create your first dataset</li>
            <li>🤝 Collaborate with the community</li>
            <li>✅ Validate contributions from other users</li>
            <li>📈 Build better datasets together</li>
          </ul>
        </div>
        <div class="footer">
          <p>Best regards,<br>The DataForge Team</p>
          <p><small>This is an automated message from DataForge. Please do not reply to this email.</small></p>
        </div>
      </body>
      </html>
    `;
  }

  getPasswordResetTemplate(user, resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your DataForge Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; background: linear-gradient(135deg, #f44336 0%, #e57373 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; }
          .button { display: inline-block; background: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hi ${user.fullName || user.username},</h2>
          <p>We received a request to reset your DataForge account password. Click the button below to set a new password:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #f44336;">${resetUrl}</p>
          
          <p><strong>⚠️ Security Notice:</strong></p>
          <ul>
            <li>This reset link will expire in 1 hour</li>
            <li>If you didn't request this reset, please ignore this email</li>
            <li>Your password will remain unchanged unless you complete the reset process</li>
          </ul>
        </div>
        <div class="footer">
          <p>Best regards,<br>The DataForge Team</p>
          <p><small>This is an automated message from DataForge. Please do not reply to this email.</small></p>
        </div>
      </body>
      </html>
    `;
  }

  getValidationNotificationTemplate(contributor, contribution, status, notes, datasetUrl, contributionUrl) {
    const statusColor = status === 'approved' ? '#4caf50' : status === 'rejected' ? '#f44336' : '#ff9800';
    const statusIcon = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⚠️';
    const statusText = status.charAt(0).toUpperCase() + status.slice(1);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contribution ${statusText}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; background: ${statusColor}; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; }
          .button { display: inline-block; background: ${statusColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .notes { background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid ${statusColor}; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${statusIcon} Contribution ${statusText}</h1>
        </div>
        <div class="content">
          <h2>Hi ${contributor.fullName || contributor.username},</h2>
          <p>Your contribution to the dataset has been reviewed and <strong>${status}</strong>.</p>
          
          <p><strong>Contribution Details:</strong></p>
          <ul>
            <li>Type: ${contribution.dataType}</li>
            <li>Submitted: ${new Date(contribution.createdAt).toLocaleDateString()}</li>
            <li>Status: <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></li>
          </ul>
          
          ${notes ? `<div class="notes"><strong>Validator Notes:</strong><br>${notes}</div>` : ''}
          
          <div style="text-align: center;">
            <a href="${contributionUrl}" class="button">View Contribution</a>
            <a href="${datasetUrl}" class="button">View Dataset</a>
          </div>
          
          <p>Thank you for contributing to the DataForge community! ${status === 'approved' ? 'Your contribution helps make datasets better for everyone.' : status === 'rejected' ? 'Don\'t worry - you can always make improvements and contribute again.' : 'Please review the feedback and update your contribution if needed.'}</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The DataForge Team</p>
          <p><small>This is an automated message from DataForge. Please do not reply to this email.</small></p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();