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
    
    // Visibility filter - more sophisticated logic
    if (visibility) {
      // Specific visibility requested
      whereClause.visibility = visibility;
    } else {
      // No specific visibility filter - show appropriate datasets based on user status
      if (userId) {
        // User-specific datasets - show all their own datasets regardless of visibility
        whereClause.ownerId = userId;
      } else if (req.user) {
        // Authenticated user viewing "all" datasets - show public and collaborative
        whereClause.visibility = { [Op.in]: ['public', 'collaborative'] };
      } else {
        // Unauthenticated user - only public datasets
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
      // Remove visibility restrictions for user's own datasets
      delete whereClause.visibility;
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

    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Access the history table using multiple fallback approaches
    let DatasetHistory = null;
    
    // Try different ways to access the history model
    try {
      // Method 1: From models export
      const models = require('../models');
      DatasetHistory = models.DatasetHistory;
    } catch (error) {
      console.log('Method 1 failed');
    }
    
    if (!DatasetHistory) {
      try {
        // Method 2: Direct from sequelize models
        DatasetHistory = Dataset.sequelize.models.DatasetHistory;
      } catch (error) {
        console.log('Method 2 failed');
      }
    }
    
    if (!DatasetHistory) {
      try {
        // Method 3: Sequelize-temporal naming convention
        DatasetHistory = Dataset.sequelize.models['Dataset' + 'History'];
      } catch (error) {
        console.log('Method 3 failed');
      }
    }
    
    if (!DatasetHistory) {
      try {
        // Method 4: Check for plural form
        DatasetHistory = Dataset.sequelize.models.DatasetHistories;
      } catch (error) {
        console.log('Method 4 failed');
      }
    }

    if (!DatasetHistory) {
      // Debug: List all available models
      console.log('Available Sequelize models:', Object.keys(Dataset.sequelize.models));
      
      // If history model doesn't exist, return empty history
      return res.json({
        success: true,
        data: {
          history: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(limit),
            hasNext: false,
            hasPrev: false
          }
        }
      });
    }

    // Get history records for this dataset ID
    let count = 0;
    let history = [];
    
    try {
      const result = await DatasetHistory.findAndCountAll({
        where: { id: parseInt(id) }, // Filter by original dataset ID
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'fullName'],
          required: false // LEFT JOIN in case user is deleted
        }],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['archivedAt', sortOrder.toUpperCase()]], // Use archivedAt for ordering
        distinct: true
      });
      
      count = result.count;
      history = result.rows;
    } catch (associationError) {
      console.log('Association failed, trying without User include:', associationError.message);
      
      // Fallback: try without the User association
      try {
        const result = await DatasetHistory.findAndCountAll({
          where: { id: parseInt(id) },
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [['archivedAt', sortOrder.toUpperCase()]],
          distinct: true
        });
        
        count = result.count;
        history = result.rows;
      } catch (fallbackError) {
        console.log('Fallback also failed, using raw SQL approach');
        
        // Last resort: raw SQL query
        const historyQuery = `
          SELECT * FROM "DatasetHistories" 
          WHERE id = :datasetId 
          ORDER BY "archivedAt" ${sortOrder.toUpperCase()}
          LIMIT :limit OFFSET :offset
        `;
        
        const countQuery = `
          SELECT COUNT(*) as count FROM "DatasetHistories" 
          WHERE id = :datasetId
        `;
        
        const [historyResults] = await Dataset.sequelize.query(historyQuery, {
          replacements: { 
            datasetId: parseInt(id), 
            limit: parseInt(limit), 
            offset: parseInt(offset) 
          }
        });
        
        const [countResults] = await Dataset.sequelize.query(countQuery, {
          replacements: { datasetId: parseInt(id) }
        });
        
        history = historyResults;
        count = parseInt(countResults[0]?.count || 0);
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // Transform history records to match expected format
    const transformedHistory = history.map(record => {
      // Handle both Sequelize model instances and raw SQL results
      const data = record.dataValues || record;
      
      return {
        id: data.hid || data.id,
        version: data.archivedAt || data.archived_at,
        isHistorical: true,
        name: data.name,
        description: data.description,
        ownerId: data.ownerId || data.owner_id,
        visibility: data.visibility,
        dataType: data.dataType || data.data_type,
        currentVersion: data.currentVersion || data.current_version,
        tags: data.tags || [],
        contributionCount: data.contributionCount || data.contribution_count || 0,
        validationCount: data.validationCount || data.validation_count || 0,
        isActive: data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true),
        createdAt: data.createdAt || data.created_at,
        updatedAt: data.updatedAt || data.updated_at,
        archivedAt: data.archivedAt || data.archived_at,
        owner: record.owner || null
      };
    });

    res.json({
      success: true,
      data: {
        history: transformedHistory,
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