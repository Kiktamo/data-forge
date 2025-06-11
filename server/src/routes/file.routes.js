const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { param } = require('express-validator');
const { optionalAuth } = require('../middlewares/auth.middleware');
const Contribution = require('../models/contribution.model');
const Dataset = require('../models/dataset.model');

const router = express.Router();

// Validation for file parameters
const fileValidation = [
  param('type')
    .isIn(['images', 'text', 'structured'])
    .withMessage('File type must be images, text, or structured'),
  param('filename')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Invalid filename format')
];

// Helper function to check file access permissions
async function checkFileAccess(filename, user = null) {
  // Find the contribution that owns this file
  const contribution = await Contribution.findOne({
    where: {
      content: {
        file: {
          filename: filename
        }
      },
      isActive: true
    },
    include: [{
      model: Dataset,
      as: 'dataset',
      attributes: ['id', 'visibility', 'ownerId']
    }]
  });

  if (!contribution) {
    return { allowed: false, error: 'File not found', contribution: null };
  }

  // Check access permissions
  const dataset = contribution.dataset;
  if (dataset.visibility === 'private') {
    if (!user || user.id !== dataset.ownerId) {
      return { 
        allowed: false, 
        error: 'Access denied to private dataset file', 
        contribution: null 
      };
    }
  }

  return { allowed: true, error: null, contribution };
}

// Serve contribution files with access control
router.get('/contributions/:type/:filename', 
  fileValidation,
  async (req, res) => {
    try {
      const { type, filename } = req.params;
      
      // Extract token from Authorization header OR query parameter
      let user = null;
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token;
      
      let token = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (queryToken) {
        token = queryToken;
      }
      
      if (token) {
        try {
          const { verifyAccessToken } = require('../config/jwt');
          const decoded = verifyAccessToken(token);
          const User = require('../models/user.model');
          user = await User.findByPk(decoded.id);
          if (user && !user.isActive) {
            user = null; // Inactive users don't get access
          }
        } catch (error) {
          // Token invalid or expired, continue without user
          console.log('Invalid token for file access:', error.message);
          user = null;
        }
      }

      // Find the contribution and check permissions
      const contribution = await Contribution.findOne({
        where: {
          content: {
            file: {
              filename: filename
            }
          },
          isActive: true
        },
        include: [{
          model: Dataset,
          as: 'dataset',
          attributes: ['id', 'visibility', 'ownerId']
        }]
      });

      if (!contribution) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const dataset = contribution.dataset;
      
      // Check access permissions based on dataset visibility
      if (dataset.visibility === 'private') {
        // Private datasets require authentication and ownership
        if (!user || user.id !== dataset.ownerId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to private dataset file'
          });
        }
      }
      // Public and collaborative datasets are accessible to everyone
      
      // Construct file path
      const filePath = path.join(__dirname, '../../uploads/contributions', type, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'Physical file not found'
        });
      }

      // Set CORS headers explicitly
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');

      // Set appropriate headers based on file type
      if (type === 'images') {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }

      // Send file
      res.sendFile(filePath);
      
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to serve file',
        error: error.message
      });
    }
  }
);

// Handle OPTIONS requests for CORS preflight
router.options('/contributions/:type/:filename', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Get file info/metadata
router.get('/contributions/:type/:filename/info',
  fileValidation,
  optionalAuth,
  async (req, res) => {
    try {
      const { type, filename } = req.params;
      
      // Check file access permissions
      const accessCheck = await checkFileAccess(filename, req.user);
      
      if (!accessCheck.allowed) {
        return res.status(accessCheck.error === 'File not found' ? 404 : 403).json({
          success: false,
          message: accessCheck.error
        });
      }

      const contribution = accessCheck.contribution;

      // Get file stats
      const filePath = path.join(__dirname, '../../uploads/contributions', type, filename);
      let fileStats = null;
      
      try {
        const stats = await fs.stat(filePath);
        fileStats = {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      } catch (error) {
        console.log('Could not get file stats:', error);
      }

      res.json({
        success: true,
        data: {
          filename,
          type,
          contribution: {
            id: contribution.id,
            createdAt: contribution.createdAt,
            validationStatus: contribution.validationStatus,
            contributor: contribution.contributor
          },
          dataset: {
            id: contribution.dataset.id,
            name: contribution.dataset.name
          },
          file: {
            originalName: contribution.content.file.originalName,
            size: contribution.content.file.size,
            mimetype: contribution.content.file.mimetype,
            stats: fileStats
          },
          metadata: contribution.metadata
        }
      });
      
    } catch (error) {
      console.error('Error getting file info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get file info',
        error: error.message
      });
    }
  }
);

// Serve thumbnail/preview for images
router.get('/contributions/:type/:filename/thumbnail',
  fileValidation,
  async (req, res) => {
    try {
      const { type, filename } = req.params;
      
      if (type !== 'images') {
        return res.status(400).json({
          success: false,
          message: 'Thumbnails only available for images'
        });
      }

      // For now, just serve the original image
      // In a production system, you'd generate actual thumbnails
      req.url = `/contributions/${type}/${filename}`;
      return router.handle(req, res);
      
    } catch (error) {
      console.error('Error serving thumbnail:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to serve thumbnail',
        error: error.message
      });
    }
  }
);

module.exports = router;