const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Validation = require('../models/validation.model');
const Contribution = require('../models/contribution.model');
const Dataset = require('../models/dataset.model');
const User = require('../models/user.model');
const emailService = require('../services/email.service');
const ContributionEmbedding = require('../models/embedding.model');

// Create validation for a contribution
exports.createValidation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { contributionId } = req.params;
    const { status, confidence, notes, validationCriteria, timeSpent } = req.body;

    // Check if contribution exists
    const contribution = await Contribution.findOne({
      where: { id: contributionId, isActive: true },
      include: [
        {
          model: Dataset,
          as: 'dataset',
          attributes: ['id', 'name', 'ownerId', 'visibility']
        },
        {
          model: User,
          as: 'contributor',
          attributes: ['id', 'username', 'fullName', 'email']
        }
      ]
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Contribution not found'
      });
    }

    // Check if user can validate (not their own contribution)
    if (contribution.contributorId === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You cannot validate your own contribution'
      });
    }

    // Check if user already validated this contribution
    const existingValidation = await Validation.findOne({
      where: {
        contributionId,
        validatorId: req.user.id,
        isActive: true
      }
    });

    if (existingValidation) {
      return res.status(409).json({
        success: false,
        message: 'You have already validated this contribution'
      });
    }

    // Check dataset access permissions for validation
    const canValidate = contribution.dataset.visibility !== 'private' || 
                       req.user.id === contribution.dataset.ownerId ||
                       req.user.roles.includes('admin');

    if (!canValidate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to validate contributions in this dataset'
      });
    }

    // Store original status for email notification comparison
    const originalStatus = contribution.validationStatus;

    // Create validation
    const validation = await Validation.create({
      contributionId: parseInt(contributionId),
      validatorId: req.user.id,
      status,
      confidence: confidence ? parseFloat(confidence) : null,
      notes: notes || '',
      validationCriteria: validationCriteria || {},
      timeSpent: timeSpent ? parseInt(timeSpent) : null
    });

    // Update contribution's validated_by array
    const updatedValidatedBy = [...(contribution.validatedBy || []), req.user.id];
    await contribution.update({
      validatedBy: updatedValidatedBy
    });

    // Calculate consensus and update contribution status if needed
    const statusChanged = await updateContributionStatus(contribution);

    // Send email notification if status changed to approved/rejected
    if (statusChanged && contribution.contributor && contribution.contributor.email) {
      try {
        // Reload contribution to get updated status
        await contribution.reload();
        
        if (contribution.validationStatus === 'approved' || contribution.validationStatus === 'rejected') {
          await emailService.sendValidationNotification(
            contribution.contributor,
            contribution,
            contribution.validationStatus,
            notes || `Your contribution has been ${contribution.validationStatus} by the community.`
          );
          console.log(`📧 Validation notification sent to ${contribution.contributor.email} for ${contribution.validationStatus} contribution`);
        }
      } catch (emailError) {
        console.error('❌ Failed to send validation notification email:', emailError);
        // Don't fail the validation creation if email fails
      }
    }

    // Fetch the created validation with validator info
    const createdValidation = await Validation.findOne({
      where: { id: validation.id },
      include: [{
        model: User,
        as: 'validator',
        attributes: ['id', 'username', 'fullName']
      }]
    });

    // Notify via WebSocket if available
    const { wsService } = require('../index');
    if (wsService && typeof wsService === 'function') {
      const ws = wsService();
      if (ws) {
        ws.notifyDatasetUpdate(contribution.datasetId, 'contribution_validated', {
          contributionId: contribution.id,
          validatorName: req.user.username,
          validationStatus: status
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Validation created successfully',
      data: { validation: createdValidation.toSafeObject() }
    });
  } catch (error) {
    console.error('Error creating validation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create validation',
      error: error.message
    });
  }
};

// Get validations for a contribution
exports.getValidationsForContribution = async (req, res) => {
  try {
    const { contributionId } = req.params;

    // Check if contribution exists and user has access
    const contribution = await Contribution.findOne({
      where: { id: contributionId, isActive: true },
      include: [{
        model: Dataset,
        as: 'dataset',
        attributes: ['id', 'visibility', 'ownerId']
      }]
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
        message: 'Access denied'
      });
    }

    const validationSummary = await Validation.getSummaryForContribution(contributionId);

    res.json({
      success: true,
      data: validationSummary
    });
  } catch (error) {
    console.error('Error fetching validations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch validations',
      error: error.message
    });
  }
};

// Update validation
exports.updateValidation = async (req, res) => {
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
    const { status, confidence, notes, validationCriteria, timeSpent } = req.body;

    const validation = await Validation.findOne({
      where: { id, isActive: true },
      include: [{
        model: Contribution,
        as: 'contribution',
        include: [{
          model: User,
          as: 'contributor',
          attributes: ['id', 'username', 'fullName', 'email']
        }]
      }]
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: 'Validation not found'
      });
    }

    // Check ownership
    if (validation.validatorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own validations'
      });
    }

    // Store original contribution status for email notification comparison
    const originalContributionStatus = validation.contribution.validationStatus;

    // Update validation
    await validation.update({
      status: status || validation.status,
      confidence: confidence !== undefined ? parseFloat(confidence) : validation.confidence,
      notes: notes !== undefined ? notes : validation.notes,
      validationCriteria: validationCriteria || validation.validationCriteria,
      timeSpent: timeSpent !== undefined ? parseInt(timeSpent) : validation.timeSpent
    });

    // Recalculate contribution status
    const contribution = await Contribution.findByPk(validation.contributionId, {
      include: [{
        model: User,
        as: 'contributor',
        attributes: ['id', 'username', 'fullName', 'email']
      }]
    });
    
    if (contribution) {
      const statusChanged = await updateContributionStatus(contribution);
      
      // Send email notification if status changed to approved/rejected
      if (statusChanged && contribution.contributor && contribution.contributor.email) {
        try {
          await contribution.reload();
          
          if ((contribution.validationStatus === 'approved' || contribution.validationStatus === 'rejected') &&
              contribution.validationStatus !== originalContributionStatus) {
            await emailService.sendValidationNotification(
              contribution.contributor,
              contribution,
              contribution.validationStatus,
              notes || `Your contribution status has been updated to ${contribution.validationStatus}.`
            );
            console.log(`📧 Validation update notification sent to ${contribution.contributor.email}`);
          }
        } catch (emailError) {
          console.error('❌ Failed to send validation update notification email:', emailError);
        }
      }
    }

    res.json({
      success: true,
      message: 'Validation updated successfully',
      data: { validation: validation.toSafeObject() }
    });
  } catch (error) {
    console.error('Error updating validation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update validation',
      error: error.message
    });
  }
};

// Delete validation
exports.deleteValidation = async (req, res) => {
  try {
    const { id } = req.params;

    const validation = await Validation.findOne({
      where: { id, isActive: true },
      include: [{
        model: Contribution,
        as: 'contribution',
        include: [{
          model: User,
          as: 'contributor',
          attributes: ['id', 'username', 'fullName', 'email']
        }]
      }]
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: 'Validation not found'
      });
    }

    // Check permissions
    const canDelete = validation.validatorId === req.user.id || 
                     req.user.roles.includes('admin');

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this validation'
      });
    }

    // Store original contribution status for email notification comparison
    const originalContributionStatus = validation.contribution.validationStatus;

    // Soft delete
    await validation.update({ isActive: false });

    // Update contribution's validated_by array
    const contribution = await Contribution.findByPk(validation.contributionId, {
      include: [{
        model: User,
        as: 'contributor',
        attributes: ['id', 'username', 'fullName', 'email']
      }]
    });
    
    if (contribution) {
      const updatedValidatedBy = (contribution.validatedBy || [])
        .filter(id => id !== req.user.id);
      await contribution.update({
        validatedBy: updatedValidatedBy
      });

      // Recalculate contribution status
      const statusChanged = await updateContributionStatus(contribution);
      
      // Send email notification if status changed due to validation removal
      if (statusChanged && contribution.contributor && contribution.contributor.email) {
        try {
          await contribution.reload();
          
          if (contribution.validationStatus !== originalContributionStatus) {
            await emailService.sendValidationNotification(
              contribution.contributor,
              contribution,
              contribution.validationStatus,
              `A validation for your contribution was removed, changing its status to ${contribution.validationStatus}.`
            );
            console.log(`📧 Validation removal notification sent to ${contribution.contributor.email}`);
          }
        } catch (emailError) {
          console.error('❌ Failed to send validation removal notification email:', emailError);
        }
      }
    }

    res.json({
      success: true,
      message: 'Validation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting validation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete validation',
      error: error.message
    });
  }
};

// Get pending contributions for validation
exports.getPendingContributions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      datasetId,
      dataType,
      sortBy = 'created_at',
      sortOrder = 'ASC'
    } = req.query;

    const whereClause = {
      validationStatus: 'pending',
      isActive: true,
      contributorId: {
        [Op.ne]: req.user.id // Exclude user's own contributions
      }
    };

    if (datasetId) {
      whereClause.datasetId = datasetId;
    }

    if (dataType) {
      whereClause.dataType = dataType;
    }

    // Also exclude contributions the user has already validated
    const userValidations = await Validation.findAll({
      where: {
        validatorId: req.user.id,
        isActive: true
      },
      attributes: ['contributionId']
    });

    const validatedContributionIds = userValidations.map(v => v.contributionId);
    if (validatedContributionIds.length > 0) {
      whereClause.id = {
        [Op.notIn]: validatedContributionIds
      };
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
          attributes: ['id', 'name', 'dataType', 'visibility', 'ownerId'],
          where: {
            [Op.or]: [
              { visibility: { [Op.in]: ['public', 'collaborative'] } },
              { ownerId: req.user.id }
            ]
          }
        },
        // New: Include embedding data for duplicate detection
        {
          model: ContributionEmbedding,
          as: 'embedding',
          required: false, // LEFT JOIN - some contributions might not have embeddings yet
          attributes: ['id', 'embedding', 'contentExcerpt', 'extractedAt', 'embeddingModel']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    // New: Enhance contributions with duplicate detection information
    const enhancedContributions = [];
    
    for (const contribution of contributions) {
      const contributionData = contribution.toSafeObject();
      
      // Add duplicate detection info if embedding exists
      if (contribution.embedding && contribution.embedding.embedding) {
        try {
          // Find similar contributions for this one
          const similarContributions = await ContributionEmbedding.findSimilar(
            JSON.parse(contribution.embedding.embedding), // Parse vector from database
            {
              limit: 5,
              threshold: 0.75, // Warning threshold
              excludeContributionId: contribution.id,
              datasetId: contribution.datasetId
            }
          );

          contributionData.duplicateDetection = {
            hasEmbedding: true,
            similarCount: similarContributions.length,
            highSimilarityCount: similarContributions.filter(s => s.similarity >= 0.85).length,
            topSimilarities: similarContributions.slice(0, 3).map(s => ({
              contributionId: s.contribution_id,
              similarity: Math.round(s.similarity * 100) / 100,
              contentExcerpt: s.content_excerpt?.substring(0, 100) + '...'
            }))
          };
          
        } catch (duplicateError) {
          console.error(`Error checking duplicates for contribution ${contribution.id}:`, duplicateError);
          contributionData.duplicateDetection = {
            hasEmbedding: true,
            error: 'Could not check for duplicates'
          };
        }
      } else {
        contributionData.duplicateDetection = {
          hasEmbedding: false,
          message: 'Embedding not generated yet'
        };
      }
      
      enhancedContributions.push(contributionData);
    }

    const totalPages = Math.ceil(count / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      success: true,
      data: {
        contributions: enhancedContributions, // Return enhanced data
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
    console.error('Error fetching pending contributions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending contributions',
      error: error.message
    });
  }
};

// Helper function to update contribution status based on validations
// UPDATED: Now returns whether the status actually changed
async function updateContributionStatus(contribution) {
  try {
    const originalStatus = contribution.validationStatus;
    
    const validations = await Validation.findAll({
      where: {
        contributionId: contribution.id,
        isActive: true
      }
    });

    if (validations.length === 0) {
      // If no validations and not pending, reset to pending
      if (contribution.validationStatus !== 'pending') {
        await contribution.update({ validationStatus: 'pending' });
        return true; // Status changed
      }
      return false; // No change
    }

    const approvedCount = validations.filter(v => v.status === 'approved').length;
    const rejectedCount = validations.filter(v => v.status === 'rejected').length;
    const totalValidations = validations.length;

    // Enhanced consensus rules with better logging
    let newStatus = contribution.validationStatus;

    if (totalValidations >= 2) {
      if (approvedCount > rejectedCount && approvedCount / totalValidations >= 0.6) {
        newStatus = 'approved';
      } else if (rejectedCount > approvedCount && rejectedCount / totalValidations >= 0.6) {
        newStatus = 'rejected';
      }
    } else if (totalValidations === 1) {
      // For single validation, require unanimous decision with high confidence
      const singleValidation = validations[0];
      if (singleValidation.confidence && singleValidation.confidence >= 0.8) {
        newStatus = singleValidation.status;
      }
    }

    console.log(`🔍 Contribution ${contribution.id} validation consensus: ${approvedCount} approved, ${rejectedCount} rejected, ${totalValidations} total. Status: ${originalStatus} → ${newStatus}`);

    // Update contribution status if it changed
    if (newStatus !== originalStatus) {
      await contribution.update({ validationStatus: newStatus });

      // Update dataset validation count if approved
      if (newStatus === 'approved' && originalStatus !== 'approved') {
        const dataset = await Dataset.findByPk(contribution.datasetId);
        if (dataset) {
          await dataset.increment('validationCount');
          console.log(`📊 Dataset ${dataset.id} validation count incremented`);
        }
      } else if (originalStatus === 'approved' && newStatus !== 'approved') {
        const dataset = await Dataset.findByPk(contribution.datasetId);
        if (dataset && dataset.validationCount > 0) {
          await dataset.decrement('validationCount');
          console.log(`📊 Dataset ${dataset.id} validation count decremented`);
        }
      }
      
      return true; // Status changed
    }
    
    return false; // No status change
  } catch (error) {
    console.error('Error updating contribution status:', error);
    return false;
  }
}

module.exports = exports;