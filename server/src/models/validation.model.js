const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Validation = sequelize.define('Validation', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  contributionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'contribution_id',
    references: {
      model: 'contributions',
      key: 'id'
    }
  },
  validatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'validator_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      isIn: [['approved', 'rejected', 'needs_review']]
    },
    comment: 'Validator decision on this contribution'
  },
  confidence: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0.0,
      max: 1.0
    },
    comment: 'Validator confidence in their decision (0-1)'
  },
  notes: {
    type: DataTypes.TEXT,
    comment: 'Validator notes explaining their decision'
  },
  validationCriteria: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'validation_criteria',
    comment: 'Structured validation criteria scores'
  },
  timeSpent: {
    type: DataTypes.INTEGER,
    field: 'time_spent',
    comment: 'Time spent on validation in seconds'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'validations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['contribution_id']
    },
    {
      fields: ['validator_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['created_at']
    }
  ]
});

// Instance method to generate safe validation object
Validation.prototype.toSafeObject = function() {
  const {
    id, contributionId, validatorId, status, confidence, notes,
    validationCriteria, timeSpent, isActive, created_at, updated_at
  } = this;
  
  return {
    id, contributionId, validatorId, status, confidence, notes,
    validationCriteria, timeSpent, isActive, created_at, updated_at
  };
};

// Static method to get validations with validator information
Validation.getWithValidator = async function(whereClause = {}) {
  const User = require('./user.model');
  
  return await Validation.findAll({
    where: whereClause,
    include: [{
      model: User,
      as: 'validator',
      attributes: ['id', 'username', 'fullName']
    }],
    order: [['created_at', 'DESC']]
  });
};

// Static method to get validation summary for a contribution
Validation.getSummaryForContribution = async function(contributionId) {
  const validations = await Validation.findAll({
    where: { 
      contributionId,
      isActive: true 
    },
    include: [{
      model: require('./user.model'),
      as: 'validator',
      attributes: ['id', 'username', 'fullName']
    }]
  });
  
  const summary = {
    totalValidations: validations.length,
    approved: validations.filter(v => v.status === 'approved').length,
    rejected: validations.filter(v => v.status === 'rejected').length,
    needsReview: validations.filter(v => v.status === 'needs_review').length,
    averageConfidence: 0,
    validations: validations.map(v => v.toSafeObject())
  };
  
  if (validations.length > 0) {
    const confidenceSum = validations
      .filter(v => v.confidence !== null)
      .reduce((sum, v) => sum + parseFloat(v.confidence || 0), 0);
    const confidenceCount = validations.filter(v => v.confidence !== null).length;
    
    summary.averageConfidence = confidenceCount > 0 ? 
      Math.round((confidenceSum / confidenceCount) * 100) / 100 : 0;
  }
  
  return summary;
};

module.exports = Validation;