const embeddingService = require('./embedding.service');
const ContributionEmbedding = require('../models/embedding.model');
const Contribution = require('../models/contribution.model');
const User = require('../models/user.model');

class DuplicateDetectionService {
  constructor() {
    this.similarityThreshold = 0.85; // High similarity threshold for duplicates
    this.warningThreshold = 0.75;    // Lower threshold for potential duplicates
  }

  // Main entry point: check for duplicates when a new contribution is created
  async checkForDuplicates(contribution) {
    try {
      console.log(`🔍 Checking for duplicates of contribution ${contribution.id}`);
      
      // Generate embedding for the new contribution
      const embeddingData = await embeddingService.generateContributionEmbedding(contribution);
      
      if (!embeddingData || !embeddingData.embedding) {
        console.warn(`❌ Could not generate embedding for contribution ${contribution.id}`);
        return { hasDuplicates: false, potentialDuplicates: [], embedding: null };
      }

      // Store the embedding
      await this.storeEmbedding(embeddingData);

      // Find similar contributions
      const similarContributions = await ContributionEmbedding.findSimilar(
        embeddingData.embedding,
        {
          limit: 20,
          threshold: this.warningThreshold,
          excludeContributionId: contribution.id,
          datasetId: contribution.datasetId // Only check within same dataset
        }
      );

      // Classify results
      const duplicates = similarContributions.filter(item => item.similarity >= this.similarityThreshold);
      const warnings = similarContributions.filter(item => 
        item.similarity >= this.warningThreshold && item.similarity < this.similarityThreshold
      );

      console.log(`📊 Found ${duplicates.length} potential duplicates, ${warnings.length} similar contributions`);

      return {
        hasDuplicates: duplicates.length > 0,
        hasWarnings: warnings.length > 0,
        duplicates: await this.enrichDuplicateResults(duplicates),
        warnings: await this.enrichDuplicateResults(warnings),
        embedding: embeddingData
      };

    } catch (error) {
      console.error('Error in duplicate detection:', error);
      return { hasDuplicates: false, potentialDuplicates: [], embedding: null };
    }
  }

  // Process existing contributions to build embedding database
  async processExistingContributions(datasetId = null) {
    try {
      const whereClause = { isActive: true };
      if (datasetId) whereClause.datasetId = datasetId;

      const contributions = await Contribution.findAll({
        where: whereClause,
        include: [{
          model: User,
          as: 'contributor',
          attributes: ['id', 'username', 'fullName']
        }],
        order: [['id', 'ASC']]
      });

      console.log(`🔄 Processing ${contributions.length} contributions for embeddings`);

      let processed = 0;
      let skipped = 0;
      
      for (const contribution of contributions) {
        try {
          // Check if embedding already exists
          const existingEmbedding = await ContributionEmbedding.findOne({
            where: { contributionId: contribution.id }
          });

          if (existingEmbedding) {
            skipped++;
            continue;
          }

          // Generate and store embedding
          const embeddingData = await embeddingService.generateContributionEmbedding(contribution);
          
          if (embeddingData && embeddingData.embedding) {
            await this.storeEmbedding(embeddingData);
            processed++;
            
            if (processed % 10 === 0) {
              console.log(`📈 Processed ${processed} embeddings...`);
            }
          } else {
            skipped++;
          }

        } catch (error) {
          console.error(`Error processing contribution ${contribution.id}:`, error);
          skipped++;
        }
      }

      console.log(`✅ Embedding processing complete: ${processed} processed, ${skipped} skipped`);
      return { processed, skipped, total: contributions.length };

    } catch (error) {
      console.error('Error processing existing contributions:', error);
      throw error;
    }
  }

  // Store embedding in database
async storeEmbedding(embeddingData) {
  try {
    // This ensures the vector is stored correctly for pgvector operations
    
    await ContributionEmbedding.sequelize.query(`
      INSERT INTO contribution_embeddings 
      (contribution_id, embedding, content_excerpt, extracted_at, embedding_model)
      VALUES (:contributionId, :embedding::vector, :contentExcerpt, :extractedAt, :embeddingModel)
      ON CONFLICT (contribution_id) 
      DO UPDATE SET
        embedding = :embedding::vector,
        content_excerpt = :contentExcerpt,
        extracted_at = :extractedAt,
        embedding_model = :embeddingModel
    `, {
      replacements: {
        contributionId: embeddingData.contributionId,
        embedding: `[${embeddingData.embedding.join(',')}]`, // Format as vector
        contentExcerpt: embeddingData.content,
        extractedAt: embeddingData.extractedAt,
        embeddingModel: embeddingData.embeddingModel || 'all-MiniLM-L6-v2'
      },
      type: ContributionEmbedding.sequelize.QueryTypes.INSERT
    });

    console.log(`💾 Stored vector embedding for contribution ${embeddingData.contributionId}`);

  } catch (error) {
    console.error(`Error storing embedding for contribution ${embeddingData.contributionId}:`, error);
    throw error;
  }
}

  // Enrich duplicate results with contribution details
  async enrichDuplicateResults(results) {
    const enriched = [];

    for (const result of results) {
      try {
        // Get full contribution details
        const contribution = await Contribution.findByPk(result.contribution_id, {
          include: [{
            model: User,
            as: 'contributor',
            attributes: ['id', 'username', 'fullName']
          }]
        });

        if (contribution) {
          enriched.push({
            contributionId: result.contribution_id,
            similarity: Math.round(result.similarity * 100) / 100, // Round to 2 decimals
            distance: Math.round(result.distance * 1000) / 1000,   // Round to 3 decimals
            contribution: contribution.toSafeObject(),
            contentExcerpt: result.content_excerpt,
            dataType: result.data_type,
            validationStatus: result.validation_status,
            createdAt: result.contribution_created_at
          });
        }

      } catch (error) {
        console.error(`Error enriching result for contribution ${result.contribution_id}:`, error);
      }
    }

    return enriched.sort((a, b) => b.similarity - a.similarity); // Sort by similarity descending
  }

  // Find all potential duplicates across a dataset
  async findDatasetDuplicates(datasetId, options = {}) {
    const {
      threshold = this.warningThreshold,
      includeValidated = false
    } = options;

    try {
      // Get all contributions with embeddings in the dataset
      const query = `
        SELECT 
          ce1.contribution_id as contribution_id_1,
          ce2.contribution_id as contribution_id_2,
          (1 - (ce1.embedding <=> ce2.embedding)) as similarity
        FROM contribution_embeddings ce1
        JOIN contribution_embeddings ce2 ON ce1.id < ce2.id
        JOIN contributions c1 ON ce1.contribution_id = c1.id
        JOIN contributions c2 ON ce2.contribution_id = c2.id
        WHERE c1.dataset_id = :datasetId 
          AND c2.dataset_id = :datasetId
          AND c1.is_active = true 
          AND c2.is_active = true
          AND (1 - (ce1.embedding <=> ce2.embedding)) >= :threshold
          ${includeValidated ? '' : "AND (c1.validation_status != 'approved' OR c2.validation_status != 'approved')"}
        ORDER BY similarity DESC
      `;

      const results = await ContributionEmbedding.sequelize.query(query, {
        replacements: { datasetId, threshold },
        type: ContributionEmbedding.sequelize.QueryTypes.SELECT
      });

      console.log(`🔍 Found ${results.length} potential duplicate pairs in dataset ${datasetId}`);

      return results;

    } catch (error) {
      console.error('Error finding dataset duplicates:', error);
      throw error;
    }
  }

  // Generate duplicate detection report
  async generateDuplicateReport(datasetId) {
    try {
      const duplicatePairs = await this.findDatasetDuplicates(datasetId, {
        threshold: this.warningThreshold,
        includeValidated: false
      });

      const highConfidence = duplicatePairs.filter(pair => pair.similarity >= this.similarityThreshold);
      const mediumConfidence = duplicatePairs.filter(pair => 
        pair.similarity >= this.warningThreshold && pair.similarity < this.similarityThreshold
      );

      // Get embedding coverage statistics
      const totalContributions = await Contribution.count({
        where: { datasetId, isActive: true }
      });

      const embeddedContributions = await ContributionEmbedding.count({
        include: [{
          model: Contribution,
          as: 'contribution',
          where: { datasetId, isActive: true }
        }]
      });

      return {
        datasetId,
        totalContributions,
        embeddedContributions,
        embeddingCoverage: totalContributions > 0 ? Math.round((embeddedContributions / totalContributions) * 100) : 0,
        duplicatePairs: {
          total: duplicatePairs.length,
          highConfidence: highConfidence.length,
          mediumConfidence: mediumConfidence.length
        },
        duplicateDetails: {
          highConfidence: highConfidence.slice(0, 10), // Top 10 high confidence
          mediumConfidence: mediumConfidence.slice(0, 10) // Top 10 medium confidence
        },
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Error generating duplicate report:', error);
      throw error;
    }
  }

  // Clean up orphaned embeddings
  async cleanupEmbeddings() {
    try {
      const result = await ContributionEmbedding.sequelize.query(`
        DELETE FROM contribution_embeddings
        WHERE contribution_id NOT IN (
          SELECT id FROM contributions WHERE is_active = true
        )
      `);

      console.log(`🧹 Cleaned up ${result[1]} orphaned embeddings`);
      return result[1];

    } catch (error) {
      console.error('Error cleaning up embeddings:', error);
      throw error;
    }
  }
}

module.exports = new DuplicateDetectionService();