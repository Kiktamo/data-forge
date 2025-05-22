const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Dataset = require('../models/dataset.model');
const User = require('../models/user.model');

// Get all datasets (with filtering and pagination)
exports.getDatasets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      visibility,
      dataType,
      search,
      tags,
      sortBy = 'updatedAt',
      sortOrder = 'DESC',
      userId
    } = req.query;

    // Build where clause
    const whereClause = { isActive: true };
    
    // Visibility filter
    if (visibility) {
      whereClause.visibility = visibility;
    } else {
      // Default: show only public datasets unless user is authenticated and requesting their own
      if (!userId || userId !== req.user?.id?.toString()) {
        whereClause.visibility = 'public';
      }
    }

    // Data type filter
    if (dataType) {
      whereClause.dataType = dataType;
    }

    // User filter (for "my datasets")
    if (userId) {
      whereClause.ownerId = userId;
    }

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      whereClause.tags = { [Op.overlap]: tagArray };
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Get datasets with owner information
    const { count, rows: datasets } = await Dataset.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'username', 'fullName']
      }],
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
        datasets: datasets.map(dataset => dataset.toSafeObject()),
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
    console.error('Error fetching datasets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch datasets',
      error: error.message
    });
  }
};

// Get single dataset by ID
exports.getDatasetById = async (req, res) => {
  try {
    const { id } = req.params;

    const dataset = await Dataset.findOne({
      where: { id, isActive: true },
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'username', 'fullName']
      }]
    });

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found'
      });
    }

    // Check visibility permissions
    if (dataset.visibility === 'private' && 
        (!req.user || req.user.id !== dataset.ownerId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to private dataset'
      });
    }

    res.json({
      success: true,
      data: { dataset: dataset.toSafeObject() }
    });
  } catch (error) {
    console.error('Error fetching dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dataset',
      error: error.message
    });
  }
};

// Create new dataset
exports.createDataset = async (req, res) => {
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

    const { name, description, visibility, dataType, tags } = req.body;

    // Create dataset
    const dataset = await Dataset.create({
      name,
      description,
      visibility: visibility || 'private',
      dataType,
      tags: tags || [],
      ownerId: req.user.id
    });

    // Fetch the created dataset with owner info
    const createdDataset = await Dataset.findOne({
      where: { id: dataset.id },
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'username', 'fullName']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Dataset created successfully',
      data: { dataset: createdDataset.toSafeObject() }
    });
  } catch (error) {
    console.error('Error creating dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dataset',
      error: error.message
    });
  }
};

// Update dataset
exports.updateDataset = async (req, res) => {
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

    const { id } = req.params;
    const { name, description, visibility, tags } = req.body;

    // Find dataset
    const dataset = await Dataset.findOne({
      where: { id, isActive: true }
    });

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found'
      });
    }

    // Check ownership
    if (dataset.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own datasets.'
      });
    }

    // Update dataset
    await dataset.update({
      name: name || dataset.name,
      description: description !== undefined ? description : dataset.description,
      visibility: visibility || dataset.visibility,
      tags: tags || dataset.tags
    });

    // Fetch updated dataset with owner info
    const updatedDataset = await Dataset.findOne({
      where: { id: dataset.id },
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'username', 'fullName']
      }]
    });

    res.json({
      success: true,
      message: 'Dataset updated successfully',
      data: { dataset: updatedDataset.toSafeObject() }
    });
  } catch (error) {
    console.error('Error updating dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update dataset',
      error: error.message
    });
  }
};

// Delete dataset (soft delete)
exports.deleteDataset = async (req, res) => {
  try {
    const { id } = req.params;

    // Find dataset
    const dataset = await Dataset.findOne({
      where: { id, isActive: true }
    });

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found'
      });
    }

    // Check ownership or admin role
    if (dataset.ownerId !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own datasets.'
      });
    }

    // Soft delete
    await dataset.update({ isActive: false });

    res.json({
      success: true,
      message: 'Dataset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete dataset',
      error: error.message
    });
  }
};

// Get user's datasets
exports.getUserDatasets = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      visibility,
      dataType,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'DESC'
    } = req.query;

    // Check if user is requesting their own datasets or has permission
    if (userId !== req.user.id.toString() && !req.user.roles.includes('admin')) {
      // If not own datasets, only show public ones
      req.query.visibility = 'public';
    }

    // Set userId for filtering
    req.query.userId = userId;

    // Reuse the getDatasets logic
    return await exports.getDatasets(req, res);
  } catch (error) {
    console.error('Error fetching user datasets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user datasets',
      error: error.message
    });
  }
};

// Get dataset history/versions
exports.getDatasetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      sortOrder = 'DESC'
    } = req.query;

    // First check if dataset exists and user has permission
    const dataset = await Dataset.findOne({
      where: { id, isActive: true }
    });

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found'
      });
    }

    // Check visibility permissions
    if (dataset.visibility === 'private' && 
        (!req.user || req.user.id !== dataset.ownerId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to private dataset'
      });
    }

    // Get history from temporal table
    const offset = (page - 1) * limit;
    
    const { count, rows: history } = await Dataset.HistoryModel.findAndCountAll({
      where: { id },
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'username', 'fullName']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['updatedAt', sortOrder.toUpperCase()]],
      distinct: true
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      success: true,
      data: {
        history: history.map(version => ({
          ...version.toSafeObject(),
          version: version.updatedAt, // Use timestamp as version identifier
          isHistorical: true
        })),
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
    console.error('Error fetching dataset history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dataset history',
      error: error.message
    });
  }
};

// Create a new version (manual versioning for major releases)
exports.createDatasetVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { versionDescription, incrementType = 'patch' } = req.body;

    // Find dataset
    const dataset = await Dataset.findOne({
      where: { id, isActive: true }
    });

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found'
      });
    }

    // Check ownership
    if (dataset.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only version your own datasets.'
      });
    }

    // Calculate new version number
    const currentVersion = dataset.currentVersion;
    const newVersion = incrementVersion(currentVersion, incrementType);

    // Update dataset with new version
    await dataset.update({
      currentVersion: newVersion,
      // Add version description to a description field or metadata
      description: versionDescription ? 
        `${dataset.description}\n\n--- Version ${newVersion} ---\n${versionDescription}` : 
        dataset.description
    });

    // The temporal table will automatically create a history entry

    // Fetch updated dataset
    const updatedDataset = await Dataset.findOne({
      where: { id: dataset.id },
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'username', 'fullName']
      }]
    });

    res.json({
      success: true,
      message: `Dataset version ${newVersion} created successfully`,
      data: { 
        dataset: updatedDataset.toSafeObject(),
        previousVersion: currentVersion,
        newVersion: newVersion
      }
    });
  } catch (error) {
    console.error('Error creating dataset version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dataset version',
      error: error.message
    });
  }
};

// Helper function to increment version numbers
function incrementVersion(version, incrementType) {
  const parts = version.split('.').map(Number);
  
  switch (incrementType) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
    default:
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

// Get dataset statistics
exports.getDatasetStats = async (req, res) => {
  try {
    const { id } = req.params;

    const dataset = await Dataset.findOne({
      where: { id, isActive: true }
    });

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found'
      });
    }

    // Check visibility permissions
    if (dataset.visibility === 'private' && 
        (!req.user || req.user.id !== dataset.ownerId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to private dataset'
      });
    }

    // Calculate basic statistics
    const stats = {
      totalContributions: dataset.contributionCount,
      validatedContributions: dataset.validationCount,
      pendingValidations: dataset.contributionCount - dataset.validationCount,
      currentVersion: dataset.currentVersion,
      createdAt: dataset.createdAt,
      lastUpdated: dataset.updatedAt,
      tags: dataset.tags,
      dataType: dataset.dataType
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching dataset statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dataset statistics',
      error: error.message
    });
  }
};