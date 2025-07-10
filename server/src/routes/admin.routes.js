const express = require('express');
const { param, query } = require('express-validator');
const { authenticate } = require('../middlewares/auth.middleware');
const duplicateDetectionService = require('../services/duplicate-detection.service');

const User = require('../models/user.model');
const Contribution = require('../models/contribution.model');
const { Op } = require('sequelize');

const router = express.Router();

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.roles.includes('admin')) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Process embeddings for existing contributions
router.post('/embeddings/process', async (req, res) => {
  try {
    const { datasetId } = req.body;
    
    console.log(`🔄 Admin triggered embedding processing${datasetId ? ` for dataset ${datasetId}` : ' for all datasets'}`);
    
    const result = await duplicateDetectionService.processExistingContributions(datasetId);
    
    res.json({
      success: true,
      message: 'Embedding processing completed',
      data: result
    });
    
  } catch (error) {
    console.error('Error in admin embedding processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process embeddings',
      error: error.message
    });
  }
});

// Get duplicate detection report for a dataset
router.get('/datasets/:datasetId/duplicates',
  [param('datasetId').isInt({ min: 1 }).withMessage('Dataset ID must be a positive integer')],
  async (req, res) => {
    try {
      const { datasetId } = req.params;
      
      const report = await duplicateDetectionService.generateDuplicateReport(parseInt(datasetId));
      
      res.json({
        success: true,
        data: report
      });
      
    } catch (error) {
      console.error('Error generating duplicate report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate duplicate report',
        error: error.message
      });
    }
  }
);

// Find all duplicate pairs in a dataset
router.get('/datasets/:datasetId/duplicate-pairs',
  [
    param('datasetId').isInt({ min: 1 }).withMessage('Dataset ID must be a positive integer'),
    query('threshold').optional().isFloat({ min: 0, max: 1 }).withMessage('Threshold must be between 0 and 1'),
    query('includeValidated').optional().isBoolean().withMessage('includeValidated must be true or false')
  ],
  async (req, res) => {
    try {
      const { datasetId } = req.params;
      const { threshold = 0.75, includeValidated = false } = req.query;
      
      const duplicatePairs = await duplicateDetectionService.findDatasetDuplicates(
        parseInt(datasetId),
        {
          threshold: parseFloat(threshold),
          includeValidated: includeValidated === 'true'
        }
      );
      
      res.json({
        success: true,
        data: {
          datasetId: parseInt(datasetId),
          threshold: parseFloat(threshold),
          includeValidated: includeValidated === 'true',
          duplicatePairs
        }
      });
      
    } catch (error) {
      console.error('Error finding duplicate pairs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find duplicate pairs',
        error: error.message
      });
    }
  }
);

// Clean up orphaned embeddings
router.delete('/embeddings/cleanup', async (req, res) => {
  try {
    const deletedCount = await duplicateDetectionService.cleanupEmbeddings();
    
    res.json({
      success: true,
      message: 'Embedding cleanup completed',
      data: {
        deletedCount
      }
    });
    
  } catch (error) {
    console.error('Error cleaning up embeddings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up embeddings',
      error: error.message
    });
  }
});

// Get embedding system status
router.get('/embeddings/status', async (req, res) => {
  try {
    const Contribution = require('../models/contribution.model');
    const ContributionEmbedding = require('../models/embedding.model');
    
    const totalContributions = await Contribution.count({ where: { isActive: true } });
    const embeddedContributions = await ContributionEmbedding.count();
    
    // Get status by dataset
    const datasetStats = await Contribution.sequelize.query(`
      SELECT 
        d.id as dataset_id,
        d.name as dataset_name,
        COUNT(c.id) as total_contributions,
        COUNT(ce.id) as embedded_contributions,
        ROUND(COUNT(ce.id)::numeric / NULLIF(COUNT(c.id), 0) * 100, 2) as coverage_percentage
      FROM datasets d
      LEFT JOIN contributions c ON d.id = c.dataset_id AND c.is_active = true
      LEFT JOIN contribution_embeddings ce ON c.id = ce.contribution_id
      WHERE d.is_active = true
      GROUP BY d.id, d.name
      ORDER BY coverage_percentage ASC
    `, {
      type: Contribution.sequelize.QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: {
        overview: {
          totalContributions,
          embeddedContributions,
          coveragePercentage: totalContributions > 0 ? Math.round((embeddedContributions / totalContributions) * 100) : 0,
          pendingEmbeddings: totalContributions - embeddedContributions
        },
        datasetBreakdown: datasetStats
      }
    });
    
  } catch (error) {
    console.error('Error getting embedding status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get embedding status',
      error: error.message
    });
  }
});

// Get user statistics
router.get('/users/stats', async (req, res) => {
  try {
    // Get basic user counts
    const totalUsers = await User.count({ where: { isActive: true } });
    
    // Users who have logged in within the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.count({
      where: {
        isActive: true,
        lastLogin: { [Op.gte]: thirtyDaysAgo }
      }
    });

    // Users created in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await User.count({
      where: {
        isActive: true,
        created_at: { [Op.gte]: sevenDaysAgo }
      }
    });

    // Get rejected contributions count
    const rejectedContributions = await Contribution.count({
      where: {
        validationStatus: 'rejected',
        isActive: true
      }
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        newUsersThisWeek,
        rejectedContributions
      }
    });
    
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics',
      error: error.message
    });
  }
});

module.exports = router;