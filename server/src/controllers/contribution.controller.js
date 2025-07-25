const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Contribution = require('../models/contribution.model');
const Validation = require('../models/validation.model');
const Dataset = require('../models/dataset.model');
const User = require('../models/user.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const duplicateDetectionService = require('../services/duplicate-detection.service');

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
    
    // For now, allow all types - I'll validate against dataset type in the controller
    cb(null, true);
  }
});

const moveFileToTypeFolder = async (file, dataType) => {
  const typeFolder = path.join(__dirname, `../../uploads/contributions/${dataType}s`);
  await fs.mkdir(typeFolder, { recursive: true });
  
  const newPath = path.join(typeFolder, file.filename);
  await fs.rename(file.path, newPath);
  
  return {
    ...file,
    path: newPath,
    typeFolder: `${dataType}s`
  };
};

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

    // Build where clause
    const whereClause = {
      datasetId: parseInt(datasetId),
      isActive: true
    };

    if (status) {
      whereClause.validationStatus = status;
    }

    if (contributorId) {
      whereClause.contributorId = parseInt(contributorId);
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // FIXED: Add proper includes for contributor and dataset information
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
          attributes: ['id', 'name', 'dataType', 'visibility', 'ownerId']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

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
  // FIXED: Move file to appropriate type-specific folder
  const movedFile = await moveFileToTypeFolder(req.file, dataset.dataType);
  
  const fileInfo = {
    originalName: movedFile.originalname,
    filename: movedFile.filename,
    path: movedFile.path,
    size: movedFile.size,
    mimetype: movedFile.mimetype,
    typeFolder: movedFile.typeFolder
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
      const textContent = await fs.readFile(movedFile.path, 'utf-8');
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

      // New: Run duplicate detection service
      let duplicateDetectionResult = null;
      try {
        console.log(`🔍 Running duplicate detection for contribution ${contribution.id}`);
        duplicateDetectionResult = await duplicateDetectionService.checkForDuplicates(createdContribution);
        
        // Log results for monitoring
        if (duplicateDetectionResult.hasDuplicates) {
          console.log(`🚨 Found ${duplicateDetectionResult.duplicates.length} potential duplicates for contribution ${contribution.id}`);
        } else if (duplicateDetectionResult.hasWarnings) {
          console.log(`⚠️ Found ${duplicateDetectionResult.warnings.length} similar contributions for contribution ${contribution.id}`);
        } else {
          console.log(`✅ No duplicates found for contribution ${contribution.id}`);
        }
        
      } catch (duplicateError) {
        console.error('❌ Duplicate detection failed (continuing without):', duplicateError);
        // Don't fail the contribution creation if duplicate detection fails
      }

      // Notify via WebSocket if available
      // Notify via WebSocket if available
      const { wsService } = require('../index');
      if (wsService && typeof wsService === 'function') {
        const ws = wsService();
        if (ws) {
          ws.notifyDatasetUpdate(datasetId, 'contribution_added', {
            contributionId: contribution.id,
            contributorName: req.user.username,
            duplicateDetection: duplicateDetectionResult ? {
              hasDuplicates: duplicateDetectionResult.hasDuplicates,
              hasWarnings: duplicateDetectionResult.hasWarnings,
              duplicateCount: duplicateDetectionResult.duplicates?.length || 0,
              warningCount: duplicateDetectionResult.warnings?.length || 0
            } : null
          });
        }
      }

// Return response with duplicate detection results
      const response = {
        success: true,
        message: 'Contribution created successfully',
        data: { 
          contribution: createdContribution.toSafeObject(),
          duplicateDetection: duplicateDetectionResult ? {
            hasDuplicates: duplicateDetectionResult.hasDuplicates,
            hasWarnings: duplicateDetectionResult.hasWarnings,
            duplicates: duplicateDetectionResult.duplicates || [],
            warnings: duplicateDetectionResult.warnings || [],
            // Don't expose the full embedding data to frontend
            embeddingGenerated: !!duplicateDetectionResult.embedding
          } : null
        }
      };

      res.status(201).json(response);
      
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

    // console.log('Getting user contributions with where clause:', whereClause);

    // FIXED: Ensure includes are present for dataset and contributor info
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

    // console.log('User contributions query result count:', count);
    // console.log('First contribution with includes:', contributions[0]?.toJSON ? contributions[0].toJSON() : contributions[0]);

    const totalPages = Math.ceil(count / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // FIXED: Include related data in response
    const contributionsWithRelated = contributions.map(contribution => {
      const contribObj = contribution.toSafeObject();
      return {
        ...contribObj,
        contributor: contribution.contributor ? {
          id: contribution.contributor.id,
          username: contribution.contributor.username,
          fullName: contribution.contributor.fullName
        } : null,
        dataset: contribution.dataset ? {
          id: contribution.dataset.id,
          name: contribution.dataset.name,
          dataType: contribution.dataset.dataType,
          visibility: contribution.dataset.visibility
        } : null
      };
    });

    // console.log('Processed user contributions:', contributionsWithRelated);

    res.json({
      success: true,
      data: {
        contributions: contributionsWithRelated,
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