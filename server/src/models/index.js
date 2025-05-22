const User = require('./user.model');
const Dataset = require('./dataset.model');

// Define associations
User.hasMany(Dataset, {
  foreignKey: 'ownerId',
  as: 'datasets',
  onDelete: 'CASCADE'
});

Dataset.belongsTo(User, {
  foreignKey: 'ownerId',
  as: 'owner',
  onDelete: 'CASCADE'
});

// Also set up association for the history table
if (Dataset.HistoryModel) {
  Dataset.HistoryModel.belongsTo(User, {
    foreignKey: 'ownerId',
    as: 'owner',
    onDelete: 'CASCADE'
  });
}

// Export models
module.exports = {
  User,
  Dataset
};