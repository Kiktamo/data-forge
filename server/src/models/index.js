const sequelize = require('../config/database');

// Import models
const User = require('./user.model');
const Dataset = require('./dataset.model');
const Contribution = require('./contribution.model');
const Validation = require('./validation.model');
const ContributionEmbedding = require('./embedding.model');

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

Contribution.hasOne(ContributionEmbedding, {
  foreignKey: 'contributionId',
  as: 'embedding'
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

// ContributionEmbedding associations
ContributionEmbedding.belongsTo(Contribution, {
  foreignKey: 'contributionId',
  as: 'contribution'
});

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  Dataset,
  Contribution,
  Validation,
  ContributionEmbedding
};

// Also export individual models for backward compatibility
module.exports.User = User;
module.exports.Dataset = Dataset;
module.exports.Contribution = Contribution;
module.exports.Validation = Validation;
module.exports.ContributionEmbedding = ContributionEmbedding;