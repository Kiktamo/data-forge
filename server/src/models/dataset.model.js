const { DataTypes } = require('sequelize');
const Temporal = require('sequelize-temporal');
const sequelize = require('../config/database');

// Add temporal functionality for automatic versioning
const Dataset = Temporal(sequelize.define('Dataset', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'owner_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  visibility: {
    type: DataTypes.ENUM('public', 'private', 'collaborative'),
    defaultValue: 'private',
    validate: {
      isIn: [['public', 'private', 'collaborative']]
    }
  },
  dataType: {
    type: DataTypes.ENUM('image', 'text', 'structured'),
    allowNull: false,
    field: 'data_type',
    validate: {
      isIn: [['image', 'text', 'structured']]
    }
  },
  currentVersion: {
    type: DataTypes.STRING(20),
    defaultValue: '1.0.0',
    field: 'current_version',
    validate: {
      len: [1, 20]
    }
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  contributionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'contribution_count'
  },
  validationCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'validation_count'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'datasets',
  freezeTableName: true,
  underscored: true
}), sequelize, {
  // Enable full history tracking (saves all states, not just changes)
  full: true,
  // Skip history if update is silent (for performance)
  skipIfSilent: false
});

// Instance method to generate safe dataset object
Dataset.prototype.toSafeObject = function() {
  const {
    id, name, description, ownerId, visibility, dataType,
    currentVersion, tags, contributionCount, validationCount,
    isActive, created_at, updated_at
  } = this;
  
  // Include owner information if it exists
  const ownerData = this.owner ? {
    id: this.owner.id,
    username: this.owner.username,
    fullName: this.owner.fullName
  } : null;
  
  return {
    id, name, description, ownerId, visibility, dataType,
    currentVersion, tags, contributionCount, validationCount,
    isActive, 
    createdAt: created_at,
    updatedAt: updated_at,
    created_at, 
    updated_at,
    owner: ownerData
  };
};

// Static method to get datasets with owner information
Dataset.getWithOwner = async function(whereClause = {}) {
  const User = require('./user.model');
  
  return await Dataset.findAll({
    where: whereClause,
    include: [{
      model: User,
      as: 'owner',
      attributes: ['id', 'username', 'fullName']
    }],
    order: [['updated_at', 'DESC']]
  });
};

module.exports = Dataset;