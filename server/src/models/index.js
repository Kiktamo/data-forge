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

// Handle temporal model associations
// The sequelize-temporal library creates a history model that we need to associate
try {
  // Get the history model created by sequelize-temporal
  const DatasetHistory = Dataset.sequelize.models.DatasetHistory;
  
  if (DatasetHistory) {
    // Associate the history model with User
    DatasetHistory.belongsTo(User, {
      foreignKey: 'ownerId',
      as: 'owner',
      onDelete: 'SET NULL' // Don't cascade delete history when user is deleted
    });
    
    // Also allow User to access history
    User.hasMany(DatasetHistory, {
      foreignKey: 'ownerId',
      as: 'datasetHistory'
    });
  }
} catch (error) {
  console.log('Note: DatasetHistory model not found for associations (temporal may not be initialized yet)');
}

// Export models
module.exports = {
  User,
  Dataset,
  // Export the history model if it exists
  DatasetHistory: Dataset.sequelize?.models?.DatasetHistory || null
};