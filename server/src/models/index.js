const sequelize = require('../config/database');

// Import models
const User = require('./user.model');
const Dataset = require('./dataset.model');
const Contribution = require('./contribution.model');
const Validation = require('./validation.model');

// Define associations

// User associations
User.hasMany(Dataset, {
  foreignKey: 'ownerId',
  as: 'ownedDatasets'
});

User.hasMany(Contribution, {
  foreignKey: 'contributorId',
  as: 'contributions'
});

User.hasMany(Validation, {
  foreignKey: 'validatorId',
  as: 'validations'
});

// Dataset associations
Dataset.belongsTo(User, {
  foreignKey: 'ownerId',
  as: 'owner'
});

Dataset.hasMany(Contribution, {
  foreignKey: 'datasetId',
  as: 'contributions'
});

// Contribution associations
Contribution.belongsTo(User, {
  foreignKey: 'contributorId',
  as: 'contributor'
});

Contribution.belongsTo(Dataset, {
  foreignKey: 'datasetId',
  as: 'dataset'
});

Contribution.hasMany(Validation, {
  foreignKey: 'contributionId',
  as: 'validations'
});

// Validation associations
Validation.belongsTo(User, {
  foreignKey: 'validatorId',
  as: 'validator'
});

Validation.belongsTo(Contribution, {
  foreignKey: 'contributionId',
  as: 'contribution'
});

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  Dataset,
  Contribution,
  Validation
};

// Also export individual models for backward compatibility
module.exports.User = User;
module.exports.Dataset = Dataset;
module.exports.Contribution = Contribution;
module.exports.Validation = Validation;