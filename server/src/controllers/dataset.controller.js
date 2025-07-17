const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Dataset = require('../models/dataset.model');
const User = require('../models/user.model');
const archiver = require('archiver');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const Contribution = require('../models/contribution.model');

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
      sortBy = 'updated_at',
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

    // console.log('Dataset controller where clause:', whereClause);

    // FIXED: Add the missing include for owner information
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

    // console.log('Dataset controller raw results count:', count);
    // console.log('Dataset controller first dataset with owner:', datasets[0]?.toJSON ? datasets[0].toJSON() : datasets[0]);

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // FIXED: Include owner information in response
    const datasetsWithOwner = datasets.map(dataset => {
      const datasetObj = dataset.toSafeObject();
      return {
        ...datasetObj,
        owner: dataset.owner ? {
          id: dataset.owner.id,
          username: dataset.owner.username,
          fullName: dataset.owner.fullName
        } : null
      };
    });

    // console.log('Dataset controller processed datasets:', datasetsWithOwner);

    res.json({
      success: true,
      data: {
        datasets: datasetsWithOwner,
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
      sortBy = 'updated_at',
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
      // console.log('Available Sequelize models:', Object.keys(Dataset.sequelize.models));
      
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

      console.log('Transformed history record:', data);
      
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
        created_at: data.createdAt,
        updated_at: data.updatedAt,
        archived_at: data.archivedAt,
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

    // console.log('=== DATASET STATS DEBUG ===');
    // console.log('Calculating stats for dataset:', id);

    // FIXED: Calculate statistics from actual contribution data instead of relying on cached counts
    const Contribution = require('../models/contribution.model');
    
    // Get total contributions
    const totalContributions = await Contribution.count({
      where: {
        datasetId: id,
        isActive: true
      }
    });

    // Get validated (approved) contributions
    const validatedContributions = await Contribution.count({
      where: {
        datasetId: id,
        isActive: true,
        validationStatus: 'approved'
      }
    });

    // Get pending contributions
    const pendingContributions = await Contribution.count({
      where: {
        datasetId: id,
        isActive: true,
        validationStatus: 'pending'
      }
    });

    // Get rejected contributions (for completeness)
    const rejectedContributions = await Contribution.count({
      where: {
        datasetId: id,
        isActive: true,
        validationStatus: 'rejected'
      }
    });

    // console.log('Calculated stats:', {
    //   totalContributions,
    //   validatedContributions,
    //   pendingContributions,
    //   rejectedContributions
    // });

    // console.log('Dataset cached counts:', {
    //   contributionCount: dataset.contributionCount,
    //   validationCount: dataset.validationCount
    // });

    // FIXED: Update dataset cached counts if they don't match
    if (dataset.contributionCount !== totalContributions || 
        dataset.validationCount !== validatedContributions) {
      
      console.log('Updating cached counts in dataset');
      await dataset.update({
        contributionCount: totalContributions,
        validationCount: validatedContributions
      });
    }

    // Calculate accurate statistics
    const stats = {
      totalContributions: totalContributions,
      validatedContributions: validatedContributions,
      pendingValidations: pendingContributions,
      rejectedContributions: rejectedContributions,
      currentVersion: dataset.currentVersion,
      created_at: dataset.createdAt,
      lastUpdated: dataset.updatedAt,
      tags: dataset.tags,
      dataType: dataset.dataType
    };

    // console.log('Final stats returned:', stats);
    // console.log('=== END DATASET STATS DEBUG ===');

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

// Export dataset in various formats
exports.exportDataset = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      format = 'zip', 
      includeRejected = false, 
      includePending = false 
    } = req.query;

    // Validate format
    const validFormats = ['json', 'csv', 'zip'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Supported formats: json, csv, zip'
      });
    }

    // Find dataset with owner info
    const dataset = await Dataset.findOne({
      where: { id, isActive: true },
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'username', 'fullName', 'email']
      }]
    });

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found'
      });
    }

    // Check export permissions
    const isOwner = req.user && req.user.id === dataset.ownerId;
    const isAdmin = req.user && req.user.roles.includes('admin');
    
    if (dataset.visibility === 'private' && !isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to private dataset'
      });
    }

    // Build contribution filter based on permissions and preferences
    const contributionWhere = {
      datasetId: id,
      isActive: true
    };

    // Filter by validation status
    const allowedStatuses = ['approved'];
    if (isOwner || isAdmin) {
      // Owners can choose to include pending/rejected
      if (includePending === 'true') allowedStatuses.push('pending');
      if (includeRejected === 'true') allowedStatuses.push('rejected');
    }
    contributionWhere.validationStatus = { [Op.in]: allowedStatuses };

    // Get all contributions with related data
    const contributions = await Contribution.findAll({
      where: contributionWhere,
      include: [
        {
          model: User,
          as: 'contributor',
          attributes: ['id', 'username', 'fullName']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    console.log(`📊 Exporting dataset ${id} with ${contributions.length} contributions in ${format} format`);

    // Generate export based on format
    switch (format) {
      case 'json':
        return await exportAsJSON(res, dataset, contributions);
      case 'csv':
        return await exportAsCSV(res, dataset, contributions);
      case 'zip':
        return await exportAsZIP(res, dataset, contributions);
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported export format'
        });
    }

  } catch (error) {
    console.error('Error exporting dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export dataset',
      error: error.message
    });
  }
};

// Export as JSON with complete metadata
async function exportAsJSON(res, dataset, contributions) {
  const exportData = {
    dataset: {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      dataType: dataset.dataType,
      visibility: dataset.visibility,
      currentVersion: dataset.currentVersion,
      tags: dataset.tags,
      created_at: dataset.created_at,
      updated_at: dataset.updated_at,
      owner: {
        id: dataset.owner.id,
        username: dataset.owner.username,
        fullName: dataset.owner.fullName
      },
      statistics: {
        totalContributions: contributions.length,
        approvedContributions: contributions.filter(c => c.validationStatus === 'approved').length,
        pendingContributions: contributions.filter(c => c.validationStatus === 'pending').length,
        rejectedContributions: contributions.filter(c => c.validationStatus === 'rejected').length
      }
    },
    contributions: contributions.map(contribution => ({
      id: contribution.id,
      dataType: contribution.dataType,
      validationStatus: contribution.validationStatus,
      content: contribution.content,
      metadata: contribution.metadata,
      contributor: {
        id: contribution.contributor.id,
        username: contribution.contributor.username,
        fullName: contribution.contributor.fullName
      },
      created_at: contribution.created_at,
      updated_at: contribution.updated_at
    })),
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      exportFormat: 'json',
      exportVersion: '1.0',
      generatedBy: 'DataForge Export System'
    }
  };

  // Set appropriate headers
  const filename = `${dataset.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  res.json(exportData);
}

// Export as CSV (for structured data compatibility)
async function exportAsCSV(res, dataset, contributions) {
  let csvContent = '';
  
  // CSV header based on data type
  if (dataset.dataType === 'structured') {
    // For structured data, try to create a unified CSV
    csvContent = 'contribution_id,contributor_username,validation_status,created_at,content_type';
    
    // Find common fields across contributions
    const allFields = new Set();
    contributions.forEach(contrib => {
      if (contrib.content.type === 'direct' && contrib.content.data) {
        Object.keys(contrib.content.data).forEach(key => allFields.add(key));
      }
    });
    
    // Add dynamic columns for structured fields
    const sortedFields = Array.from(allFields).sort();
    csvContent += ',' + sortedFields.join(',') + '\n';
    
    // Add data rows
    contributions.forEach(contrib => {
      const row = [
        contrib.id,
        contrib.contributor.username,
        contrib.validationStatus,
        contrib.created_at,
        contrib.content.type
      ];
      
      // Add structured data fields
      sortedFields.forEach(field => {
        if (contrib.content.type === 'direct' && contrib.content.data && contrib.content.data[field]) {
          row.push(`"${contrib.content.data[field]}"`);
        } else {
          row.push('');
        }
      });
      
      csvContent += row.join(',') + '\n';
    });
    
  } else {
    // For other data types, create a contribution summary CSV
    csvContent = 'contribution_id,contributor_username,contributor_fullname,validation_status,data_type,has_file,description,tags,created_at\n';
    
    contributions.forEach(contrib => {
      const row = [
        contrib.id,
        contrib.contributor.username,
        `"${contrib.contributor.fullName || ''}"`,
        contrib.validationStatus,
        contrib.dataType,
        contrib.content.type === 'file' ? 'yes' : 'no',
        `"${(contrib.metadata.description || '').replace(/"/g, '""')}"`,
        `"${(contrib.metadata.tags || []).join('; ')}"`,
        contrib.created_at
      ];
      
      csvContent += row.join(',') + '\n';
    });
  }

  // Set appropriate headers
  const filename = `${dataset.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  res.send(csvContent);
}

// Export as ZIP archive with files and metadata
async function exportAsZIP(res, dataset, contributions) {
  const filename = `${dataset.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.zip`;
  
  // Set response headers for streaming ZIP
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  // Create ZIP archive stream
  const archive = archiver('zip', {
    zlib: { level: 9 } // Compression level
  });

  // Handle archive errors
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to create archive',
        error: err.message
      });
    }
  });

  // Pipe archive to response
  archive.pipe(res);

  // Add dataset metadata
  const datasetMetadata = {
    dataset: {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      dataType: dataset.dataType,
      visibility: dataset.visibility,
      currentVersion: dataset.currentVersion,
      tags: dataset.tags,
      created_at: dataset.created_at,
      updated_at: dataset.updated_at,
      owner: {
        username: dataset.owner.username,
        fullName: dataset.owner.fullName
      }
    },
    statistics: {
      totalContributions: contributions.length,
      approvedContributions: contributions.filter(c => c.validationStatus === 'approved').length,
      pendingContributions: contributions.filter(c => c.validationStatus === 'pending').length,
      rejectedContributions: contributions.filter(c => c.validationStatus === 'rejected').length
    },
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      exportFormat: 'zip',
      exportVersion: '1.0'
    }
  };

  archive.append(JSON.stringify(datasetMetadata, null, 2), { name: 'metadata.json' });

  // Add contributions data
  const contributionsData = contributions.map(contribution => ({
    id: contribution.id,
    dataType: contribution.dataType,
    validationStatus: contribution.validationStatus,
    content: contribution.content,
    metadata: contribution.metadata,
    contributor: {
      username: contribution.contributor.username,
      fullName: contribution.contributor.fullName
    },
    created_at: contribution.created_at
  }));

  archive.append(JSON.stringify(contributionsData, null, 2), { name: 'contributions/data.json' });

  // Add CSV manifest for easy viewing
  let csvManifest = 'id,contributor,validation_status,data_type,has_file,filename,description,created_at\n';
  
  let filesAdded = 0;
  let filesSkipped = 0;
  
  for (const contrib of contributions) {
    const hasFile = contrib.content.type === 'file';
    const filename = hasFile ? contrib.content.file.filename : '';
    
    csvManifest += [
      contrib.id,
      contrib.contributor.username,
      contrib.validationStatus,
      contrib.dataType,
      hasFile ? 'yes' : 'no',
      `"${filename}"`,
      `"${(contrib.metadata.description || '').replace(/"/g, '""')}"`,
      contrib.created_at
    ].join(',') + '\n';

    // FIXED: Add actual files to archive with correct path resolution
    if (hasFile && contrib.content.file.filename) {
      // Try multiple path strategies to find the file
      const possiblePaths = [];
      
      // Strategy 1: Check if typeFolder is available (new organized structure)
      if (contrib.content.file.typeFolder) {
        possiblePaths.push(path.join(
          __dirname, 
          '../../uploads/contributions', 
          contrib.content.file.typeFolder, 
          contrib.content.file.filename
        ));
      }
      
      // Strategy 2: Try the organized folder based on data type (fallback)
      const typeFolderMap = {
        'image': 'images',
        'text': 'text',
        'structured': 'structured'
      };
      const typeFolder = typeFolderMap[contrib.dataType];
      if (typeFolder) {
        possiblePaths.push(path.join(
          __dirname, 
          '../../uploads/contributions', 
          typeFolder, 
          contrib.content.file.filename
        ));
      }
      
      // Strategy 3: Try the old direct path (for backwards compatibility)
      if (contrib.content.file.path) {
        possiblePaths.push(contrib.content.file.path);
      }
      
      // Strategy 4: Try root uploads folder (last resort)
      possiblePaths.push(path.join(
        __dirname, 
        '../../uploads/contributions', 
        contrib.content.file.filename
      ));

      console.log(`🔍 Searching for file: ${contrib.content.file.filename}`);
      console.log(`📁 Contribution data type: ${contrib.dataType}`);
      console.log(`📂 Type folder from DB: ${contrib.content.file.typeFolder}`);

      let fileFound = false;
      
      for (const sourcePath of possiblePaths) {
        try {
          // Check if file exists at this path
          await fs.access(sourcePath);
          
          // Determine archive path based on data type
          const archiveTypeFolder = typeFolderMap[contrib.dataType] || 'other';
          const archivePath = `contributions/files/${archiveTypeFolder}/${contrib.content.file.filename}`;
          
          // Add file to archive
          archive.file(sourcePath, { name: archivePath });
          
          console.log(`📎 Added file to archive: ${archivePath}`);
          console.log(`📁 Source path: ${sourcePath}`);
          
          filesAdded++;
          fileFound = true;
          break;
          
        } catch (fileError) {
          // File not found at this path, try next one
          console.log(`❌ File not found at: ${sourcePath}`);
          continue;
        }
      }
      
      if (!fileFound) {
        console.warn(`⚠️ File not found for contribution ${contrib.id}: ${contrib.content.file.filename}`);
        console.warn(`⚠️ Tried paths:`, possiblePaths);
        filesSkipped++;
      }
    }
  }

  archive.append(csvManifest, { name: 'contributions/manifest.csv' });

  // Add README with file statistics
  const readmeContent = `# ${dataset.name} - Dataset Export

## Dataset Information
- **Name**: ${dataset.name}
- **Description**: ${dataset.description || 'No description provided'}
- **Data Type**: ${dataset.dataType}
- **Version**: ${dataset.currentVersion}
- **Owner**: ${dataset.owner.fullName || dataset.owner.username}
- **Created**: ${dataset.created_at}
- **Exported**: ${new Date().toISOString()}

## Export Contents

### Files Structure
- \`metadata.json\` - Complete dataset metadata and statistics
- \`contributions/data.json\` - All contribution data with metadata
- \`contributions/manifest.csv\` - Human-readable contribution summary
- \`contributions/files/\` - Actual uploaded files organized by type
  - \`images/\` - Image contributions
  - \`text/\` - Text file contributions  
  - \`structured/\` - Structured data file contributions

### Statistics
- **Total Contributions**: ${contributions.length}
- **Approved**: ${contributions.filter(c => c.validationStatus === 'approved').length}
- **Pending**: ${contributions.filter(c => c.validationStatus === 'pending').length}
- **Rejected**: ${contributions.filter(c => c.validationStatus === 'rejected').length}

### File Export Results
- **Files Successfully Added**: ${filesAdded}
- **Files Skipped (Not Found)**: ${filesSkipped}
- **File Success Rate**: ${contributions.length > 0 ? Math.round((filesAdded / contributions.filter(c => c.content.type === 'file').length) * 100) : 100}%

## Usage Notes
- All contributions included in this export have been validated according to the dataset's quality standards
- File references in \`data.json\` correspond to files in the \`files/\` directory
- The CSV manifest provides a quick overview of all contributions
- If some files are missing, they may have been moved or deleted from the server

---
Generated by DataForge Export System v1.0
`;

  archive.append(readmeContent, { name: 'README.txt' });

  // Finalize archive
  await archive.finalize();
  
  console.log(`📦 ZIP export completed for dataset ${dataset.id}`);
  console.log(`📊 Export summary: ${filesAdded} files added, ${filesSkipped} files skipped`);
}