const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Contribution = sequelize.define('Contribution', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  datasetId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'dataset_id',
    references: {
      model: 'datasets',
      key: 'id'
    }
  },
  contributorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'contributor_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  dataType: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'text',
    field: 'data_type',
    validate: {
      isIn: [['image', 'text', 'structured']]
    }
  },
  content: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Stores the actual contribution data - structure varies by data type'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata like file info, annotations, etc.'
  },
  validationStatus: {
    type: DataTypes.TEXT,
    defaultValue: 'pending',
    field: 'validation_status',
    validate: {
      isIn: [['pending', 'approved', 'rejected']]
    }
  },
  validatedBy: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    defaultValue: [],
    field: 'validated_by',
    comment: 'Array of user IDs who have validated this contribution'
  },
  validationNotes: {
    type: DataTypes.TEXT,
    field: 'validation_notes',
    comment: 'Notes from validators about the contribution'
  },
  qualityScore: {
    type: DataTypes.DECIMAL(3, 2),
    field: 'quality_score',
    validate: {
      min: 0.0,
      max: 1.0
    },
    comment: 'Automated quality score between 0 and 1'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'contributions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['dataset_id']
    },
    {
      fields: ['contributor_id']
    },
    {
      fields: ['validation_status']
    },
    {
      fields: ['data_type']
    },
    {
      fields: ['created_at']
    }
  ]
});

// Instance method to generate safe contribution object
Contribution.prototype.toSafeObject = function() {
  const {
    id, datasetId, contributorId, dataType, content, metadata,
    validationStatus, validatedBy, validationNotes, qualityScore,
    isActive, createdAt, updatedAt, created_at, updated_at
  } = this;
  
  // Include contributor information if it exists
  const contributorData = this.contributor ? {
    id: this.contributor.id,
    username: this.contributor.username,
    fullName: this.contributor.fullName
  } : null;
  
  // Include dataset information if it exists
  const datasetData = this.dataset ? {
    id: this.dataset.id,
    name: this.dataset.name,
    dataType: this.dataset.dataType,
    visibility: this.dataset.visibility
  } : null;
  
  let duplicateDetection = null;
  if (this.embedding) {
    duplicateDetection = {
      hasEmbedding: true,
      contentExcerpt: this.embedding.contentExcerpt,
      extractedAt: this.embedding.extractedAt,
      embeddingModel: this.embedding.embeddingModel
    };
  } else if (this.duplicateDetection) {
    duplicateDetection = this.duplicateDetection;
  }
  
  const baseObject = {
    id, datasetId, contributorId, dataType, content, metadata,
    validationStatus, validatedBy, validationNotes, qualityScore,
    isActive, createdAt, updatedAt, created_at, updated_at,
    contributor: contributorData,
    dataset: datasetData
  };
  
  if (duplicateDetection) {
    baseObject.duplicateDetection = duplicateDetection;
  }
  
  return baseObject;
};

// Static method to get contributions with contributor information
Contribution.getWithContributor = async function(whereClause = {}) {
  const User = require('./user.model');
  
  return await Contribution.findAll({
    where: whereClause,
    include: [{
      model: User,
      as: 'contributor',
      attributes: ['id', 'username', 'fullName']
    }],
    order: [['created_at', 'DESC']]
  });
};

// Static method to get contributions for a dataset
Contribution.getForDataset = async function(datasetId, options = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    contributorId,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = options;
  
  const whereClause = { 
    datasetId,
    isActive: true 
  };
  
  if (status) {
    whereClause.validationStatus = status;
  }
  
  if (contributorId) {
    whereClause.contributorId = contributorId;
  }
  
  const offset = (page - 1) * limit;
  
  return await Contribution.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: require('./user.model'),
        as: 'contributor',
        attributes: ['id', 'username', 'fullName']
      },
      {
        model: require('./dataset.model'),
        as: 'dataset',
        attributes: ['id', 'name', 'dataType', 'visibility']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    distinct: true
  });
};

module.exports = Contribution;