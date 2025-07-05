const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ContributionEmbedding = sequelize.define('ContributionEmbedding', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contributionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'contribution_id',
    references: {
      model: 'contributions',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  embedding: {
    //FIXED: Use proper vector type definition for Sequelize
    type: 'vector(384)', // Direct SQL type since Sequelize doesn't have native vector support
    allowNull: true
  },
  contentExcerpt: {
    type: DataTypes.TEXT,
    field: 'content_excerpt',
    allowNull: true
  },
  extractedAt: {
    type: DataTypes.DATE,
    field: 'extracted_at',
    defaultValue: DataTypes.NOW
  },
  embeddingModel: {
    type: DataTypes.STRING(100),
    field: 'embedding_model',
    defaultValue: 'all-MiniLM-L6-v2'
  }
}, {
  tableName: 'contribution_embeddings',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['contribution_id']
    }
  ]
});

//FIXED: Update the findSimilar method to handle the vector type properly
ContributionEmbedding.findSimilar = async function(targetEmbedding, options = {}) {
  const {
    limit = 10,
    threshold = 0.7,
    excludeContributionId = null,
    datasetId = null
  } = options;

  // Convert embedding array to PostgreSQL vector format
  const vectorStr = `[${targetEmbedding.join(',')}]`;
  
  let whereClause = '';
  const replacements = { vectorStr, limit, threshold };
  
  if (excludeContributionId) {
    whereClause += ' AND ce.contribution_id != :excludeContributionId';
    replacements.excludeContributionId = excludeContributionId;
  }
  
  if (datasetId) {
    whereClause += ' AND c.dataset_id = :datasetId';
    replacements.datasetId = datasetId;
  }

  const query = `
    SELECT 
      ce.*,
      c.dataset_id,
      c.data_type,
      c.validation_status,
      c.created_at as contribution_created_at,
      (ce.embedding <=> :vectorStr::vector) as distance,
      (1 - (ce.embedding <=> :vectorStr::vector)) as similarity
    FROM contribution_embeddings ce
    JOIN contributions c ON ce.contribution_id = c.id
    WHERE c.is_active = true 
      AND ce.embedding IS NOT NULL
      AND (1 - (ce.embedding <=> :vectorStr::vector)) >= :threshold
      ${whereClause}
    ORDER BY ce.embedding <=> :vectorStr::vector
    LIMIT :limit
  `;

  try {
    const results = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  } catch (error) {
    console.error('Error in vector similarity search:', error);
    console.error('Query:', query);
    console.error('Replacements:', replacements);
    throw error;
  }
};

module.exports = ContributionEmbedding;