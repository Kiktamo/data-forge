const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Contribution = require('../models/contribution.model');
const Validation = require('../models/validation.model');
const Dataset = require('../models/dataset.model');
const User = require('../models/user.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/contributions');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type based on dataset's data type
    const allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      text: ['text/plain', 'text/csv', 'application/json'],
      structured: ['text/csv', 'application/json', 'text/tab-separated-values']
    };
    
    // For now, allow all types - we'll validate against dataset type in the controller
    cb(null, true);
  }
});

// Get contributions for a dataset
exports.getContributionsForDataset = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      contributorId,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Check if dataset exists and user has access
    const dataset = await Dataset.findOne({
      where: { id: datasetId, isActive: true }
    });

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found'
      });
    }

    // Check access permissions
    if (dataset.visibility === 'private' && 
        (!req.user || req.user.id !== dataset.ownerId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to private dataset'
      });
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      contributorId: contributorId ? parseInt(contributorId) : undefined,
      sortBy,
      sortOrder
    };

    const { count, rows: contributions } = await Contribution.getForDataset(datasetId, options);

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      success: true,
      data: {
        contributions: contributions.map(c => c.toSafeObject()),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNext,
          hasPrev
        }
      }
    });
  } catch (error) {
    console.error('Error fetching contributions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contributions',
      error: error.message
    });
  }
};

// Get single contribution by ID
exports.getContributionById = async (req, res) => {
  try {
    const { id } = req.params;

    const contribution = await Contribution.findOne({
      where: { id, isActive: true },
      include: [
        {
          model: User,
          as: 'contributor',
          attributes: ['id', 'username', 'fullName']
        },
        {
          model: Dataset,
          as: 'dataset',
          attributes: ['id', 'name', 'visibility', 'ownerId']
        }
      ]
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Contribution not found'
      });
    }

    // Check access permissions
    if (contribution.dataset.visibility === 'private' && 
        (!req.user || req.user.id !== contribution.dataset.ownerId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to private dataset contribution'
      });
    }

    // Get validation summary
    const validationSummary = await Validation.getSummaryForContribution(contribution.id);

    res.json({
      success: true,
      data: {
        contribution: contribution.toSafeObject(),
        validationSummary
      }
    });
  } catch (error) {
    console.error('Error fetching contribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contribution',
      error: error.message
    });
  }
};

// Create new contribution
exports.createContribution = [
  upload.single('file'),
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { datasetId } = req.params;
      const { annotations, description } = req.body;
      
      // Handle tags properly - they come as separate form fields
      let tags = [];
      if (req.body.tags) {
        if (Array.isArray(req.body.tags)) {
          tags = req.body.tags.filter(tag => tag && tag.trim());
        } else if (typeof req.body.tags === 'string') {
          try {
            // Try to parse as JSON first
            const parsed = JSON.parse(req.body.tags);
            tags = Array.isArray(parsed) ? parsed.filter(tag => tag && tag.trim()) : [];
          } catch (e) {
            // If not JSON, treat as single tag
            tags = req.body.tags.trim() ? [req.body.tags.trim()] : [];
          }
        }
      }
      
      // Handle tags from form array format (tags[0], tags[1], etc.)
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('tags[') && key.endsWith(']')) {
          const tagValue = req.body[key];
          if (tagValue && tagValue.trim()) {
            tags.push(tagValue.trim());
          }
        }
      });

      // Check if dataset exists and user can contribute
      const dataset = await Dataset.findOne({
        where: { id: datasetId, isActive: true }
      });

      if (!dataset) {
        return res.status(404).json({
          success: false,
          message: 'Dataset not found'
        });
      }

      // Check contribution permissions
      const canContribute = dataset.visibility !== 'private' || 
                           (req.user && req.user.id === dataset.ownerId);

      if (!canContribute) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to contribute to this dataset'
        });
      }

      // Process contribution based on data type
      let content = {};
      let metadata = {
        description: description || '',
        tags: tags || [], // Use the processed tags array
        annotations: annotations ? JSON.parse(annotations) : {}
      };

      if (req.file) {
        // File-based contribution
        const fileInfo = {
          originalName: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype
        };

        switch (dataset.dataType) {
          case 'image':
            content = {
              type: 'file',
              file: fileInfo,
              annotations: metadata.annotations
            };
            break;
          case 'text':
            // For text files, we might want to read the content
            const textContent = await fs.readFile(req.file.path, 'utf-8');
            content = {
              type: 'file',
              file: fileInfo,
              text: textContent.substring(0, 10000) // Limit text length
            };
            break;
          case 'structured':
            content = {
              type: 'file',
              file: fileInfo,
              preview: 'File uploaded - processing required'
            };
            break;
        }
      } else {
        // Direct text/structured data contribution
        const { textContent, structuredData } = req.body;
        
        switch (dataset.dataType) {
          case 'text':
            content = {
              type: 'direct',
              text: textContent || '',
              annotations: metadata.annotations
            };
            break;
          case 'structured':
            content = {
              type: 'direct',
              data: structuredData ? JSON.parse(structuredData) : {},
              annotations: metadata.annotations
            };
            break;
          default:
            return res.status(400).json({
              success: false,
              message: 'File upload required for this data type'
            });
        }
      }

      // Create contribution
      const contribution = await Contribution.create({
        datasetId: parseInt(datasetId),
        contributorId: req.user.id,
        dataType: dataset.dataType,
        content,
        metadata,
        validationStatus: 'pending'
      });

      // Update dataset contribution count
      await dataset.increment('contributionCount');

      // Fetch the created contribution with contributor info
      const createdContribution = await Contribution.findOne({
        where: { id: contribution.id },
        include: [{
          model: User,
          as: 'contributor',
          attributes: ['id', 'username', 'fullName']
        }]
      });

      // Notify via WebSocket if available
      const { wsService } = require('../index');
      if (wsService && typeof wsService === 'function') {
        const ws = wsService();
        if (ws) {
          ws.notifyDatasetUpdate(datasetId, 'contribution_added', {
            contributionId: contribution.id,
            contributorName: req.user.username
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Contribution created successfully',
        data: { contribution: createdContribution.toSafeObject() }
      });
    } catch (error) {
      console.error('Error creating contribution:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create contribution',
        error: error.message
      });
    }
  }
];

// Update contribution (for contributor to edit their own)
exports.updateContribution = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { annotations, description, tags } = req.body;

    const contribution = await Contribution.findOne({
      where: { id, isActive: true },
      include: [{
        model: Dataset,
        as: 'dataset',
        attributes: ['id', 'ownerId']
      }]
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Contribution not found'
      });
    }

    // Check ownership
    if (contribution.contributorId !== req.user.id && 
        contribution.dataset.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own contributions'
      });
    }

    // Update metadata
    const updatedMetadata = {
      ...contribution.metadata,
      description: description || contribution.metadata.description,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : contribution.metadata.tags,
      annotations: annotations ? JSON.parse(annotations) : contribution.metadata.annotations
    };

    await contribution.update({
      metadata: updatedMetadata
    });

    res.json({
      success: true,
      message: 'Contribution updated successfully',
      data: { contribution: contribution.toSafeObject() }
    });
  } catch (error) {
    console.error('Error updating contribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contribution',
      error: error.message
    });
  }
};

// Delete contribution (soft delete)
exports.deleteContribution = async (req, res) => {
  try {
    const { id } = req.params;

    const contribution = await Contribution.findOne({
      where: { id, isActive: true },
      include: [{
        model: Dataset,
        as: 'dataset',
        attributes: ['id', 'ownerId']
      }]
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Contribution not found'
      });
    }

    // Check permissions
    const canDelete = contribution.contributorId === req.user.id || 
                     contribution.dataset.ownerId === req.user.id ||
                     req.user.roles.includes('admin');

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this contribution'
      });
    }

    // Soft delete
    await contribution.update({ isActive: false });

    // Update dataset contribution count
    const dataset = await Dataset.findByPk(contribution.datasetId);
    if (dataset && dataset.contributionCount > 0) {
      await dataset.decrement('contributionCount');
    }

    res.json({
      success: true,
      message: 'Contribution deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contribution',
      error: error.message
    });
  }
};

// Get user's contributions
exports.getUserContributions = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      datasetId,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Check if user is requesting their own contributions or has permission
    if (userId !== req.user.id.toString() && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const whereClause = {
      contributorId: userId,
      isActive: true
    };

    if (datasetId) {
      whereClause.datasetId = datasetId;
    }

    if (status) {
      whereClause.validationStatus = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows: contributions } = await Contribution.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'contributor',
          attributes: ['id', 'username', 'fullName']
        },
        {
          model: Dataset,
          as: 'dataset',
          attributes: ['id', 'name', 'dataType', 'visibility']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      success: true,
      data: {
        contributions: contributions.map(c => c.toSafeObject()),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNext,
          hasPrev
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user contributions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user contributions',
      error: error.message
    });
  }
};

module.exports = exports;