const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Validation = require('../models/validation.model');
const Contribution = require('../models/contribution.model');
const Dataset = require('../models/dataset.model');
const User = require('../models/user.model');

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
      include: [{
        model: Dataset,
        as: 'dataset',
        attributes: ['id', 'name', 'ownerId', 'visibility']
      }]
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
    await updateContributionStatus(contribution);

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
      where: { id, isActive: true }
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

    // Update validation
    await validation.update({
      status: status || validation.status,
      confidence: confidence !== undefined ? parseFloat(confidence) : validation.confidence,
      notes: notes !== undefined ? notes : validation.notes,
      validationCriteria: validationCriteria || validation.validationCriteria,
      timeSpent: timeSpent !== undefined ? parseInt(timeSpent) : validation.timeSpent
    });

    // Recalculate contribution status
    const contribution = await Contribution.findByPk(validation.contributionId);
    if (contribution) {
      await updateContributionStatus(contribution);
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
      where: { id, isActive: true }
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

    // Soft delete
    await validation.update({ isActive: false });

    // Update contribution's validated_by array
    const contribution = await Contribution.findByPk(validation.contributionId);
    if (contribution) {
      const updatedValidatedBy = (contribution.validatedBy || [])
        .filter(id => id !== req.user.id);
      await contribution.update({
        validatedBy: updatedValidatedBy
      });

      // Recalculate contribution status
      await updateContributionStatus(contribution);
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
      sortBy = 'createdAt',
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
    console.error('Error fetching pending contributions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending contributions',
      error: error.message
    });
  }
};

// Helper function to update contribution status based on validations
async function updateContributionStatus(contribution) {
  try {
    const validations = await Validation.findAll({
      where: {
        contributionId: contribution.id,
        isActive: true
      }
    });

    if (validations.length === 0) {
      return; // No validations yet
    }

    const approvedCount = validations.filter(v => v.status === 'approved').length;
    const rejectedCount = validations.filter(v => v.status === 'rejected').length;
    const totalValidations = validations.length;

    // Simple consensus rules - can be made more sophisticated
    let newStatus = contribution.validationStatus;

    if (totalValidations >= 2) {
      if (approvedCount > rejectedCount && approvedCount / totalValidations >= 0.6) {
        newStatus = 'approved';
      } else if (rejectedCount > approvedCount && rejectedCount / totalValidations >= 0.6) {
        newStatus = 'rejected';
      }
    }

    // Update contribution status if it changed
    if (newStatus !== contribution.validationStatus) {
      await contribution.update({ validationStatus: newStatus });

      // Update dataset validation count if approved
      if (newStatus === 'approved' && contribution.validationStatus !== 'approved') {
        const dataset = await Dataset.findByPk(contribution.datasetId);
        if (dataset) {
          await dataset.increment('validationCount');
        }
      } else if (contribution.validationStatus === 'approved' && newStatus !== 'approved') {
        const dataset = await Dataset.findByPk(contribution.datasetId);
        if (dataset && dataset.validationCount > 0) {
          await dataset.decrement('validationCount');
        }
      }
    }
  } catch (error) {
    console.error('Error updating contribution status:', error);
  }
}

module.exports = exports;